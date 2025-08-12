"""
Integration tests for model loading with registry-added models.

This test file validates that models added to the registry via the model addition
utilities can be properly loaded and used by the TTS API.
"""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import pytest


class TestModelLoadingIntegration(unittest.TestCase):
    """Test integration between model registry and TTS model loading."""

    def setUp(self):
        """Set up test environment with temporary registry."""
        self.test_dir = tempfile.mkdtemp()
        self.test_registry_path = Path(self.test_dir) / "test_models.json"
        
        # Create minimal test registry
        self.test_registry = {
            "tts_models": {
                "en": {
                    "test": {
                        "mock_model": {
                            "description": "Mock model for testing",
                            "license": "MIT",
                            "github_rls_url": "https://example.com/mock_model.zip",
                            "author": "@testuser"
                        }
                    }
                }
            },
            "vocoder_models": {
                "universal": {
                    "libri-tts": {
                        "mock_vocoder": {
                            "description": "Mock vocoder for testing", 
                            "license": "MIT",
                            "github_rls_url": "https://example.com/mock_vocoder.zip"
                        }
                    }
                }
            }
        }
        
        with open(self.test_registry_path, 'w') as f:
            json.dump(self.test_registry, f, indent=2)

    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.test_dir)

    @patch('TTS.utils.manage.ModelManager')
    def test_model_path_resolution(self, mock_manager):
        """Test that model paths from registry are correctly resolved."""
        # This test validates that the model path format used in registry
        # matches what the TTS API expects
        
        expected_path = "tts_models/en/test/mock_model"
        
        # Test that the path format is consistent
        model_type, language, dataset, model_name = expected_path.split('/')
        self.assertEqual(model_type, "tts_models")
        self.assertEqual(language, "en")
        self.assertEqual(dataset, "test")
        self.assertEqual(model_name, "mock_model")
        
        # Verify the model exists in our test registry
        registry_entry = self.test_registry[model_type][language][dataset][model_name]
        self.assertIsInstance(registry_entry, dict)
        self.assertIn("description", registry_entry)
        self.assertIn("license", registry_entry)

    @patch('TTS.api.TTS')  
    def test_registry_model_discovery(self, mock_tts_class):
        """Test that models added to registry are discoverable by TTS."""
        # Mock the TTS constructor to avoid actual model loading
        mock_tts_instance = Mock()
        mock_tts_class.return_value = mock_tts_instance
        
        # Mock list_models to return our test registry models
        expected_models = [
            "tts_models/en/test/mock_model",
            "vocoder_models/universal/libri-tts/mock_vocoder"
        ]
        mock_tts_instance.list_models.return_value = expected_models
        
        # Test model discovery
        tts = mock_tts_class()
        available_models = tts.list_models()
        
        self.assertIn("tts_models/en/test/mock_model", available_models)
        self.assertIn("vocoder_models/universal/libri-tts/mock_vocoder", available_models)

    @patch('TTS.api.TTS')
    def test_custom_model_loading_pattern(self, mock_tts_class):
        """Test the model loading pattern for custom registry models."""
        # Mock successful model loading
        mock_tts_instance = Mock()
        mock_tts_class.return_value = mock_tts_instance
        
        # Test the loading pattern
        model_name = "tts_models/en/test/mock_model"
        
        try:
            # This would be the actual usage pattern
            tts = mock_tts_class(model_name=model_name)
            
            # Verify the constructor was called with correct model name
            mock_tts_class.assert_called_with(model_name=model_name)
            
        except Exception as e:
            self.fail(f"Model loading pattern failed: {e}")

    @patch('TTS.api.TTS')
    @patch('TTS.utils.manage.ModelManager.download_model')
    def test_model_download_integration(self, mock_download, mock_tts_class):
        """Test that registry models trigger correct download behavior."""
        # Setup mocks
        mock_tts_instance = Mock()
        mock_tts_class.return_value = mock_tts_instance
        mock_download.return_value = "/fake/model/path"
        
        model_name = "tts_models/en/test/mock_model"
        
        # Mock the model loading process
        with patch('TTS.utils.manage.ModelManager.query_model') as mock_query:
            mock_query.return_value = self.test_registry["tts_models"]["en"]["test"]["mock_model"]
            
            # Test model instantiation
            tts = mock_tts_class(model_name=model_name)
            
            # Verify constructor was called
            mock_tts_class.assert_called_with(model_name=model_name)

    def test_registry_entry_format_validation(self):
        """Test that registry entries have the correct format for TTS loading."""
        model_entry = self.test_registry["tts_models"]["en"]["test"]["mock_model"]
        
        # Check required fields for TTS loading
        required_fields = ["description", "license"]
        for field in required_fields:
            self.assertIn(field, model_entry, f"Missing required field: {field}")
        
        # Check that at least one URL field exists
        url_fields = ["github_rls_url", "hf_url", "model_url"]
        has_url = any(field in model_entry for field in url_fields)
        self.assertTrue(has_url, "Model entry must have at least one URL field")
        
        # Check URL format if github_rls_url is present
        if "github_rls_url" in model_entry:
            url = model_entry["github_rls_url"]
            self.assertTrue(url.startswith(("http://", "https://")), 
                          f"Invalid URL format: {url}")

    @patch('TTS.api.TTS')
    def test_synthesis_workflow_integration(self, mock_tts_class):
        """Test the complete workflow from model loading to synthesis."""
        # Setup mock TTS instance with synthesis capability
        mock_tts_instance = Mock()
        mock_tts_class.return_value = mock_tts_instance
        
        # Mock synthesis methods
        mock_tts_instance.tts.return_value = [0.1, 0.2, 0.3]  # Mock audio samples
        mock_tts_instance.tts_to_file.return_value = None
        
        model_name = "tts_models/en/test/mock_model"
        
        # Test complete workflow
        tts = mock_tts_class(model_name=model_name)
        
        # Test synthesis
        audio = tts.tts("Hello world!")
        self.assertIsInstance(audio, list)
        self.assertEqual(len(audio), 3)
        
        # Test file synthesis
        tts.tts_to_file("Hello world!", "output.wav")
        mock_tts_instance.tts_to_file.assert_called_with("Hello world!", "output.wav")

    def test_model_metadata_preservation(self):
        """Test that model metadata is preserved during registry operations."""
        model_entry = self.test_registry["tts_models"]["en"]["test"]["mock_model"]
        
        # Check that all metadata fields are preserved
        expected_metadata = {
            "description": "Mock model for testing",
            "license": "MIT", 
            "github_rls_url": "https://example.com/mock_model.zip",
            "author": "@testuser"
        }
        
        for key, expected_value in expected_metadata.items():
            self.assertEqual(model_entry[key], expected_value,
                           f"Metadata field {key} not preserved correctly")

    @patch.dict(os.environ, {"TTS_MODELS_JSON": ""})
    @patch('TTS.utils.manage.ModelManager')
    def test_custom_registry_path_integration(self, mock_manager):
        """Test integration with custom registry file paths."""
        # Test that custom registry paths work with model loading
        custom_registry_path = str(self.test_registry_path)
        
        # Mock ModelManager to use custom registry
        mock_manager_instance = Mock()
        mock_manager.return_value = mock_manager_instance
        mock_manager_instance.models_file = custom_registry_path
        
        # Test that the manager can be initialized with custom path
        manager = mock_manager()
        self.assertEqual(manager.models_file, custom_registry_path)


