# Implementation Plan

## Task Overview
Create a lightweight TTS API server that automatically generates and serves OpenAPI-based endpoints without frontend components. The implementation focuses on startup validation, automatic code generation, endpoint registration, service integration, and lifecycle management while removing all frontend serving capabilities.

## Steering Document Compliance
Tasks follow structure.md conventions for service organization under TTS/server/services/ and leverage existing patterns from tech.md including BaseService, ServiceResult, and Coqpit configuration management.

## Atomic Task Requirements
**Each task must meet these criteria for optimal agent execution:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

## Task Format Guidelines
- Use checkbox format: `- [ ] Task number. Task description`
- **Specify files**: Always include exact file paths to create/modify
- **Include implementation details** as bullet points
- Reference requirements using: `_Requirements: X.Y, Z.A_`
- Reference existing code to leverage using: `_Leverage: path/to/file.py, path/to/component.py_`
- Focus only on coding tasks (no deployment, user testing, etc.)
- **Avoid broad terms**: No "system", "integration", "complete" in task titles

## Good vs Bad Task Examples
❌ **Bad Examples (Too Broad)**:
- "Implement authentication system" (affects many files, multiple purposes)
- "Add user management features" (vague scope, no file specification)
- "Build complete dashboard" (too large, multiple components)

✅ **Good Examples (Atomic)**:
- "Create User model in models/user.py with email/password fields"
- "Add password hashing utility in utils/auth.py using bcrypt"
- "Create LoginForm component in components/LoginForm.tsx with email/password inputs"

## Tasks

### Configuration Foundation

- [ ] 1. Create OpenAPIServerConfig class in TTS/server/config.py
  - File: TTS/server/config.py
  - Add OpenAPIServerConfig dataclass with api_only_mode, enable_docs, enable_redoc fields
  - Extend existing ServerConfig with openapi_server section
  - Include validation for boolean configuration fields
  - _Leverage: TTS/server/config.py existing Coqpit patterns_
  - _Requirements: 2.1, 2.2_

### OpenAPI Validation Component

- [ ] 2. Create OpenAPIValidator service class in TTS/server/services/openapi_validator.py
  - File: TTS/server/services/openapi_validator.py
  - Implement OpenAPIValidator class extending BaseService
  - Add validate_openapi_file() method to check YAML syntax and structure
  - Include file existence and schema validation logic
  - _Leverage: TTS/server/services/base_service.py BaseService pattern_
  - _Requirements: 1.1, 1.2_

- [ ] 3. Add dependency validation method to OpenAPIValidator
  - File: TTS/server/services/openapi_validator.py
  - Implement validate_dependencies() method for openapi-generator-cli check
  - Add command execution validation using subprocess
  - Return ServiceResult with validation status and error details
  - _Leverage: TTS/server/services/base_service.py ServiceResult pattern_
  - _Requirements: 1.3_

### API Component Generator

- [ ] 4. Create APIComponentGenerator service class in TTS/server/services/api_component_generator.py
  - File: TTS/server/services/api_component_generator.py
  - Implement APIComponentGenerator class extending BaseService
  - Add generate_api_models() method using openapi-generator-cli
  - Include subprocess execution with proper error handling
  - _Leverage: TTS/server/services/base_service.py BaseService pattern_
  - _Requirements: 1.4, 6.1_

- [ ] 5. Add change detection method to APIComponentGenerator
  - File: TTS/server/services/api_component_generator.py
  - Implement detect_component_changes() method comparing file timestamps
  - Add check_generation_needed() method for conditional regeneration
  - Include file hash comparison for change detection
  - _Leverage: TTS/server/services/base_service.py ServiceResult pattern_
  - _Requirements: 6.2_

- [ ] 6. Add route generation method to APIComponentGenerator
  - File: TTS/server/services/api_component_generator.py
  - Implement generate_routes() method for FastAPI endpoint creation
  - Add template-based code generation for route handlers
  - Include OpenAPI schema to FastAPI endpoint mapping
  - _Leverage: existing OpenAPI patterns from TTS/server/openapi.yaml_
  - _Requirements: 1.5, 3.1_

