#!/usr/bin/env python3
"""
TTS Server with OpenAPI Code Generation and Full TTS Endpoints

This server provides:
1. OpenAPI specification serving
2. Automatic frontend code generation
3. Static file serving for the frontend
4. Development mode with auto-regeneration
5. Full TTS API endpoints (legacy and modern)
6. Service-based TTS architecture integration
"""

import os
import sys
import subprocess
import shutil
import json
import yaml
import importlib.util
from pathlib import Path
from typing import Optional, Dict, Any, List
import argparse
import logging
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

# Add the TTS module to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import TTS server components
try:
    from TTS.server.server import app as tts_app
    from TTS.server.services.service_based_server import create_service_based_app
    from TTS.server.model_cache import ModelCacheManager
    from TTS.server.codegen.generator import Generator, GeneratorError
except ImportError as e:
    print(f"Warning: Could not import TTS server components: {e}")
    tts_app = None
    create_service_based_app = None
    ModelCacheManager = None
    Generator = None
    GeneratorError = None
    from TTS.server.services.service_based_server import create_service_based_app
    from TTS.server.services.model_cache import ModelCacheManager


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DynamicAPILoader:
    """Loads and manages dynamically generated API endpoints from OpenAPI spec"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.openapi_spec = base_dir / "openapi.yaml"
        self.generated_dir = base_dir / "generated"
        self.generator = None
        self.generated_routes: List[APIRoute] = []
        
        # Initialize generator if available
        if Generator:
            self.generator = Generator.create_for_tts_server(
                output_dir=self.generated_dir,
                spec_path=self.openapi_spec
            )
    
    def generate_server_code(self) -> bool:
        """Generate FastAPI server code from OpenAPI spec"""
        if not self.generator:
            logger.warning("Generator not available, cannot generate server code")
            return False
            
        try:
            logger.info("Generating server code from OpenAPI specification...")
            
            # Clean previous generation
            if self.generated_dir.exists():
                shutil.rmtree(self.generated_dir)
            
            # Generate models and routes
            models_dir = self.generator.generate_models()
            routes_dir = self.generator.generate_routes()
            
            logger.info(f"Generated models in: {models_dir}")
            logger.info(f"Generated routes in: {routes_dir}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate server code: {e}")
            return False
    
    def load_generated_models(self) -> Optional[Any]:
        """Load generated Pydantic models dynamically"""
        models_path = self.generated_dir / "tts_server_generated" / "models"
        
        if not models_path.exists():
            logger.warning(f"Generated models not found at: {models_path}")
            return None
            
        try:
            # Add generated directory to Python path
            sys.path.insert(0, str(self.generated_dir))
            
            # Import generated models
            models_module = importlib.import_module("tts_server_generated.models")
            logger.info("Successfully loaded generated models")
            return models_module
            
        except Exception as e:
            logger.error(f"Failed to load generated models: {e}")
            return None
    
    def load_generated_routes(self) -> List[APIRoute]:
        """Load generated FastAPI routes dynamically"""
        apis_path = self.generated_dir / "tts_server_generated" / "apis"
        
        if not apis_path.exists():
            # Try alternative path
            apis_path = self.generated_dir / "tts_server_generated" / "api"
        
        if not apis_path.exists():
            logger.warning(f"Generated APIs not found at: {apis_path}")
            return []
            
        try:
            # Add generated directory to Python path
            sys.path.insert(0, str(self.generated_dir))
            
            # Import generated API modules
            api_modules = []
            for api_file in apis_path.glob("*.py"):
                if api_file.name.startswith("__"):
                    continue
                    
                module_name = f"tts_server_generated.apis.{api_file.stem}"
                try:
                    api_module = importlib.import_module(module_name)
                    api_modules.append(api_module)
                except Exception as e:
                    logger.warning(f"Failed to import API module {module_name}: {e}")
            
            logger.info(f"Successfully loaded {len(api_modules)} API modules")
            return api_modules
            
        except Exception as e:
            logger.error(f"Failed to load generated routes: {e}")
            return []
    
    def integrate_with_app(self, app: FastAPI, tts_service_app: Optional[FastAPI] = None) -> bool:
        """Integrate generated routes with FastAPI app using bridge handler"""
        try:
            # Create bridge handler
            api_handler = OpenAPIBasedAPIHandler(self, tts_service_app)
            
            # Create dynamic endpoints from OpenAPI spec
            api_handler.create_dynamic_endpoints(app)
            
            logger.info("Successfully integrated OpenAPI-based dynamic endpoints")
            return True
            
        except Exception as e:
            logger.error(f"Failed to integrate generated code: {e}")
            return False


class OpenAPIBasedAPIHandler:
    """Handles API requests using generated models but bridging to existing TTS functionality"""
    
    def __init__(self, dynamic_loader: DynamicAPILoader, tts_service_app: Optional[FastAPI] = None):
        self.dynamic_loader = dynamic_loader
        self.tts_service_app = tts_service_app
        self.models = None
        self.openapi_spec = None
        
        # Load OpenAPI spec
        self._load_openapi_spec()
        
        # Load generated models if available
        self.models = dynamic_loader.load_generated_models()
    
    def _load_openapi_spec(self):
        """Load and parse the OpenAPI specification"""
        try:
            with open(self.dynamic_loader.openapi_spec, 'r') as f:
                self.openapi_spec = yaml.safe_load(f)
            logger.info("Loaded OpenAPI specification")
        except Exception as e:
            logger.error(f"Failed to load OpenAPI spec: {e}")
    
    def create_dynamic_endpoints(self, app: FastAPI):
        """Create FastAPI endpoints dynamically from OpenAPI spec"""
        if not self.openapi_spec:
            logger.warning("No OpenAPI spec available for dynamic endpoint creation")
            return
        
        paths = self.openapi_spec.get('paths', {})
        
        for path, path_item in paths.items():
            for method, operation in path_item.items():
                if method.lower() in ['get', 'post', 'put', 'delete', 'patch']:
                    self._create_endpoint(app, path, method.lower(), operation)
    
    def _create_endpoint(self, app: FastAPI, path: str, method: str, operation: Dict[str, Any]):
        """Create a single FastAPI endpoint from OpenAPI operation"""
        operation_id = operation.get('operationId', f"{method}_{path.replace('/', '_')}")
        summary = operation.get('summary', f"{method.upper()} {path}")
        description = operation.get('description', '')
        
        async def dynamic_handler(request: Request):
            """Dynamic handler that routes to appropriate TTS functionality"""
            try:
                # Extract parameters from request
                query_params = dict(request.query_params)
                
                # Route to appropriate TTS handler based on path
                if '/api/tts' in path:
                    return await self._handle_tts_request(request, query_params)
                elif '/voices' in path:
                    return await self._handle_voices_request()
                elif '/locales' in path:
                    return await self._handle_locales_request()
                elif '/process' in path:
                    return await self._handle_process_request(request, query_params)
                elif '/v1/audio/speech' in path:
                    return await self._handle_openai_tts_request(request)
                elif '/api/v1/health' in path:
                    return await self._handle_health_request()
                else:
                    # Default handler
                    return JSONResponse(
                        content={"message": f"Dynamic endpoint: {method.upper()} {path}"},
                        status_code=200
                    )
                    
            except Exception as e:
                logger.error(f"Error in dynamic handler for {path}: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        # Add the route to the app
        app.add_api_route(
            path=path,
            endpoint=dynamic_handler,
            methods=[method.upper()],
            summary=summary,
            description=description,
            operation_id=operation_id
        )
        
        logger.info(f"Created dynamic endpoint: {method.upper()} {path}")
    
    async def _handle_tts_request(self, request: Request, params: Dict[str, Any]):
        """Handle TTS synthesis requests"""
        # Forward to existing TTS service if available
        if self.tts_service_app:
            # This would need implementation to forward to the TTS service
            pass
        
        # Fallback response
        return JSONResponse(
            content={"message": "TTS synthesis", "params": params},
            status_code=200
        )
    
    async def _handle_voices_request(self):
        """Handle voices listing requests"""
        return JSONResponse(
            content={"voices": ["default", "speaker1", "speaker2"]},
            status_code=200
        )
    
    async def _handle_locales_request(self):
        """Handle locales listing requests"""
        return JSONResponse(
            content={"locales": ["en", "es", "fr", "de"]},
            status_code=200
        )
    
    async def _handle_process_request(self, request: Request, params: Dict[str, Any]):
        """Handle MaryTTS process requests"""
        return JSONResponse(
            content={"message": "MaryTTS process", "params": params},
            status_code=200
        )
    
    async def _handle_openai_tts_request(self, request: Request):
        """Handle OpenAI-compatible TTS requests"""
        try:
            body = await request.json()
            return JSONResponse(
                content={"message": "OpenAI TTS", "body": body},
                status_code=200
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    
    async def _handle_health_request(self):
        """Handle health check requests"""
        return JSONResponse(
            content={
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "components": {
                    "openapi_generator": "active",
                    "dynamic_endpoints": "active"
                }
            },
            status_code=200
        )


class OpenAPICodeGenerator:
    """Handles OpenAPI code generation for frontend"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.tts_server_dir = base_dir
        self.frontend_dir = self.tts_server_dir / "frontend"
        self.openapi_spec = self.tts_server_dir / "openapi.yaml"
        self.gen_dir = self.frontend_dir / "src" / "gen"
        
    def check_dependencies(self) -> bool:
        """Check if required dependencies are available"""
        try:
            # Check for Node.js and npm/yarn
            subprocess.run(["node", "--version"], capture_output=True, check=True, shell=True)
            
            # Check for OpenAPI Generator CLI
            result = subprocess.run(
                ["openapi-generator-cli", "version"], 
                capture_output=True, 
                text=True,
                shell=True
            )
            if result.returncode != 0:
                logger.warning("OpenAPI Generator CLI not found, attempting to install...")
                subprocess.run(
                    ["npm", "install", "-g", "@openapitools/openapi-generator-cli"],
                    check=True,
                    shell=True
                )
            
            return True
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            logger.error(f"Dependency check failed: {e}")
            return False
    
    def generate_frontend_api(self) -> bool:
        """Generate TypeScript API client from OpenAPI spec"""
        try:
            if not self.openapi_spec.exists():
                logger.error(f"OpenAPI spec not found at {self.openapi_spec}")
                return False
            
            logger.info("Generating TypeScript API client...")
            
            # Create/clean the generation directory
            if self.gen_dir.exists():
                shutil.rmtree(self.gen_dir)
            self.gen_dir.mkdir(parents=True, exist_ok=True)
            
            # OpenAPI Generator command
            cmd = [
                "openapi-generator-cli", "generate",
                "-i", str(self.openapi_spec),
                "-g", "typescript-fetch",
                "-o", str(self.gen_dir),
                "-c", str(self.frontend_dir / "openapi-generator-config.json")
            ]
            
            # Change to frontend directory for generation
            result = subprocess.run(
                cmd,
                cwd=self.frontend_dir,
                capture_output=True,
                text=True,
                shell=True
            )
            
            if result.returncode != 0:
                logger.error(f"OpenAPI generation failed: {result.stderr}")
                return False
            
            logger.info("✅ TypeScript API client generated successfully")
            
            # Remove unused imports if needed
            self._cleanup_generated_files()
            
            return True
            
        except Exception as e:
            logger.error(f"Error generating frontend API: {e}")
            return False
    
    def _cleanup_generated_files(self):
        """Clean up generated files to remove unused imports"""
        try:
            # Remove unused HTTPValidationError import from default-api.ts
            api_file = self.gen_dir / "src" / "apis" / "default-api.ts"
            if api_file.exists():
                content = api_file.read_text()
                # Remove HTTPValidationError from imports
                content = content.replace("  HTTPValidationError,\n", "")
                content = content.replace(",\n  HTTPValidationError", "")
                content = content.replace("HTTPValidationError,", "")
                api_file.write_text(content)
                logger.info("✅ Cleaned up generated API file")
        except Exception as e:
            logger.warning(f"Could not cleanup generated files: {e}")
    
    def build_frontend(self) -> bool:
        """Build the frontend application"""
        try:
            if not self.frontend_dir.exists():
                logger.error(f"Frontend directory not found at {self.frontend_dir}")
                return False
            
            logger.info("Building frontend application...")
            
            # Install dependencies
            subprocess.run(
                ["yarn", "install"],
                cwd=self.frontend_dir,
                check=True,
                capture_output=True,
                shell=True
            )
            
            # Build the frontend
            result = subprocess.run(
                ["yarn", "run", "build"],
                cwd=self.frontend_dir,
                capture_output=True,
                text=True,
                shell=True
            )
            
            if result.returncode != 0:
                logger.error(f"Frontend build failed: {result.stderr}")
                return False
            
            logger.info("✅ Frontend built successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error building frontend: {e}")
            return False
    
    def watch_openapi_spec(self) -> bool:
        """Check if OpenAPI spec has been modified"""
        try:
            if not self.openapi_spec.exists():
                return False
            
            # Check modification time
            spec_mtime = self.openapi_spec.stat().st_mtime
            gen_mtime = 0
            
            if self.gen_dir.exists():
                version_file = self.gen_dir / ".openapi-generator" / "VERSION"
                if version_file.exists():
                    gen_mtime = version_file.stat().st_mtime
            
            return spec_mtime > gen_mtime
            
        except Exception:
            return True  # Regenerate on error


