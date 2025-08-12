"""Model addition utilities for managing TTS model registry.

This module provides utilities to add and manage models in the TTS model registry
(.models.json file). It maintains the existing structure and follows project conventions.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import fsspec

from TTS.config import read_json_with_comments

logger = logging.getLogger(__name__)


def add_model_to_registry(
    model_entry: Dict[str, Any],
    model_type: str,
    language: str,
    dataset: str,
    model_name: str,
    registry_path: Optional[Union[str, os.PathLike[Any]]] = None,
) -> bool:
    """Add a model entry to the TTS model registry.

    This function adds a new model to the TTS/.models.json file, maintaining
    the existing hierarchical structure: model_type -> language -> dataset -> model_name.

    Args:
        model_entry (Dict[str, Any]): Model configuration dictionary containing
            fields like description, license, author, etc.
        model_type (str): Type of model (e.g., "tts_models", "vocoder_models", 
            "voice_conversion_models").
        language (str): Language code (e.g., "en", "multilingual").
        dataset (str): Dataset name (e.g., "ljspeech", "common-voice").
        model_name (str): Model name (e.g., "vits", "tacotron2").
        registry_path (Optional[Union[str, os.PathLike[Any]]]): Path to the registry file.
            Defaults to TTS/.models.json.

    Returns:
        bool: True if model was successfully added, False otherwise.

    Raises:
        FileNotFoundError: If registry file doesn't exist.
        ValueError: If model_entry validation fails.
        IOError: If registry file cannot be read or written.

    Example:
        >>> model_entry = {
        ...     "description": "Custom VITS model",
        ...     "license": "MIT",
        ...     "author": "@user",
        ...     "github_rls_url": "https://github.com/user/model.zip",
        ...     "default_vocoder": None
        ... }
        >>> add_model_to_registry(
        ...     model_entry, "tts_models", "en", "custom", "vits_custom"
        ... )
        True
    """
    try:
        # Validate model entry
        if not validate_model_entry(model_entry):
            logger.error("Model entry validation failed")
            return False

        # Determine registry path
        if registry_path is None:
            registry_path = Path(__file__).parent.parent / ".models.json"
        else:
            registry_path = Path(registry_path)

        if not registry_path.exists():
            raise FileNotFoundError(f"Registry file not found: {registry_path}")

        # Load existing registry
        logger.info("Loading model registry from %s", registry_path)
        registry_data = read_json_with_comments(registry_path)

        # Initialize nested structure if needed
        if model_type not in registry_data:
            registry_data[model_type] = {}
        if language not in registry_data[model_type]:
            registry_data[model_type][language] = {}
        if dataset not in registry_data[model_type][language]:
            registry_data[model_type][language][dataset] = {}

        # Check if model already exists
        if model_name in registry_data[model_type][language][dataset]:
            logger.warning(
                "Model %s/%s/%s/%s already exists in registry, overwriting",
                model_type,
                language,
                dataset,
                model_name,
            )

        # Add model entry
        registry_data[model_type][language][dataset][model_name] = model_entry

        # Write updated registry back to file
        with fsspec.open(registry_path, "w", encoding="utf-8") as f:
            json.dump(registry_data, f, indent=4, ensure_ascii=False)

        logger.info(
            "Successfully added model %s/%s/%s/%s to registry",
            model_type,
            language,
            dataset,
            model_name,
        )
        return True

    except FileNotFoundError as e:
        logger.error("Registry file not found: %s", e)
        raise
    except ValueError as e:
        logger.error("Model entry validation error: %s", e)
        raise
    except (IOError, OSError) as e:
        logger.error("Failed to read/write registry file: %s", e)
        raise
    except Exception as e:
        logger.error("Unexpected error adding model to registry: %s", e)
        return False


def validate_model_entry(model_entry: Dict[str, Any]) -> bool:
    """Validate a model entry for basic field requirements.

    Performs basic validation on model entry fields to ensure they meet
    minimum requirements for the TTS model registry.

    Args:
        model_entry (Dict[str, Any]): Model configuration dictionary to validate.

    Returns:
        bool: True if validation passes, False otherwise.

    Raises:
        ValueError: If critical validation errors are found.
    """
    if not isinstance(model_entry, dict):
        raise ValueError("Model entry must be a dictionary")

    # Check for at least one source URL
    url_fields = ["github_rls_url", "hf_url", "model_url"]
    has_url = any(field in model_entry for field in url_fields)
    
    if not has_url:
        logger.warning("Model entry missing source URL (github_rls_url, hf_url, or model_url)")
        # Don't fail validation as some models might use other sources
    
    # Validate URL fields if present
    for field in url_fields:
        if field in model_entry:
            url_value = model_entry[field]
            if not isinstance(url_value, (str, list)):
                raise ValueError(f"Field '{field}' must be a string or list of strings")
            if isinstance(url_value, list):
                if not all(isinstance(url, str) for url in url_value):
                    raise ValueError(f"All URLs in '{field}' must be strings")

    # Validate boolean fields
    boolean_fields = ["tos_required"]
    for field in boolean_fields:
        if field in model_entry and not isinstance(model_entry[field], bool):
            raise ValueError(f"Field '{field}' must be a boolean")

    # Validate string fields (allow None/null)
    string_fields = ["description", "license", "author", "contact", "commit", "default_vocoder"]
    for field in string_fields:
        if field in model_entry:
            value = model_entry[field]
            if value is not None and not isinstance(value, str):
                raise ValueError(f"Field '{field}' must be a string or null")

    logger.debug("Model entry validation passed")
    return True


def list_registry_models(
    registry_path: Optional[Union[str, os.PathLike[Any]]] = None,
    model_type: Optional[str] = None,
) -> List[str]:
    """List all models in the registry for debugging purposes.

    Args:
        registry_path (Optional[Union[str, os.PathLike[Any]]]): Path to the registry file.
            Defaults to TTS/.models.json.
        model_type (Optional[str]): Filter by model type. If None, lists all types.

    Returns:
        List[str]: List of model names in format "type/language/dataset/model".

    Raises:
        FileNotFoundError: If registry file doesn't exist.
        IOError: If registry file cannot be read.

    Example:
        >>> models = list_registry_models(model_type="tts_models")
        >>> print(f"Found {len(models)} TTS models")
    """
    try:
        # Determine registry path
        if registry_path is None:
            registry_path = Path(__file__).parent.parent / ".models.json"
        else:
            registry_path = Path(registry_path)

        if not registry_path.exists():
            raise FileNotFoundError(f"Registry file not found: {registry_path}")

        # Load registry
        logger.debug("Loading model registry from %s", registry_path)
        registry_data = read_json_with_comments(registry_path)

        model_list = []
        
        # Filter by model type if specified
        model_types = [model_type] if model_type else list(registry_data.keys())
        
        for m_type in model_types:
            if m_type not in registry_data:
                continue
                
            for language in registry_data[m_type]:
                for dataset in registry_data[m_type][language]:
                    for model in registry_data[m_type][language][dataset]:
                        model_full_name = f"{m_type}/{language}/{dataset}/{model}"
                        model_list.append(model_full_name)

        logger.debug("Found %d models in registry", len(model_list))
        return sorted(model_list)

    except FileNotFoundError as e:
        logger.error("Registry file not found: %s", e)
        raise
    except (IOError, OSError) as e:
        logger.error("Failed to read registry file: %s", e)
        raise
    except Exception as e:
        logger.error("Unexpected error listing registry models: %s", e)
        return []