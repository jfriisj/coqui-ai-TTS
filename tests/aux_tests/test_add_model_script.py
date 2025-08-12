"""Tests for scripts/add_model.py CLI script.

This module provides comprehensive tests for the CLI script that adds models
to the TTS registry, including argument parsing, validation, and end-to-end workflows.
"""

import json
import tempfile
from argparse import ArgumentParser
from pathlib import Path
from unittest.mock import Mock, patch, mock_open

import pytest

# Import the CLI module
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

from scripts.add_model import (
    VALID_MODEL_TYPES,
    URL_PATTERN,
    create_model_entry,
    main,
    parse_args,
    validate_arguments,
    validate_model_type,
    validate_url,
)


class TestValidateUrl:
    """Test cases for validate_url function."""

    def test_validate_url_valid_https(self):
        """Test validation passes for valid HTTPS URLs."""
        valid_urls = [
            "https://github.com/user/repo/releases/download/v1.0/model.zip",
            "https://huggingface.co/user/model/resolve/main/pytorch_model.bin",
            "https://example.com/path/to/model.pth",
            "https://api.github.com/repos/user/repo/zipball/main",
            "https://storage.googleapis.com/bucket/model.tar.gz",
            "https://s3.amazonaws.com/bucket/model.zip",
        ]
        for url in valid_urls:
            assert validate_url(url) is True, f"URL should be valid: {url}"

    def test_validate_url_valid_http(self):
        """Test validation passes for valid HTTP URLs."""
        valid_urls = [
            "http://example.com/model.zip",
            "http://localhost:8080/model.pth",
            "http://192.168.1.1:3000/api/model",
        ]
        for url in valid_urls:
            assert validate_url(url) is True, f"URL should be valid: {url}"

    def test_validate_url_invalid_formats(self):
        """Test validation fails for invalid URL formats."""
        invalid_urls = [
            "",
            "not-a-url",
            "ftp://example.com/model.zip",  # Unsupported protocol
            "https://",  # Incomplete
            "https:///path",  # No host
            "http://.com",  # Invalid host
            "https://example.com:99999/model.zip",  # Invalid port
        ]
        for url in invalid_urls:
            assert validate_url(url) is False, f"URL should be invalid: {url}"

    def test_validate_url_edge_cases(self):
        """Test validation handles edge cases properly."""
        # None and non-string inputs
        assert validate_url(None) is False
        assert validate_url(123) is False
        assert validate_url([]) is False
        
        # Whitespace handling
        assert validate_url("  https://example.com/model.zip  ") is True
        assert validate_url("   ") is False


class TestValidateModelType:
    """Test cases for validate_model_type function."""

    def test_validate_model_type_valid(self):
        """Test validation passes for valid model types."""
        for model_type in VALID_MODEL_TYPES:
            assert validate_model_type(model_type) is True

    def test_validate_model_type_invalid(self):
        """Test validation fails for invalid model types."""
        invalid_types = [
            "invalid_type",
            "TTS_MODELS",  # Wrong case
            "tts-models",  # Wrong separator
            "",
            None,
            123,
        ]
        for model_type in invalid_types:
            assert validate_model_type(model_type) is False


