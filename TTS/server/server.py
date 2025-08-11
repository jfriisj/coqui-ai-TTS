#!python3

"""TTS demo server with FastAPI and automatic OpenAPI documentation."""

import argparse
import io
import json
import logging
import os
import sys
import warnings
import time
import tempfile
import uuid
import queue
import threading
import atexit
from datetime import datetime
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs
from typing import Optional, Dict, Any, List, Union

import torch
import torchaudio
import psutil

try:
    from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Header, Request, status
    from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
    import uvicorn
except ImportError as e:
    msg = "Server requires FastAPI and uvicorn, use `pip install fastapi uvicorn`"
    raise ImportError(msg) from e

from TTS.api import TTS
from TTS.utils.generic_utils import ConsoleFormatter, setup_logger
from TTS.utils.manage import ModelManager
from TTS.server.model_state import GlobalModelState, get_global_model_state
from TTS.server.model_cache import ModelCacheManager
from TTS.server.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
setup_logger("TTS", level=logging.INFO, stream=sys.stdout, formatter=ConsoleFormatter())


# Pydantic models for API documentation
class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=1000)
    speaker: Optional[str] = Field(None, description="Speaker ID or speaker wav file path for voice cloning")
    language: Optional[str] = Field(None, description="Language ID for multilingual models")
    speaker_id: Optional[str] = Field(None, description="Alias for speaker")
    language_id: Optional[str] = Field(None, description="Alias for language")
    format: str = Field("wav", description="Output audio format", pattern="^(wav|mp3|opus|aac|flac|pcm)$")


class OpenAITTSRequest(BaseModel):
    model: str = Field("tts-1", description="Model to use (ignored, uses currently loaded model)")
    voice: str = Field(..., description="Voice ID or file path for voice cloning")
    input: str = Field(..., description="Text to synthesize", min_length=1)
    response_format: str = Field("wav", description="Audio format", pattern="^(wav|mp3|opus|aac|flac|pcm)$")
    speed: float = Field(1.0, description="Speed of speech", ge=0.25, le=4.0)


class ModelLoadRequest(BaseModel):
    model_id: str = Field(..., description="Name of the model to load")
    force_reload: bool = Field(False, description="Force reload even if model is already loaded")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall health status")
    model_loaded: bool = Field(..., description="Whether a TTS model is currently loaded")
    components: Dict[str, Any] = Field(..., description="Status of individual components")
    cache: Optional[Dict[str, Any]] = Field(None, description="Cache statistics")
    model_name: Optional[str] = Field(None, description="Currently loaded model name")
    model_capabilities: Optional[Dict[str, Any]] = Field(None, description="Model capabilities")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    suggestions: Optional[List[str]] = Field(None, description="Suggestions to resolve the error")


def create_argparser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--list_models",
        action="store_true",
        help="list available pre-trained tts and vocoder models.",
    )
    parser.add_argument(
        "--model_name",
        type=str,
        default="tts_models/multilingual/multi-dataset/xtts_v2",
        help="Name of one of the pre-trained tts models in format <language>/<dataset>/<model_name>",
    )
    parser.add_argument("--vocoder_name", type=str, default=None, help="Name of one of the released vocoder models.")
    parser.add_argument("--speaker_idx", type=str, default=None, help="Default speaker ID for multi-speaker models.")

    # Args for running custom models
    parser.add_argument("--config_path", default=None, type=str, help="Path to model config file.")
    parser.add_argument(
        "--model_path",
        type=str,
        default=None,
        help="Path to model file.",
    )
    parser.add_argument(
        "--vocoder_path",
        type=str,
        help="Path to vocoder model file. If it is not defined, model uses GL as vocoder. Please make sure that you installed vocoder library before (WaveRNN).",
        default=None,
    )
    parser.add_argument("--vocoder_config_path", type=str, help="Path to vocoder model config file.", default=None)
    parser.add_argument("--speakers_file_path", type=str, help="JSON file for multi-speaker model.", default=None)
    parser.add_argument("--port", type=int, default=5002, help="port to listen on.")
    parser.add_argument("--device", type=str, help="Device to run model on.", default="cpu")
    parser.add_argument("--use_cuda", action=argparse.BooleanOptionalAction, default=False, help="true to use CUDA.")
    parser.add_argument(
        "--debug", action=argparse.BooleanOptionalAction, default=False, help="true to enable Flask debug mode."
    )
    parser.add_argument(
        "--show_details", action=argparse.BooleanOptionalAction, default=False, help="Generate model detail page."
    )
    parser.add_argument("--language_idx", type=str, help="Default language ID for multilingual models.", default="en")
    return parser


# parse the args
args = create_argparser().parse_args()

manager = ModelManager(models_file=TTS.get_models_file_path())

# Cache configuration from environment variables
cache_max_memory = int(os.getenv('TTS_CACHE_MAX_MEMORY_MB', '4096'))
cache_max_entries = int(os.getenv('TTS_CACHE_MAX_ENTRIES', '10'))
cache_cleanup_threshold = float(os.getenv('TTS_CACHE_CLEANUP_THRESHOLD', '0.8'))
cache_dir = os.getenv('TTS_CACHE_DIR')  # None = use default

# Initialize global model state and cache manager with configuration
global_model_state = get_global_model_state()
model_cache = ModelCacheManager(
    cache_dir=cache_dir,
    max_memory_mb=cache_max_memory,
    max_entries=cache_max_entries,
    cleanup_threshold=cache_cleanup_threshold
)

# Log cache configuration
logger.info(f"Cache configured: max_memory={cache_max_memory}MB, max_entries={cache_max_entries}, threshold={cache_cleanup_threshold}")
logger.info(f"Cache directory: {model_cache.cache_dir}")

# Initialize model registry monitoring (requirement 8.2, 8.4, 8.5)
model_registry = ModelRegistry()

# Perform startup health checks and cache validation
def startup_health_checks():
    """Perform comprehensive startup health checks and cache validation."""
    logger.info("Performing startup health checks...")
    
    # Cache recovery and validation (requirement 3.4)
    try:
        logger.info("Validating model cache...")
        cache_stats = model_cache.get_cache_stats()
        logger.info(f"Cache validated: {cache_stats.total_entries} entries, {cache_stats.total_size // (1024*1024)}MB used")
        
        # Check for corrupted cache entries and recover
        corrupted_count = 0
        with model_cache._lock:
            corrupted_models = []
            for model_name, entry in model_cache._cache_entries.items():
                if entry.is_corrupted:
                    corrupted_models.append(model_name)
                    corrupted_count += 1
            
            # Remove corrupted entries (requirement 3.4)
            for model_name in corrupted_models:
                try:
                    model_cache.remove_from_cache(model_name)
                    logger.info(f"Removed corrupted cache entry: {model_name}")
                except Exception as e:
                    logger.warning(f"Failed to remove corrupted entry {model_name}: {e}")
        
        if corrupted_count > 0:
            logger.info(f"Cache recovery complete: removed {corrupted_count} corrupted entries")
        else:
            logger.info("Cache validation complete: no corrupted entries found")
            
    except Exception as e:
        logger.error(f"Cache validation failed: {e}")
    
    # Model registry health check (requirement 8.5)
    try:
        logger.info("Checking model registry availability...")
        registry_stats = model_registry.get_registry_stats()
        
        if registry_stats.models_count > 0:
            logger.info(f"Model registry available: {registry_stats.models_count} models")
            # Start registry monitoring for automatic updates
            model_registry.start_monitoring()
            logger.info("Model registry monitoring started")
        else:
            logger.warning("Model registry is empty or unavailable, continuing with cached information")
            
    except Exception as e:
        logger.warning(f"Model registry check failed: {e} - continuing with cached information")
    
    # Model management component health
    try:
        logger.info("Checking model management components...")
        
        # Check GlobalModelState
        if global_model_state:
            logger.info("GlobalModelState: healthy")
        else:
            logger.error("GlobalModelState: not initialized")
        
        # Check system resources
        import psutil
        memory = psutil.virtual_memory()
        available_gb = memory.available / (1024**3)
        logger.info(f"System memory: {available_gb:.1f}GB available ({100-memory.percent:.1f}% free)")
        
        if available_gb < 1.0:
            logger.warning("Low system memory detected - model loading may be slower")
        
        logger.info("Startup health checks completed successfully")
        
    except Exception as e:
        logger.error(f"Component health check failed: {e}")

