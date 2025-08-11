"""
Simple integration test runner for FastAPI TTS server.

This script tests all endpoints without requiring additional dependencies like pytest.
Uses the standard library and FastAPI's TestClient.
"""

import io
import json
import os
import sys
import tempfile
import time
import traceback
from pathlib import Path
from typing import Dict, Any, List, Tuple

import torch
import torchaudio
from fastapi.testclient import TestClient

# Add parent directory to path to import the server
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Mock the version check to avoid metadata issues
import importlib.metadata
def mock_version(package_name):
    if package_name == "coqui-tts":
        return "0.26.0"  # Mock version
    elif package_name == "coqpit-config":
        return "0.2.1"  # Mock version for coqpit
    # Use original function for other packages, but avoid recursion
    original_func = importlib.metadata.__dict__.get('_original_version', lambda x: "0.1.0")
    return original_func(package_name)

# Store original function and patch
importlib.metadata._original_version = importlib.metadata.version
importlib.metadata.version = mock_version

try:
    from TTS.server.server import app, global_model_state, model_cache, model_registry
    
    # Restore original version function
    importlib.metadata.version = importlib.metadata._original_version
except Exception as e:
    # Restore original version function even on error
    importlib.metadata.version = importlib.metadata._original_version
    raise e


class IntegrationTestRunner:
    """Simple test runner for TTS server integration tests."""
    
    def __init__(self):
        self.client = TestClient(app)
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors = []
        
    def run_test(self, test_name: str, test_func):
        """Run a single test and track results."""
        print(f"Running {test_name}...", end=" ")
        
        try:
            result = test_func()
            if result == "SKIP":
                print("SKIPPED")
                self.skipped += 1
            else:
                print("PASSED")
                self.passed += 1
        except Exception as e:
            print("FAILED")
            self.failed += 1
            error_msg = f"{test_name}: {str(e)}\n{traceback.format_exc()}"
            self.errors.append(error_msg)
    
    def assert_status_code(self, response, expected_code: int, message: str = ""):
        """Assert response status code."""
        if response.status_code != expected_code:
            raise AssertionError(
                f"Expected status {expected_code}, got {response.status_code}. {message}"
            )
    
    def assert_in(self, item, container, message: str = ""):
        """Assert item is in container."""
        if item not in container:
            raise AssertionError(f"'{item}' not found in container. {message}")
    
    def assert_true(self, condition, message: str = ""):
        """Assert condition is True."""
        if not condition:
            raise AssertionError(f"Condition was False. {message}")
    
    def test_root_endpoint(self):
        """Test the root endpoint."""
        response = self.client.get("/")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_true("message" in data or "error" in data)
    
    def test_health_endpoint(self):
        """Test the health check endpoint."""
        response = self.client.get("/api/v1/health")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("status", data)
        self.assert_in("model_loaded", data)
        self.assert_in("components", data)
    
    def test_list_models_endpoint(self):
        """Test the models listing endpoint."""
        response = self.client.get("/api/v1/models")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("models", data)
        self.assert_true(isinstance(data["models"], list))
    
    def test_current_model_endpoint(self):
        """Test the current model info endpoint."""
        response = self.client.get("/api/v1/models/current")
        
        if global_model_state.current_model:
            self.assert_status_code(response, 200)
            data = response.json()
            self.assert_in("modelName", data)
            self.assert_in("capabilities", data)
        else:
            self.assert_status_code(response, 404)
    
    def test_available_models_endpoint(self):
        """Test the available models endpoint."""
        response = self.client.get("/api/v1/models/available")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("models", data)
        self.assert_true(isinstance(data["models"], list))
    
    def test_model_status_endpoint(self):
        """Test the model loading status endpoint."""
        response = self.client.get("/api/v1/models/status")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("isLoading", data)
        self.assert_in("progress", data)
        self.assert_in("stage", data)
    
    def test_cache_stats_endpoint(self):
        """Test the cache statistics endpoint."""
        response = self.client.get("/api/v1/cache/stats")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("summary", data)
        self.assert_in("systemMemory", data)
    
    def test_registry_status_endpoint(self):
        """Test the model registry status endpoint."""
        response = self.client.get("/api/v1/registry/status")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("status", data)
        self.assert_in("modelsCount", data)
    
    def test_cache_cleanup_endpoint(self):
        """Test the cache cleanup endpoint."""
        response = self.client.post("/api/v1/cache/cleanup")
        self.assert_status_code(response, 200)
        
        data = response.json()
        self.assert_in("success", data)
    
    def test_tts_synthesis_get(self):
        """Test TTS synthesis via GET request."""
        if not global_model_state.current_model:
            return "SKIP"
        
        response = self.client.get("/api/tts", params={"text": "Hello world"})
        self.assert_status_code(response, 200)
        self.assert_true(response.headers["content-type"] == "audio/wav")
        
        audio_data = response.content
        self.assert_true(len(audio_data) > 0)
        self.assert_true(audio_data.startswith(b'RIFF'))  # WAV header
    
    def test_tts_synthesis_post(self):
        """Test TTS synthesis via POST request."""
        if not global_model_state.current_model:
            return "SKIP"
        
        response = self.client.post("/api/tts", params={"text": "This is a test"})
        self.assert_status_code(response, 200)
        self.assert_true(response.headers["content-type"] == "audio/wav")
    
    def test_tts_synthesis_validation(self):
        """Test TTS synthesis input validation."""
        # Test empty text
        response = self.client.get("/api/tts", params={"text": ""})
        self.assert_status_code(response, 400)
        
        # Test missing text
        response = self.client.get("/api/tts")
        self.assert_status_code(response, 400)
    
    def test_api_v1_tts_endpoint(self):
        """Test the new API v1 TTS endpoint."""
        if not global_model_state.current_model:
            return "SKIP"
        
        payload = {
            "text": "Testing API v1 endpoint",
            "format": "wav"
        }
        
        response = self.client.post("/api/v1/tts", json=payload)
        self.assert_status_code(response, 200)
        self.assert_true(response.headers["content-type"] == "audio/wav")
    
    def test_openai_tts_endpoint(self):
        """Test OpenAI-compatible TTS endpoint."""
        if not global_model_state.current_model:
            return "SKIP"
        
        payload = {
            "model": "tts-1",
            "voice": "alloy",
            "input": "OpenAI compatibility test",
            "response_format": "wav"
        }
        
        response = self.client.post("/v1/audio/speech", json=payload)
        self.assert_status_code(response, 200)
        self.assert_true(response.headers["content-type"] == "audio/wav")
    
    def test_marytts_locales_endpoint(self):
        """Test MaryTTS compatibility - locales endpoint."""
        response = self.client.get("/locales")
        self.assert_status_code(response, 200)
        
        content = response.text
        self.assert_true(len(content.strip()) > 0)
    
    def test_marytts_voices_endpoint(self):
        """Test MaryTTS compatibility - voices endpoint."""
        response = self.client.get("/voices")
        self.assert_status_code(response, 200)
        
        content = response.text
        self.assert_true(len(content.strip()) > 0)
    
    def test_marytts_process_get(self):
        """Test MaryTTS compatibility - process endpoint via GET."""
        if not global_model_state.current_model:
            return "SKIP"
        
        params = {
            "INPUT_TEXT": "MaryTTS test",
            "VOICE": "default"
        }
        
        response = self.client.get("/process", params=params)
        self.assert_status_code(response, 200)
        self.assert_true(response.headers["content-type"] == "audio/wav")
    
    def test_documentation_endpoints(self):
        """Test that API documentation endpoints are available."""
        # Test OpenAPI JSON schema
        response = self.client.get("/openapi.json")
        self.assert_status_code(response, 200)
        
        schema = response.json()
        self.assert_in("openapi", schema)
        self.assert_in("info", schema)
        self.assert_in("paths", schema)
        
        # Test Swagger UI
        response = self.client.get("/docs")
        self.assert_status_code(response, 200)
        self.assert_true("text/html" in response.headers["content-type"])
        
        # Test ReDoc
        response = self.client.get("/redoc")
        self.assert_status_code(response, 200)
        self.assert_true("text/html" in response.headers["content-type"])
    
    def test_error_handling(self):
        """Test error handling for various scenarios."""
        # Test 404 for non-existent endpoint
        response = self.client.get("/non/existent/endpoint")
        self.assert_status_code(response, 404)
        
        # Test invalid JSON payload
        response = self.client.post("/api/v1/tts", data="invalid json")
        self.assert_status_code(response, 422)
    
    def test_concurrent_requests(self):
        """Test server handles concurrent requests properly."""
        if not global_model_state.current_model:
            return "SKIP"
        
        import concurrent.futures
        
        def make_tts_request(text: str):
            response = self.client.get("/api/tts", params={"text": text})
            return response.status_code, len(response.content)
        
        # Make multiple concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for i in range(3):  # Reduced for faster testing
                future = executor.submit(make_tts_request, f"Concurrent test {i}")
                futures.append(future)
            
            results = []
            for future in concurrent.futures.as_completed(futures):
                status_code, content_length = future.result()
                results.append((status_code, content_length))
        
        # All requests should succeed
        for status_code, content_length in results:
            self.assert_true(status_code == 200)
            self.assert_true(content_length > 0)
    
    def run_all_tests(self):
        """Run all integration tests."""
        print("=" * 60)
        print("Starting TTS Server Integration Tests")
        print("=" * 60)
        
        # Wait for server startup to complete
        print("Waiting for server startup...")
        time.sleep(2)
        
        # List of all test methods
        tests = [
            ("Root Endpoint", self.test_root_endpoint),
            ("Health Check", self.test_health_endpoint),
            ("List Models", self.test_list_models_endpoint),
            ("Current Model", self.test_current_model_endpoint),
            ("Available Models", self.test_available_models_endpoint),
            ("Model Status", self.test_model_status_endpoint),
            ("Cache Stats", self.test_cache_stats_endpoint),
            ("Registry Status", self.test_registry_status_endpoint),
            ("Cache Cleanup", self.test_cache_cleanup_endpoint),
            ("TTS Synthesis GET", self.test_tts_synthesis_get),
            ("TTS Synthesis POST", self.test_tts_synthesis_post),
            ("TTS Validation", self.test_tts_synthesis_validation),
            ("API v1 TTS", self.test_api_v1_tts_endpoint),
            ("OpenAI TTS", self.test_openai_tts_endpoint),
            ("MaryTTS Locales", self.test_marytts_locales_endpoint),
            ("MaryTTS Voices", self.test_marytts_voices_endpoint),
            ("MaryTTS Process GET", self.test_marytts_process_get),
            ("Documentation", self.test_documentation_endpoints),
            ("Error Handling", self.test_error_handling),
            ("Concurrent Requests", self.test_concurrent_requests),
        ]
        
        # Run all tests
        for test_name, test_func in tests:
            self.run_test(test_name, test_func)
        
        # Print summary
        print("\n" + "=" * 60)
        print("Test Results Summary")
        print("=" * 60)
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Skipped: {self.skipped}")
        print(f"Total: {self.passed + self.failed + self.skipped}")
        
        if self.failed > 0:
            print(f"\nFailures ({self.failed}):")
            for error in self.errors:
                print(f"\n{error}")
        
        success_rate = (self.passed / (self.passed + self.failed)) * 100 if (self.passed + self.failed) > 0 else 0
        print(f"\nSuccess Rate: {success_rate:.1f}%")
        
        return self.failed == 0


def main():
    """Main entry point for running integration tests."""
    print("TTS Server Integration Test Runner")
    print("This will test all FastAPI endpoints to ensure they work correctly.\n")
    
    # Check if model is loaded
    if not global_model_state.current_model:
        print("⚠️  WARNING: No TTS model is currently loaded.")
        print("   Some tests will be skipped. To get full test coverage,")
        print("   start the server with a model loaded first.\n")
    else:
        print(f"✅ Model loaded: {global_model_state.current_model.name}")
        print("   All tests should run successfully.\n")
    
    # Run tests
    runner = IntegrationTestRunner()
    success = runner.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! The FastAPI server is working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