class TestParseArgs:
    """Test cases for parse_args function."""

    def test_parse_args_minimal_valid(self):
        """Test parsing with minimal valid arguments."""
        args_list = [
            "--model-name", "test_model",
            "--model-type", "tts_models",
            "--language", "en",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
        ]
        
        args = parse_args(args_list)
        
        assert args.model_name == "test_model"
        assert args.model_type == "tts_models"
        assert args.language == "en"
        assert args.dataset == "custom"
        assert args.github_rls_url == "https://github.com/user/model.zip"
        assert args.hf_url is None
        assert args.model_url is None

    def test_parse_args_all_optional_fields(self):
        """Test parsing with all optional fields provided."""
        args_list = [
            "--model-name", "vits_custom",
            "--model-type", "tts_models",
            "--language", "multilingual",
            "--dataset", "common-voice",
            "--github-rls-url", "https://github.com/user/model.zip",
            "--description", "Custom VITS model for multilingual synthesis",
            "--license", "Apache-2.0",
            "--author", "@researcher",
            "--contact", "researcher@example.com",
            "--commit", "abc123def456",
            "--default-vocoder", "vocoder_models/universal/libri-tts/hifigan",
            "--tos-required",
            "--verbose",
        ]
        
        args = parse_args(args_list)
        
        assert args.model_name == "vits_custom"
        assert args.description == "Custom VITS model for multilingual synthesis"
        assert args.license == "Apache-2.0"
        assert args.author == "@researcher"
        assert args.contact == "researcher@example.com"
        assert args.commit == "abc123def456"
        assert args.default_vocoder == "vocoder_models/universal/libri-tts/hifigan"
        assert args.tos_required is True
        assert args.verbose is True

    def test_parse_args_multiple_model_urls(self):
        """Test parsing with multiple model URLs."""
        args_list = [
            "--model-name", "multi_url_model",
            "--model-type", "voice_conversion_models",
            "--language", "en",
            "--dataset", "custom",
            "--model-url", "https://example.com/model1.zip",
            "--model-url", "https://example.com/model2.zip",
            "--model-url", "https://example.com/config.json",
        ]
        
        args = parse_args(args_list)
        
        assert args.model_url == [
            "https://example.com/model1.zip",
            "https://example.com/model2.zip", 
            "https://example.com/config.json"
        ]

    def test_parse_args_hf_url(self):
        """Test parsing with Hugging Face URL."""
        args_list = [
            "--model-name", "hf_model",
            "--model-type", "vocoder_models",
            "--language", "en",
            "--dataset", "ljspeech",
            "--hf-url", "https://huggingface.co/user/model/resolve/main/model.pth",
        ]
        
        args = parse_args(args_list)
        
        assert args.hf_url == "https://huggingface.co/user/model/resolve/main/model.pth"

    def test_parse_args_custom_registry_path(self):
        """Test parsing with custom registry path."""
        args_list = [
            "--model-name", "test_model",
            "--model-type", "tts_models",
            "--language", "en",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
            "--registry-path", "/custom/path/models.json",
        ]
        
        args = parse_args(args_list)
        
        assert args.registry_path == "/custom/path/models.json"

    def test_parse_args_missing_required_field(self):
        """Test parsing fails with missing required fields."""
        # Missing model-name
        with pytest.raises(SystemExit):
            parse_args([
                "--model-type", "tts_models",
                "--language", "en",
                "--dataset", "custom",
                "--github-rls-url", "https://github.com/user/model.zip",
            ])
        
        # Missing model-type
        with pytest.raises(SystemExit):
            parse_args([
                "--model-name", "test_model",
                "--language", "en",
                "--dataset", "custom",
                "--github-rls-url", "https://github.com/user/model.zip",
            ])

    def test_parse_args_invalid_model_type(self):
        """Test parsing fails with invalid model type."""
        with pytest.raises(SystemExit):
            parse_args([
                "--model-name", "test_model",
                "--model-type", "invalid_type",
                "--language", "en",
                "--dataset", "custom",
                "--github-rls-url", "https://github.com/user/model.zip",
            ])

    def test_parse_args_no_urls_provided(self):
        """Test parsing fails when no URLs are provided."""
        with pytest.raises(SystemExit):
            parse_args([
                "--model-name", "test_model",
                "--model-type", "tts_models",
                "--language", "en",
                "--dataset", "custom",
            ])


