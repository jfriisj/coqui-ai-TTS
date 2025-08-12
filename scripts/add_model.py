#!/usr/bin/env python3

"""Command line interface for adding models to TTS registry.

This script provides a command line interface to add models to the TTS model registry
(.models.json). It supports all model types and validates input parameters.
"""

import argparse
import json
import logging
import re
import sys
from argparse import RawTextHelpFormatter
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

description = """
Add models to the TTS model registry.

This script allows researchers and developers to add new models to the TTS model 
registry (.models.json file) with proper validation and error handling.

Examples:

- Add a TTS model from GitHub release:
  
  ```sh
  python scripts/add_model.py --model-name my_vits \\
      --model-type tts_models --language en --dataset custom \\
      --description "Custom VITS model" --license MIT --author @user \\
      --github-rls-url https://github.com/user/model.zip
  ```

- Add a vocoder model from Hugging Face:

  ```sh
  python scripts/add_model.py --model-name hifigan_custom \\
      --model-type vocoder_models --language en --dataset ljspeech \\
      --description "Custom HiFi-GAN vocoder" --license Apache-2.0 \\
      --hf-url https://huggingface.co/user/model
  ```

- Add a voice conversion model with multiple URLs:

  ```sh
  python scripts/add_model.py --model-name freevc_custom \\
      --model-type voice_conversion_models --language multilingual \\
      --dataset common-voice --description "Custom FreeVC model" \\
      --license MIT --model-url https://example.com/model1.zip \\
      --model-url https://example.com/model2.zip
  ```

- Add a model with many files using URLs file (useful for models with 50+ files):

  ```sh
  python scripts/add_model.py --model-name kokoro-82m \\
      --model-type tts_models --language multilingual --dataset multi-dataset \\
      --description "Multilingual TTS model with 50+ voice files" \\
      --license Apache-2.0 --author @hexgrad \\
      --model-urls-file examples/kokoro_urls.txt
  ```

Model Types:
  - tts_models: Text-to-speech models
  - vocoder_models: Vocoder models for audio generation
  - voice_conversion_models: Voice conversion models

Required fields:
  - model-name: Unique name for the model
  - model-type: Type of model (see above)
  - language: Language code (e.g., "en", "multilingual")
  - dataset: Dataset name (e.g., "ljspeech", "common-voice", "custom")
  - At least one URL field (github-rls-url, hf-url, or model-url)
"""

# Valid model types based on existing TTS registry structure
VALID_MODEL_TYPES = ["tts_models", "vocoder_models", "voice_conversion_models"]

# URL validation pattern (basic HTTP/HTTPS URLs)
URL_PATTERN = re.compile(
    r"^https?://"  # http:// or https://
    r"(?:[-\w.])+(?:\:[0-9]+)?"  # host and optional port
    r"(?:/(?:[\w/_.-])*(?:\?[\w&=%._-]*)?)?"  # path and query (fixed to allow hyphens)
    r"(?:\#[\w._-]*)?$",  # fragment
    re.IGNORECASE,
)


def validate_url(url: str) -> bool:
    """Validate URL format.
    
    Args:
        url (str): URL to validate.
        
    Returns:
        bool: True if URL is valid, False otherwise.
    """
    if not url or not isinstance(url, str):
        return False
    return bool(URL_PATTERN.match(url.strip()))


def validate_model_type(model_type: str) -> bool:
    """Validate model type.
    
    Args:
        model_type (str): Model type to validate.
        
    Returns:
        bool: True if model type is valid, False otherwise.
    """
    return model_type in VALID_MODEL_TYPES