# update in-use models to the specified released models.
model_path = None
config_path = None
speakers_file_path = None
vocoder_path = None
vocoder_config_path = None

# CASE1: list pre-trained TTS models
if args.list_models:
    manager.list_models()
    sys.exit(0)

device = args.device
if args.use_cuda:
    warnings.warn("`--use_cuda` is deprecated, use `--device cuda` instead.", DeprecationWarning, stacklevel=2)

# CASE2: load models via GlobalModelState system
model_name = args.model_name if args.model_path is None else None

# TODO: set this from SpeakerManager
use_gst = False  # Will be set after model loads

# Create FastAPI app with automatic OpenAPI documentation
app = FastAPI(
    title="Coqui TTS Server",
    description="Text-to-Speech server with voice cloning, multi-speaker, and multi-lingual support",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc documentation
    openapi_url="/openapi.json"
)

# Add CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for frontend
if os.path.exists("static/frontend"):
    app.mount("/static", StaticFiles(directory="static/frontend"), name="static")

@app.on_event("startup")
async def startup_event():
    """Load TTS model on server startup"""
    global use_gst
    
    logger.info("Loading TTS model on startup...")
    
    # Perform startup health checks first
    startup_health_checks()
    
    # Load initial model through GlobalModelState for consistency
    success = await global_model_state.load_model_async(
        model_name=model_name,
        model_path=args.model_path,
        config_path=args.config_path,
        vocoder_name=args.vocoder_name,
        vocoder_path=args.vocoder_path,
        vocoder_config_path=args.vocoder_config_path,
        device=device,
        progress_bar=True,
    )

    if not success:
        logger.error("Failed to load initial model %s", model_name or args.model_path or "default")
        raise RuntimeError("Failed to load initial model")

    # Get the loaded model for backward compatibility with use_gst
    api = global_model_state.current_model.tts_instance if global_model_state.current_model else None
    if api is None:
        logger.error("No model loaded after initialization")
        raise RuntimeError("No model loaded after initialization")

    # Set use_gst from loaded model
    use_gst = api.synthesizer.tts_config.get("use_gst", False)
    logger.info("Model loaded successfully, use_gst: %s", use_gst)

# Note: api is kept for backward compatibility with startup templates and use_gst
# All synthesis endpoints now use global_model_state.current_model.tts_instance

# Error handling helper for API endpoints
def handle_api_error(error_msg: str, status_code: int = 500) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": error_msg})


def style_wav_uri_to_dict(style_wav: str) -> str | dict:
    """Transform an uri style_wav, in either a string (path to wav file to be use for style transfer)
    or a dict (gst tokens/values to be use for styling)

    Args:
        style_wav (str): uri

    Returns:
        Union[str, dict]: path to file (str) or gst style (dict)
    """
    if style_wav:
        if os.path.isfile(style_wav) and style_wav.endswith(".wav"):
            return style_wav  # style_wav is a .wav file located on the server

        style_wav = json.loads(style_wav)
        return style_wav  # style_wav is a gst dictionary with {token1_id : token1_weigth, ...}
    return None


@app.get("/", include_in_schema=False)
async def index():
    """Serve the React frontend index.html or API info"""
    static_dir = "static/frontend"
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        # Return API information instead of 404
        return {
            "message": "Coqui TTS Server API",
            "version": "1.0.0",
            "description": "Text-to-Speech server with voice cloning, multi-speaker, and multi-lingual support",
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "openapi_url": "/openapi.json",
            "endpoints": {
                "health": "/api/v1/health",
                "models": "/api/v1/models",
                "tts": "/api/tts",
                "openai_compatible": "/v1/audio/speech"
            }
        }


@app.get("/legacy", include_in_schema=False)
async def legacy():
    """Legacy template interface for backwards compatibility"""
    current_model = global_model_state.current_model
    
    # Default values if no model is loaded
    use_multi_speaker = False
    use_multi_language = False
    speaker_ids = []
    language_ids = []
    supports_cloning = False
    
    # Update with actual model capabilities if available
    if current_model and current_model.tts_instance:
        use_multi_speaker = current_model.is_multi_speaker
        use_multi_language = current_model.is_multi_lingual
        speaker_ids = current_model.speakers or []
        language_ids = current_model.languages or []
        
        # Check if voice cloning is supported
        if (hasattr(current_model.tts_instance, 'synthesizer') and
            hasattr(current_model.tts_instance.synthesizer, 'tts_config') and
            hasattr(current_model.tts_instance.synthesizer.tts_config, 'supports_cloning')):
            supports_cloning = current_model.tts_instance.synthesizer.tts_config.supports_cloning
    
    return JSONResponse({
        "show_details": args.show_details,
        "use_multi_speaker": use_multi_speaker,
        "use_multi_language": use_multi_language,
        "speaker_ids": speaker_ids,
        "language_ids": language_ids,
        "use_gst": use_gst,
        "supports_cloning": supports_cloning,
    })


@app.get("/details", include_in_schema=False)
async def details():
    """Get model details for debugging"""
    current_model = global_model_state.current_model
    
    model_config = None
    vocoder_config = None
    
    if (current_model and current_model.tts_instance and 
        hasattr(current_model.tts_instance, 'synthesizer')):
        model_config = current_model.tts_instance.synthesizer.tts_config
        vocoder_config = current_model.tts_instance.synthesizer.vocoder_config or None

    return JSONResponse({
        "show_details": args.show_details,
        "model_config": model_config,
        "vocoder_config": vocoder_config,
        "args": args.__dict__,
    })


lock = Lock()


@app.api_route("/api/tts", methods=["GET", "POST"], 
               summary="Text-to-Speech Synthesis", 
               description="Convert text to speech using the currently loaded TTS model",
               operation_id="tts_synthesis")
async def tts(
    request: Request,
    text: Optional[str] = Query(None, description="Text to synthesize"),
    speaker_id: Optional[str] = Query(None, description="Speaker ID for multi-speaker models"),
    language_id: Optional[str] = Query(None, description="Language ID for multilingual models"),
    style_wav: Optional[str] = Query(None, description="Style wav file or GST tokens"),
    speaker_wav: Optional[str] = Query(None, description="Speaker wav file for voice cloning"),
    speaker_header: Optional[str] = Header(None, alias="speaker-id"),
    language_header: Optional[str] = Header(None, alias="language-id"),
    text_header: Optional[str] = Header(None, alias="text"),
    style_wav_header: Optional[str] = Header(None, alias="style-wav"),
    speaker_wav_header: Optional[str] = Header(None, alias="speaker-wav")
):
    # Check if model is loaded
    current_model = global_model_state.current_model
    if not current_model or not current_model.tts_instance:
        raise HTTPException(status_code=503, detail={"error": "No TTS model is currently loaded"})
    
    # Create synthesis ID for tracking
    synthesis_id = str(uuid.uuid4())[:8]
    
    try:
        # Register synthesis operation
        global_model_state.register_synthesis(synthesis_id)
        
        with lock:
            # Get parameters from headers or query params (headers take precedence)
            text = text_header or text or ""
            speaker_idx = (
                speaker_header or speaker_id or args.speaker_idx
                if current_model.is_multi_speaker
                else None
            )
            # Handle empty speaker_id for voice cloning scenarios
            if speaker_idx == "":
                speaker_idx = None
            language_idx = (
                language_header or language_id or args.language_idx
                if current_model.is_multi_lingual
                else None
            )
            # Handle empty language_id
            if language_idx == "":
                language_idx = None
            style_wav = style_wav_uri_to_dict(style_wav_header or style_wav or "")
            speaker_wav = speaker_wav_header or speaker_wav or ""

            # Basic validation
            if not text.strip():
                raise HTTPException(status_code=400, detail={"error": "Text parameter is required"})

            logger.info("Model input: %s", text)
            logger.info("Speaker idx: %s", speaker_idx)
            logger.info("Speaker wav: %s", speaker_wav)
            logger.info("Language idx: %s", language_idx)
            logger.info("Using model: %s (synthesis_id: %s)", current_model.model_name, synthesis_id)

            # Build TTS parameters based on model capabilities
            tts_kwargs = {}
            
            # Only add speaker if model supports multiple speakers and speaker is provided
            if current_model.is_multi_speaker and speaker_idx:
                tts_kwargs["speaker"] = speaker_idx
            
            # Only add language if model supports multiple languages and language is provided  
            if current_model.is_multi_lingual and language_idx:
                tts_kwargs["language"] = language_idx
                
            # Add style_wav if provided and not empty
            if style_wav:
                tts_kwargs["style_wav"] = style_wav
                
            # Add speaker_wav if provided and not empty
            if speaker_wav:
                tts_kwargs["speaker_wav"] = speaker_wav

            try:
                wavs = current_model.tts_instance.tts(text, **tts_kwargs)
            except Exception as e:
                logger.error("TTS synthesis failed: %s", str(e))
                raise HTTPException(status_code=500, detail={"error": f"TTS synthesis failed: {str(e)}"})

            out = io.BytesIO()
            current_model.tts_instance.synthesizer.save_wav(wavs, out)
            out.seek(0)
            
        return StreamingResponse(out, media_type="audio/wav")
        
    finally:
        # Always unregister synthesis operation
        global_model_state.unregister_synthesis(synthesis_id)