### Endpoint Registration System

- [ ] 7. Create EndpointRegistry service class in TTS/server/services/endpoint_registry.py
  - File: TTS/server/services/endpoint_registry.py
  - Implement EndpointRegistry class extending BaseService
  - Add register_endpoints() method for dynamic FastAPI route mounting
  - Include endpoint validation against OpenAPI specification
  - _Leverage: TTS/server/services/base_service.py BaseService pattern_
  - _Requirements: 3.2, 3.3_

- [ ] 8. Add validation middleware setup to EndpointRegistry
  - File: TTS/server/services/endpoint_registry.py
  - Implement setup_validation_middleware() method for request/response validation
  - Add OpenAPI schema-based validation configuration
  - Include HTTP 422 error handling for validation failures
  - _Leverage: existing FastAPI patterns from TTS/server/services/_
  - _Requirements: 3.4, 3.5_

### Service Integration Component

- [ ] 9. Create ServiceIntegrator class in TTS/server/services/service_integrator.py
  - File: TTS/server/services/service_integrator.py
  - Implement ServiceIntegrator class extending BaseService
  - Add integrate_model_service() method for ModelManagementService connection
  - Include external service health check delegation
  - _Leverage: TTS/server/services/base_service.py, TTS/server/services/model_management_service.py_
  - _Requirements: 4.1, 4.2_

- [ ] 10. Add service isolation methods to ServiceIntegrator
  - File: TTS/server/services/service_integrator.py
  - Implement ensure_service_isolation() method for non-blocking operation
  - Add background service initialization without blocking startup
  - Include service dependency management and health monitoring
  - _Leverage: TTS/server/services/service_manager.py patterns_
  - _Requirements: 4.3, 4.4_

### Lifecycle Management System

- [ ] 11. Create LifecycleManager class in TTS/server/services/lifecycle_manager.py
  - File: TTS/server/services/lifecycle_manager.py
  - Implement LifecycleManager class extending BaseService
  - Add graceful_startup() method with component validation sequence
  - Include startup dependency ordering and error handling
  - _Leverage: TTS/server/services/base_service.py BaseService pattern_
  - _Requirements: 5.1, 5.2_

- [ ] 12. Add shutdown management to LifecycleManager
  - File: TTS/server/services/lifecycle_manager.py
  - Implement graceful_shutdown() method for service cleanup
  - Add connection cleanup and resource release logic
  - Include proper shutdown ordering for dependent services
  - _Leverage: TTS/server/services/service_manager.py shutdown patterns_
  - _Requirements: 5.5_

### Main Server Application

- [ ] 13. Create LightweightTTSServer class in TTS/server/services/lightweight_tts_server.py
  - File: TTS/server/services/lightweight_tts_server.py
  - Implement LightweightTTSServer class extending BaseService
  - Add create_fastapi_app() method for API-only FastAPI application
  - Include OpenAPI documentation serving at /docs and /redoc endpoints
  - _Leverage: TTS/server/services/base_service.py BaseService pattern_
  - _Requirements: 2.3, 2.4_

- [ ] 14. Add CORS configuration to LightweightTTSServer
  - File: TTS/server/services/lightweight_tts_server.py
  - Implement setup_cors() method for API-only access configuration
  - Add middleware configuration for cross-origin requests
  - Include proper CORS headers for API documentation access
  - _Leverage: existing CORS patterns from TTS/server/ FastAPI setup_
  - _Requirements: 2.5_

- [ ] 15. Add error handling middleware to LightweightTTSServer
  - File: TTS/server/services/lightweight_tts_server.py
  - Implement setup_error_handling() method for comprehensive error middleware
  - Add HTTP status code mapping and error response formatting
  - Include proper exception handling for OpenAPI validation errors
  - _Leverage: TTS/server/services/error_handlers.py existing patterns_
  - _Requirements: 2.6, 3.5_

### Main Entry Point

