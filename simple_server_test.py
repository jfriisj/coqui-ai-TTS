#!/usr/bin/env python3
"""
Simple server test that starts the server and tests endpoints via HTTP requests.
This avoids import issues by treating the server as a black box.
"""

import requests
import time
import subprocess
import sys
import os
import signal
from threading import Thread
import json

class SimpleServerTest:
    def __init__(self, host="127.0.0.1", port=5002):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.server_process = None
        
    def start_server(self):
        """Start the TTS server in a subprocess."""
        print(f"Starting TTS server on {self.host}:{self.port}...")
        
        # Start server process
        cmd = [
            sys.executable, "-m", "TTS.server.server",
            "--host", self.host,
            "--port", str(self.port)
        ]
        
        try:
            self.server_process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                cwd=os.path.dirname(__file__)
            )
            
            # Wait for server to start
            for i in range(30):  # Wait up to 30 seconds
                try:
                    response = requests.get(f"{self.base_url}/", timeout=2)
                    if response.status_code == 200:
                        print("Server started successfully!")
                        return True
                except requests.exceptions.RequestException:
                    time.sleep(1)
                    continue
                    
            print("Failed to start server within 30 seconds")
            return False
            
        except Exception as e:
            print(f"Failed to start server: {e}")
            return False
    
    def stop_server(self):
        """Stop the TTS server."""
        if self.server_process:
            try:
                if sys.platform == "win32":
                    self.server_process.terminate()
                else:
                    self.server_process.send_signal(signal.SIGINT)
                
                # Wait for graceful shutdown
                try:
                    self.server_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.server_process.kill()
                    
                print("Server stopped.")
            except Exception as e:
                print(f"Error stopping server: {e}")
    
    def test_endpoint(self, method, path, data=None, expected_status=None):
        """Test a single endpoint."""
        url = f"{self.base_url}{path}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, timeout=10)
            elif method.upper() == "POST":
                if data:
                    response = requests.post(url, json=data, timeout=10)
                else:
                    response = requests.post(url, timeout=10)
            else:
                return False, f"Unsupported method: {method}"
            
            status_ok = expected_status is None or response.status_code == expected_status
            
            if status_ok:
                return True, f"✓ {method} {path} -> {response.status_code}"
            else:
                return False, f"✗ {method} {path} -> {response.status_code} (expected {expected_status})"
                
        except requests.exceptions.Timeout:
            return False, f"✗ {method} {path} -> Timeout"
        except requests.exceptions.RequestException as e:
            return False, f"✗ {method} {path} -> {str(e)}"
    
    def run_tests(self):
        """Run all endpoint tests."""
        test_cases = [
            # Basic endpoints
            ("GET", "/", 200),
            ("GET", "/health", 200),
            ("GET", "/docs", 200),
            ("GET", "/openapi.json", 200),
            
            # API v1 endpoints
            ("GET", "/api/v1/health", 200),
            ("GET", "/api/v1/models", 200),
            ("GET", "/api/v1/current-model", None),  # Could be 200 or 404
            ("GET", "/api/v1/registry/status", 200),
            ("GET", "/api/v1/cache/stats", 200),
            
            # Management endpoints  
            ("POST", "/api/v1/cache/clear", 200),
            ("POST", "/api/v1/cache/cleanup", 200),
            ("GET", "/api/v1/cache/stats", 200),
            
            # TTS endpoint (will fail without model, but should respond)
            ("POST", "/api/v1/tts", None),
        ]
        
        results = []
        passed = 0
        total = len(test_cases)
        
        print(f"\nRunning {total} endpoint tests...\n")
        
        for method, path, expected_status in test_cases:
            data = None
            if method == "POST" and path == "/api/v1/tts":
                data = {"text": "Hello world", "format": "wav"}
            
            success, message = self.test_endpoint(method, path, data, expected_status)
            results.append((success, message))
            
            if success:
                passed += 1
            
            print(message)
        
        print(f"\nResults: {passed}/{total} tests passed ({100*passed/total:.1f}%)")
        
        if passed < total:
            print("\nFailed tests:")
            for success, message in results:
                if not success:
                    print(f"  {message}")
        
        return passed == total

def main():
    """Main test function."""
    tester = SimpleServerTest()
    
    try:
        # Start server
        if not tester.start_server():
            print("Failed to start server. Exiting.")
            return False
        
        # Run tests
        success = tester.run_tests()
        
        return success
        
    finally:
        # Always stop server
        tester.stop_server()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
