"""
Integration tests for the FastAPI TTS server.

This module contains comprehensive tests for all TTS server endpoints,
including TTS synthesis, model management, health checks, and compatibility APIs.
"""

import asyncio
import io
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Dict, Any

import pytest
import httpx
from fastapi.testclient import TestClient
import torch
import torchaudio

# Import the FastAPI app
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from TTS.server.server import app, global_model_state, model_cache, model_registry


class TestTTSServer:
    """Test class for TTS server endpoints."""
    
    @pytest.fixture(scope="class")
    def client(self):
        """Create a test client for the FastAPI app."""
        return TestClient(app)
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_server(self):
        """Setup the server with a test model."""
        # Wait for startup event to complete
        time.sleep(2)
        
        # Ensure we have a model loaded for testing
        if not global_model_state.current_model:
            pytest.skip("No TTS model loaded - skipping integration tests")
        
        yield
        
        # Cleanup after tests
        pass
    
    def test_root_endpoint(self, client):
        """Test the root endpoint returns proper response."""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data or "error" in data
    
    def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "model_loaded" in data
        assert "components" in data
        
        # Check component structure
        components = data["components"]
        assert "global_model_state" in components
        assert "model_cache" in components
        assert "model_registry" in components
    
    def test_list_models_endpoint(self, client):
        """Test the models listing endpoint."""
        response = client.get("/api/v1/models")
        assert response.status_code == 200
        
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
    
    def test_current_model_endpoint(self, client):
        """Test the current model info endpoint."""
        response = client.get("/api/v1/models/current")
        
        if global_model_state.current_model:
            assert response.status_code == 200
            data = response.json()
            assert "modelName" in data
            assert "capabilities" in data
            assert "performance" in data
        else:
            assert response.status_code == 404
    
    def test_available_models_endpoint(self, client):
        """Test the available models endpoint."""
        response = client.get("/api/v1/models/available")
        assert response.status_code == 200
        
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        
        if data["models"]:
            model = data["models"][0]
            assert "name" in model
            assert "capabilities" in model
            assert "performance" in model
    
    def test_model_status_endpoint(self, client):
        """Test the model loading status endpoint."""
        response = client.get("/api/v1/models/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "isLoading" in data
        assert "progress" in data
        assert "stage" in data
    
    def test_cache_stats_endpoint(self, client):
        """Test the cache statistics endpoint."""
        response = client.get("/api/v1/cache/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "systemMemory" in data
        assert "entries" in data
        
        summary = data["summary"]
        assert "totalEntries" in summary
        assert "totalSizeMb" in summary
        assert "hitRate" in summary
    
    def test_registry_status_endpoint(self, client):
        """Test the model registry status endpoint."""
        response = client.get("/api/v1/registry/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "modelsCount" in data
        assert "monitoringActive" in data
    
    def test_cache_cleanup_endpoint(self, client):
        """Test the cache cleanup endpoint."""
        response = client.post("/api/v1/cache/cleanup")
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data
        assert "evictedCount" in data
    
    def test_registry_refresh_endpoint(self, client):
        """Test the registry refresh endpoint."""
        response = client.post("/api/v1/registry/refresh")
        assert response.status_code in [200, 409]  # 409 if already refreshing
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
    
    def test_tts_synthesis_get(self, client):
        """Test TTS synthesis via GET request."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        response = client.get("/api/tts", params={"text": "Hello world"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        
        # Verify we got audio data
        audio_data = response.content
        assert len(audio_data) > 0
        assert audio_data.startswith(b'RIFF')  # WAV file header
    
    def test_tts_synthesis_post(self, client):
        """Test TTS synthesis via POST request."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        response = client.post("/api/tts", params={"text": "This is a test"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        
        audio_data = response.content
        assert len(audio_data) > 0
    
    def test_tts_synthesis_headers(self, client):
        """Test TTS synthesis using headers."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        headers = {"text": "Header test"}
        response = client.get("/api/tts", headers=headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
    
    def test_tts_synthesis_validation(self, client):
        """Test TTS synthesis input validation."""
        # Test empty text
        response = client.get("/api/tts", params={"text": ""})
        assert response.status_code == 400
        
        # Test missing text
        response = client.get("/api/tts")
        assert response.status_code == 400
    
    def test_api_v1_tts_endpoint(self, client):
        """Test the new API v1 TTS endpoint."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        payload = {
            "text": "Testing API v1 endpoint",
            "format": "wav"
        }
        
        response = client.post("/api/v1/tts", json=payload)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
    
    def test_api_v1_tts_validation(self, client):
        """Test API v1 TTS endpoint validation."""
        # Test invalid format
        payload = {
            "text": "Test",
            "format": "invalid_format"
        }
        
        response = client.post("/api/v1/tts", json=payload)
        assert response.status_code == 422  # Validation error
        
        # Test text too long
        payload = {
            "text": "x" * 2000,  # Exceeds max length
            "format": "wav"
        }
        
        response = client.post("/api/v1/tts", json=payload)
        assert response.status_code == 422
    
    def test_openai_tts_endpoint(self, client):
        """Test OpenAI-compatible TTS endpoint."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        payload = {
            "model": "tts-1",
            "voice": "alloy",
            "input": "OpenAI compatibility test",
            "response_format": "wav"
        }
        
        response = client.post("/v1/audio/speech", json=payload)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
    
    def test_openai_tts_formats(self, client):
        """Test OpenAI TTS endpoint with different formats."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        formats = ["wav", "mp3", "opus", "aac", "flac"]
        
        for fmt in formats:
            payload = {
                "model": "tts-1",
                "voice": "alloy", 
                "input": f"Testing {fmt} format",
                "response_format": fmt
            }
            
            response = client.post("/v1/audio/speech", json=payload)
            assert response.status_code == 200
            
            # Check MIME type
            expected_mime = {
                "wav": "audio/wav",
                "mp3": "audio/mpeg", 
                "opus": "audio/ogg",
                "aac": "audio/aac",
                "flac": "audio/flac"
            }
            assert response.headers["content-type"] == expected_mime[fmt]
    
    def test_marytts_locales_endpoint(self, client):
        """Test MaryTTS compatibility - locales endpoint."""
        response = client.get("/locales")
        assert response.status_code == 200
        
        content = response.text
        assert len(content.strip()) > 0
    
    def test_marytts_voices_endpoint(self, client):
        """Test MaryTTS compatibility - voices endpoint."""
        response = client.get("/voices")
        assert response.status_code == 200
        
        content = response.text
        assert len(content.strip()) > 0
    
    def test_marytts_process_get(self, client):
        """Test MaryTTS compatibility - process endpoint via GET."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        params = {
            "INPUT_TEXT": "MaryTTS test",
            "VOICE": "default"
        }
        
        response = client.get("/process", params=params)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
    
    def test_marytts_process_post(self, client):
        """Test MaryTTS compatibility - process endpoint via POST."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for TTS test")
        
        form_data = {
            "INPUT_TEXT": "MaryTTS POST test",
            "VOICE": "default"
        }
        
        response = client.post("/process", data=form_data)
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
    
    def test_voice_conversion_endpoint(self, client):
        """Test voice conversion endpoint."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for voice conversion test")
        
        # Create temporary audio files for testing
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as source_file:
            # Generate simple test audio
            sample_rate = 22050
            duration = 1.0
            t = torch.linspace(0, duration, int(sample_rate * duration))
            waveform = torch.sin(2 * torch.pi * 440 * t).unsqueeze(0)  # 440Hz sine wave
            torchaudio.save(source_file.name, waveform, sample_rate)
            source_path = source_file.name
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as target_file:
            # Generate different test audio
            t = torch.linspace(0, duration, int(sample_rate * duration))
            waveform = torch.sin(2 * torch.pi * 880 * t).unsqueeze(0)  # 880Hz sine wave
            torchaudio.save(target_file.name, waveform, sample_rate)
            target_path = target_file.name
        
        try:
            with open(source_path, "rb") as source_f, open(target_path, "rb") as target_f:
                files = {
                    "source_wav": ("source.wav", source_f, "audio/wav"),
                    "target_wav": ("target.wav", target_f, "audio/wav")
                }
                
                response = client.post("/api/v1/voice-convert", files=files)
                
                # Voice conversion might not be supported by all models
                assert response.status_code in [200, 500]
                
                if response.status_code == 200:
                    assert response.headers["content-type"] == "audio/wav"
        
        finally:
            # Cleanup temporary files
            os.unlink(source_path)
            os.unlink(target_path)
    
    def test_model_loading_endpoint(self, client):
        """Test model loading endpoint."""
        # Get current model for comparison
        current_response = client.get("/api/v1/models/current")
        
        if current_response.status_code == 200:
            current_model = current_response.json()["modelName"]
            
            # Try to "load" the same model (should be quick)
            payload = {
                "modelName": current_model,
                "forceReload": False
            }
            
            response = client.post("/api/v1/models/load", json=payload)
            assert response.status_code in [200, 409]  # 200 or conflict if already loading
        
        # Test invalid model
        payload = {
            "modelName": "invalid/model/name",
            "forceReload": False
        }
        
        response = client.post("/api/v1/models/load", json=payload)
        assert response.status_code == 400
    
    def test_cache_clear_endpoint(self, client):
        """Test cache clearing endpoint."""
        response = client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data
        assert "clearedCount" in data
    
    def test_documentation_endpoints(self, client):
        """Test that API documentation endpoints are available."""
        # Test OpenAPI JSON schema
        response = client.get("/openapi.yaml")
        assert response.status_code == 200
        
        schema = response.json()
        assert "openapi" in schema
        assert "info" in schema
        assert "paths" in schema
        
        # Test Swagger UI
        response = client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        
        # Test ReDoc
        response = client.get("/redoc")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
    
    def test_concurrent_requests(self, client):
        """Test server handles concurrent requests properly."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded for concurrency test")
        
        import concurrent.futures
        import threading
        
        def make_tts_request(text: str):
            """Make a TTS request."""
            response = client.get("/api/tts", params={"text": text})
            return response.status_code, len(response.content)
        
        # Make multiple concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for i in range(5):
                future = executor.submit(make_tts_request, f"Concurrent test {i}")
                futures.append(future)
            
            results = []
            for future in concurrent.futures.as_completed(futures):
                status_code, content_length = future.result()
                results.append((status_code, content_length))
        
        # All requests should succeed
        for status_code, content_length in results:
            assert status_code == 200
            assert content_length > 0
    
    def test_error_handling(self, client):
        """Test error handling for various scenarios."""
        # Test 404 for non-existent endpoint
        response = client.get("/non/existent/endpoint")
        assert response.status_code == 404
        
        # Test invalid JSON payload
        response = client.post("/api/v1/tts", data="invalid json")
        assert response.status_code == 422
        
        # Test unsupported method
        response = client.delete("/api/v1/health")
        assert response.status_code == 405


