"""OpenAPI Generator wrapper utility for server-side code generation.

This module provides a wrapper around openapi-generator-pip for generating
FastAPI server code from OpenAPI specifications. It supports generating both
Pydantic models and FastAPI route handlers from the TTS server's OpenAPI spec.
"""

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Union

logger = logging.getLogger(__name__)


class GeneratorError(Exception):
    """Exception raised when code generation fails."""
    pass


class Generator:
    """Wrapper class around openapi-generator-pip for server generation.
    
    This class provides a convenient interface for generating FastAPI server code
    from OpenAPI specifications, including Pydantic models and route handlers.
    It follows the patterns established in the existing TTS/server/gen/ client
    generation but focuses on server-side code generation.
    """
    
    def __init__(
        self,
        spec_path: Union[str, Path],
        output_dir: Union[str, Path],
        generator_name: str = "python-fastapi",
        package_name: str = "openapi_server",
        package_version: str = "1.0.0"
    ):
        """Initialize the Generator.
        
        Args:
            spec_path: Path to the OpenAPI specification file (YAML or JSON)
            output_dir: Directory where generated code will be written
            generator_name: OpenAPI generator to use (default: python-fastapi)
            package_name: Name for the generated Python package
            package_version: Version for the generated package
        """
        self.spec_path = Path(spec_path).resolve()
        self.output_dir = Path(output_dir).resolve()
        self.generator_name = generator_name
        self.package_name = package_name
        self.package_version = package_version
        
        # Validate inputs
        if not self.spec_path.exists():
            raise FileNotFoundError(f"OpenAPI spec not found: {self.spec_path}")
        
        # Default configuration options for python-fastapi generator
        self.config_options = {
            "packageName": package_name,
            "packageVersion": package_version,
            "projectName": package_name.replace("_", "-"),
            "packageUrl": "https://github.com/idiap/coqui-ai-TTS",
            "pythonAtLeast": "3.10",
            "generatePythonCodeStyle": "black",
            "useTypeHints": "true",
            "usePydantic": "true",
        }
        
        self.global_properties = {
            "models": "",
            "apis": "",
            "supportingFiles": "",
        }
    
    def set_config_option(self, key: str, value: str) -> None:
        """Set a configuration option for the generator.
        
        Args:
            key: Configuration option name
            value: Configuration option value
        """
        self.config_options[key] = value
    
    def set_global_property(self, key: str, value: str) -> None:
        """Set a global property for the generator.
        
        Args:
            key: Global property name
            value: Global property value
        """
        self.global_properties[key] = value
    
    def _build_command(
        self,
        additional_options: Optional[Dict[str, str]] = None,
        additional_global_properties: Optional[Dict[str, str]] = None,
        template_dir: Optional[Union[str, Path]] = None,
        ignore_file: Optional[Union[str, Path]] = None
    ) -> List[str]:
        """Build the openapi-generator command.
        
        Args:
            additional_options: Additional config options for this generation
            additional_global_properties: Additional global properties
            template_dir: Custom template directory
            ignore_file: Custom ignore file
            
        Returns:
            Command as list of strings for subprocess
        """
        cmd = [
            "openapi-generator-cli",
            "generate",
            "-i", str(self.spec_path),
            "-g", self.generator_name,
            "-o", str(self.output_dir),
        ]
        
        # Merge config options
        config_opts = self.config_options.copy()
        if additional_options:
            config_opts.update(additional_options)
        
        # Add config options
        for key, value in config_opts.items():
            cmd.extend(["--additional-properties", f"{key}={value}"])
        
        # Merge global properties
        global_props = self.global_properties.copy()
        if additional_global_properties:
            global_props.update(additional_global_properties)
        
        # Add global properties
        for key, value in global_props.items():
            if value:  # Only add non-empty values
                cmd.extend(["--global-property", f"{key}={value}"])
        
        # Add template directory if specified
        if template_dir:
            cmd.extend(["-t", str(template_dir)])
        
        # Add ignore file if specified
        if ignore_file:
            cmd.extend(["--ignore-file-override", str(ignore_file)])
        
        return cmd
    
    def _run_generator(self, cmd: List[str]) -> None:
        """Run the openapi-generator command.
        
        Args:
            cmd: Command to run as list of strings
            
        Raises:
            GeneratorError: If generation fails
        """
        logger.info(f"Running OpenAPI generator: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                cwd=self.output_dir.parent
            )
            
            if result.stdout:
                logger.info(f"Generator stdout: {result.stdout}")
            if result.stderr:
                logger.warning(f"Generator stderr: {result.stderr}")
                
        except subprocess.CalledProcessError as e:
            error_msg = f"OpenAPI generation failed with exit code {e.returncode}"
            if e.stdout:
                error_msg += f"\nStdout: {e.stdout}"
            if e.stderr:
                error_msg += f"\nStderr: {e.stderr}"
            raise GeneratorError(error_msg) from e
        except FileNotFoundError as e:
            raise GeneratorError(
                "openapi-generator-cli not found. Please install openapi-generator-pip: "
                "pip install openapi-generator-pip"
            ) from e
    
    def generate_models(
        self,
        models_only: bool = True,
        additional_options: Optional[Dict[str, str]] = None
    ) -> Path:
        """Generate only Pydantic models from the OpenAPI spec.
        
        Args:
            models_only: If True, generate only model files
            additional_options: Additional configuration options
            
        Returns:
            Path to the generated models directory
            
        Raises:
            GeneratorError: If generation fails
        """
        logger.info("Generating Pydantic models from OpenAPI spec")
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure for models-only generation
        global_props = {}
        if models_only:
            global_props["models"] = ""
            global_props["apis"] = "false"
            global_props["supportingFiles"] = "false"
        
        # Build and run command
        cmd = self._build_command(
            additional_options=additional_options,
            additional_global_properties=global_props
        )
        self._run_generator(cmd)
        
        models_dir = self.output_dir / self.package_name / "models"
        if not models_dir.exists():
            raise GeneratorError(f"Models directory not created: {models_dir}")
        
        logger.info(f"Models generated successfully in: {models_dir}")
        return models_dir
    
    def generate_routes(
        self,
        routes_only: bool = True,
        additional_options: Optional[Dict[str, str]] = None
    ) -> Path:
        """Generate FastAPI route handlers from the OpenAPI spec.
        
        Args:
            routes_only: If True, generate only API/route files
            additional_options: Additional configuration options
            
        Returns:
            Path to the generated APIs directory
            
        Raises:
            GeneratorError: If generation fails
        """
        logger.info("Generating FastAPI routes from OpenAPI spec")
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure for routes-only generation
        global_props = {}
        if routes_only:
            global_props["apis"] = ""
            global_props["models"] = "false"
            global_props["supportingFiles"] = "false"
        
        # Build and run command
        cmd = self._build_command(
            additional_options=additional_options,
            additional_global_properties=global_props
        )
        self._run_generator(cmd)
        
        apis_dir = self.output_dir / self.package_name / "apis"
        if not apis_dir.exists():
            # Try alternative path structure
            apis_dir = self.output_dir / self.package_name / "api"
        
        if not apis_dir.exists():
            raise GeneratorError(f"APIs directory not created in: {self.output_dir}")
        
        logger.info(f"Routes generated successfully in: {apis_dir}")
        return apis_dir
    
    def generate_full_server(
        self,
        additional_options: Optional[Dict[str, str]] = None,
        template_dir: Optional[Union[str, Path]] = None,
        ignore_file: Optional[Union[str, Path]] = None
    ) -> Path:
        """Generate complete FastAPI server code.
        
        Args:
            additional_options: Additional configuration options
            template_dir: Custom template directory for customization
            ignore_file: Custom ignore file to exclude certain files
            
        Returns:
            Path to the generated server directory
            
        Raises:
            GeneratorError: If generation fails
        """
        logger.info("Generating complete FastAPI server from OpenAPI spec")
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Build and run command for full generation
        cmd = self._build_command(
            additional_options=additional_options,
            template_dir=template_dir,
            ignore_file=ignore_file
        )
        self._run_generator(cmd)
        
        server_dir = self.output_dir / self.package_name
        if not server_dir.exists():
            raise GeneratorError(f"Server directory not created: {server_dir}")
        
        logger.info(f"Full server generated successfully in: {server_dir}")
        return server_dir
    
    def clean_output_dir(self) -> None:
        """Clean the output directory before generation.
        
        Removes all contents of the output directory to ensure a clean slate.
        """
        if self.output_dir.exists():
            logger.info(f"Cleaning output directory: {self.output_dir}")
            shutil.rmtree(self.output_dir)
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def create_for_tts_server(
        cls,
        output_dir: Union[str, Path],
        spec_path: Optional[Union[str, Path]] = None
    ) -> "Generator":
        """Create a Generator instance configured for the TTS server.
        
        Args:
            output_dir: Directory where generated code will be written
            spec_path: Path to OpenAPI spec (defaults to TTS server spec)
            
        Returns:
            Configured Generator instance
        """
        if spec_path is None:
            # Default to the TTS server OpenAPI spec
            current_dir = Path(__file__).parent
            spec_path = current_dir.parent / "openapi.yaml"
        
        return cls(
            spec_path=spec_path,
            output_dir=output_dir,
            generator_name="python-fastapi",
            package_name="tts_server_generated",
            package_version="1.0.0"
        )


def generate_tts_server_models(output_dir: Union[str, Path]) -> Path:
    """Convenience function to generate TTS server models.
    
    Args:
        output_dir: Directory where generated models will be written
        
    Returns:
        Path to the generated models directory
    """
    generator = Generator.create_for_tts_server(output_dir)
    return generator.generate_models()


def generate_tts_server_routes(output_dir: Union[str, Path]) -> Path:
    """Convenience function to generate TTS server routes.
    
    Args:
        output_dir: Directory where generated routes will be written
        
    Returns:
        Path to the generated routes directory
    """
    generator = Generator.create_for_tts_server(output_dir)
    return generator.generate_routes()


def generate_tts_full_server(output_dir: Union[str, Path]) -> Path:
    """Convenience function to generate complete TTS server code.
    
    Args:
        output_dir: Directory where generated server will be written
        
    Returns:
        Path to the generated server directory
    """
    generator = Generator.create_for_tts_server(output_dir)
    return generator.generate_full_server()