class TestValidateArguments:
    """Test cases for validate_arguments function."""

    def setup_method(self):
        """Set up test fixtures."""
        self.valid_args = Mock()
        self.valid_args.model_name = "test_model"
        self.valid_args.model_type = "tts_models"
        self.valid_args.language = "en"
        self.valid_args.dataset = "custom"
        self.valid_args.github_rls_url = "https://github.com/user/model.zip"
        self.valid_args.hf_url = None
        self.valid_args.model_url = None
        self.valid_args.default_vocoder = None

    def test_validate_arguments_valid(self):
        """Test validation passes for valid arguments."""
        assert validate_arguments(self.valid_args) is True

    def test_validate_arguments_invalid_github_url(self):
        """Test validation fails for invalid GitHub URL."""
        self.valid_args.github_rls_url = "not-a-url"
        
        with patch("scripts.add_model.logger") as mock_logger:
            assert validate_arguments(self.valid_args) is False
            mock_logger.error.assert_called()

    def test_validate_arguments_invalid_hf_url(self):
        """Test validation fails for invalid Hugging Face URL."""
        self.valid_args.hf_url = "invalid-url"
        
        with patch("scripts.add_model.logger") as mock_logger:
            assert validate_arguments(self.valid_args) is False
            mock_logger.error.assert_called()

    def test_validate_arguments_invalid_model_url_list(self):
        """Test validation fails for invalid model URLs in list."""
        self.valid_args.model_url = [
            "https://valid.com/model.zip",
            "invalid-url",
            "https://another-valid.com/config.json"
        ]
        
        with patch("scripts.add_model.logger") as mock_logger:
            assert validate_arguments(self.valid_args) is False
            mock_logger.error.assert_called()

    def test_validate_arguments_invalid_model_name(self):
        """Test validation fails for invalid model name format."""
        invalid_names = [
            "model with spaces",
            "model@special",
            "model.dot",
            "model/slash",
        ]
        
        for invalid_name in invalid_names:
            self.valid_args.model_name = invalid_name
            
            with patch("scripts.add_model.logger") as mock_logger:
                assert validate_arguments(self.valid_args) is False
                mock_logger.error.assert_called()

    def test_validate_arguments_invalid_language_format(self):
        """Test validation fails for invalid language format."""
        self.valid_args.language = "en-US@special"
        
        with patch("scripts.add_model.logger") as mock_logger:
            assert validate_arguments(self.valid_args) is False
            mock_logger.error.assert_called()

    def test_validate_arguments_invalid_dataset_format(self):
        """Test validation fails for invalid dataset format."""
        self.valid_args.dataset = "dataset with spaces"
        
        with patch("scripts.add_model.logger") as mock_logger:
            assert validate_arguments(self.valid_args) is False
            mock_logger.error.assert_called()

    def test_validate_arguments_invalid_default_vocoder_format(self):
        """Test validation fails for invalid default vocoder format."""
        invalid_vocoders = [
            "invalid/format",  # Too few parts
            "invalid/format/too/many/parts",  # Too many parts
            "invalid_type/en/ljspeech/hifigan",  # Invalid type
        ]
        
        for invalid_vocoder in invalid_vocoders:
            self.valid_args.default_vocoder = invalid_vocoder
            
            with patch("scripts.add_model.logger") as mock_logger:
                assert validate_arguments(self.valid_args) is False
                mock_logger.error.assert_called()

    def test_validate_arguments_valid_default_vocoder(self):
        """Test validation passes for valid default vocoder format."""
        self.valid_args.default_vocoder = "vocoder_models/universal/libri-tts/hifigan"
        
        assert validate_arguments(self.valid_args) is True


