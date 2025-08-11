# Fix for Bark Model Speaker/Language Issue

## Problem
When using Bark models, the frontend was showing 3 standard/hardcoded speakers instead of the actual speakers available for the Bark model. This was happening because:

1. The frontend model service was using fallback/hardcoded speaker lists instead of fetching real data from the backend
2. There were no dedicated API endpoints to get the actual speakers and languages from the currently loaded model
3. The model service was generating fake speaker data based on model name patterns

## Solution

### 1. Backend Changes (server.py)

Added two new API endpoints to get real speaker and language data:

- **`GET /api/v1/models/speakers`**: Returns actual speakers from the currently loaded model
- **`GET /api/v1/models/languages`**: Returns actual languages from the currently loaded model

These endpoints:
- Check the `global_model_state.current_model` for real model data
- Extract speakers/languages from the TTS instance properties
- Handle different model types (Bark, XTTS, etc.) that store speaker data differently
- Provide fallback detection for single-speaker/single-language models

### 2. Frontend Changes

#### apiClient.ts
- Added `getModelSpeakers()` method to call the new speakers endpoint
- Added `getModelLanguages()` method to call the new languages endpoint

#### modelService.ts
- Updated `getSpeakers()` to fetch real speakers from the API instead of using hardcoded lists
- Updated `getLanguages()` to fetch real languages from the API instead of using hardcoded lists
- Added fallback to cached model info if API calls fail
- Added `assessLanguageQualityFromModelName()` helper method

### 3. Testing

#### test_speaker_language_endpoints.py
Python script to test the new backend endpoints:
```bash
python test_speaker_language_endpoints.py
```

#### test_frontend_capabilities.html
Updated HTML test page that shows:
- Current model information
- Real speakers and languages from the API
- Model capabilities detection

## How It Works Now

1. **Model Loading**: When a model is loaded, the backend stores the real speaker/language data
2. **Frontend Request**: Frontend calls the new API endpoints to get actual data
3. **Dynamic Display**: UI components only show when real capabilities exist
4. **Real Data**: For Bark models, shows actual Bark speakers instead of generic ones

## Benefits

- ✅ **Real Data**: Shows actual speakers/languages for each model
- ✅ **Model-Specific**: Different models show their own unique capabilities
- ✅ **Dynamic**: UI adapts to what's actually available
- ✅ **Accurate**: No more fake/hardcoded speaker lists
- ✅ **Future-Proof**: Works with any model that provides speaker/language data

## Testing the Fix

1. **Start the TTS server** with a Bark model
2. **Load the test page**: Open `test_frontend_capabilities.html` in browser
3. **Check speakers**: Should show actual Bark speakers (not generic ones)
4. **Test API directly**: Run `python test_speaker_language_endpoints.py`

For Bark models, you should now see the actual Bark speakers instead of hardcoded generic speakers like "Claribel Dervla", "Daisy Studious", "Gracie Wise".

## Next Steps

If the issue persists:
1. Check server logs for any errors in the new endpoints
2. Verify the model is loading speaker data correctly
3. Test the API endpoints directly using the Python test script
4. Check browser console for any frontend errors