# Basic MaryTTS compatibility layer

@app.get("/locales", 
         summary="MaryTTS Compatible Locales", 
         description="MaryTTS-compatible /locales endpoint")
async def mary_tts_api_locales():
    """MaryTTS-compatible /locales endpoint"""
    # NOTE: We currently assume there is only one model active at the same time
    if args.model_name is not None:
        model_details = args.model_name.split("/")
    else:
        model_details = ["", "en", "", "default"]
    return f"{model_details[1]}\n"


@app.get("/voices", 
         summary="MaryTTS Compatible Voices", 
         description="MaryTTS-compatible /voices endpoint")
async def mary_tts_api_voices():
    """MaryTTS-compatible /voices endpoint"""
    current_model = global_model_state.current_model
    
    # Use current model info or fallback to args
    if current_model:
        model_details = current_model.model_name.split("/")
        is_multi_speaker = current_model.is_multi_speaker
        speakers = current_model.speakers or []
    else:
        # Fallback to args if available
        if args.model_name is not None:
            model_details = args.model_name.split("/")
        else:
            model_details = ["", "en", "", "default"]
        is_multi_speaker = False
        speakers = []
    
    # Ensure we have enough parts in model_details
    while len(model_details) < 4:
        model_details.append("default")
    
    if is_multi_speaker and speakers:
        voices = []
        for speaker in speakers:
            voices.append(f"{speaker} {model_details[1]} u")
        return "\n".join(voices) + "\n"
    return f"{model_details[3]} {model_details[1]} u\n"


@app.api_route("/process", methods=["GET", "POST"], 
               summary="MaryTTS Compatible Process", 
               description="MaryTTS-compatible /process endpoint",
               operation_id="mary_tts_process")
async def mary_tts_api_process(
    request: Request,
    INPUT_TEXT: Optional[str] = Query(None, description="Text to synthesize"),
    VOICE: Optional[str] = Query(None, description="Voice/speaker ID"),
    LOCALE: Optional[str] = Query(None, description="Language locale (ignored)")
):
    """MaryTTS-compatible /process endpoint"""
    # Check if model is loaded
    current_model = global_model_state.current_model
    if not current_model or not current_model.tts_instance:
        raise HTTPException(status_code=503, detail={"error": "No TTS model is currently loaded"})
    
    # Create synthesis ID for tracking
    synthesis_id = str(uuid.uuid4())[:8]
    
    try:
        # Register synthesis operation
        global_model_state.register_synthesis(synthesis_id)
        
        with lock:
            if request.method == "POST":
                # Handle form data for POST requests
                form_data = await request.form()
                speaker_idx = form_data.get("VOICE", args.speaker_idx)
                text = form_data.get("INPUT_TEXT", "")
            else:
                text = INPUT_TEXT or ""
                speaker_idx = VOICE or args.speaker_idx

            logger.info("Model input: %s", text)
            logger.info("Speaker idx: %s", speaker_idx)
            logger.info("Using model: %s (synthesis_id: %s)", current_model.model_name, synthesis_id)
            
            wavs = current_model.tts_instance.tts(text, speaker=speaker_idx)
            out = io.BytesIO()
            current_model.tts_instance.synthesizer.save_wav(wavs, out)
            out.seek(0)
            
        return StreamingResponse(out, media_type="audio/wav")
        
    finally:
        # Always unregister synthesis operation
        global_model_state.unregister_synthesis(synthesis_id)


# OpenAI-compatible Speech API
@app.post("/v1/audio/speech", 
          summary="OpenAI Compatible Speech API", 
          description="OpenAI-compatible text-to-speech endpoint")
async def openai_tts(request_data: OpenAITTSRequest):
    """
    POST /v1/audio/speech
    OpenAI-compatible text-to-speech endpoint
    """
    # Check if model is loaded
    current_model = global_model_state.current_model
    if not current_model or not current_model.tts_instance:
        raise HTTPException(status_code=503, detail={"error": "No TTS model is currently loaded"})
    
    # Create synthesis ID for tracking
    synthesis_id = str(uuid.uuid4())[:8]
    
    try:
        # Register synthesis operation
        global_model_state.register_synthesis(synthesis_id)
        
        logger.info(request_data.dict())
        text = request_data.input
        speaker_idx = request_data.voice if current_model.is_multi_speaker else None
        fmt = request_data.response_format.lower()
        speed = request_data.speed
        language_idx = args.language_idx if current_model.is_multi_lingual else None

        speaker_wav = None
        if speaker_idx is not None:
            voice_path = Path(speaker_idx)
            # Check if voice cloning is supported
            supports_cloning = (
                hasattr(current_model.tts_instance, 'synthesizer') and
                hasattr(current_model.tts_instance.synthesizer, 'tts_config') and
                hasattr(current_model.tts_instance.synthesizer.tts_config, 'supports_cloning') and
                current_model.tts_instance.synthesizer.tts_config.supports_cloning
            )
            if voice_path.exists() and supports_cloning:
                speaker_wav = str(voice_path) if voice_path.is_file() else [str(w) for w in voice_path.glob("*.wav")]
                speaker_idx = None

        def _save_audio(waveform, sample_rate, format_args):
            buf = io.BytesIO()
            torchaudio.save(buf, waveform, sample_rate, **format_args)
            buf.seek(0)
            return buf

        def _save_pcm(waveform):
            """Raw PCM (16-bit little-endian)."""
            waveform_int16 = (waveform * 32767).to(torch.int16)
            buf = io.BytesIO()
            buf.write(waveform_int16.numpy().tobytes())
            buf.seek(0)
            return buf

        with lock:
            logger.info("Model input: %s", text)
            logger.info("Speaker idx: %s", speaker_idx)
            logger.info("Speaker wav: %s", speaker_wav)
            logger.info("Language idx: %s", language_idx)
            logger.info("Using model: %s (synthesis_id: %s)", current_model.model_name, synthesis_id)

            wavs = current_model.tts_instance.tts(text, speaker=speaker_idx, language=language_idx, speaker_wav=speaker_wav, speed=speed)
            out = io.BytesIO()
            current_model.tts_instance.synthesizer.save_wav(wavs, out)
            out.seek(0)
            waveform, sample_rate = torchaudio.load(out)

            mimetypes = {
                "wav": "audio/wav",
                "mp3": "audio/mpeg",
                "opus": "audio/ogg",
                "aac": "audio/aac",
                "flac": "audio/flac",
                "pcm": "audio/L16",
            }

            mimetype = mimetypes.get(fmt, "audio/mpeg")
            if fmt == "wav":
                out.seek(0)
                return StreamingResponse(out, media_type=mimetype)

            format_dispatch = {
                "mp3": lambda: _save_audio(waveform, sample_rate, {"format": "mp3"}),
                "opus": lambda: _save_audio(waveform, sample_rate, {"format": "ogg", "encoding": "opus"}),
                "aac": lambda: _save_audio(waveform, sample_rate, {"format": "mp4", "encoding": "aac"}),  # m4a container
                "flac": lambda: _save_audio(waveform, sample_rate, {"format": "flac"}),
                "pcm": lambda: _save_pcm(waveform),
            }

            # Check if format is supported
            if fmt not in format_dispatch:
                raise HTTPException(status_code=400, detail={"error": f"Unsupported format: {fmt}"})

            # Generate and send file
            audio_buffer = format_dispatch[fmt]()
            return StreamingResponse(audio_buffer, media_type=mimetype)
            
    finally:
        # Always unregister synthesis operation
        global_model_state.unregister_synthesis(synthesis_id)