def parse_args(arg_list: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse command line arguments.
    
    Args:
        arg_list (Optional[List[str]]): List of arguments to parse. 
            If None, uses sys.argv.
            
    Returns:
        argparse.Namespace: Parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description=description.replace("    ```\n", ""),
        formatter_class=RawTextHelpFormatter,
    )

    # Required arguments
    parser.add_argument(
        "--model-name",
        type=str,
        required=True,
        help="Name of the model (e.g., 'vits', 'tacotron2')",
    )

    parser.add_argument(
        "--model-type",
        type=str,
        required=True,
        choices=VALID_MODEL_TYPES,
        help=f"Type of model. Choices: {', '.join(VALID_MODEL_TYPES)}",
    )

    parser.add_argument(
        "--language",
        type=str,
        required=True,
        help="Language code (e.g., 'en', 'es', 'multilingual')",
    )

    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Dataset name (e.g., 'ljspeech', 'common-voice', 'custom')",
    )

    # URL arguments (at least one required)
    parser.add_argument(
        "--github-rls-url",
        type=str,
        help="GitHub release URL for the model",
    )

    parser.add_argument(
        "--hf-url",
        type=str,
        help="Hugging Face model URL",
    )

    parser.add_argument(
        "--model-url",
        type=str,
        action="append",
        help="Direct model URL (can be specified multiple times)",
    )
    
    parser.add_argument(
        "--model-urls-file",
        type=str,
        help="File containing model URLs (one per line) for models with many files",
    )

    # Optional metadata
    parser.add_argument(
        "--description",
        type=str,
        help="Description of the model",
    )

    parser.add_argument(
        "--license",
        type=str,
        help="License of the model (e.g., 'MIT', 'Apache-2.0')",
    )

    parser.add_argument(
        "--author",
        type=str,
        help="Author of the model (e.g., '@username')",
    )

    parser.add_argument(
        "--contact",
        type=str,
        help="Contact information for the model author",
    )

    parser.add_argument(
        "--commit",
        type=str,
        help="Git commit hash associated with the model",
    )

    parser.add_argument(
        "--default-vocoder",
        type=str,
        help="Default vocoder for TTS models (format: type/language/dataset/name)",
    )

    parser.add_argument(
        "--tos-required",
        action="store_true",
        help="Whether terms of service agreement is required",
    )

    # Registry path (for testing)
    parser.add_argument(
        "--registry-path",
        type=str,
        help="Path to registry file (defaults to TTS/.models.json)",
    )

    # Verbosity
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args(arg_list)

    # Load URLs from file if provided
    if args.model_urls_file:
        try:
            urls_file = Path(args.model_urls_file)
            if not urls_file.exists():
                parser.error(f"URLs file not found: {args.model_urls_file}")
            
            with open(urls_file, 'r') as f:
                file_urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
            
            # Add to model_url list
            if args.model_url is None:
                args.model_url = []
            args.model_url.extend(file_urls)
            
        except Exception as e:
            parser.error(f"Error reading URLs file: {e}")

    # Validate that at least one URL is provided
    url_fields = [args.github_rls_url, args.hf_url, args.model_url]
    if not any(url_fields):
        parser.error(
            "At least one URL must be provided: --github-rls-url, --hf-url, --model-url, or --model-urls-file"
        )

    return args


def validate_arguments(args: argparse.Namespace) -> bool:
    """Validate parsed arguments.
    
    Args:
        args (argparse.Namespace): Parsed arguments to validate.
        
    Returns:
        bool: True if all arguments are valid, False otherwise.
    """
    errors = []

    # Validate URLs
    if args.github_rls_url and not validate_url(args.github_rls_url):
        errors.append(f"Invalid GitHub release URL: {args.github_rls_url}")

    if args.hf_url and not validate_url(args.hf_url):
        errors.append(f"Invalid Hugging Face URL: {args.hf_url}")

    if args.model_url:
        for url in args.model_url:
            if not validate_url(url):
                errors.append(f"Invalid model URL: {url}")

    # Validate model type (should be handled by choices, but double-check)
    if not validate_model_type(args.model_type):
        errors.append(f"Invalid model type: {args.model_type}")

    # Validate model name format (no special characters except underscore and hyphen)
    if not re.match(r"^[a-zA-Z0-9_-]+$", args.model_name):
        errors.append(
            "Model name can only contain letters, numbers, underscores, and hyphens"
        )

    # Validate language format (basic check)
    if not re.match(r"^[a-zA-Z0-9_-]+$", args.language):
        errors.append(
            "Language code can only contain letters, numbers, underscores, and hyphens"
        )

    # Validate dataset format (basic check)
    if not re.match(r"^[a-zA-Z0-9_-]+$", args.dataset):
        errors.append(
            "Dataset name can only contain letters, numbers, underscores, and hyphens"
        )

    # Validate default vocoder format if provided
    if args.default_vocoder:
        parts = args.default_vocoder.split("/")
        if len(parts) != 4:
            errors.append(
                "Default vocoder must be in format: type/language/dataset/name"
            )
        elif parts[0] not in VALID_MODEL_TYPES:
            errors.append(f"Default vocoder type must be one of: {VALID_MODEL_TYPES}")

    if errors:
        for error in errors:
            logger.error("Validation error: %s", error)
        return False

    return True


def create_model_entry(args: argparse.Namespace) -> dict:
    """Create model entry dictionary from arguments.
    
    Args:
        args (argparse.Namespace): Parsed arguments.
        
    Returns:
        dict: Model entry dictionary.
    """
    model_entry = {}

    # Add URLs
    if args.github_rls_url:
        model_entry["github_rls_url"] = args.github_rls_url

    if args.hf_url:
        model_entry["hf_url"] = args.hf_url

    if args.model_url:
        if len(args.model_url) == 1:
            model_entry["model_url"] = args.model_url[0]
        else:
            model_entry["model_url"] = args.model_url

    # Add optional metadata
    if args.description:
        model_entry["description"] = args.description

    if args.license:
        model_entry["license"] = args.license

    if args.author:
        model_entry["author"] = args.author

    if args.contact:
        model_entry["contact"] = args.contact

    if args.commit:
        model_entry["commit"] = args.commit

    if args.default_vocoder:
        model_entry["default_vocoder"] = args.default_vocoder

    if args.tos_required:
        model_entry["tos_required"] = True

    return model_entry


