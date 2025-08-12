# Implementation Plan

## Task Overview
This implementation creates a new OpenAPI-generated server (`tts-server.py`) alongside the existing manual server (`server.py`), using `openapi-generator-pip` to generate Pydantic models and FastAPI routes from the OpenAPI specification. The approach ensures zero-downtime migration and maintains full backward compatibility.

## Steering Document Compliance
Tasks follow structure.md conventions with snake_case file naming and modular organization in `TTS/server/` directory. Implementation leverages existing FastAPI, Pydantic, and PyTorch patterns from tech.md while integrating with current model management systems.

## Atomic Task Requirements
Each task meets optimal agent execution criteria:
- **File Scope**: Touches 1-3 related files maximum per task
- **Time Boxing**: Completable in 15-30 minutes by experienced developer
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Exact file paths specified for creation/modification
- **Agent-Friendly**: Clear input/output with minimal context switching

## Tasks

### Phase 1: Foundation and Code Generation

- [ ] 1. Create OpenAPI Generator wrapper utility in TTS/server/codegen/generator.py
  - File: TTS/server/codegen/generator.py
  - Create wrapper class around openapi-generator-pip for server generation
  - Add methods for model generation and route generation using python-fastapi generator
  - Include configuration for output directory and template customization
  - _Leverage: Existing TTS/server/gen/ client generation patterns_
  - _Requirements: 1.1, 2.1_

- [ ] 2. Create OpenAPI specification validator in TTS/server/codegen/validator.py
  - File: TTS/server/codegen/validator.py  
  - Implement OpenAPI 3.0 specification validation using jsonschema
  - Add line number error reporting for YAML syntax errors
  - Include validation for required components/schemas section
  - _Leverage: Existing error handling patterns from TTS/server/error_handlers.py_
  - _Requirements: 1.1, 4.2_

- [ ] 3. Create codegen package initialization in TTS/server/codegen/__init__.py
  - File: TTS/server/codegen/__init__.py
  - Export main generator and validator classes
  - Add package-level configuration constants
  - Define public API for code generation utilities
  - _Leverage: Existing package structure patterns in TTS/server/_
  - _Requirements: 1.1_

- [ ] 4. Add openapi-generator-pip dependency to pyproject.toml
  - File: pyproject.toml (modify existing)
  - Add openapi-generator-pip to optional dependencies under [project.optional-dependencies] server group
  - Use version constraint "^1.0.0" compatible with existing FastAPI version
  - _Leverage: Existing dependency management in pyproject.toml_
  - _Requirements: 1.1, 6.4_

- [ ] 4b. Validate openapi-generator-pip installation
  - File: None (verification task)
  - Run pip install with server extras to verify dependency resolution
  - Test basic openapi-generator-cli functionality with --help command
  - _Leverage: Existing development environment setup_
  - _Requirements: 1.1_

- [ ] 5. Create generated server directory structure in TTS/server/generated_server/
  - Files: TTS/server/generated_server/__init__.py, TTS/server/generated_server/models/__init__.py, TTS/server/generated_server/apis/__init__.py
  - Create directory structure for OpenAPI Generator output
  - Add .gitignore for generated files (keep structure, ignore content)
  - Include README explaining generated nature of directory contents
  - _Leverage: Existing TTS/server/gen/ structure as template_
  - _Requirements: 1.2_

- [ ] 6. Configure OpenAPI Generator for model generation
  - File: TTS/server/codegen/generator.py (modify from task 1)
  - Add configure_model_generation() method with python-fastapi template
  - Set output directory to TTS/server/generated_server/models/
  - Configure template options for Pydantic V2 compatibility
  - _Leverage: Existing TTS/server/gen/openapi_client/ as reference for configuration_
  - _Requirements: 2.1_

