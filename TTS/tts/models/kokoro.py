import logging
from typing import Dict, List, Optional

import torch
from coqpit import Coqpit

from TTS.tts.configs.kokoro_config import KokoroConfig
from TTS.tts.layers.kokoro.model import KModel
from TTS.tts.layers.kokoro.pipeline import KPipeline
from TTS.tts.models.base_tts import BaseTTS
from TTS.tts.utils.text.tokenizer import TTSTokenizer
from TTS.utils.audio import AudioProcessor

logger = logging.getLogger(__name__)


class Kokoro(BaseTTS):
    """Kokoro TTS model implementation.
    
    Kokoro is a high-quality, lightweight TTS model supporting multiple languages
    with 82M parameters. It supports 8+ languages and 50+ voices.
    
    Args:
        config (KokoroConfig): model configuration.
        ap (AudioProcessor): audio processor.
        tokenizer (TTSTokenizer): text tokenizer.
    
    Examples:
        >>> config = KokoroConfig()
        >>> ap = AudioProcessor.init_from_config(config)
        >>> tokenizer = TTSTokenizer.init_from_config(config)
        >>> model = Kokoro(config, ap, tokenizer)
        >>> wav = model.synthesize("Hello world!", voice="af_heart", lang="a")
    """
    
    def __init__(
        self,
        config: Coqpit,
        ap: AudioProcessor = None,
        tokenizer: TTSTokenizer = None,
        **kwargs,
    ):
        super().__init__(config, ap, tokenizer, **kwargs)
        
        self.config = config
        self.ap = ap
        self.tokenizer = tokenizer
        
        # Initialize Kokoro model and pipeline
        self.model = None
        self.pipelines = {}  # Cache pipelines by language
        
        # Model paths
        self.model_path = getattr(config, 'model_path', None)
        self.config_path = getattr(config, 'config_path', None)
        self.voices_path = getattr(config, 'voices_path', None)

        # Default settings
        self.default_voice = getattr(config, 'default_voice', 'af_heart')
        self.default_lang = getattr(config, 'default_lang', 'a')
        self.speed = getattr(config, 'speed', 1.0)

        # Available languages and voices
        self.language_codes = getattr(config, 'language_codes', {})
        self.available_voices = self._get_available_voices()
        
    def _get_available_voices(self) -> Dict[str, List[str]]:
        """Get available voices for each language."""
        # This would typically scan the voices directory or HF repo
        # For now, return a hardcoded mapping based on Kokoro's known voices
        return {
            "a": ["af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", 
                  "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
                  "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", 
                  "am_michael", "am_onyx", "am_puck", "am_santa"],
            "b": ["bf_alice", "bf_emma", "bf_isabella", "bf_lily",
                  "bm_daniel", "bm_fable", "bm_george", "bm_lewis"],
            "e": ["ef_dora", "em_alex", "em_santa"],
            "f": ["ff_siwis"],
            "h": ["hf_alpha", "hf_beta", "hm_omega", "hm_psi"],
            "i": ["if_sara", "im_nicola"],
            "j": ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"],
            "p": ["pf_dora", "pm_alex", "pm_santa"],
            "z": ["zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi"]
        }
    
    def load_model(self):
        """Load the Kokoro model."""
        if self.model is None:
            logger.info("Loading Kokoro model...")
            
            # Initialize KModel with optional custom paths
            model_kwargs = {}
            if self.config_path:
                model_kwargs['config'] = self.config_path
            if self.model_path:
                model_kwargs['model'] = self.model_path
                
            self.model = KModel(**model_kwargs)
            logger.info("Kokoro model loaded successfully")
    
    def get_pipeline(self, lang_code: str) -> KPipeline:
        """Get or create a pipeline for the specified language."""
        if lang_code not in self.pipelines:
            if lang_code not in self.language_codes:
                raise ValueError(f"Unsupported language code: {lang_code}. "
                               f"Available: {list(self.language_codes.keys())}")
            
            logger.debug(f"Creating pipeline for language: {lang_code}")
            self.pipelines[lang_code] = KPipeline(lang_code=lang_code)
            
        return self.pipelines[lang_code]
    
    def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        lang: Optional[str] = None,
        speed: Optional[float] = None,
        **kwargs
    ) -> torch.Tensor:
        """Synthesize speech from text.
        
        Args:
            text (str): input text to synthesize.
            voice (str, optional): voice to use. Defaults to config default.
            lang (str, optional): language code. Defaults to config default.
            speed (float, optional): speech speed. Defaults to config default.
            
        Returns:
            torch.Tensor: synthesized audio waveform.
        """
        # Set defaults
        voice = voice or self.default_voice
        lang = lang or self.default_lang
        speed = speed or self.speed
        
        # Validate inputs
        if lang not in self.language_codes:
            raise ValueError(f"Unsupported language: {lang}. "
                           f"Available: {list(self.language_codes.keys())}")
        
        if lang in self.available_voices and voice not in self.available_voices[lang]:
            logger.warning(f"Voice {voice} not found for language {lang}. "
                         f"Available voices: {self.available_voices.get(lang, [])}")
        
        # Load model if needed
        self.load_model()
        
        # Get pipeline for the language
        pipeline = self.get_pipeline(lang)
        
        # Generate audio
        logger.debug(f"Synthesizing: text='{text}', voice={voice}, lang={lang}, speed={speed}")
        
        # Collect all audio segments
        audio_segments = []
        for result in pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+"):
            if result.audio is not None:
                audio_segments.append(result.audio)
        
        if not audio_segments:
            logger.warning("No audio generated")
            return torch.zeros(1, 1024)  # Return empty audio
        
        # Concatenate all segments
        audio = torch.cat(audio_segments, dim=-1)
        
        return audio
    
    def inference(self, x: str, aux_input: Dict = None) -> Dict:
        """TTS inference interface for compatibility with BaseTTS.
        
        Args:
            x (str): input text.
            aux_input (Dict, optional): auxiliary inputs containing voice, lang, etc.
            
        Returns:
            Dict: dictionary containing "wav" key with synthesized audio.
        """
        aux_input = aux_input or {}
        
        voice = aux_input.get("voice", self.default_voice)
        lang = aux_input.get("lang", self.default_lang)
        speed = float(aux_input.get("speed", self.speed))

        wav = self.synthesize(text=x, voice=voice, lang=lang, speed=speed)
        
        return {"wav": wav}
    
    def forward(self, x, aux_input=None):
        """Forward pass - same as inference for this model."""
        return self.inference(x, aux_input)
    
    @staticmethod
    def init_from_config(config: "KokoroConfig", **kwargs) -> "Kokoro":
        """Initialize model from config."""
        # Create a minimal AudioProcessor for compatibility
        ap = AudioProcessor(
            sample_rate=config.audio.sample_rate,
            hop_length=config.audio.hop_length,
            win_length=config.audio.win_length,
            n_fft=config.audio.n_fft,
            mel_fmin=config.audio.mel_fmin,
            mel_fmax=config.audio.mel_fmax,
            n_mels=config.audio.n_mels,
        )
        
        # Create a minimal tokenizer for compatibility
        tokenizer = TTSTokenizer()

        return Kokoro(config=config, ap=ap, tokenizer=tokenizer, **kwargs)
    
    def load_checkpoint(self, checkpoint_path: str, eval: bool = True, strict: bool = True, cache: bool = False):
        """Load model from checkpoint."""
        # Kokoro handles its own model loading, so this is a no-op for compatibility
        pass

    def train_step(self, *args, **kwargs):
        """Training step - not implemented for Kokoro."""
        raise NotImplementedError("Training is not supported for Kokoro model.")

    def eval_step(self, *args, **kwargs):
        """Evaluation step - not implemented for Kokoro."""
        raise NotImplementedError("Evaluation is not supported for Kokoro model.")

    def get_optimizer(self):
        """Get optimizer - not implemented for Kokoro."""
        raise NotImplementedError("Optimizer is not supported for Kokoro model.")

    def get_lr(self):
        """Get learning rate - not implemented for Kokoro."""
        raise NotImplementedError("Learning rate is not supported for Kokoro model.")

    def get_scheduler(self, optimizer):
        """Get scheduler - not implemented for Kokoro."""
        raise NotImplementedError("Scheduler is not supported for Kokoro model.")

    def get_criterion(self):
        """Get criterion - not implemented for Kokoro."""
        raise NotImplementedError("Criterion is not supported for Kokoro model.")

    def format_batch(self, batch):
        """Format batch - not implemented for Kokoro."""
        raise NotImplementedError("Batch formatting is not supported for Kokoro model.")

    def get_data_loader(self, config, assets, is_eval, samples, verbose, num_gpus, rank=0):
        """Get data loader - not implemented for Kokoro."""
        raise NotImplementedError("Data loader is not supported for Kokoro model.")

    def test_run(self, assets):
        """Test run - not implemented for Kokoro."""
        pass
