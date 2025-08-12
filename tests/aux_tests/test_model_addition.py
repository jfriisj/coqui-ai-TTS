import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, mock_open, patch

import pytest

from TTS.utils.model_addition import add_model_to_registry, list_registry_models, validate_model_entry


class TestValidateModelEntry:
    """Test cases for validate_model_entry function."""

    def test_validate_model_entry_valid_basic(self):
        """Test validation passes for basic valid model entry."""
        model_entry = {
            "description": "Test model",
            "license": "MIT",
            "author": "@test_user",
            "github_rls_url": "https://github.com/test/model.zip",
            "default_vocoder": None,
        }
        assert validate_model_entry(model_entry) is True

    def test_validate_model_entry_valid_with_hf_url(self):
        """Test validation passes with HuggingFace URL."""
        model_entry = {
            "description": "HF model",
            "hf_url": "https://huggingface.co/test/model/resolve/main/model.pth",
            "tos_required": True,
        }
        assert validate_model_entry(model_entry) is True

    def test_validate_model_entry_valid_with_multiple_urls(self):
        """Test validation passes with multiple URLs."""
        model_entry = {
            "description": "Multi-URL model",
            "hf_url": [
                "https://huggingface.co/test/model.pth",
                "https://huggingface.co/test/config.json",
            ],
            "model_url": "https://example.com/model.zip",
        }
        assert validate_model_entry(model_entry) is True

    def test_validate_model_entry_valid_minimal(self):
        """Test validation passes for minimal entry without URLs."""
        model_entry = {"description": "Minimal model"}
        assert validate_model_entry(model_entry) is True

    def test_validate_model_entry_invalid_not_dict(self):
        """Test validation fails for non-dictionary input."""
        with pytest.raises(ValueError, match="Model entry must be a dictionary"):
            validate_model_entry("not a dict")

        with pytest.raises(ValueError, match="Model entry must be a dictionary"):
            validate_model_entry(["list", "not", "dict"])

    def test_validate_model_entry_invalid_url_type(self):
        """Test validation fails for invalid URL field types."""
        model_entry = {"github_rls_url": 123}
        with pytest.raises(ValueError, match="Field 'github_rls_url' must be a string or list"):
            validate_model_entry(model_entry)

    def test_validate_model_entry_invalid_url_list_contents(self):
        """Test validation fails for invalid URL list contents."""
        model_entry = {"hf_url": ["valid_url", 123, "another_url"]}
        with pytest.raises(ValueError, match="All URLs in 'hf_url' must be strings"):
            validate_model_entry(model_entry)

    def test_validate_model_entry_invalid_boolean_field(self):
        """Test validation fails for invalid boolean fields."""
        model_entry = {"tos_required": "true"}  # string instead of boolean
        with pytest.raises(ValueError, match="Field 'tos_required' must be a boolean"):
            validate_model_entry(model_entry)

    def test_validate_model_entry_invalid_string_field(self):
        """Test validation fails for invalid string fields."""
        model_entry = {"description": 123}  # number instead of string
        with pytest.raises(ValueError, match="Field 'description' must be a string or null"):
            validate_model_entry(model_entry)

        model_entry = {"license": ["not", "a", "string"]}  # list instead of string
        with pytest.raises(ValueError, match="Field 'license' must be a string or null"):
            validate_model_entry(model_entry)

    def test_validate_model_entry_valid_null_fields(self):
        """Test validation passes with null/None values in string fields."""
        model_entry = {
            "description": None,
            "license": None,
            "author": None,
            "contact": None,
            "commit": None,
            "default_vocoder": None,
            "github_rls_url": "https://github.com/test/model.zip",
        }
        assert validate_model_entry(model_entry) is True