class TestCreateModelEntry:
    """Test cases for create_model_entry function."""

    def setup_method(self):
        """Set up test fixtures."""
        self.args = Mock()
        self.args.github_rls_url = None
        self.args.hf_url = None
        self.args.model_url = None
        self.args.description = None
        self.args.license = None
        self.args.author = None
        self.args.contact = None
        self.args.commit = None
        self.args.default_vocoder = None
        self.args.tos_required = False

    def test_create_model_entry_github_url(self):
        """Test creating model entry with GitHub URL."""
        self.args.github_rls_url = "https://github.com/user/model.zip"
        
        entry = create_model_entry(self.args)
        
        assert entry["github_rls_url"] == "https://github.com/user/model.zip"
        assert "hf_url" not in entry
        assert "model_url" not in entry

    def test_create_model_entry_hf_url(self):
        """Test creating model entry with Hugging Face URL."""
        self.args.hf_url = "https://huggingface.co/user/model"
        
        entry = create_model_entry(self.args)
        
        assert entry["hf_url"] == "https://huggingface.co/user/model"
        assert "github_rls_url" not in entry
        assert "model_url" not in entry

    def test_create_model_entry_single_model_url(self):
        """Test creating model entry with single model URL."""
        self.args.model_url = ["https://example.com/model.zip"]
        
        entry = create_model_entry(self.args)
        
        # Single URL should be stored as string, not list
        assert entry["model_url"] == "https://example.com/model.zip"
        assert isinstance(entry["model_url"], str)

    def test_create_model_entry_multiple_model_urls(self):
        """Test creating model entry with multiple model URLs."""
        self.args.model_url = [
            "https://example.com/model.zip",
            "https://example.com/config.json",
        ]
        
        entry = create_model_entry(self.args)
        
        # Multiple URLs should be stored as list
        assert entry["model_url"] == [
            "https://example.com/model.zip",
            "https://example.com/config.json",
        ]
        assert isinstance(entry["model_url"], list)

    def test_create_model_entry_all_metadata(self):
        """Test creating model entry with all metadata fields."""
        self.args.description = "Test model description"
        self.args.license = "MIT"
        self.args.author = "@researcher"
        self.args.contact = "researcher@example.com"
        self.args.commit = "abc123def456"
        self.args.default_vocoder = "vocoder_models/universal/libri-tts/hifigan"
        self.args.tos_required = True
        self.args.github_rls_url = "https://github.com/user/model.zip"
        
        entry = create_model_entry(self.args)
        
        assert entry["description"] == "Test model description"
        assert entry["license"] == "MIT"
        assert entry["author"] == "@researcher"
        assert entry["contact"] == "researcher@example.com"
        assert entry["commit"] == "abc123def456"
        assert entry["default_vocoder"] == "vocoder_models/universal/libri-tts/hifigan"
        assert entry["tos_required"] is True
        assert entry["github_rls_url"] == "https://github.com/user/model.zip"

    def test_create_model_entry_no_optional_fields(self):
        """Test creating model entry with no optional fields."""
        self.args.github_rls_url = "https://github.com/user/model.zip"
        
        entry = create_model_entry(self.args)
        
        # Only URL should be present
        assert entry == {"github_rls_url": "https://github.com/user/model.zip"}