@app.get("/api/v1/models", 
         summary="List Available Models", 
         description="Get list of all available TTS models")
async def api_v1_models():
    try:
        models = TTS.list_models()
        return {"models": models}
    except Exception as e:
        logger.error("Error listing models: %s", str(e))
        raise HTTPException(status_code=500, detail={"error": f"Failed to list models: {str(e)}"})


@app.post("/api/v1/tts", 
          summary="TTS Synthesis", 
          description="Synthesize speech from text using the advanced API")
async def api_v1_tts(request_data: TTSRequest):
    # Check if model is loaded
    current_model = global_model_state.current_model
    if not current_model or not current_model.tts_instance:
        raise HTTPException(status_code=503, detail={"error": "No TTS model is currently loaded"})
    
    # Create synthesis ID for tracking
    synthesis_id = str(uuid.uuid4())[:8]
    
    try:
        # Register synthesis operation
        global_model_state.register_synthesis(synthesis_id)
        
        # Get parameters from request
        text = request_data.text
        speaker = request_data.speaker or request_data.speaker_id
        language = request_data.language or request_data.language_id
        fmt = request_data.format
        
        # Basic validation
        if not text.strip():
            raise HTTPException(status_code=400, detail={"error": "Text parameter is required"})
        if len(text) > 1000:
            raise HTTPException(status_code=400, detail={"error": "Text parameter exceeds maximum length (1000)"})
        
        # Filter parameters based on model capabilities
        tts_kwargs = {"text": text}
        
        # Only add speaker if model supports multiple speakers and speaker is provided
        if current_model.is_multi_speaker and speaker:
            tts_kwargs["speaker"] = speaker
        
        # Only add language if model supports multiple languages and language is provided
        if current_model.is_multi_lingual and language:
            tts_kwargs["language"] = language
        
        # TTS synthesis logic
        with lock:
            logger.info("Using model: %s (synthesis_id: %s)", current_model.model_name, synthesis_id)
            logger.info("TTS parameters: %s", {k: v for k, v in tts_kwargs.items() if k != "text"})
            try:
                wavs = current_model.tts_instance.tts(**tts_kwargs)
            except Exception as e:
                logger.error("TTS synthesis failed: %s", str(e))
                raise HTTPException(status_code=500, detail={"error": f"TTS synthesis failed: {str(e)}"})
        
        # Audio format handling based on requested format
        out_buf = io.BytesIO()
        current_model.tts_instance.synthesizer.save_wav(wavs, out_buf)
        out_buf.seek(0)
        waveform, sample_rate = torchaudio.load(out_buf)

        def _save_audio(waveform, sample_rate, format_args):
            buf = io.BytesIO()
            torchaudio.save(buf, waveform, sample_rate, **format_args)
            buf.seek(0)
            return buf

        def _save_pcm(waveform):
            waveform_int16 = (waveform * 32767).to(torch.int16)
            buf = io.BytesIO()
            buf.write(waveform_int16.numpy().tobytes())
            buf.seek(0)
            return buf

        mimetypes = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg",
            "opus": "audio/ogg",
            "aac": "audio/aac",
            "flac": "audio/flac",
            "pcm": "audio/L16",
        }
        mimetype = mimetypes.get(fmt, "audio/wav")
        if fmt == "wav":
            out_buf.seek(0)
            return StreamingResponse(out_buf, media_type=mimetype)

        format_dispatch = {
            "mp3": lambda: _save_audio(waveform, sample_rate, {"format": "mp3"}),
            "opus": lambda: _save_audio(waveform, sample_rate, {"format": "ogg", "encoding": "opus"}),
            "aac": lambda: _save_audio(waveform, sample_rate, {"format": "mp4", "encoding": "aac"}),
            "flac": lambda: _save_audio(waveform, sample_rate, {"format": "flac"}),
            "pcm": lambda: _save_pcm(waveform),
        }
        if fmt not in format_dispatch:
            raise HTTPException(status_code=400, detail={"error": f"Unsupported format: {fmt}"})
        
        audio_buffer = format_dispatch[fmt]()
        return StreamingResponse(audio_buffer, media_type=mimetype)
        
    finally:
        # Always unregister synthesis operation
        global_model_state.unregister_synthesis(synthesis_id)


@app.get("/api/v1/health", 
         response_model=HealthResponse,
         summary="Health Check", 
         description="Get comprehensive health status of the TTS server and its components")
async def api_v1_health():
    """Health check endpoint with comprehensive model management component status"""
    try:
        current_model = global_model_state.current_model
        model_loaded = current_model is not None and current_model.tts_instance is not None
        
        # Get cache statistics
        cache_stats = model_cache.get_cache_stats()
        
        # Get registry statistics
        registry_stats = model_registry.get_registry_stats()
        
        # Get system memory info
        import psutil
        memory = psutil.virtual_memory()
        
        health_info = {
            "status": "healthy",
            "model_loaded": model_loaded,
            "components": {
                "global_model_state": {
                    "status": "healthy" if global_model_state else "error",
                    "is_loading": global_model_state.is_loading if global_model_state else False,
                    "active_syntheses": global_model_state.has_active_synthesis if global_model_state else False
                },
                "model_cache": {
                    "status": "healthy",
                    "entries": cache_stats.total_entries,
                    "total_size_mb": round(cache_stats.total_size / (1024 * 1024), 1),
                    "hit_rate": round(cache_stats.hit_rate * 100, 1),
                    "eviction_count": cache_stats.eviction_count,
                    "corrupted_entries": sum(1 for entry in model_cache._cache_entries.values() if entry.is_corrupted)
                },
                "model_registry": {
                    "status": registry_stats.state.name.lower(),
                    "models_count": registry_stats.models_count,
                    "last_refresh": registry_stats.last_refresh,
                    "refresh_count": registry_stats.refresh_count,
                    "failure_count": registry_stats.failure_count,
                    "monitoring_active": registry_stats.state.name == "MONITORING"
                },
                "system_resources": {
                    "memory_available_gb": round(memory.available / (1024 * 1024 * 1024), 2),
                    "memory_usage_percent": round(memory.percent, 1),
                    "memory_warning": memory.percent > 90.0
                }
            },
            "cache": {
                "entries": cache_stats.total_entries,
                "total_size_mb": round(cache_stats.total_size / (1024 * 1024), 1),
                "hit_rate": round(cache_stats.hit_rate * 100, 1),
                "memory_usage_percent": round(cache_stats.memory_usage_percent, 1),
                "available_memory_gb": round(cache_stats.available_memory / (1024 * 1024 * 1024), 2)
            }
        }
        
        # Add model info if available
        if model_loaded:
            health_info.update({
                "model_name": current_model.model_name,
                "model_capabilities": {
                    "multi_speaker": current_model.is_multi_speaker,
                    "multi_lingual": current_model.is_multi_lingual,
                    "speakers_count": len(current_model.speakers) if current_model.speakers else 0,
                    "languages_count": len(current_model.languages) if current_model.languages else 0
                },
                "model_performance": {
                    "load_time": round(current_model.load_time, 2),
                    "memory_usage": int(current_model.memory_usage)
                }
            })
        
        # Determine overall health status
        overall_status = "healthy"
        
        # Check for critical issues
        if not global_model_state:
            overall_status = "error"
        elif registry_stats.state.name == "UNAVAILABLE" and cache_stats.total_entries == 0:
            overall_status = "degraded"  # Registry unavailable but no cached fallback
        elif memory.percent > 95.0:
            overall_status = "warning"  # Very high memory usage
        elif cache_stats.eviction_count > 10:  # Frequent evictions might indicate issues
            overall_status = "warning"
            
        health_info["status"] = overall_status
        
        # Set appropriate HTTP status code based on health
        if overall_status == "error":
            # For FastAPI, we need to raise an HTTPException for non-200 status codes
            raise HTTPException(status_code=503, detail=health_info)
        
        return health_info
        
    except Exception as e:
        logger.error("Health check failed: %s", str(e))
        return handle_api_error(f"Health check failed: {str(e)}", 500)


