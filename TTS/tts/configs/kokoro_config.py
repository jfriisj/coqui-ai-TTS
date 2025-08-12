import os
from dataclasses import dataclass, field
from typing import Dict

from trainer.io import get_user_data_dir

from TTS.tts.configs.shared_configs import BaseTTSConfig


@dataclass
class KokoroConfig(BaseTTSConfig):
    """Kokoro TTS configuration

    Args:
        model (str): model name that registers the model.
        model_path (str): path to the model file. Defaults to None.
        config_path (str): path to the model config file. Defaults to None.
        voices_path (str): path to the voices directory. Defaults to None.
        language_codes (Dict[str, str]): mapping of language codes to language names.
        default_voice (str): default voice to use. Defaults to "af_heart".
        default_lang (str): default language code. Defaults to "a".
        speed (float): default speech speed. Defaults to 1.0.
        device (str): device to run the model on. Defaults to None (auto-detect).
        enable_logging (bool): enable Kokoro internal logging. Defaults to False.
        cache_dir (str): directory to cache downloaded models. Defaults to user data dir.
    """

    model: str = "kokoro"
    
    # Model files
    model_path: str = None
    config_path: str = None  
    voices_path: str = None
    
    # Language configuration
    language_codes: Dict[str, str] = field(default_factory=lambda: {
        "a": "American English",
        "b": "British English", 
        "h": "Hindi",
        "e": "Spanish",
        "f": "French",
        "i": "Italian",
        "p": "Brazilian Portuguese",
        "j": "Japanese",
        "z": "Mandarin Chinese"
    })
    
    # Default settings
    default_voice: str = "af_heart"
    default_lang: str = "a" 
    speed: float = 1.0

    # Device configuration
    device: str = None
    enable_logging: bool = False
    cache_dir: str = field(default_factory=lambda: os.path.join(get_user_data_dir("tts"), "kokoro"))
    
    def __post_init__(self):
        """Set default values and validate configuration."""
        super().__post_init__()
        
        # Set up audio configuration for Kokoro
        if not hasattr(self, 'audio') or self.audio is None:
            from TTS.config.shared_configs import BaseAudioConfig
            self.audio = BaseAudioConfig(
                sample_rate=24000,
                hop_length=256,
                win_length=1024,
                mel_fmin=0,
                mel_fmax=12000,
            )

        # Ensure cache directory exists
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        else:
            self.cache_dir = os.path.join(get_user_data_dir("tts"), "kokoro")

        # Validate language code
        if self.default_lang not in self.language_codes:
            raise ValueError(f"Invalid default language '{self.default_lang}'. "
                           f"Available: {list(self.language_codes.keys())}")
                           
        # Validate speed
        if not 0.1 <= self.speed <= 3.0:
            raise ValueError(f"Speed must be between 0.1 and 3.0, got {self.speed}")