class TestMainFunction:
    """Test cases for main function."""

    def setup_method(self):
        """Set up test fixtures."""
        self.valid_args = [
            "--model-name", "test_model",
            "--model-type", "tts_models",
            "--language", "en",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
        ]

    def test_main_success_scenario(self):
        """Test successful execution of main function."""
        with patch("scripts.add_model.add_model_to_registry", return_value=True) as mock_add:
            with patch("builtins.print") as mock_print:
                main(self.valid_args)
                
                mock_add.assert_called_once()
                mock_print.assert_called_with("✓ Model 'tts_models/en/custom/test_model' added to registry successfully")

    def test_main_add_model_failure(self):
        """Test main function handles add_model_to_registry failure."""
        with patch("scripts.add_model.add_model_to_registry", return_value=False):
            with patch("builtins.print") as mock_print:
                with pytest.raises(SystemExit) as exc_info:
                    main(self.valid_args)
                
                assert exc_info.value.code == 1
                mock_print.assert_called_with("✗ Failed to add model to registry")

    def test_main_validation_failure(self):
        """Test main function handles validation failure."""
        invalid_args = [
            "--model-name", "test model",  # Invalid name with space
            "--model-type", "tts_models",
            "--language", "en",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
        ]
        
        with patch("scripts.add_model.logger") as mock_logger:
            with pytest.raises(SystemExit) as exc_info:
                main(invalid_args)
            
            assert exc_info.value.code == 1
            mock_logger.error.assert_called()

    def test_main_keyboard_interrupt(self):
        """Test main function handles keyboard interrupt gracefully."""
        with patch("scripts.add_model.parse_args", side_effect=KeyboardInterrupt):
            with patch("builtins.print") as mock_print:
                with pytest.raises(SystemExit) as exc_info:
                    main(self.valid_args)
                
                assert exc_info.value.code == 1
                mock_print.assert_called_with("\nOperation cancelled")

    def test_main_unexpected_exception(self):
        """Test main function handles unexpected exceptions."""
        with patch("scripts.add_model.parse_args", side_effect=RuntimeError("Unexpected error")):
            with patch("builtins.print") as mock_print:
                with pytest.raises(SystemExit) as exc_info:
                    main(self.valid_args)
                
                assert exc_info.value.code == 1
                mock_print.assert_called_with("✗ Error: Unexpected error")

    def test_main_verbose_logging(self):
        """Test main function sets up verbose logging correctly."""
        verbose_args = self.valid_args + ["--verbose"]
        
        with patch("scripts.add_model.add_model_to_registry", return_value=True):
            with patch("scripts.add_model.setup_logger") as mock_setup:
                main(verbose_args)
                
                # Should be called with DEBUG level
                mock_setup.assert_called_once()
                call_args = mock_setup.call_args
                assert call_args[1]["level"] == 10  # logging.DEBUG