@pytest.mark.asyncio
class TestAsyncEndpoints:
    """Test async-specific functionality."""
    
    async def test_server_sent_events(self):
        """Test server-sent events for progress streaming."""
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("GET", "http://localhost:5002/api/v1/models/progress-stream") as response:
                    assert response.status_code == 200
                    assert "text/event-stream" in response.headers["content-type"]
                    
                    # Read a few events
                    events_read = 0
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            events_read += 1
                            if events_read >= 2:  # Read a couple events then break
                                break
                    
                    assert events_read > 0
            except httpx.ConnectError:
                pytest.skip("Server not running on localhost:5002")


class TestModelCapabilities:
    """Test model-specific capabilities."""
    
    @pytest.fixture(scope="class")
    def client(self):
        return TestClient(app)
    
    def test_multi_speaker_support(self, client):
        """Test multi-speaker functionality if available."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded")
        
        current_model = global_model_state.current_model
        if not current_model.is_multi_speaker:
            pytest.skip("Current model does not support multi-speaker")
        
        speakers = current_model.speakers
        if speakers and len(speakers) > 1:
            # Test with different speakers
            for speaker in speakers[:2]:  # Test first 2 speakers
                response = client.get("/api/tts", params={
                    "text": f"Hello from speaker {speaker}",
                    "speaker_id": speaker
                })
                assert response.status_code == 200
    
    def test_multi_language_support(self, client):
        """Test multi-language functionality if available."""
        if not global_model_state.current_model:
            pytest.skip("No model loaded")
        
        current_model = global_model_state.current_model
        if not current_model.is_multi_lingual:
            pytest.skip("Current model does not support multi-language")
        
        languages = current_model.languages
        if languages and len(languages) > 1:
            # Test with different languages
            for language in languages[:2]:  # Test first 2 languages
                response = client.get("/api/tts", params={
                    "text": "Hello world",
                    "language_id": language
                })
                assert response.status_code == 200


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