@app.post("/api/v1/voice-convert", 
          summary="Voice Conversion", 
          description="Convert voice characteristics from source to target audio")
async def api_v1_voice_convert(
    source_wav: UploadFile = File(..., description="Source audio file"),
    target_wav: UploadFile = File(..., description="Target audio file for voice characteristics")
):
    """Voice conversion endpoint"""
    # Check if model is loaded
    current_model = global_model_state.current_model
    if not current_model or not current_model.tts_instance:
        raise HTTPException(status_code=503, detail={"error": "No TTS model is currently loaded"})
    
    # Basic validation  
    if not source_wav.filename.endswith('.wav') or not target_wav.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail={"error": "Both source_wav and target_wav must be .wav files"})
    
    # Create synthesis ID for tracking
    import uuid
    synthesis_id = str(uuid.uuid4())[:8]
    
    import tempfile
    import os
    tmp_src = None
    tmp_tgt = None
    
    try:
        # Register synthesis operation
        global_model_state.register_synthesis(synthesis_id)
        
        with lock:
            # Save uploaded files to temporary paths
            tmp_src = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_src.close()
            source_wav_file.save(tmp_src.name)
            tmp_tgt = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_tgt.close()
            target_wav_file.save(tmp_tgt.name)
            
            logger.info("Voice conversion using model: %s (synthesis_id: %s)", current_model.model_name, synthesis_id)
            
            # Perform voice conversion
            wavs = current_model.tts_instance.voice_conversion(source_wav=tmp_src.name, target_wav=tmp_tgt.name)
            # Prepare output buffer
            out = io.BytesIO()
            current_model.tts_instance.synthesizer.save_wav(wavs, out)
            out.seek(0)
            
        return send_file(out, mimetype="audio/wav")
        
    except Exception as e:
        logger.error("Voice conversion failed: %s", str(e))
        return handle_api_error(f"Voice conversion failed: {str(e)}", 500)
    finally:
        # Always unregister synthesis operation
        global_model_state.unregister_synthesis(synthesis_id)
        
        # Clean up temporary files
        if tmp_src:
            try: os.unlink(tmp_src.name)
            except: pass
        if tmp_tgt:
            try: os.unlink(tmp_tgt.name)
            except: pass


# Model Management API Routes

@app.get("/api/v1/models/available", 
         summary="Get available models",
         description="Get a list of all available TTS models with metadata")
def api_v1_models_available(request: Request):
    """Get all available models with metadata and caching information."""
    try:
        # Get all models from manager
        models_list = manager.list_models()
        models_data = []
        
        for model_name in models_list:
            try:
                # Note: model_info_by_full_name only prints, doesn't return data
                
                # Extract model components from name
                name_parts = model_name.split('/')
                model_type = name_parts[0] if len(name_parts) > 0 else "unknown"
                language = name_parts[1] if len(name_parts) > 1 else "unknown"
                dataset = name_parts[2] if len(name_parts) > 2 else "unknown"
                architecture = name_parts[3] if len(name_parts) > 3 else "unknown"
                
                # Determine capabilities based on model type and name
                capabilities = {
                    "multiSpeaker": "multi" in model_name.lower() or "vctk" in model_name.lower() or "yourtts" in model_name.lower(),
                    "multiLingual": "multi" in model_name.lower() or "yourtts" in model_name.lower() or "bark" in model_name.lower(),
                    "voiceCloning": "xtts" in model_name.lower() or "yourtts" in model_name.lower(),
                    "styleTransfer": "gst" in model_name.lower() or "capacitron" in model_name.lower()
                }
                
                # Estimate performance characteristics
                performance = {
                    "quality": "high" if any(x in model_name.lower() for x in ["xtts", "vits", "yourtts"]) else "medium",
                    "speed": "fast" if "fast" in model_name.lower() else "medium",
                    "memoryUsage": model_cache.estimate_memory_usage(model_name) // (1024 * 1024)  # Convert to MB
                }
                
                # Check if model is cached
                cached = model_name in model_cache._cache_entries
                
                # Create display name
                display_name = f"{architecture.title()} - {dataset.upper()} ({language.upper()})"
                
                model_data = {
                    "name": model_name,
                    "displayName": display_name,
                    "type": architecture,
                    "language": language,
                    "dataset": dataset,
                    "architecture": architecture,
                    "capabilities": capabilities,
                    "performance": performance,
                    "cached": cached,
                    "estimatedLoadTime": 15 if cached else 30  # Rough estimates
                }
                
                models_data.append(model_data)
                
            except Exception as e:
                logger.warning(f"Failed to get info for model {model_name}: {e}")
                continue
        
        return {"models": models_data}
        
    except Exception as e:
        logger.error(f"Error getting available models: {e}")
        return handle_api_error(f"Failed to get available models: {str(e)}", 500)


@app.get("/api/v1/models/current", 
         summary="Get current model",
         description="Get information about the currently loaded model")
def api_v1_models_current(request: Request):
    """Get information about the currently loaded model."""
    try:
        model_state = global_model_state.current_model
        
        if not model_state or not model_state.tts_instance:
            raise HTTPException(status_code=404, detail={"error": "No model currently loaded"})
        
        # Create display name from model name
        name_parts = model_state.model_name.split('/')
        display_name = f"{name_parts[3].title() if len(name_parts) > 3 else 'Unknown'} - {name_parts[2].upper() if len(name_parts) > 2 else 'Unknown'} ({name_parts[1].upper() if len(name_parts) > 1 else 'Unknown'})"
        
        # Get capabilities from TTS instance
        tts_instance = model_state.tts_instance
        capabilities = {
            "multi_speaker": model_state.is_multi_speaker,
            "multi_lingual": model_state.is_multi_lingual,
            "voice_cloning": (
                hasattr(tts_instance.synthesizer, 'tts_config') and
                hasattr(tts_instance.synthesizer.tts_config, 'supports_cloning') and
                tts_instance.synthesizer.tts_config.supports_cloning
            ) if hasattr(tts_instance, 'synthesizer') else False,
            "speakers": model_state.speakers or [],
            "languages": model_state.languages or []
        }
        
        # Performance information
        performance = {
            "memoryUsage": int(model_state.memory_usage),
            "loadTime": round(model_state.load_time, 2)
        }
        
        current_model_info = {
            "modelName": model_state.model_name,
            "displayName": display_name,
            "capabilities": capabilities,
            "performance": performance,
            "loadedAt": datetime.now().isoformat() + "Z"  # Current time as approximate
        }
        
        return current_model_info
        
    except Exception as e:
        logger.error(f"Error getting current model info: {e}")
        return handle_api_error(f"Failed to get current model info: {str(e)}", 500)


@app.post("/api/v1/models/load",
          summary="Load model",
          description="Load a specific TTS model")