class TestEndToEndIntegration:
    """Integration tests with temporary files."""

    def test_integration_add_model_end_to_end(self):
        """Test complete workflow from CLI args to registry update."""
        # Create temporary registry file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            initial_registry = {"tts_models": {}}
            json.dump(initial_registry, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            # Prepare CLI arguments
            args = [
                "--model-name", "integration_test",
                "--model-type", "tts_models",
                "--language", "en",
                "--dataset", "integration",
                "--github-rls-url", "https://github.com/test/integration.zip",
                "--description", "Integration test model",
                "--license", "Apache-2.0",
                "--author", "@integration_test",
                "--registry-path", str(tmp_path),
            ]

            # Execute main function
            main(args)

            # Verify registry was updated
            with open(tmp_path, "r", encoding="utf-8") as f:
                updated_registry = json.load(f)

            expected_path = ["tts_models", "en", "integration", "integration_test"]
            current_level = updated_registry
            for key in expected_path:
                assert key in current_level
                current_level = current_level[key]

            # Verify model entry content
            model_entry = current_level
            assert model_entry["description"] == "Integration test model"
            assert model_entry["license"] == "Apache-2.0"
            assert model_entry["author"] == "@integration_test"
            assert model_entry["github_rls_url"] == "https://github.com/test/integration.zip"

        finally:
            tmp_path.unlink()

    def test_integration_multiple_urls_scenario(self):
        """Test integration with multiple URLs."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            json.dump({"voice_conversion_models": {}}, tmp_file)
            tmp_path = Path(tmp_file.name)

        try:
            args = [
                "--model-name", "multi_url_vc",
                "--model-type", "voice_conversion_models",
                "--language", "multilingual",
                "--dataset", "custom",
                "--model-url", "https://example.com/model1.zip",
                "--model-url", "https://example.com/model2.zip",
                "--hf-url", "https://huggingface.co/test/vc-model",
                "--registry-path", str(tmp_path),
            ]

            main(args)

            # Verify registry content
            with open(tmp_path, "r", encoding="utf-8") as f:
                updated_registry = json.load(f)

            model_entry = updated_registry["voice_conversion_models"]["multilingual"]["custom"]["multi_url_vc"]
            assert isinstance(model_entry["model_url"], list)
            assert len(model_entry["model_url"]) == 2
            assert model_entry["hf_url"] == "https://huggingface.co/test/vc-model"

        finally:
            tmp_path.unlink()

    def test_integration_error_handling_invalid_registry(self):
        """Test integration handles invalid registry file gracefully."""
        # Create file with invalid JSON
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp_file:
            tmp_file.write("invalid json content")
            tmp_path = Path(tmp_file.name)

        try:
            args = [
                "--model-name", "test_model",
                "--model-type", "tts_models",
                "--language", "en",
                "--dataset", "custom",
                "--github-rls-url", "https://github.com/test/model.zip",
                "--registry-path", str(tmp_path),
            ]

            with pytest.raises(SystemExit) as exc_info:
                main(args)

            assert exc_info.value.code == 1

        finally:
            tmp_path.unlink()


class TestURLPatternRegex:
    """Test cases for URL_PATTERN regex."""

    def test_url_pattern_comprehensive_matching(self):
        """Test URL pattern matches various valid URL formats."""
        valid_urls = [
            "https://github.com/user/repo.git",
            "http://localhost:8000/api/v1/model",
            "https://api.example.com:443/models/download?id=123&format=zip",
            "https://cdn.example.com/models/v2.0/pytorch_model.bin",
            "https://storage.googleapis.com/bucket/path/model.tar.gz",
            "http://192.168.1.100:3000/model#section",
        ]
        
        for url in valid_urls:
            match = URL_PATTERN.match(url)
            assert match is not None, f"URL should match pattern: {url}"
            assert match.group(0) == url, f"Full URL should be matched: {url}"

    def test_url_pattern_invalid_formats(self):
        """Test URL pattern rejects invalid formats."""
        invalid_urls = [
            "ftp://example.com/file.txt",
            "https://",
            "http:///path",
            "not-a-url",
            "",
            "mailto:user@example.com",
        ]
        
        for url in invalid_urls:
            match = URL_PATTERN.match(url)
            assert match is None, f"URL should not match pattern: {url}"


class TestArgParsingEdgeCases:
    """Test edge cases in argument parsing."""

    def test_parse_args_empty_string_values(self):
        """Test parsing handles empty string values correctly."""
        args_list = [
            "--model-name", "test",
            "--model-type", "tts_models", 
            "--language", "en",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
            "--description", "",  # Empty description
            "--author", "",  # Empty author
        ]
        
        args = parse_args(args_list)
        
        # Empty strings should still be parsed
        assert args.description == ""
        assert args.author == ""

    def test_parse_args_unicode_handling(self):
        """Test parsing handles Unicode characters in arguments."""
        args_list = [
            "--model-name", "test_unicode",
            "--model-type", "tts_models",
            "--language", "ja",
            "--dataset", "custom",
            "--github-rls-url", "https://github.com/user/model.zip",
            "--description", "日本語のモデル",  # Japanese description
            "--author", "@研究者",  # Japanese author
        ]
        
        args = parse_args(args_list)
        
        assert args.description == "日本語のモデル"
        assert args.author == "@研究者"
        # But validation should still fail due to regex restrictions
        with patch("scripts.add_model.logger"):
            assert validate_arguments(args) is False

    def test_parse_args_very_long_values(self):
        """Test parsing handles very long argument values."""
        long_description = "A" * 1000  # Very long description
        long_url = "https://example.com/" + "very-long-path/" * 50 + "model.zip"
        
        args_list = [
            "--model-name", "test_long",
            "--model-type", "tts_models",
            "--language", "en", 
            "--dataset", "custom",
            "--github-rls-url", long_url,
            "--description", long_description,
        ]
        
        args = parse_args(args_list)
        
        assert args.description == long_description
        assert args.github_rls_url == long_url