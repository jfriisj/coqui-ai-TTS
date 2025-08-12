# Adding New Models - Implementation Tasks

## Overview
This task breakdown implements the simple CLI-based system for adding new models to `TTS/.models.json`. The implementation focuses on two core components: a CLI script for user interaction and helper functions for registry manipulation.

## Prerequisites
- Python 3.10+ environment set up
- Existing Coqui TTS codebase accessible
- Understanding of `.models.json` structure from `TTS/.models.json`

## Task Breakdown

### Phase 1: Core Helper Functions

#### Task 1: Create model addition utility module
**Files to modify/create:** `TTS/utils/model_addition.py`
**Requirements:** FR-2 (Custom Model Registration), TC-1 (Architecture Constraints)
**Existing code to leverage:** `TTS/config/read_json_with_comments()`, `TTS/utils/manage.py` patterns

- [ ] Create new file `TTS/utils/model_addition.py`
- [ ] Implement `add_model_to_registry()` function with parameters for model_entry, model_type, language, dataset
- [ ] Add proper error handling and logging using existing logger patterns
- [ ] Implement `validate_model_entry()` function for basic field validation
- [ ] Add `list_registry_models()` helper function for debugging
- [ ] Include comprehensive docstrings following project conventions
- [ ] Add type hints for all function parameters and return values

#### Task 2: Add unit tests for model addition utilities
**Files to modify/create:** `tests/aux_tests/test_model_addition.py`
**Requirements:** DR-2 (Integration Testing Requirements), QA-2 (Maintainability)
**Existing code to leverage:** Test patterns from `tests/aux_tests/test_generic_utils.py`

- [ ] Create test file `tests/aux_tests/test_model_addition.py`
- [ ] Test `add_model_to_registry()` with valid model entries
- [ ] Test registry structure creation for new model types
- [ ] Test error handling for invalid JSON and file access issues
- [ ] Test `validate_model_entry()` with valid and invalid entries
- [ ] Mock file system operations using existing test patterns
- [ ] Add integration test with actual `.models.json` file modification

### Phase 2: CLI Script Implementation

#### Task 3: Create CLI script for adding models
**Files to modify/create:** `scripts/add_model.py`
**Requirements:** US-1 (Researcher Model Integration), US-2 (Developer Custom Model Support)
**Existing code to leverage:** Argument parsing patterns from `TTS/bin/` scripts

- [ ] Create executable script `scripts/add_model.py`
- [ ] Implement argument parser with all required options (model-name, model-type, etc.)
- [ ] Add validation for model-type choices (tts_models, vocoder_models, voice_conversion_models)
- [ ] Implement URL validation for hf-url and model-url parameters
- [ ] Add proper error handling and user-friendly error messages
- [ ] Include help text and usage examples
- [ ] Add logging output for successful/failed operations

#### Task 4: Add CLI script validation and testing
**Files to modify/create:** `tests/aux_tests/test_add_model_script.py`
**Requirements:** DR-2 (Integration Testing Requirements), NFR-2 (Reliability Requirements)
**Existing code to leverage:** CLI testing patterns from existing test suite

- [ ] Create test file for CLI script testing
- [ ] Test argument parsing with valid and invalid inputs
- [ ] Test model addition workflow end-to-end
- [ ] Test error handling for missing required arguments
- [ ] Test URL validation for various input formats
- [ ] Mock registry file operations for isolated testing
- [ ] Add integration test with temporary `.models.json` file

### Phase 3: Integration and Documentation

#### Task 5: Create documentation file for model addition
**Files to create:** `docs/source/adding_models.md`
**Requirements:** DR-1 (Documentation Requirements)
**Leverage:** Documentation structure from `docs/source/installation.md`

- [x] 5.1. Create new file `docs/source/adding_models.md` with proper Sphinx formatting
- [x] 5.2. Document CLI script usage with complete command examples
- [x] 5.3. Add troubleshooting section for common CLI errors

#### Task 6: Document registry structure and examples
**Files to modify:** `docs/source/adding_models.md`
**Requirements:** QA-1 (Usability)
**Leverage:** Registry examples from `TTS/.models.json`

- [x] 6.1. Document `.models.json` structure with annotated example
- [x] 6.2. Add examples for both Hugging Face and custom model entries
- [x] 6.3. Document model naming conventions and organization

#### Task 7: Update main README with model addition feature
**Files to modify:** `README.md`
**Requirements:** QA-1 (Usability)
**Leverage:** Existing feature documentation patterns in `README.md`

- [x] 7.1. Add brief section about model addition capability in features list
- [x] 7.2. Add link to detailed documentation in `docs/source/adding_models.md`

#### Task 8: Test model listing integration
**Files to test:** `TTS/api.py`, `TTS/utils/manage.py`
**Requirements:** IP-1 (Model Manager Integration)
**Leverage:** Existing `TTS().list_models()` functionality

- [ ] 8.1. Add test model to registry using helper function
- [ ] 8.2. Verify new model appears in `TTS().list_models()` output
- [ ] 8.3. Confirm model entry format matches expected structure

#### Task 9: Test model loading integration  
**Files to test:** `TTS/api.py`
**Requirements:** NFR-4 (Compatibility Requirements)
**Leverage:** Existing `TTS(model_name=...)` pattern

- [ ] 9.1. Test loading custom model with `TTS(model_name="tts_models/custom/custom/test_model")`
- [ ] 9.2. Verify model loading works without errors
- [ ] 9.3. Test basic synthesis functionality with loaded custom model