def api_v1_models_load(request: Request, model_request: ModelLoadRequest):
    """Load a specific model."""
    try:
        model_name = model_request.model_id
        force_reload = model_request.force_reload
        
        if not model_name:
            return handle_api_error("model_id parameter is required", 400)
        
        # Validate model exists
        available_models = manager.list_models()
        if model_name not in available_models:
            # Try to suggest alternatives
            suggestions = [m for m in available_models if any(part in m for part in model_name.split('/'))]
            suggestion_text = f" Suggestions: {', '.join(suggestions[:3])}" if suggestions else ""
            return handle_api_error(f"Model '{model_name}' not found.{suggestion_text}", 400)
        
        # Check if already loading this model
        if global_model_state.is_loading:
            loading_status = global_model_state.loading_status
            if loading_status.target_model == model_name:
                return {
                    "success": True,
                    "message": "Model loading already in progress",
                    "estimatedTime": 30,
                    "loadingId": f"load_{int(time.time())}"
                }
            else:
                return handle_api_error("Another model is currently loading. Please wait or cancel the current operation.", 409)
        
        # Check if model is already loaded (and not forcing reload)
        current_model = global_model_state.current_model
        if (not force_reload and current_model and 
            current_model.model_name == model_name):
            return {
                "success": True,
                "message": "Model is already loaded",
                "estimatedTime": 0,
                "loadingId": f"already_loaded_{int(time.time())}"
            }
        
        # Estimate loading time based on cache status
        cached = model_name in model_cache._cache_entries
        estimated_time = 15 if cached else 45
        
        # Start loading in background (non-blocking)
        loading_id = f"load_{int(time.time())}"
        
        # Use threading to load model asynchronously
        import threading
        def load_model_thread():
            try:
                success = global_model_state.load_model(
                    model_name=model_name,
                    device=device,
                    progress_bar=False
                )
                if success:
                    logger.info(f"Successfully loaded model {model_name} in background")
                else:
                    logger.error(f"Failed to load model {model_name} in background")
            except Exception as e:
                logger.error(f"Exception during background model loading: {e}")
        
        thread = threading.Thread(target=load_model_thread, daemon=True)
        thread.start()
        
        return {
            "success": True,
            "message": "Model loading initiated",
            "estimatedTime": estimated_time,
            "loadingId": loading_id
        }
        
    except Exception as e:
        logger.error(f"Error initiating model load: {e}")
        return handle_api_error(f"Failed to initiate model loading: {str(e)}", 500)


@app.get("/api/v1/models/status", 
         summary="Get model loading status",
         description="Get the current status of model loading operations")
def api_v1_models_status(request: Request):
    """Get current model loading status."""
    try:
        loading_progress = global_model_state.get_loading_progress()
        loading_status = global_model_state.loading_status
        
        # Calculate time remaining based on progress
        time_remaining = 0
        if loading_progress["is_loading"] and loading_progress["progress"] > 0:
            elapsed_time = time.time() - loading_progress.get("start_time", time.time())
            if loading_progress["progress"] > 0:
                total_estimated = elapsed_time / (loading_progress["progress"] / 100)
                time_remaining = max(0, int(total_estimated - elapsed_time))
        
        status_response = {
            "isLoading": loading_progress["is_loading"],
            "progress": round(loading_progress["progress"], 1),
            "stage": loading_progress["message"],
            "timeRemaining": time_remaining,
            "canCancel": loading_progress["is_loading"],
            "loadingId": f"load_{int(loading_progress.get('start_time', time.time()))}"
        }
        
        return status_response
        
    except Exception as e:
        logger.error(f"Error getting loading status: {e}")
        return handle_api_error(f"Failed to get loading status: {str(e)}", 500)


@app.post("/api/v1/models/cancel",
          summary="Cancel model loading",
          description="Cancel the current model loading operation")
def api_v1_models_cancel(request: Request):
    """Cancel current model loading operation."""
    try:
        # Check if there's a loading operation to cancel
        if not global_model_state.is_loading:
            return {
                "success": False,
                "message": "No model loading operation in progress",
                "error": "No active loading operation"
            }
        
        # Attempt to cancel the loading operation
        success = global_model_state.cancel_loading()
        
        if success:
            return {
                "success": True,
                "message": "Model loading cancelled successfully"
            }
        else:
            return {
                "success": False,
                "message": "Failed to cancel model loading",
                "error": "Cancellation request failed"
            }
            
    except Exception as e:
        logger.error(f"Error cancelling model loading: {e}")
        return handle_api_error(f"Failed to cancel model loading: {str(e)}", 500)


@app.get("/api/v1/models/speakers", 
         summary="Get model speakers",
         description="Get available speakers for the current model")
def api_v1_get_model_speakers(request: Request):
    """Get available speakers for the current model"""
    try:
        model_state = global_model_state.current_model
        
        if not model_state or not model_state.tts_instance:
            return handle_api_error("No model loaded", 404)
        
        speakers = []
        model_name_lower = model_state.model_name.lower()
        
        # Special handling for different model types
        if 'bark' in model_name_lower:
            # Bark uses voice cloning and doesn't have predefined speakers
            speakers = [
                "random",  # Generate random voice
                "clone"    # Use voice cloning with uploaded audio
            ]
        elif 'xtts' in model_name_lower:
            # XTTS v1.1 and v2 have built-in speakers plus voice cloning
            speakers = [
                "Claribel Dervla", "Daisy Studious", "Gracie Wise", "Ana Florence",
                "Rainbow Rainbow", "Libri female", "Libri male", "Briauna", "Mohegan",
                "Santa", "Baldur", "Bruce Wayne", "Carla", "Claes", "Elisabeth", 
                "Emma", "Florian", "Hans", "Holly", "Ijeoma", "Janet", "Jenna",
                "Kazuhiko", "Kenji", "Klaus", "Leonidas", "Marcus", "Narrator",
                "Niel", "Patrick", "Rosalyn", "Roy", "Samaki", "Serenity", "Sofia",
                "Stefanie", "Victor", "Wayne", "Zora", "female_01", "female_02",
                "female_03", "female_04", "female_05", "female_06", "female_07",
                "female_08", "female_09", "female_10", "male_01", "male_02",
                "male_03", "male_04", "male_05", "male_06", "male_07", "male_08",
                "male_09", "male_10"
            ]
        elif 'tortoise' in model_name_lower:
            # Tortoise uses voice cloning primarily
            speakers = [
                "random",  # Generate random voice
                "clone",   # Use voice cloning with uploaded audio
                "angie", "daniel", "deniro", "emma", "freeman", "geralt",
                "halle", "jlaw", "lj", "mol", "pat", "pat2", "rainbow",
                "snakes", "tim_reynolds", "tom", "train_daws", "train_dreams",
                "train_grace", "train_lescault", "train_mouse", "weaver", "william"
            ]
        elif 'yourtts' in model_name_lower or 'your_tts' in model_name_lower:
            # YourTTS supports multiple speakers
            speakers = [
                "female_01", "female_02", "female_03", "male_01", "male_02", "male_03",
                "p225", "p226", "p227", "p228", "p229", "p230", "p231", "p232",
                "p233", "p234", "p235", "p236", "p237", "p238", "p239", "p240"
            ]
        elif 'openvoice' in model_name_lower:
            # OpenVoice focuses on voice cloning and conversion
            speakers = [
                "clone",      # Voice cloning
                "base_v1",    # OpenVoice v1 base speaker
                "base_v2"     # OpenVoice v2 base speaker
            ]
        elif 'knnvc' in model_name_lower:
            # KNNVC is voice conversion, not TTS - uses source/target pairs
            speakers = [
                "source",     # Source voice for conversion
                "target"      # Target voice for conversion
            ]
        # Get speakers from the model state first
        elif model_state.speakers:
            speakers = model_state.speakers
        # Get speakers from the TTS instance
        elif hasattr(model_state.tts_instance, 'speakers') and model_state.tts_instance.speakers:
            speakers = list(model_state.tts_instance.speakers)
        elif hasattr(model_state.tts_instance, 'speaker_manager') and model_state.tts_instance.speaker_manager:
            # For models with speaker manager (like XTTS)
            if hasattr(model_state.tts_instance.speaker_manager, 'speakers'):
                speakers = list(model_state.tts_instance.speaker_manager.speakers.keys())
        elif model_state.is_multi_speaker:
            # Try to get from model config
            if hasattr(model_state.tts_instance, 'config') and hasattr(model_state.tts_instance.config, 'speakers'):
                speakers = model_state.tts_instance.config.speakers
            else:
                # Fallback for multi-speaker models without explicit speaker list
                speakers = ['default']
        else:
            # Single speaker model
            speakers = ['default']
        
        return {
            "speakers": speakers,
            "is_multi_speaker": model_state.is_multi_speaker,
            "model_name": model_state.model_name
        }
    except Exception as e:
        logger.error("Error getting model speakers: %s", str(e))
        return handle_api_error(f"Failed to get speakers: {str(e)}", 500)


@app.get("/api/v1/models/languages", 
         summary="Get model languages",
         description="Get available languages for the current model")