- [ ] 16. Create new lightweight main.py in TTS/server/tts-server/main.py
  - File: TTS/server/tts-server/main.py
  - Replace existing main.py with lightweight version
  - Add startup sequence: validation → generation → service integration → server start
  - Include configuration loading from config.json
  - _Leverage: TTS/server/config.py, TTS/server/services/service_manager.py_
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 17. Add service orchestration to main.py
  - File: TTS/server/tts-server/main.py
  - Implement service initialization using all created service classes
  - Add proper error handling for startup failures
  - Include graceful shutdown signal handling
  - _Leverage: all created service classes_
  - _Requirements: 5.4, 5.5_

### Testing Infrastructure

- [ ] 18. Create OpenAPIValidator unit tests in tests/aux_tests/test_openapi_validator.py
  - File: tests/aux_tests/test_openapi_validator.py
  - Write tests for validate_openapi_file() and validate_dependencies() methods
  - Add test cases for valid/invalid YAML and missing dependencies
  - Include mock subprocess calls for dependency validation
  - _Leverage: tests/aux_tests/ existing test patterns_
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 19. Create APIComponentGenerator unit tests in tests/aux_tests/test_api_component_generator.py
  - File: tests/aux_tests/test_api_component_generator.py
  - Write tests for generate_api_models() and detect_component_changes() methods
  - Add test cases for successful generation and change detection
  - Include mock file system operations and subprocess calls
  - _Leverage: tests/aux_tests/ existing test patterns_
  - _Requirements: 1.4, 6.1, 6.2_

- [ ] 20. Create EndpointRegistry unit tests in tests/aux_tests/test_endpoint_registry.py
  - File: tests/aux_tests/test_endpoint_registry.py
  - Write tests for register_endpoints() and setup_validation_middleware() methods
  - Add test cases for successful endpoint registration and validation setup
  - Include mock FastAPI application and OpenAPI schema validation
  - _Leverage: tests/aux_tests/ existing FastAPI test patterns_
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 21. Create ServiceIntegrator unit tests in tests/aux_tests/test_service_integrator.py
  - File: tests/aux_tests/test_service_integrator.py
  - Write tests for integrate_model_service() and ensure_service_isolation() methods
  - Add test cases for successful service integration and isolation
  - Include mock ModelManagementService integration
  - _Leverage: tests/aux_tests/ existing service test patterns_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 22. Create LifecycleManager unit tests in tests/aux_tests/test_lifecycle_manager.py
  - File: tests/aux_tests/test_lifecycle_manager.py
  - Write tests for graceful_startup() and graceful_shutdown() methods
  - Add test cases for successful startup sequence and shutdown cleanup
  - Include mock service dependency management
  - _Leverage: tests/aux_tests/ existing service test patterns_
  - _Requirements: 5.1, 5.2, 5.5_

- [ ] 23. Create LightweightTTSServer unit tests in tests/aux_tests/test_lightweight_tts_server.py
  - File: tests/aux_tests/test_lightweight_tts_server.py
  - Write tests for create_fastapi_app(), setup_cors(), and setup_error_handling() methods
  - Add test cases for FastAPI application creation and middleware setup
  - Include mock FastAPI configuration and CORS testing
  - _Leverage: tests/aux_tests/ existing FastAPI test patterns_
  - _Requirements: 2.3, 2.4, 2.5, 2.6_

### Integration Testing

- [ ] 24. Create integration test for complete startup sequence in tests/integration/test_lightweight_server_startup.py
  - File: tests/integration/test_lightweight_server_startup.py
  - Write end-to-end test for complete server startup process
  - Add test cases for OpenAPI validation → generation → service integration → server start
  - Include real file system operations with temporary test environments
  - _Leverage: tests/integration/ existing integration test patterns_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

### Documentation and Cleanup

- [ ] 25. Update configuration documentation in TTS/server/config.py docstrings
  - File: TTS/server/config.py
  - Add comprehensive docstrings for OpenAPIServerConfig class
  - Include usage examples and configuration field descriptions
  - Document integration with existing configuration system
  - _Leverage: existing docstring patterns in TTS/server/config.py_
  - _Requirements: 2.1, 2.2_