#### Task 10: Verify existing test suite compatibility
**Files to test:** Existing test suite
**Requirements:** NFR-4 (Compatibility Requirements)  
**Leverage:** Current test running infrastructure

- [ ] 10.1. Run existing test suite after registry modifications
- [ ] 10.2. Verify no regressions in model management tests
- [ ] 10.3. Confirm ModelManager tests still pass with extended registry

### Phase 4: Testing and Validation

#### Task 11: Create basic integration test file
**Files to create:** `tests/integration/test_model_addition_workflow.py`
**Requirements:** DR-2 (Integration Testing Requirements)
**Leverage:** Integration test patterns from `tests/integration/test_fastapi_server.py`

- [ ] 11.1. Create integration test file with proper test class structure
- [ ] 11.2. Add setup method to create temporary registry file
- [ ] 11.3. Add teardown method to clean up test files

#### Task 12: Test CLI workflow integration
**Files to modify:** `tests/integration/test_model_addition_workflow.py`
**Requirements:** US-1 (Researcher Model Integration)
**Leverage:** CLI testing patterns from existing integration tests

- [ ] 12.1. Test complete CLI script → registry update → model loading workflow
- [ ] 12.2. Test with valid model metadata and URLs
- [ ] 12.3. Verify model appears in TTS model listing after addition

#### Task 13: Test error handling in integration
**Files to modify:** `tests/integration/test_model_addition_workflow.py`
**Requirements:** EC-2 (Corrupted Model Files), NFR-2 (Reliability Requirements)
**Leverage:** Error handling patterns from existing tests

- [ ] 13.1. Test CLI script with invalid arguments
- [ ] 13.2. Test registry file corruption recovery
- [ ] 13.3. Test concurrent access scenarios with file locking

#### Task 14: Add file system error handling
**Files to modify:** `TTS/utils/model_addition.py`
**Requirements:** EC-1 (Network Connectivity Issues), EC-4 (Storage Space Exhaustion)
**Leverage:** Error handling patterns from `TTS/utils/manage.py`

- [ ] 14.1. Add comprehensive error handling for file access permissions
- [ ] 14.2. Handle disk space issues during registry write operations
- [ ] 14.3. Add proper exception logging with actionable error messages

#### Task 15: Add JSON parsing error handling
**Files to modify:** `TTS/utils/model_addition.py`
**Requirements:** EC-2 (Corrupted Model Files), NFR-2 (Reliability Requirements)
**Leverage:** JSON handling patterns from `TTS/config/read_json_with_comments()`

- [ ] 15.1. Handle JSON parsing errors gracefully in registry operations
- [ ] 15.2. Implement registry backup before modifications
- [ ] 15.3. Add rollback capability for failed registry updates

#### Task 16: Add URL validation and security
**Files to modify:** `scripts/add_model.py`
**Requirements:** NFR-3 (Security Requirements), EC-3 (Incompatible Model Architecture)
**Leverage:** URL validation patterns from existing codebase

- [ ] 16.1. Add URL format validation for hf-url and model-url parameters
- [ ] 16.2. Implement basic URL accessibility checking
- [ ] 16.3. Add security validation to prevent malicious URL inputs

## Quality Assurance Tasks

### Code Quality and Standards
- [ ] Run `ruff` linting on all new Python files and fix issues
- [ ] Verify type hints are complete and accurate using mypy
- [ ] Ensure all functions have comprehensive docstrings
- [ ] Follow snake_case naming conventions for all modules and functions
- [ ] Verify imports are organized according to project standards

### Performance and Security
- [ ] Validate URL inputs to prevent security issues
- [ ] Add file size limits for registry operations
- [ ] Ensure atomic file operations to prevent corruption
- [ ] Test memory usage with large registry files
- [ ] Verify no sensitive information is logged

### Backward Compatibility
- [ ] Confirm all existing models continue working unchanged
- [ ] Verify no breaking changes to existing APIs
- [ ] Test upgrade path from current `.models.json` structure
- [ ] Ensure new registry entries don't break existing parsers

## Acceptance Criteria Verification

### US-1 (Researcher Model Integration)
- [ ] Verify researcher can add HF model with single CLI command
- [ ] Confirm model appears in web interface after addition
- [ ] Test model loading and synthesis through existing API

### US-2 (Developer Custom Model Support)  
- [ ] Verify developer can register local model files
- [ ] Confirm custom models work with existing TTS workflows
- [ ] Test integration with Python API and web interface

### FR-1 (Hugging Face Integration)
- [ ] Confirm models are added to `.models.json` as single source of truth
- [ ] Verify automatic model discovery after registry update
- [ ] Test HF URL format support and validation

### FR-2 (Custom Model Registration)
- [ ] Confirm local model registration works properly
- [ ] Verify validation of model files and metadata
- [ ] Test registry entry creation with proper structure

## Implementation Notes

### Development Order
1. **Start with Task 1** - Core utility functions provide foundation
2. **Complete Task 2** - Ensure utilities are thoroughly tested
3. **Move to Task 3** - CLI script builds on tested utilities
4. **Continue sequentially** - Each task builds on previous work

### Testing Strategy
- Write tests alongside implementation (not after)
- Use existing test patterns and utilities from project
- Test both success and failure scenarios for each function
- Include integration tests that verify end-to-end workflows

### Error Handling Philosophy
- Fail fast with clear error messages
- Provide actionable suggestions for fixing issues
- Log detailed information for debugging
- Gracefully handle external service failures

This task breakdown provides atomic, testable units that can be implemented incrementally while maintaining system stability and following established project patterns.