def api_v1_get_model_languages(request: Request):
    """Get available languages for the current model"""
    try:
        model_state = global_model_state.current_model
        
        if not model_state or not model_state.tts_instance:
            return handle_api_error("No model loaded", 404)
        
        languages = []
        model_name_lower = model_state.model_name.lower()
        
        # Special handling for different model types
        if 'bark' in model_name_lower:
            # Bark supports multiple languages through automatic detection
            languages = [
                'en',  # English
                'es',  # Spanish  
                'fr',  # French
                'de',  # German
                'it',  # Italian
                'pt',  # Portuguese
                'pl',  # Polish
                'tr',  # Turkish
                'ru',  # Russian
                'nl',  # Dutch
                'cs',  # Czech
                'ar',  # Arabic
                'zh',  # Chinese
                'ja',  # Japanese
                'hu',  # Hungarian
                'ko'   # Korean
            ]
        elif 'xtts' in model_name_lower:
            # XTTS v1.1 and v2 support 17 languages
            languages = [
                'en',  # English
                'es',  # Spanish
                'fr',  # French
                'de',  # German
                'it',  # Italian
                'pt',  # Portuguese
                'pl',  # Polish
                'tr',  # Turkish
                'ru',  # Russian
                'nl',  # Dutch
                'cs',  # Czech
                'ar',  # Arabic
                'zh',  # Chinese (zh-cn)
                'ja',  # Japanese
                'hi',  # Hindi
                'hu',  # Hungarian
                'ko'   # Korean
            ]
        elif 'tortoise' in model_name_lower:
            # Tortoise is primarily English but can handle some other languages
            languages = ['en']  # English only
        elif 'yourtts' in model_name_lower or 'your_tts' in model_name_lower:
            # YourTTS supports multiple languages
            languages = [
                'en',  # English
                'es',  # Spanish
                'fr',  # French
                'de',  # German
                'it',  # Italian
                'pt'   # Portuguese
            ]
        elif 'openvoice' in model_name_lower:
            # OpenVoice supports multiple languages for voice cloning
            languages = [
                'en',  # English
                'es',  # Spanish
                'fr',  # French
                'de',  # German
                'it',  # Italian
                'pt',  # Portuguese
                'pl',  # Polish
                'tr',  # Turkish
                'ru',  # Russian
                'nl',  # Dutch
                'cs',  # Czech
                'zh',  # Chinese
                'ja',  # Japanese
                'ko'   # Korean
            ]
        elif 'knnvc' in model_name_lower:
            # KNNVC is voice conversion - language agnostic
            languages = [
                'any'  # Language agnostic voice conversion
            ]
        # Get languages from the model state first
        elif model_state.languages:
            languages = model_state.languages
        # Get languages from the TTS instance
        elif hasattr(model_state.tts_instance, 'languages') and model_state.tts_instance.languages:
            languages = list(model_state.tts_instance.languages)
        elif hasattr(model_state.tts_instance, 'language_manager') and model_state.tts_instance.language_manager:
            # For models with language manager
            if hasattr(model_state.tts_instance.language_manager, 'languages'):
                languages = list(model_state.tts_instance.language_manager.languages.keys())
        elif model_state.is_multi_lingual:
            # Try to get from model config
            if hasattr(model_state.tts_instance, 'config') and hasattr(model_state.tts_instance.config, 'languages'):
                languages = model_state.tts_instance.config.languages
            else:
                # Fallback for multi-lingual models
                languages = ['en']
        else:
            # Single language model - detect from model name
            if '/en/' in model_name_lower or 'english' in model_name_lower:
                languages = ['en']
            elif '/es/' in model_name_lower or 'spanish' in model_name_lower:
                languages = ['es']
            elif '/fr/' in model_name_lower or 'french' in model_name_lower:
                languages = ['fr']
            elif '/de/' in model_name_lower or 'german' in model_name_lower:
                languages = ['de']
            else:
                languages = ['en']  # Default to English
                
        return {
            "languages": languages,
            "is_multi_lingual": model_state.is_multi_lingual,
            "model_name": model_state.model_name
        }
    except Exception as e:
        logger.error("Error getting model languages: %s", str(e))
        return handle_api_error(f"Failed to get languages: {str(e)}", 500)


@app.get("/api/v1/cache/stats", 
         summary="Get cache statistics",
         description="Get detailed cache statistics and memory usage")
def api_v1_cache_stats(request: Request):
    """Get detailed cache statistics."""
    try:
        cache_stats = model_cache.get_cache_stats()
        
        # Get individual cache entries info
        cache_entries = []
        with model_cache._lock:
            for model_name, entry in model_cache._cache_entries.items():
                cache_entries.append({
                    "modelName": model_name,
                    "memorySizeMb": round(entry.memory_size / (1024 * 1024), 1),
                    "hitCount": entry.hit_count,
                    "lastAccessed": entry.last_accessed,
                    "createdAt": entry.created_at,
                    "isCorrupted": entry.is_corrupted
                })
        
        # Sort by last accessed (most recent first)
        cache_entries.sort(key=lambda x: x["lastAccessed"], reverse=True)
        
        cache_info = {
            "summary": {
                "totalEntries": cache_stats.total_entries,
                "totalSizeMb": round(cache_stats.total_size / (1024 * 1024), 1),
                "maxMemoryMb": round(model_cache.max_memory_bytes / (1024 * 1024), 1),
                "maxEntries": model_cache.max_entries,
                "hitRate": round(cache_stats.hit_rate * 100, 1),
                "cacheHits": cache_stats.cache_hits,
                "cacheMisses": cache_stats.cache_misses,
                "evictionCount": cache_stats.eviction_count
            },
            "systemMemory": {
                "usagePercent": round(cache_stats.memory_usage_percent, 1),
                "availableGb": round(cache_stats.available_memory / (1024 * 1024 * 1024), 2),
                "cleanupThreshold": round(model_cache.cleanup_threshold * 100, 1)
            },
            "entries": cache_entries
        }
        
        return cache_info
        
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        return handle_api_error(f"Failed to get cache stats: {str(e)}", 500)


@app.post("/api/v1/cache/clear",
          summary="Clear cache",
          description="Clear all cached models from memory")
def api_v1_cache_clear(request: Request):
    """Clear all cached models."""
    try:
        cleared_count = model_cache.clear_cache()
        
        return {
            "success": True,
            "message": f"Successfully cleared {cleared_count} cached models",
            "clearedCount": cleared_count
        }
        
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return handle_api_error(f"Failed to clear cache: {str(e)}", 500)


@app.post("/api/v1/cache/cleanup", 
          summary="Cleanup cache",
          description="Perform LRU cache cleanup to free memory")
def api_v1_cache_cleanup(request: Request):
    """Perform LRU cache cleanup."""
    try:
        evicted_count = model_cache.cleanup_cache()
        
        return {
            "success": True,
            "message": f"Cache cleanup completed, evicted {evicted_count} entries",
            "evictedCount": evicted_count
        }
        
    except Exception as e:
        logger.error(f"Error during cache cleanup: {e}")
        return handle_api_error(f"Failed to perform cache cleanup: {str(e)}", 500)


@app.get("/api/v1/registry/status", 
         summary="Get registry status",
         description="Get model registry status and statistics")
def api_v1_registry_status(request: Request):
    """Get model registry status and statistics."""
    try:
        registry_stats = model_registry.get_registry_stats()
        
        registry_info = {
            "status": registry_stats.state.name.lower(),
            "modelsCount": registry_stats.models_count,
            "lastRefresh": registry_stats.last_refresh,
            "refreshCount": registry_stats.refresh_count,
            "cacheInvalidationCount": registry_stats.cache_invalidation_count,
            "failureCount": registry_stats.failure_count,
            "monitoringActive": registry_stats.state.name == "MONITORING",
            "canRefresh": registry_stats.state.name in ["IDLE", "MONITORING", "ERROR"],
            "supportsWatchdog": model_registry._observer is not None if hasattr(model_registry, '_observer') else False
        }
        
        return registry_info
        
    except Exception as e:
        logger.error(f"Error getting registry status: {e}")
        return handle_api_error(f"Failed to get registry status: {str(e)}", 500)


@app.post("/api/v1/registry/refresh",
          summary="Refresh registry",
          description="Manually trigger model registry refresh")