# Standalone utility functions (avoiding TTS dependencies)

def setup_simple_logger(level: int = logging.INFO) -> None:
    """Setup simple logger without TTS dependencies."""
    logging.basicConfig(
        level=level,
        format='%(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )


def validate_model_entry(model_entry: Dict[str, Any]) -> bool:
    """Validate model entry has required fields.
    
    Args:
        model_entry: Dictionary containing model metadata.
        
    Returns:
        bool: True if entry is valid, False otherwise.
    """
    required_fields = ["description", "license"]
    
    # Check required fields
    for field in required_fields:
        if field not in model_entry or not model_entry[field]:
            logger.error(f"Missing required field: {field}")
            return False
    
    # Check that at least one URL field exists
    url_fields = ["github_rls_url", "hf_url", "model_url"]
    has_url = any(field in model_entry and model_entry[field] for field in url_fields)
    
    if not has_url:
        logger.error("At least one URL field must be provided")
        return False
    
    return True


def add_model_to_registry_standalone(
    model_entry: Dict[str, Any],
    model_type: str = "tts_models",
    language: str = "custom",
    dataset: str = "custom", 
    model_name: str = "custom_model",
    models_file: Optional[Path] = None
) -> bool:
    """Add a model to the TTS model registry.
    
    Args:
        model_entry: Dictionary containing model metadata.
        model_type: Type of model (tts_models, vocoder_models, voice_conversion_models).
        language: Language code for the model.
        dataset: Dataset name for the model.
        model_name: Name of the model.
        models_file: Path to models.json file. If None, uses default TTS/.models.json.
        
    Returns:
        bool: True if model was added successfully, False otherwise.
    """
    try:
        # Determine models file path
        if models_file is None:
            script_dir = Path(__file__).parent
            project_root = script_dir.parent
            models_file = project_root / "TTS" / ".models.json"
        else:
            models_file = Path(models_file)
        
        if not models_file.exists():
            logger.error(f"Models file not found: {models_file}")
            return False
        
        # Validate model entry
        if not validate_model_entry(model_entry):
            return False
        
        # Load existing registry
        try:
            with open(models_file, 'r', encoding='utf-8') as f:
                registry = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in models file: {e}")
            return False
        
        # Create nested structure if it doesn't exist
        if model_type not in registry:
            registry[model_type] = {}
        
        if language not in registry[model_type]:
            registry[model_type][language] = {}
        
        if dataset not in registry[model_type][language]:
            registry[model_type][language][dataset] = {}
        
        # Check if model already exists
        if model_name in registry[model_type][language][dataset]:
            logger.warning(f"Model '{model_type}/{language}/{dataset}/{model_name}' already exists")
            return False
        
        # Add model entry
        registry[model_type][language][dataset][model_name] = model_entry
        
        # Write back to file
        try:
            with open(models_file, 'w', encoding='utf-8') as f:
                json.dump(registry, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Model added: {model_type}/{language}/{dataset}/{model_name}")
            return True
            
        except (OSError, PermissionError) as e:
            logger.error(f"Failed to write to models file: {e}")
            return False
        
    except Exception as e:
        logger.error(f"Unexpected error adding model: {e}")
        return False


def main(arg_list: Optional[List[str]] = None) -> None:
    """Entry point for add_model CLI.
    
    Args:
        arg_list (Optional[List[str]]): List of arguments to parse.
            If None, uses sys.argv.
    """
    try:
        # Parse arguments
        args = parse_args(arg_list)

        # Setup logging
        log_level = logging.DEBUG if args.verbose else logging.INFO
        setup_simple_logger(level=log_level)

        logger.info("Adding model to TTS registry")

        # Validate arguments
        if not validate_arguments(args):
            logger.error("Argument validation failed")
            sys.exit(1)

        # Create model entry
        model_entry = create_model_entry(args)
        logger.debug("Created model entry: %s", model_entry)

        # Add model to registry
        models_file = Path(args.registry_path) if args.registry_path else None
        success = add_model_to_registry_standalone(
            model_entry=model_entry,
            model_type=args.model_type,
            language=args.language,
            dataset=args.dataset,
            model_name=args.model_name,
            models_file=models_file,
        )

        if success:
            model_path = f"{args.model_type}/{args.language}/{args.dataset}/{args.model_name}"
            logger.info("Successfully added model: %s", model_path)
            print(f"✓ Model '{model_path}' added to registry successfully")
            sys.exit(0)
        else:
            logger.error("Failed to add model to registry")
            print("✗ Failed to add model to registry")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        print("\nOperation cancelled")
        sys.exit(1)
    except Exception as e:
        logger.error("Unexpected error: %s", e, exc_info=args.verbose if 'args' in locals() else False)
        print(f"✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()