- [ ] 6b. Generate Pydantic models from OpenAPI specification
  - Files: TTS/server/generated_server/models/*.py (generated)
  - Execute openapi-generator with configured settings on existing openapi.yaml
  - Generate models only (not routes) using python-fastapi generator
  - _Leverage: Configuration from task 6, existing openapi.yaml_
  - _Requirements: 2.1_

- [ ] 6c. Validate generated models against existing manual models
  - File: TTS/server/codegen/model_validator.py
  - Create validation script to compare generated models with manual server.py models
  - Check field types, constraints, and validation rules match
  - Generate validation report showing compatibility
  - _Leverage: Generated models from task 6b, existing manual models in server.py_
  - _Requirements: 2.3_

- [ ] 7. Create model registry for generated classes in TTS/server/generated_server/registry.py
  - File: TTS/server/generated_server/registry.py
  - Implement registry pattern for runtime access to generated model classes
  - Add methods for model registration, retrieval, and refresh
  - Include thread-safe atomic updates for hot-reload scenarios
  - _Leverage: Existing model state patterns from TTS/server/model_state.py_
  - _Requirements: 2.2, 4.1_

### Phase 2: Business Logic Integration

- [ ] 8. Create TTS business logic handlers in TTS/server/business_logic/tts_handlers.py
  - File: TTS/server/business_logic/tts_handlers.py
  - Extract TTS synthesis logic from existing server.py endpoints
  - Create reusable handler functions that work with generated models
  - Ensure handlers integrate with existing TTS.api and model state management
  - _Leverage: Existing route handler logic from server.py:738-836, TTS.api classes_
  - _Requirements: 3.1, 7.1_

- [ ] 9. Create model management handlers in TTS/server/business_logic/model_handlers.py
  - File: TTS/server/business_logic/model_handlers.py
  - Extract model loading/management logic from existing server.py
  - Create handlers for model operations that integrate with ModelManager and ModelCacheManager
  - Preserve existing threading and caching behavior
  - _Leverage: Existing model management from server.py:1126+, ModelManager, ModelCacheManager_
  - _Requirements: 7.1, 7.3_

- [ ] 10. Create business_logic package initialization in TTS/server/business_logic/__init__.py
  - File: TTS/server/business_logic/__init__.py
  - Export handler functions for import by generated server
  - Add configuration for business logic integration
  - Define interface contracts between handlers and generated routes
  - _Leverage: Existing handler patterns in TTS/server/_
  - _Requirements: 3.1, 7.1_

- [ ] 11. Create TTS server builder in TTS/server/codegen/server_builder.py
  - File: TTS/server/codegen/server_builder.py
  - Implement FastAPI app creation with generated routes and models
  - Connect generated endpoints to business logic handlers
  - Apply middleware (CORS, logging) matching existing server.py patterns
  - _Leverage: Existing FastAPI app setup from server.py:258-279_
  - _Requirements: 1.1, 3.1_

- [ ] 12. Configure OpenAPI Generator for route generation
  - File: TTS/server/codegen/generator.py (modify from task 6)
  - Add configure_route_generation() method with python-fastapi template
  - Set output directory to TTS/server/generated_server/apis/
  - Configure template to generate route stubs that import business logic handlers
  - _Leverage: Existing route patterns from server.py, business logic handlers from task 10_
  - _Requirements: 1.1_

- [ ] 12b. Generate FastAPI route stubs from OpenAPI specification
  - Files: TTS/server/generated_server/apis/*.py (generated)
  - Execute openapi-generator with route configuration on existing openapi.yaml
  - Generate FastAPI route definitions using python-fastapi generator
  - _Leverage: Configuration from task 12, existing openapi.yaml paths_
  - _Requirements: 1.1_

- [ ] 12c. Validate generated routes against existing endpoints
  - File: TTS/server/codegen/route_validator.py
  - Create validation script to compare generated routes with manual server.py endpoints
  - Check HTTP methods, paths, parameters, and response types match
  - Generate validation report showing endpoint compatibility
  - _Leverage: Generated routes from task 12b, existing endpoints in server.py_
  - _Requirements: 3.1_

### Phase 3: New Server Creation

- [ ] 13. Create main tts-server.py entry point
  - File: TTS/server/tts-server.py
  - Create new FastAPI application using server builder
  - Add startup/shutdown events for model loading and cleanup
  - Include CLI argument parsing for port, host, and configuration options
  - _Leverage: Existing server.py argument parsing and startup patterns_
  - _Requirements: 1.1, 6.1_

- [ ] 14. Integrate generated models with tts-server.py
  - File: TTS/server/tts-server.py (modify from task 13)
  - Import and register generated models using model registry
  - Configure model validation and serialization for all endpoints
  - Add error handling for model validation failures matching existing patterns
  - _Leverage: Generated models from task 6, registry from task 7_
  - _Requirements: 2.4, 3.4_

- [ ] 15. Apply middleware and CORS configuration to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 14)
  - Replicate existing CORS configuration from server.py
  - Add logging middleware using existing ConsoleFormatter patterns
  - Include error handling middleware matching existing error response formats
  - _Leverage: Existing middleware setup from server.py:262-279_
  - _Requirements: 3.3, 3.4_

- [ ] 16. Add health check endpoints to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 15)
  - Implement /api/v1/health endpoint using generated HealthResponse model
  - Add OpenAPI documentation generation serving at /docs
  - Include server status endpoints for monitoring generated vs manual server
  - _Leverage: Existing health check logic from server.py:837-933, generated HealthResponse model_
  - _Requirements: 1.4, 6.3_

### Phase 4: Hot-Reload and Development Tools

- [ ] 17. Create file watcher for OpenAPI specification in TTS/server/codegen/watcher.py
  - File: TTS/server/codegen/watcher.py
  - Implement file watching using watchdog library for openapi.yaml changes
  - Add debouncing to prevent excessive regeneration on rapid file changes
  - Include callback system for triggering regeneration pipeline
  - _Leverage: Development server patterns, existing logging infrastructure_
  - _Requirements: 4.1_

- [ ] 18. Add hot-reload support to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 16)
  - Integrate file watcher for development mode (--dev flag)
  - Implement background regeneration with atomic model registry updates
  - Add graceful error handling when regeneration fails, fallback to cached models
  - _Leverage: File watcher from task 17, registry from task 7_
  - _Requirements: 4.1_

- [ ] 19. Create development utilities in TTS/server/codegen/dev_utils.py
  - File: TTS/server/codegen/dev_utils.py
  - Add debugging utilities for inspecting generated models and routes
  - Create validation error formatter with line numbers and context
  - Include development dashboard endpoints for generation status
  - _Leverage: Existing debugging patterns, error formatting from validator_
  - _Requirements: 4.2, 4.4_

### Phase 5: Testing Integration

- [ ] 20. Create test utilities for generated models in tests/server_tests/test_generated_models.py
  - File: tests/server_tests/test_generated_models.py
  - Add unit tests for generated model validation against OpenAPI constraints
  - Test model serialization/deserialization consistency with existing manual models
  - Verify field validation matches OpenAPI schema constraints exactly
  - _Leverage: Existing test patterns from tests/aux_tests/, generated models_
  - _Requirements: 2.3, 4.3_

- [ ] 21. Create server startup integration tests in tests/integration/test_tts_server_startup.py
  - File: tests/integration/test_tts_server_startup.py
  - Test tts-server.py startup process and basic health check endpoints
  - Verify server starts within 30-second requirement with generated models
  - Test graceful shutdown and error handling during startup
  - _Leverage: Existing integration test patterns from tests/integration/, tts-server.py_
  - _Requirements: 6.1_

- [ ] 21b. Create endpoint compatibility tests in tests/integration/test_tts_server_endpoints.py
  - File: tests/integration/test_tts_server_endpoints.py
  - Compare response formats between tts-server.py and server.py endpoints byte-for-byte
  - Test all HTTP status codes (200, 422, 500) match exactly
  - Verify error response structure consistency
  - _Leverage: Both server implementations, existing endpoint testing patterns_
  - _Requirements: 3.1, 3.2_

- [ ] 21c. Create TTS synthesis integration tests in tests/integration/test_tts_server_synthesis.py
  - File: tests/integration/test_tts_server_synthesis.py
  - Verify TTS synthesis works through generated /api/v1/tts endpoint
  - Test integration with existing ModelManager and TTS.api classes
  - Test model loading and caching through generated endpoints
  - _Leverage: Existing TTS synthesis test patterns, ModelManager integration_
  - _Requirements: 7.1, 7.2_

- [ ] 22. Create performance regression tests in tests/performance/test_server_performance.py
  - File: tests/performance/test_server_performance.py
  - Benchmark response times between tts-server.py and server.py
  - Test memory usage and concurrent request handling performance
  - Validate performance requirements (5% response time, 10% memory overhead)
  - _Leverage: Existing performance testing patterns, both server implementations_
  - _Requirements: 5.1, 5.2, 5.3_

### Phase 6: Deployment Strategy

- [ ] 23. Create parallel server runner in TTS/server/deployment/parallel_runner.py
  - File: TTS/server/deployment/parallel_runner.py
  - Implement utility to run both server.py and tts-server.py simultaneously
  - Add port management and process monitoring for both servers
  - Include health check coordination and status reporting
  - _Leverage: Existing server startup patterns, health check logic_
  - _Requirements: 6.3_

- [ ] 24. Create traffic router for gradual migration in TTS/server/deployment/traffic_router.py
  - File: TTS/server/deployment/traffic_router.py
  - Implement request routing logic between manual and generated servers
  - Add gradual traffic shifting (10% → 50% → 90% → 100%) capability
  - Include automatic fallback on error rate thresholds
  - _Leverage: Existing request handling patterns, health monitoring_
  - _Requirements: 6.3_

- [ ] 25. Create deployment package initialization in TTS/server/deployment/__init__.py
  - File: TTS/server/deployment/__init__.py
  - Export deployment utilities for production use
  - Add configuration for deployment strategies and traffic routing
  - Include monitoring and alerting integration points
  - _Leverage: Existing deployment patterns_
  - _Requirements: 6.1, 6.2_

- [ ] 26. Add production deployment configuration
  - Files: TTS/server/deployment/production_config.py
  - Create production-specific configuration for generated server
  - Add environment variable handling for deployment settings
  - Include Docker compatibility and container health checks
  - _Leverage: Existing configuration patterns, Docker setup_
  - _Requirements: 6.4_

### Phase 7: Documentation and Finalization

- [ ] 27. Create migration guide documentation in docs/server_migration.md
  - File: docs/server_migration.md
  - Document migration process from server.py to tts-server.py
  - Include troubleshooting guide for common issues
  - Add configuration examples and deployment strategies
  - _Leverage: Existing documentation patterns in docs/_
  - _Requirements: 6.4_

- [ ] 28. Update README.md with new server information
  - File: README.md (modify existing)
  - Add section describing the OpenAPI-generated server option
  - Include usage examples and command-line options for tts-server.py
  - Document development workflow with hot-reload features
  - _Leverage: Existing README structure and examples_
  - _Requirements: 1.4_

- [ ] 29. Add error response compatibility to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 18)
  - Ensure all error responses match existing server.py HTTP status codes exactly
  - Import and use existing error response formats and patterns
  - Test error responses match manual server format
  - _Leverage: Existing error handling from server.py:930-933, error_handlers.py_
  - _Requirements: 3.4_

- [ ] 29b. Add comprehensive logging to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 29)
  - Add logging middleware using existing ConsoleFormatter patterns
  - Configure log levels and formats to match existing server.py
  - Include request/response logging for debugging
  - _Leverage: Existing logging infrastructure, ConsoleFormatter_
  - _Requirements: 6.1_

- [ ] 29c. Add fallback mechanisms to tts-server.py
  - File: TTS/server/tts-server.py (modify from task 29b)
  - Include graceful fallback when model generation fails
  - Add fallback to cached models when regeneration fails
  - Implement circuit breaker pattern for repeated failures
  - _Leverage: Existing model state management, cached model patterns_
  - _Requirements: 6.1, 6.2_

- [ ] 30. Create final integration validation script
  - File: scripts/validate_openapi_server.py
  - Create comprehensive validation script comparing both servers
  - Test all endpoints for response format consistency
  - Validate performance requirements and generate compliance report
  - _Leverage: Both server implementations, existing testing infrastructure_
  - _Requirements: All_