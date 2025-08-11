#!/usr/bin/env python3
"""
Test FastAPI server to demonstrate the TTS server conversion.
This version skips model loading to avoid numba compilation delays.
"""

import io
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, File, UploadFile, Query, Header, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for API documentation
class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=1000)
    speaker: Optional[str] = Field(None, description="Speaker ID or speaker wav file path for voice cloning")
    language: Optional[str] = Field(None, description="Language ID for multilingual models")
    format: str = Field("wav", description="Output audio format", pattern="^(wav|mp3|opus|aac|flac|pcm)$")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall health status")
    model_loaded: bool = Field(..., description="Whether a TTS model is currently loaded")
    components: Dict[str, Any] = Field(..., description="Status of individual components")

# Create FastAPI app with automatic OpenAPI documentation
app = FastAPI(
    title="Coqui TTS Server (Test)",
    description="Text-to-Speech server with FastAPI and automatic OpenAPI documentation (Test Version)",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI available at http://localhost:5002/docs
    redoc_url="/redoc",  # ReDoc documentation available at http://localhost:5002/redoc
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

@app.get("/", summary="Frontend", description="Serve the main application")
async def index():
    """Serve the React frontend index.html or basic info"""
    return JSONResponse({
        "message": "FastAPI TTS Server is running!",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/api/v1/health"
    })

@app.get("/api/v1/health", 
         response_model=HealthResponse,
         summary="Health Check", 
         description="Get server health status and component information")
async def api_v1_health():
    """Health check endpoint with comprehensive component status"""
    try:
        health_info = {
            "status": "healthy",
            "model_loaded": False,  # No models loaded in test mode
            "components": {
                "fastapi": {
                    "status": "healthy",
                    "version": "running"
                },
                "test_mode": {
                    "status": "active",
                    "message": "Running in test mode without TTS models"
                }
            },
            "timestamp": datetime.now().isoformat(),
            "docs_available": True
        }
        
        return health_info
        
    except Exception as e:
        logger.error("Health check failed: %s", str(e))
        raise HTTPException(status_code=500, detail={"error": f"Health check failed: {str(e)}"})

@app.get("/api/v1/models", 
         summary="List Available Models", 
         description="Get list of available TTS models")
async def api_v1_models():
    """List available models (test data)"""
    return {
        "models": [
            "tts_models/en/ljspeech/tacotron2-DCA",
            "tts_models/en/ljspeech/glow-tts",
            "tts_models/multilingual/multi-dataset/xtts_v2"
        ],
        "note": "This is test data. In production, this would list actual available models."
    }

@app.post("/api/v1/tts", 
          summary="Text-to-Speech Synthesis", 
          description="Convert text to speech (test endpoint)")
async def api_v1_tts(request_data: TTSRequest):
    """TTS synthesis endpoint (returns test audio info)"""
    try:
        # Create synthesis ID for tracking
        synthesis_id = str(uuid.uuid4())[:8]
        
        logger.info(f"TTS request: {request_data.text[:50]}... (synthesis_id: {synthesis_id})")
        
        # In test mode, return information about what would be synthesized
        response_info = {
            "synthesis_id": synthesis_id,
            "text": request_data.text,
            "speaker": request_data.speaker,
            "language": request_data.language,
            "format": request_data.format,
            "estimated_duration": len(request_data.text) * 0.1,  # Rough estimate
            "status": "test_mode",
            "message": "In production, this would return actual audio data"
        }
        
        return JSONResponse(response_info)
        
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise HTTPException(status_code=500, detail={"error": f"TTS synthesis failed: {str(e)}"})

@app.get("/api/v1/models/current", 
         summary="Current Model Info", 
         description="Get information about the currently loaded model")
async def api_v1_models_current():
    """Get information about the currently loaded model (test data)"""
    return {
        "modelName": "test_model",
        "displayName": "Test Model - No actual model loaded",
        "capabilities": {
            "multiSpeaker": False,
            "multiLingual": False,
            "voiceCloning": False
        },
        "status": "test_mode"
    }

if __name__ == "__main__":
    print("🚀 Starting FastAPI TTS Server (Test Mode)")
    print("📖 Documentation available at: http://localhost:5002/docs")
    print("📚 Alternative docs at: http://localhost:5002/redoc")
    print("❤️  Health check at: http://localhost:5002/api/v1/health")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5002,
        log_level="info"
    )