class TestAddModelToRegistry:
    """Test cases for add_model_to_registry function."""

    def setup_method(self):
        """Set up test fixtures."""
        self.valid_model_entry = {
            "description": "Test VITS model",
            "license": "MIT",
            "author": "@test_user",
            "github_rls_url": "https://github.com/test/model.zip",
            "default_vocoder": None,
        }
        self.existing_registry = {
            "tts_models": {
                "en": {
                    "ljspeech": {
                        "tacotron2": {
                            "description": "Existing model",
                            "github_rls_url": "https://github.com/existing/model.zip",
                        }
                    }
                }
            },
            "vocoder_models": {},
        }

    def test_add_model_to_registry_success_new_structure(self):
        """Test successfully adding model to new registry structure."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value={}):
                with patch("fsspec.open", mock_open()) as mock_file:
                    result = add_model_to_registry(
                        self.valid_model_entry,
                        "tts_models",
                        "en",
                        "custom",
                        "vits_custom",
                        registry_path=tmp_path,
                    )

                    assert result is True
                    # Verify the JSON was written
                    mock_file.assert_called_once_with(tmp_path, "w", encoding="utf-8")
                    # Verify write was called on file handle
                    handle = mock_file.return_value.__enter__.return_value
                    handle.write.assert_called()
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_success_existing_structure(self):
        """Test successfully adding model to existing registry structure."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(self.existing_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.existing_registry):
                with patch("fsspec.open", mock_open()) as mock_file:
                    result = add_model_to_registry(
                        self.valid_model_entry,
                        "tts_models",
                        "en",
                        "ljspeech",
                        "vits",
                        registry_path=tmp_path,
                    )

                    assert result is True
                    mock_file.assert_called_once_with(tmp_path, "w", encoding="utf-8")
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_default_path(self):
        """Test adding model with default registry path."""
        mock_registry_data = {"tts_models": {}}
        
        with patch("TTS.utils.model_addition.read_json_with_comments", return_value=mock_registry_data):
            with patch("fsspec.open", mock_open()):
                with patch("pathlib.Path.exists", return_value=True):
                    result = add_model_to_registry(
                        self.valid_model_entry,
                        "tts_models",
                        "en",
                        "custom",
                        "vits_custom",
                    )

                    assert result is True

    def test_add_model_to_registry_overwrite_existing(self):
        """Test overwriting existing model with warning."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(self.existing_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.existing_registry):
                with patch("fsspec.open", mock_open()):
                    with patch("TTS.utils.model_addition.logger") as mock_logger:
                        result = add_model_to_registry(
                            self.valid_model_entry,
                            "tts_models",
                            "en", 
                            "ljspeech",
                            "tacotron2",  # existing model
                            registry_path=tmp_path,
                        )

                        assert result is True
                        # Verify warning was logged
                        mock_logger.warning.assert_called_once()
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_invalid_entry(self):
        """Test failure with invalid model entry."""
        invalid_entry = {"github_rls_url": 123}  # invalid type

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            result = add_model_to_registry(
                invalid_entry,
                "tts_models",
                "en",
                "custom",
                "vits_custom",
                registry_path=tmp_path,
            )

            assert result is False
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_file_not_found(self):
        """Test failure when registry file doesn't exist."""
        non_existent_path = Path("/non/existent/path.json")
        
        with pytest.raises(FileNotFoundError, match="Registry file not found"):
            add_model_to_registry(
                self.valid_model_entry,
                "tts_models",
                "en",
                "custom",
                "vits_custom",
                registry_path=non_existent_path,
            )

    def test_add_model_to_registry_read_error(self):
        """Test failure when registry file cannot be read."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", side_effect=IOError("Read error")):
                with pytest.raises(IOError, match="Read error"):
                    add_model_to_registry(
                        self.valid_model_entry,
                        "tts_models",
                        "en",
                        "custom",
                        "vits_custom",
                        registry_path=tmp_path,
                    )
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_write_error(self):
        """Test failure when registry file cannot be written."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value={}):
                with patch("fsspec.open", side_effect=IOError("Write error")):
                    with pytest.raises(IOError, match="Write error"):
                        add_model_to_registry(
                            self.valid_model_entry,
                            "tts_models",
                            "en",
                            "custom",
                            "vits_custom",
                            registry_path=tmp_path,
                        )
        finally:
            tmp_path.unlink()

    def test_add_model_to_registry_unexpected_error(self):
        """Test handling of unexpected errors."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value={}):
                with patch("json.dump", side_effect=RuntimeError("Unexpected error")):
                    result = add_model_to_registry(
                        self.valid_model_entry,
                        "tts_models",
                        "en",
                        "custom",
                        "vits_custom",
                        registry_path=tmp_path,
                    )

                    assert result is False
        finally:
            tmp_path.unlink()


class TestListRegistryModels:
    """Test cases for list_registry_models function."""

    def setup_method(self):
        """Set up test fixtures."""
        self.sample_registry = {
            "tts_models": {
                "en": {
                    "ljspeech": {
                        "tacotron2": {"description": "Tacotron2 model"},
                        "vits": {"description": "VITS model"},
                    },
                    "common-voice": {
                        "glow_tts": {"description": "Glow TTS model"}
                    },
                },
                "multilingual": {
                    "multi-dataset": {
                        "xtts_v2": {"description": "XTTS v2 model"}
                    }
                },
            },
            "vocoder_models": {
                "universal": {
                    "libri-tts": {
                        "hifigan": {"description": "HiFiGAN vocoder"}
                    }
                }
            },
        }

    def test_list_registry_models_all_models(self):
        """Test listing all models in registry."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(self.sample_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.sample_registry):
                models = list_registry_models(registry_path=tmp_path)

                expected_models = [
                    "tts_models/en/common-voice/glow_tts",
                    "tts_models/en/ljspeech/tacotron2",
                    "tts_models/en/ljspeech/vits", 
                    "tts_models/multilingual/multi-dataset/xtts_v2",
                    "vocoder_models/universal/libri-tts/hifigan",
                ]
                assert models == expected_models
        finally:
            tmp_path.unlink()

    def test_list_registry_models_filtered_by_type(self):
        """Test listing models filtered by type."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(self.sample_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.sample_registry):
                models = list_registry_models(registry_path=tmp_path, model_type="tts_models")

                expected_models = [
                    "tts_models/en/common-voice/glow_tts",
                    "tts_models/en/ljspeech/tacotron2",
                    "tts_models/en/ljspeech/vits",
                    "tts_models/multilingual/multi-dataset/xtts_v2",
                ]
                assert models == expected_models

                # Test with vocoder models
                models = list_registry_models(registry_path=tmp_path, model_type="vocoder_models")
                expected_models = ["vocoder_models/universal/libri-tts/hifigan"]
                assert models == expected_models
        finally:
            tmp_path.unlink()

    def test_list_registry_models_nonexistent_type(self):
        """Test listing models with non-existent type filter."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(self.sample_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.sample_registry):
                models = list_registry_models(registry_path=tmp_path, model_type="nonexistent_type")
                assert models == []
        finally:
            tmp_path.unlink()

    def test_list_registry_models_default_path(self):
        """Test listing models with default registry path."""
        with patch("TTS.utils.model_addition.read_json_with_comments", return_value=self.sample_registry):
            with patch("pathlib.Path.exists", return_value=True):
                models = list_registry_models()
                assert len(models) == 5  # Total models in sample registry

    def test_list_registry_models_empty_registry(self):
        """Test listing models from empty registry."""
        empty_registry = {}
        
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump(empty_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", return_value=empty_registry):
                models = list_registry_models(registry_path=tmp_path)
                assert models == []
        finally:
            tmp_path.unlink()

    def test_list_registry_models_file_not_found(self):
        """Test failure when registry file doesn't exist."""
        non_existent_path = Path("/non/existent/path.json")
        
        with pytest.raises(FileNotFoundError, match="Registry file not found"):
            list_registry_models(registry_path=non_existent_path)

    def test_list_registry_models_read_error(self):
        """Test failure when registry file cannot be read."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", side_effect=IOError("Read error")):
                with pytest.raises(IOError, match="Read error"):
                    list_registry_models(registry_path=tmp_path)
        finally:
            tmp_path.unlink()

    def test_list_registry_models_unexpected_error(self):
        """Test handling of unexpected errors returns empty list."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            with patch("TTS.utils.model_addition.read_json_with_comments", side_effect=RuntimeError("Unexpected")):
                models = list_registry_models(registry_path=tmp_path)
                assert models == []
        finally:
            tmp_path.unlink()


class TestIntegrationModelAddition:
    """Integration tests with actual file operations."""

    def test_integration_add_and_list_models(self):
        """Integration test: add model and verify it can be listed."""
        model_entry = {
            "description": "Integration test model",
            "license": "Apache-2.0",
            "author": "@integration_test",
            "github_rls_url": "https://github.com/test/integration.zip",
            "default_vocoder": None,
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            # Start with minimal registry
            initial_registry = {"tts_models": {}}
            json.dump(initial_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            # Add the model
            success = add_model_to_registry(
                model_entry,
                "tts_models",
                "en",
                "integration_test",
                "test_model",
                registry_path=tmp_path,
            )
            assert success is True

            # Verify it can be listed
            models = list_registry_models(registry_path=tmp_path)
            expected_model = "tts_models/en/integration_test/test_model"
            assert expected_model in models

            # Verify specific filter works
            tts_models = list_registry_models(registry_path=tmp_path, model_type="tts_models")
            assert expected_model in tts_models

            # Verify content by reading the file directly
            with open(tmp_path, encoding="utf-8") as f:
                updated_registry = json.load(f)
            
            assert "tts_models" in updated_registry
            assert "en" in updated_registry["tts_models"]
            assert "integration_test" in updated_registry["tts_models"]["en"]
            assert "test_model" in updated_registry["tts_models"]["en"]["integration_test"]
            assert updated_registry["tts_models"]["en"]["integration_test"]["test_model"] == model_entry

        finally:
            tmp_path.unlink()

    def test_integration_model_entry_validation_end_to_end(self):
        """Integration test: ensure validation works in real add_model scenario."""
        # Test with invalid entry
        invalid_model_entry = {
            "description": "Invalid test model",
            "github_rls_url": 123,  # Invalid type
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({"tts_models": {}}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            # Should fail due to validation
            success = add_model_to_registry(
                invalid_model_entry,
                "tts_models",
                "en",
                "test_invalid",
                "invalid_model",
                registry_path=tmp_path,
            )
            assert success is False

            # Verify model was not added
            models = list_registry_models(registry_path=tmp_path)
            assert "tts_models/en/test_invalid/invalid_model" not in models

        finally:
            tmp_path.unlink()