def api_v1_registry_refresh(request: Request):
    """Manually trigger model registry refresh."""
    try:
        # Check if refresh is possible
        registry_stats = model_registry.get_registry_stats()
        if registry_stats.state.name == "REFRESHING":
            return handle_api_error("Registry refresh already in progress", 409)
        
        # Trigger refresh
        success = model_registry.refresh_registry()
        
        if success:
            return {
                "success": True,
                "message": "Registry refresh completed successfully"
            }
        else:
            return handle_api_error("Registry refresh failed", 500)
            
    except Exception as e:
        logger.error(f"Error during registry refresh: {e}")
        return handle_api_error(f"Failed to refresh registry: {str(e)}", 500)


@app.get("/api/v1/models/progress-stream",
         summary="Model loading progress stream",
         description="Server-sent events endpoint for streaming model loading progress")
def api_v1_models_progress_stream(request: Request):
    """Server-sent events endpoint for streaming model loading progress."""
    def generate_progress_events():
        """Generator function that yields server-sent events for progress updates."""
        import queue
        import threading
        import uuid
        from datetime import datetime
        
        # Create a unique client ID for this connection
        client_id = str(uuid.uuid4())[:8]
        logger.info(f"SSE client {client_id} connected")
        
        # Queue to receive progress updates from the callback
        event_queue = queue.Queue()
        client_disconnected = threading.Event()
        
        def progress_callback(loading_status):
            """Callback function to handle progress updates from GlobalModelState."""
            try:
                if client_disconnected.is_set():
                    return
                    
                # Calculate time remaining based on progress
                time_remaining = 0
                if (loading_status.state.name == "LOADING" and 
                    loading_status.progress > 0 and 
                    loading_status.start_time > 0):
                    elapsed_time = time.time() - loading_status.start_time
                    if loading_status.progress > 0:
                        total_estimated = elapsed_time / (loading_status.progress / 100)
                        time_remaining = max(0, int(total_estimated - elapsed_time))
                
                # Create progress event data
                event_data = {
                    "progress": round(loading_status.progress, 1),
                    "stage": loading_status.message or "Loading...",
                    "timeRemaining": time_remaining,
                    "state": loading_status.state.name,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Determine event type based on loading state
                if loading_status.state.name == "LOADING":
                    event_type = "progress"
                elif loading_status.state.name == "COMPLETED":
                    event_type = "complete"
                    # Add model info for completion events
                    current_model = global_model_state.current_model
                    if current_model:
                        event_data.update({
                            "modelName": current_model.model_name,
                            "capabilities": {
                                "multiSpeaker": current_model.is_multi_speaker,
                                "multiLingual": current_model.is_multi_lingual,
                                "speakers": current_model.speakers or [],
                                "languages": current_model.languages or []
                            },
                            "performance": {
                                "loadTime": round(current_model.load_time, 2),
                                "memoryUsage": int(current_model.memory_usage)
                            }
                        })
                elif loading_status.state.name in ["FAILED", "CANCELLED"]:
                    event_type = "error"
                    event_data.update({
                        "error": loading_status.error or f"Loading {loading_status.state.name.lower()}",
                        "suggestions": [
                            "Try selecting a different model",
                            "Check your internet connection",
                            "Restart the server if issues persist"
                        ] if loading_status.state.name == "FAILED" else [
                            "Loading was cancelled",
                            "You can start a new model loading operation"
                        ]
                    })
                else:
                    event_type = "status"
                
                # Queue the event
                event_queue.put((event_type, event_data))
                
            except Exception as e:
                logger.error(f"Error in SSE progress callback: {e}")
                try:
                    event_queue.put(("error", {
                        "error": "Internal error during progress update",
                        "suggestions": ["Reconnect to resume progress updates"]
                    }))
                except Exception:
                    pass  # Queue might be full or client disconnected
        
        # Register our progress callback
        global_model_state.register_progress_callback(progress_callback)
        
        try:
            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'clientId': client_id, 'timestamp': datetime.now().isoformat()})}\n\n"
            
            # Send current status immediately
            try:
                loading_progress = global_model_state.get_loading_progress()
                initial_event_data = {
                    "progress": round(loading_progress["progress"], 1),
                    "stage": loading_progress["message"] or "Ready",
                    "timeRemaining": 0,
                    "state": loading_progress["state"],
                    "timestamp": datetime.now().isoformat()
                }
                
                if loading_progress["is_loading"]:
                    yield f"event: progress\ndata: {json.dumps(initial_event_data)}\n\n"
                else:
                    yield f"event: status\ndata: {json.dumps(initial_event_data)}\n\n"
            except Exception as e:
                logger.warning(f"Error sending initial status: {e}")
            
            # Process events from the queue
            while True:
                try:
                    # Wait for events with timeout to allow for keepalive
                    event_type, event_data = event_queue.get(timeout=10.0)
                    
                    # Format and yield the event
                    event_json = json.dumps(event_data)
                    yield f"event: {event_type}\ndata: {event_json}\n\n"
                    
                    # Mark task as done
                    event_queue.task_done()
                    
                except queue.Empty:
                    # Send keepalive comment to prevent connection timeout
                    yield ": keepalive\n\n"
                except Exception as e:
                    logger.error(f"Error processing SSE event: {e}")
                    # Send error event and continue
                    error_data = {
                        "error": "Event processing error",
                        "suggestions": ["Connection may be unstable, consider reconnecting"]
                    }
                    yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
                    
        except GeneratorExit:
            # Client disconnected
            logger.info(f"SSE client {client_id} disconnected")
            client_disconnected.set()
        except Exception as e:
            logger.error(f"Error in SSE stream for client {client_id}: {e}")
            error_data = {
                "error": "Stream error occurred", 
                "suggestions": ["Try reconnecting to resume progress updates"]
            }
            try:
                yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
            except Exception:
                pass  # Client likely disconnected
        finally:
            # Cleanup: unregister callback and set disconnection flag
            client_disconnected.set()
            try:
                global_model_state.unregister_progress_callback(progress_callback)
                logger.info(f"SSE client {client_id} cleanup completed")
            except Exception as e:
                logger.warning(f"Error during SSE cleanup for client {client_id}: {e}")
    
    try:
        # Create response with proper SSE headers
        return StreamingResponse(
            generate_progress_events(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            }
        )
        
    except Exception as e:
        logger.error(f"Error creating SSE response: {e}")
        return handle_api_error(f"Failed to create progress stream: {str(e)}", 500)


@app.get('/{path:path}', include_in_schema=False)
async def serve_frontend(path: str):
    """
    Catch-all route for client-side routing.
    Serves static assets from the frontend build, 
    or falls back to index.html for React Router.
    """
    # First try to serve static files from frontend directory
    static_dir = "static/frontend"
    file_path = os.path.join(static_dir, path)
    
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # For any other path, return the React app's index.html to handle client-side routing
    index_path = os.path.join(static_dir, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        return JSONResponse({"error": "Frontend not found"}, status_code=404)


def main():
    try:
        # Use uvicorn to run the FastAPI app
        uvicorn.run(
            app,  # Pass the app object directly instead of string reference
            host="0.0.0.0", 
            port=args.port,
            log_level="info" if not args.debug else "debug",
            access_log=True,
            reload=args.debug
        )
    finally:
        # Cleanup on server shutdown
        cleanup_server()


def cleanup_server():
    """Perform cleanup operations on server shutdown."""
    try:
        logger.info("Server shutdown - performing cleanup")
        
        # Stop model registry monitoring
        try:
            registry_stats = model_registry.get_registry_stats()
            if registry_stats.state.name == "MONITORING":
                model_registry.stop_monitoring()
                logger.info("Model registry monitoring stopped")
        except Exception as e:
            logger.warning(f"Error stopping model registry monitoring: {e}")
        
        # Persist cache state
        model_cache.persist_cache()
        logger.info("Cache state persisted")
        
        # Additional cleanup for global model state
        try:
            if global_model_state.current_model:
                logger.info("Cleaning up loaded model resources")
                # The GlobalModelState should handle cleanup automatically
        except Exception as e:
            logger.warning(f"Error during model state cleanup: {e}")
        
    except Exception as e:
        logger.error(f"Error during server cleanup: {e}")


# Register cleanup for various exit scenarios
import atexit
atexit.register(cleanup_server)


if __name__ == "__main__":
    main()