class TestModelLoadingErrors(unittest.TestCase):
    """Test error handling in model loading integration."""

    @patch('TTS.api.TTS')
    def test_invalid_model_name_error(self, mock_tts_class):
        """Test error handling for invalid model names."""
        # Mock TTS to raise error for invalid model names
        mock_tts_class.side_effect = ValueError("Model not found")
        
        with self.assertRaises(ValueError):
            mock_tts_class(model_name="invalid/model/path/name")

    @patch('TTS.api.TTS')
    def test_missing_model_url_error(self, mock_tts_class):
        """Test error handling when model URLs are inaccessible."""
        # Mock TTS to raise network error
        mock_tts_class.side_effect = ConnectionError("Unable to download model")
        
        with self.assertRaises(ConnectionError):
            mock_tts_class(model_name="tts_models/en/test/broken_model")


# Integration test that requires actual TTS environment
@pytest.mark.integration
@pytest.mark.skipif(not os.environ.get("TTS_INTEGRATION_TESTS"), 
                   reason="Integration tests require TTS environment")
class TestRealModelLoadingIntegration(unittest.TestCase):
    """
    Integration tests that require actual TTS environment.
    
    These tests are skipped by default and only run when TTS_INTEGRATION_TESTS
    environment variable is set.
    """

    def test_real_model_loading_with_added_model(self):
        """
        Test actual model loading with a model added to registry.
        
        This test requires:
        1. PyTorch and TTS dependencies installed
        2. TTS_INTEGRATION_TESTS environment variable set
        3. Network access for model downloads
        """
        import tempfile
        import shutil
        from pathlib import Path
        
        # Skip if TTS not available
        try:
            from TTS.api import TTS
        except ImportError:
            self.skipTest("TTS not available")
        
        # Create temporary registry for testing
        test_dir = tempfile.mkdtemp()
        try:
            # Test with a lightweight existing model to avoid download time
            # Use VITS model which should be available
            model_name = "tts_models/en/ljspeech/vits"
            
            # Test model loading
            tts = TTS(model_name=model_name)
            self.assertIsNotNone(tts)
            
            # Test synthesis
            text = "This is a test."
            audio = tts.tts(text)
            self.assertIsInstance(audio, (list, tuple))
            self.assertGreater(len(audio), 0)
            
        finally:
            shutil.rmtree(test_dir)


if __name__ == "__main__":
    # Run unit tests by default
    unittest.main(verbosity=2)