#!/usr/bin/env python3
"""
Test script for the new speaker and language endpoints
"""

import requests
import json
import sys

def test_endpoint(url, description):
    """Test a single endpoint"""
    print(f"\n=== Testing {description} ===")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return False

def main():
    """Main test function"""
    base_url = "http://localhost:5002"  # Adjust if your server runs on a different port
    
    print("🐸 Testing Coqui TTS Speaker and Language Endpoints")
    print("=" * 60)
    
    # Test endpoints
    endpoints = [
        (f"{base_url}/api/v1/models/current", "Current Model Info"),
        (f"{base_url}/api/v1/models/speakers", "Model Speakers"),
        (f"{base_url}/api/v1/models/languages", "Model Languages"),
    ]
    
    results = []
    for url, description in endpoints:
        success = test_endpoint(url, description)
        results.append((description, success))
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Results Summary:")
    
    for description, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} {description}")
    
    # Check if all tests passed
    all_passed = all(success for _, success in results)
    
    if all_passed:
        print("\n🎉 All tests passed! The endpoints are working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the server logs for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