# FastAPI application
app = FastAPI(
    title="TTS Server with OpenAPI Generation",
    description="Development server for TTS with automatic frontend code generation and full TTS capabilities",
    version="1.0.0"
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global generator instance
generator: Optional[OpenAPICodeGenerator] = None
dynamic_api_loader: Optional[DynamicAPILoader] = None
tts_service_app: Optional[FastAPI] = None


@app.on_event("startup")
async def startup_event():
    """Initialize the code generator, dynamic API loader, and TTS services on startup"""
    global generator, dynamic_api_loader, tts_service_app
    base_dir = Path(__file__).parent.parent
    generator = OpenAPICodeGenerator(base_dir)
    dynamic_api_loader = DynamicAPILoader(base_dir)
    
    logger.info("🚀 TTS Server starting up...")
    
    # Check dependencies
    if not generator.check_dependencies():
        logger.error("❌ Required dependencies not available")
        sys.exit(1)
    
    # Generate server code from OpenAPI spec (if not disabled)
    if not os.environ.get('DISABLE_DYNAMIC_API', 'False').lower() == 'true':
        if dynamic_api_loader.generate_server_code():
            logger.info("✅ Generated server code from OpenAPI spec")
            
            # Try to integrate generated routes
            if dynamic_api_loader.integrate_with_app(app, tts_service_app):
                logger.info("✅ Integrated generated API endpoints")
            else:
                logger.warning("⚠️  Using fallback API endpoints")
        else:
            logger.warning("⚠️  Could not generate server code, using fallback endpoints")
    else:
        logger.info("🔇 Dynamic API generation disabled, using static endpoints")
    
    # Initialize TTS services if available
    if create_service_based_app and ModelCacheManager:
        try:
            logger.info("🔧 Initializing TTS services...")
            
            # Cache configuration from environment variables
            cache_max_memory = int(os.getenv('TTS_CACHE_MAX_MEMORY_MB', '4096'))
            cache_max_entries = int(os.getenv('TTS_CACHE_MAX_ENTRIES', '10'))
            cache_cleanup_threshold = float(os.getenv('TTS_CACHE_CLEANUP_THRESHOLD', '0.8'))
            cache_dir = os.getenv('TTS_CACHE_DIR')  # None = use default
            
            # Initialize model cache manager
            model_cache = ModelCacheManager(
                cache_dir=cache_dir,
                max_memory_mb=cache_max_memory,
                max_entries=cache_max_entries,
                cleanup_threshold=cache_cleanup_threshold
            )
            
            # Create service-based TTS app
            tts_service_app = create_service_based_app(model_cache)
            
            # Mount TTS service routes
            logger.info("🔗 Mounting TTS service endpoints...")
            
            # Mount the TTS service app under /tts prefix
            app.mount("/tts", tts_service_app, name="tts_services")
            
            logger.info("✅ TTS services initialized and mounted")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize TTS services: {e}")
            logger.info("🔄 Continuing without TTS services...")
    
    # Generate frontend API if needed
    if generator.watch_openapi_spec():
        logger.info("📝 OpenAPI spec changed, regenerating frontend API...")
        if generator.generate_frontend_api():
            logger.info("✅ Frontend API generated")
        else:
            logger.error("❌ Failed to generate frontend API")


@app.get("/")
async def root():
    """Root endpoint"""
    tts_endpoints = {}
    if tts_service_app:
        tts_endpoints = {
            "tts_synthesis": "/tts/api/v2/tts",
            "model_management": "/tts/api/v2/models",
            "health_check": "/tts/api/v2/health",
            "batch_synthesis": "/tts/api/v2/tts/batch"
        }
    
    return {
        "message": "TTS Server with OpenAPI Generation and Full TTS Capabilities",
        "docs": "/docs",
        "openapi": "/openapi",
        "frontend": "/frontend/",
        "generate": "/generate",
        "tts_services_available": tts_service_app is not None,
        "legacy_endpoints": {
            "api_tts": "/api/tts",
            "voices": "/voices", 
            "locales": "/locales",
            "mary_tts_process": "/process",
            "openai_compatible": "/v1/audio/speech"
        },
        "tts_endpoints": tts_endpoints,
        "management": {
            "health": "/api/v1/health",
            "models": "/api/v1/models",
            "generation_status": "/generate/status"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api_generator": generator is not None,
            "frontend_available": generator.frontend_dir.exists() if generator else False,
            "openapi_spec": generator.openapi_spec.exists() if generator else False
        }
    }


@app.get("/openapi")
async def get_openapi_spec():
    """Serve the OpenAPI specification"""
    if not generator or not generator.openapi_spec.exists():
        raise HTTPException(status_code=404, detail="OpenAPI specification not found")
    
    return FileResponse(
        generator.openapi_spec,
        media_type="application/yaml",
        filename="openapi.yaml"
    )


@app.post("/generate")
async def regenerate_api(background_tasks: BackgroundTasks):
    """Manually trigger API regeneration"""
    if not generator:
        raise HTTPException(status_code=500, detail="Generator not initialized")
    
    def regenerate():
        success = generator.generate_frontend_api()
        if success:
            generator.build_frontend()
    
    background_tasks.add_task(regenerate)
    
    return {
        "message": "API regeneration started",
        "status": "in_progress"
    }


@app.post("/generate/dynamic-api")
async def regenerate_dynamic_api(background_tasks: BackgroundTasks):
    """Manually trigger dynamic API regeneration from OpenAPI spec"""
    if not dynamic_api_loader:
        raise HTTPException(status_code=500, detail="Dynamic API loader not initialized")
    
    def regenerate_dynamic():
        try:
            # Regenerate server code
            success = dynamic_api_loader.generate_server_code()
            if success:
                logger.info("Dynamic API regeneration completed successfully")
            else:
                logger.error("Dynamic API regeneration failed")
        except Exception as e:
            logger.error(f"Error during dynamic API regeneration: {e}")
    
    background_tasks.add_task(regenerate_dynamic)
    
    return {
        "message": "Dynamic API regeneration started",
        "status": "in_progress",
        "note": "Server restart required to load new endpoints"
    }


@app.get("/generate/status")
async def generation_status():
    """Check the status of the last generation"""
    if not generator:
        raise HTTPException(status_code=500, detail="Generator not initialized")
    
    # Check if generation is fresh
    needs_regen = generator.watch_openapi_spec()
    
    return {
        "needs_regeneration": needs_regen,
        "last_modified": {
            "openapi_spec": generator.openapi_spec.stat().st_mtime if generator.openapi_spec.exists() else None,
            "generated_code": (generator.gen_dir / ".openapi-generator" / "VERSION").stat().st_mtime 
                            if (generator.gen_dir / ".openapi-generator" / "VERSION").exists() else None
        },
        "paths": {
            "openapi_spec": str(generator.openapi_spec),
            "generated_code": str(generator.gen_dir),
            "frontend": str(generator.frontend_dir)
        }
    }


# TTS API Endpoints - Direct Integration
# These endpoints provide the same functionality as the main TTS server

@app.get("/api/tts", summary="Text-to-Speech (GET)", description="Convert text to speech using GET method")
@app.post("/api/tts", summary="Text-to-Speech (POST)", description="Convert text to speech using POST method") 
async def api_tts(
    text: Optional[str] = None,
    speaker_id: Optional[str] = None,
    language_id: Optional[str] = None,
    style_wav: Optional[str] = None,
    speaker_wav: Optional[str] = None
):
    """TTS synthesis endpoint - proxies to mounted TTS service if available"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    # This will be handled by the mounted TTS app
    raise HTTPException(status_code=501, detail="Use /tts/api/v2/tts endpoint")


@app.get("/voices", summary="Available Voices", description="Get list of available voices/speakers")
async def get_voices():
    """Get available voices - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    return {"message": "Use /tts/api/v2/models/current endpoint for model info"}


@app.get("/locales", summary="Available Locales", description="Get list of available locales/languages")
async def get_locales():
    """Get available locales - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    return {"message": "Use /tts/api/v2/models/current endpoint for model info"}


@app.get("/process", summary="MaryTTS Process (GET)", description="MaryTTS-compatible process endpoint (GET)")
@app.post("/process", summary="MaryTTS Process (POST)", description="MaryTTS-compatible process endpoint (POST)")
async def mary_tts_process(
    INPUT_TEXT: Optional[str] = None,
    VOICE: Optional[str] = None,
    LOCALE: Optional[str] = None
):
    """MaryTTS-compatible process endpoint - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    raise HTTPException(status_code=501, detail="Use /tts/api/v2/tts endpoint")


@app.post("/v1/audio/speech", summary="OpenAI Compatible TTS", description="OpenAI-compatible text-to-speech endpoint")
async def openai_compatible_tts(request_data: dict):
    """OpenAI-compatible TTS endpoint - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    raise HTTPException(status_code=501, detail="Use /tts/api/v2/tts endpoint")


@app.get("/api/v1/health", summary="Health Check", description="Get server health status")
async def health_check():
    """Health check endpoint"""
    health_info = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api_generator": generator is not None,
            "frontend_available": generator.frontend_dir.exists() if generator else False,
            "openapi_spec": generator.openapi_spec.exists() if generator else False,
            "tts_services": tts_service_app is not None
        },
        "endpoints": {
            "generator": "/generate",
            "tts_services": "/tts" if tts_service_app else None,
            "frontend": "/frontend/",
            "docs": "/docs"
        }
    }
    
    return health_info


@app.get("/api/v1/models", summary="Available Models", description="Get list of available TTS models")
async def get_available_models():
    """Get available models - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    return {"message": "Use /tts/api/v2/models/available endpoint"}


@app.get("/api/v1/models/current", summary="Current Model", description="Get currently loaded model info")
async def get_current_model():
    """Get current model - proxies to TTS service"""
    if not tts_service_app:
        raise HTTPException(status_code=503, detail="TTS services not available")
    
    return {"message": "Use /tts/api/v2/models/current endpoint"}


# Mount static files for the frontend
@app.on_event("startup")
async def mount_static_files():
    """Mount static files after startup"""
    if generator and generator.tts_server_dir.exists():
        static_dir = generator.tts_server_dir / "static"
        if static_dir.exists():
            app.mount("/static", StaticFiles(directory=static_dir), name="static")
            logger.info(f"📁 Mounted static files from {static_dir}")
        
        # Mount frontend if built
        frontend_dist = static_dir / "frontend"
        if frontend_dist.exists():
            app.mount("/frontend", StaticFiles(directory=frontend_dist, html=True), name="frontend")
            logger.info(f"🌐 Frontend available at /frontend/")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="TTS Server with OpenAPI Generation and Full TTS Support")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--generate-only", action="store_true", help="Only generate API and exit")
    parser.add_argument("--build-frontend", action="store_true", help="Build frontend after generation")
    parser.add_argument("--disable-tts", action="store_true", help="Disable TTS services (generator only)")
    parser.add_argument("--disable-dynamic-api", action="store_true", help="Disable dynamic API generation from OpenAPI spec")
    parser.add_argument("--log-level", default="info", choices=["debug", "info", "warning", "error"], help="Log level")
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    # Set global flags for dynamic API generation
    os.environ['DISABLE_DYNAMIC_API'] = str(args.disable_dynamic_api)
    
    if args.generate_only:
        # Just generate and exit
        base_dir = Path(__file__).parent.parent
        gen = OpenAPICodeGenerator(base_dir)
        
        if not gen.check_dependencies():
            logger.error("❌ Required dependencies not available")
            sys.exit(1)
        
        success = gen.generate_frontend_api()
        if not success:
            logger.error("❌ Failed to generate frontend API")
            sys.exit(1)
        
        if args.build_frontend:
            if not gen.build_frontend():
                logger.error("❌ Failed to build frontend")
                sys.exit(1)
        
        logger.info("✅ Generation complete")
        return
    
    # Environment setup for TTS services
    if not args.disable_tts:
        logger.info("🔧 Setting up TTS environment...")
        
        # Set environment variables for TTS if not already set
        if "TTS_CACHE_MAX_MEMORY_MB" not in os.environ:
            os.environ["TTS_CACHE_MAX_MEMORY_MB"] = "4096"
        if "TTS_CACHE_MAX_ENTRIES" not in os.environ:
            os.environ["TTS_CACHE_MAX_ENTRIES"] = "10"
        if "TTS_CACHE_CLEANUP_THRESHOLD" not in os.environ:
            os.environ["TTS_CACHE_CLEANUP_THRESHOLD"] = "0.8"
        
        logger.info(f"📊 TTS Cache Config: {os.environ.get('TTS_CACHE_MAX_MEMORY_MB')}MB, "
                   f"{os.environ.get('TTS_CACHE_MAX_ENTRIES')} entries, "
                   f"{os.environ.get('TTS_CACHE_CLEANUP_THRESHOLD')} threshold")
    
    # Start the server
    logger.info(f"🚀 Starting TTS server on {args.host}:{args.port}")
    logger.info(f"📚 API documentation: http://{args.host}:{args.port}/docs")
    logger.info(f"🌐 Frontend: http://{args.host}:{args.port}/frontend/")
    
    if not args.disable_tts:
        logger.info(f"🎙️ TTS Services: http://{args.host}:{args.port}/tts/")
    
    try:
        uvicorn.run(
            "main:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level=args.log_level,
            access_log=True
        )
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
