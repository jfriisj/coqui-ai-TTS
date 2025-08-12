# openapi_client.DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**api_v1_cache_cleanup_api_v1_cache_cleanup_post**](DefaultApi.md#api_v1_cache_cleanup_api_v1_cache_cleanup_post) | **POST** /api/v1/cache/cleanup | Cleanup cache
[**api_v1_cache_clear_api_v1_cache_clear_post**](DefaultApi.md#api_v1_cache_clear_api_v1_cache_clear_post) | **POST** /api/v1/cache/clear | Clear cache
[**api_v1_cache_stats_api_v1_cache_stats_get**](DefaultApi.md#api_v1_cache_stats_api_v1_cache_stats_get) | **GET** /api/v1/cache/stats | Get cache statistics
[**api_v1_get_model_languages_api_v1_models_languages_get**](DefaultApi.md#api_v1_get_model_languages_api_v1_models_languages_get) | **GET** /api/v1/models/languages | Get model languages
[**api_v1_get_model_speakers_api_v1_models_speakers_get**](DefaultApi.md#api_v1_get_model_speakers_api_v1_models_speakers_get) | **GET** /api/v1/models/speakers | Get model speakers
[**api_v1_health_api_v1_health_get**](DefaultApi.md#api_v1_health_api_v1_health_get) | **GET** /api/v1/health | Health Check
[**api_v1_models_all_languages_api_v1_models_all_languages_get**](DefaultApi.md#api_v1_models_all_languages_api_v1_models_all_languages_get) | **GET** /api/v1/models/all-languages | Get all supported languages
[**api_v1_models_api_v1_models_get**](DefaultApi.md#api_v1_models_api_v1_models_get) | **GET** /api/v1/models | List Available Models
[**api_v1_models_available_api_v1_models_available_get**](DefaultApi.md#api_v1_models_available_api_v1_models_available_get) | **GET** /api/v1/models/available | Get available models
[**api_v1_models_cancel_api_v1_models_cancel_post**](DefaultApi.md#api_v1_models_cancel_api_v1_models_cancel_post) | **POST** /api/v1/models/cancel | Cancel model loading
[**api_v1_models_capabilities_api_v1_models_capabilities_get**](DefaultApi.md#api_v1_models_capabilities_api_v1_models_capabilities_get) | **GET** /api/v1/models/capabilities | Get current model capabilities
[**api_v1_models_current_api_v1_models_current_get**](DefaultApi.md#api_v1_models_current_api_v1_models_current_get) | **GET** /api/v1/models/current | Get current model
[**api_v1_models_datasets_api_v1_models_datasets_get**](DefaultApi.md#api_v1_models_datasets_api_v1_models_datasets_get) | **GET** /api/v1/models/datasets | Get available datasets
[**api_v1_models_download_api_v1_models_download_model_path_get**](DefaultApi.md#api_v1_models_download_api_v1_models_download_model_path_get) | **GET** /api/v1/models/download/{model_path} | Download model
[**api_v1_models_info_api_v1_models_info_model_path_get**](DefaultApi.md#api_v1_models_info_api_v1_models_info_model_path_get) | **GET** /api/v1/models/info/{model_path} | Get detailed model information
[**api_v1_models_load_api_v1_models_load_post**](DefaultApi.md#api_v1_models_load_api_v1_models_load_post) | **POST** /api/v1/models/load | Load model
[**api_v1_models_progress_stream_api_v1_models_progress_stream_get**](DefaultApi.md#api_v1_models_progress_stream_api_v1_models_progress_stream_get) | **GET** /api/v1/models/progress-stream | Model loading progress stream
[**api_v1_models_status_api_v1_models_status_get**](DefaultApi.md#api_v1_models_status_api_v1_models_status_get) | **GET** /api/v1/models/status | Get model loading status
[**api_v1_models_tts_models_api_v1_models_tts_models_get**](DefaultApi.md#api_v1_models_tts_models_api_v1_models_tts_models_get) | **GET** /api/v1/models/tts-models | Get TTS models
[**api_v1_models_vc_models_api_v1_models_vc_models_get**](DefaultApi.md#api_v1_models_vc_models_api_v1_models_vc_models_get) | **GET** /api/v1/models/vc-models | Get voice conversion models
[**api_v1_models_vocoder_models_api_v1_models_vocoder_models_get**](DefaultApi.md#api_v1_models_vocoder_models_api_v1_models_vocoder_models_get) | **GET** /api/v1/models/vocoder-models | Get vocoder models
[**api_v1_registry_refresh_api_v1_registry_refresh_post**](DefaultApi.md#api_v1_registry_refresh_api_v1_registry_refresh_post) | **POST** /api/v1/registry/refresh | Refresh registry
[**api_v1_registry_status_api_v1_registry_status_get**](DefaultApi.md#api_v1_registry_status_api_v1_registry_status_get) | **GET** /api/v1/registry/status | Get registry status
[**api_v1_tts_api_v1_tts_post**](DefaultApi.md#api_v1_tts_api_v1_tts_post) | **POST** /api/v1/tts | TTS Synthesis
[**api_v1_tts_batch_api_v1_tts_batch_post**](DefaultApi.md#api_v1_tts_batch_api_v1_tts_batch_post) | **POST** /api/v1/tts/batch | Batch TTS synthesis
[**api_v1_tts_enhanced_api_v1_tts_enhanced_post**](DefaultApi.md#api_v1_tts_enhanced_api_v1_tts_enhanced_post) | **POST** /api/v1/tts/enhanced | Enhanced TTS synthesis
[**api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post**](DefaultApi.md#api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post) | **POST** /api/v1/tts/with-voice-conversion | TTS with voice conversion
[**api_v1_utils_model_file_info_api_v1_utils_model_file_info_get**](DefaultApi.md#api_v1_utils_model_file_info_api_v1_utils_model_file_info_get) | **GET** /api/v1/utils/model-file-info | Get model file information
[**api_v1_utils_split_sentences_api_v1_utils_split_sentences_post**](DefaultApi.md#api_v1_utils_split_sentences_api_v1_utils_split_sentences_post) | **POST** /api/v1/utils/split-sentences | Split text into sentences
[**api_v1_voice_convert_api_v1_voice_convert_convert_post**](DefaultApi.md#api_v1_voice_convert_api_v1_voice_convert_convert_post) | **POST** /api/v1/voice-convert/convert | Voice conversion
[**api_v1_voice_convert_api_v1_voice_convert_post**](DefaultApi.md#api_v1_voice_convert_api_v1_voice_convert_post) | **POST** /api/v1/voice-convert | Voice Conversion
[**mary_tts_api_locales_locales_get**](DefaultApi.md#mary_tts_api_locales_locales_get) | **GET** /locales | MaryTTS Compatible Locales
[**mary_tts_api_voices_voices_get**](DefaultApi.md#mary_tts_api_voices_voices_get) | **GET** /voices | MaryTTS Compatible Voices
[**mary_tts_process_get**](DefaultApi.md#mary_tts_process_get) | **GET** /process | MaryTTS Compatible Process
[**mary_tts_process_post**](DefaultApi.md#mary_tts_process_post) | **POST** /process | MaryTTS Compatible Process
[**openai_tts_v1_audio_speech_post**](DefaultApi.md#openai_tts_v1_audio_speech_post) | **POST** /v1/audio/speech | OpenAI Compatible Speech API
[**tts_synthesis_get**](DefaultApi.md#tts_synthesis_get) | **GET** /api/tts | Text-to-Speech Synthesis
[**tts_synthesis_post**](DefaultApi.md#tts_synthesis_post) | **POST** /api/tts | Text-to-Speech Synthesis


# **api_v1_cache_cleanup_api_v1_cache_cleanup_post**
> object api_v1_cache_cleanup_api_v1_cache_cleanup_post()

Cleanup cache

Perform LRU cache cleanup to free memory

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Cleanup cache
        api_response = api_instance.api_v1_cache_cleanup_api_v1_cache_cleanup_post()
        print("The response of DefaultApi->api_v1_cache_cleanup_api_v1_cache_cleanup_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_cache_cleanup_api_v1_cache_cleanup_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_cache_clear_api_v1_cache_clear_post**
> object api_v1_cache_clear_api_v1_cache_clear_post()

Clear cache

Clear all cached models from memory

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Clear cache
        api_response = api_instance.api_v1_cache_clear_api_v1_cache_clear_post()
        print("The response of DefaultApi->api_v1_cache_clear_api_v1_cache_clear_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_cache_clear_api_v1_cache_clear_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_cache_stats_api_v1_cache_stats_get**
> object api_v1_cache_stats_api_v1_cache_stats_get()

Get cache statistics

Get detailed cache statistics and memory usage

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get cache statistics
        api_response = api_instance.api_v1_cache_stats_api_v1_cache_stats_get()
        print("The response of DefaultApi->api_v1_cache_stats_api_v1_cache_stats_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_cache_stats_api_v1_cache_stats_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_get_model_languages_api_v1_models_languages_get**
> object api_v1_get_model_languages_api_v1_models_languages_get()

Get model languages

Get available languages for the current model

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get model languages
        api_response = api_instance.api_v1_get_model_languages_api_v1_models_languages_get()
        print("The response of DefaultApi->api_v1_get_model_languages_api_v1_models_languages_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_get_model_languages_api_v1_models_languages_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_get_model_speakers_api_v1_models_speakers_get**
> object api_v1_get_model_speakers_api_v1_models_speakers_get()

Get model speakers

Get available speakers for the current model

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get model speakers
        api_response = api_instance.api_v1_get_model_speakers_api_v1_models_speakers_get()
        print("The response of DefaultApi->api_v1_get_model_speakers_api_v1_models_speakers_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_get_model_speakers_api_v1_models_speakers_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_health_api_v1_health_get**
> HealthResponse api_v1_health_api_v1_health_get()

Health Check

Get comprehensive health status of the TTS server and its components

### Example


```python
import openapi_client
from openapi_client.models.health_response import HealthResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Health Check
        api_response = api_instance.api_v1_health_api_v1_health_get()
        print("The response of DefaultApi->api_v1_health_api_v1_health_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_health_api_v1_health_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**HealthResponse**](HealthResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_all_languages_api_v1_models_all_languages_get**
> object api_v1_models_all_languages_api_v1_models_all_languages_get()

Get all supported languages

Get a list of all supported languages using ModelManager.list_langs()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get all supported languages
        api_response = api_instance.api_v1_models_all_languages_api_v1_models_all_languages_get()
        print("The response of DefaultApi->api_v1_models_all_languages_api_v1_models_all_languages_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_all_languages_api_v1_models_all_languages_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_api_v1_models_get**
> object api_v1_models_api_v1_models_get()

List Available Models

Get list of all available TTS models

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Available Models
        api_response = api_instance.api_v1_models_api_v1_models_get()
        print("The response of DefaultApi->api_v1_models_api_v1_models_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_api_v1_models_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_available_api_v1_models_available_get**
> object api_v1_models_available_api_v1_models_available_get()

Get available models

Get a list of all available TTS models with metadata

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get available models
        api_response = api_instance.api_v1_models_available_api_v1_models_available_get()
        print("The response of DefaultApi->api_v1_models_available_api_v1_models_available_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_available_api_v1_models_available_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_cancel_api_v1_models_cancel_post**
> object api_v1_models_cancel_api_v1_models_cancel_post()

Cancel model loading

Cancel the current model loading operation

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Cancel model loading
        api_response = api_instance.api_v1_models_cancel_api_v1_models_cancel_post()
        print("The response of DefaultApi->api_v1_models_cancel_api_v1_models_cancel_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_cancel_api_v1_models_cancel_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_capabilities_api_v1_models_capabilities_get**
> object api_v1_models_capabilities_api_v1_models_capabilities_get()

Get current model capabilities

Get comprehensive capabilities of the currently loaded model using TTS API properties

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get current model capabilities
        api_response = api_instance.api_v1_models_capabilities_api_v1_models_capabilities_get()
        print("The response of DefaultApi->api_v1_models_capabilities_api_v1_models_capabilities_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_capabilities_api_v1_models_capabilities_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_current_api_v1_models_current_get**
> object api_v1_models_current_api_v1_models_current_get()

Get current model

Get information about the currently loaded model

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get current model
        api_response = api_instance.api_v1_models_current_api_v1_models_current_get()
        print("The response of DefaultApi->api_v1_models_current_api_v1_models_current_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_current_api_v1_models_current_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_datasets_api_v1_models_datasets_get**
> object api_v1_models_datasets_api_v1_models_datasets_get()

Get available datasets

Get a list of all available datasets using ModelManager.list_datasets()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get available datasets
        api_response = api_instance.api_v1_models_datasets_api_v1_models_datasets_get()
        print("The response of DefaultApi->api_v1_models_datasets_api_v1_models_datasets_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_datasets_api_v1_models_datasets_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_download_api_v1_models_download_model_path_get**
> object api_v1_models_download_api_v1_models_download_model_path_get(model_path)

Download model

Download and cache a specific model using ModelManager.download_model()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    model_path = 'model_path_example' # str | 

    try:
        # Download model
        api_response = api_instance.api_v1_models_download_api_v1_models_download_model_path_get(model_path)
        print("The response of DefaultApi->api_v1_models_download_api_v1_models_download_model_path_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_download_api_v1_models_download_model_path_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_path** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_info_api_v1_models_info_model_path_get**
> object api_v1_models_info_api_v1_models_info_model_path_get(model_path)

Get detailed model information

Get detailed information about a specific model using ModelManager.model_info_by_full_name()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    model_path = 'model_path_example' # str | 

    try:
        # Get detailed model information
        api_response = api_instance.api_v1_models_info_api_v1_models_info_model_path_get(model_path)
        print("The response of DefaultApi->api_v1_models_info_api_v1_models_info_model_path_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_info_api_v1_models_info_model_path_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_path** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_load_api_v1_models_load_post**
> object api_v1_models_load_api_v1_models_load_post(model_load_request)

Load model

Load a specific TTS model

### Example


```python
import openapi_client
from openapi_client.models.model_load_request import ModelLoadRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    model_load_request = openapi_client.ModelLoadRequest() # ModelLoadRequest | 

    try:
        # Load model
        api_response = api_instance.api_v1_models_load_api_v1_models_load_post(model_load_request)
        print("The response of DefaultApi->api_v1_models_load_api_v1_models_load_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_load_api_v1_models_load_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **model_load_request** | [**ModelLoadRequest**](ModelLoadRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_progress_stream_api_v1_models_progress_stream_get**
> object api_v1_models_progress_stream_api_v1_models_progress_stream_get()

Model loading progress stream

Server-sent events endpoint for streaming model loading progress

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Model loading progress stream
        api_response = api_instance.api_v1_models_progress_stream_api_v1_models_progress_stream_get()
        print("The response of DefaultApi->api_v1_models_progress_stream_api_v1_models_progress_stream_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_progress_stream_api_v1_models_progress_stream_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_status_api_v1_models_status_get**
> object api_v1_models_status_api_v1_models_status_get()

Get model loading status

Get the current status of model loading operations

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get model loading status
        api_response = api_instance.api_v1_models_status_api_v1_models_status_get()
        print("The response of DefaultApi->api_v1_models_status_api_v1_models_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_status_api_v1_models_status_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_tts_models_api_v1_models_tts_models_get**
> object api_v1_models_tts_models_api_v1_models_tts_models_get()

Get TTS models

Get a list of all available TTS models using ModelManager.list_tts_models()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get TTS models
        api_response = api_instance.api_v1_models_tts_models_api_v1_models_tts_models_get()
        print("The response of DefaultApi->api_v1_models_tts_models_api_v1_models_tts_models_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_tts_models_api_v1_models_tts_models_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_vc_models_api_v1_models_vc_models_get**
> object api_v1_models_vc_models_api_v1_models_vc_models_get()

Get voice conversion models

Get a list of all available voice conversion models using ModelManager.list_vc_models()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get voice conversion models
        api_response = api_instance.api_v1_models_vc_models_api_v1_models_vc_models_get()
        print("The response of DefaultApi->api_v1_models_vc_models_api_v1_models_vc_models_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_vc_models_api_v1_models_vc_models_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_models_vocoder_models_api_v1_models_vocoder_models_get**
> object api_v1_models_vocoder_models_api_v1_models_vocoder_models_get()

Get vocoder models

Get a list of all available vocoder models using ModelManager.list_vocoder_models()

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get vocoder models
        api_response = api_instance.api_v1_models_vocoder_models_api_v1_models_vocoder_models_get()
        print("The response of DefaultApi->api_v1_models_vocoder_models_api_v1_models_vocoder_models_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_models_vocoder_models_api_v1_models_vocoder_models_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_registry_refresh_api_v1_registry_refresh_post**
> object api_v1_registry_refresh_api_v1_registry_refresh_post()

Refresh registry

Manually trigger model registry refresh

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Refresh registry
        api_response = api_instance.api_v1_registry_refresh_api_v1_registry_refresh_post()
        print("The response of DefaultApi->api_v1_registry_refresh_api_v1_registry_refresh_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_registry_refresh_api_v1_registry_refresh_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_registry_status_api_v1_registry_status_get**
> object api_v1_registry_status_api_v1_registry_status_get()

Get registry status

Get model registry status and statistics

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get registry status
        api_response = api_instance.api_v1_registry_status_api_v1_registry_status_get()
        print("The response of DefaultApi->api_v1_registry_status_api_v1_registry_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_registry_status_api_v1_registry_status_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_tts_api_v1_tts_post**
> object api_v1_tts_api_v1_tts_post(tts_request)

TTS Synthesis

Synthesize speech from text using the advanced API

### Example


```python
import openapi_client
from openapi_client.models.tts_request import TTSRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    tts_request = openapi_client.TTSRequest() # TTSRequest | 

    try:
        # TTS Synthesis
        api_response = api_instance.api_v1_tts_api_v1_tts_post(tts_request)
        print("The response of DefaultApi->api_v1_tts_api_v1_tts_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_tts_api_v1_tts_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tts_request** | [**TTSRequest**](TTSRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_tts_batch_api_v1_tts_batch_post**
> object api_v1_tts_batch_api_v1_tts_batch_post(batch_tts_request)

Batch TTS synthesis

Synthesize multiple texts in a single request

### Example


```python
import openapi_client
from openapi_client.models.batch_tts_request import BatchTTSRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    batch_tts_request = openapi_client.BatchTTSRequest() # BatchTTSRequest | 

    try:
        # Batch TTS synthesis
        api_response = api_instance.api_v1_tts_batch_api_v1_tts_batch_post(batch_tts_request)
        print("The response of DefaultApi->api_v1_tts_batch_api_v1_tts_batch_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_tts_batch_api_v1_tts_batch_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **batch_tts_request** | [**BatchTTSRequest**](BatchTTSRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_tts_enhanced_api_v1_tts_enhanced_post**
> object api_v1_tts_enhanced_api_v1_tts_enhanced_post(enhanced_tts_request)

Enhanced TTS synthesis

Advanced TTS synthesis with full parameter support from Synthesizer.tts() method

### Example


```python
import openapi_client
from openapi_client.models.enhanced_tts_request import EnhancedTTSRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    enhanced_tts_request = openapi_client.EnhancedTTSRequest() # EnhancedTTSRequest | 

    try:
        # Enhanced TTS synthesis
        api_response = api_instance.api_v1_tts_enhanced_api_v1_tts_enhanced_post(enhanced_tts_request)
        print("The response of DefaultApi->api_v1_tts_enhanced_api_v1_tts_enhanced_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_tts_enhanced_api_v1_tts_enhanced_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **enhanced_tts_request** | [**EnhancedTTSRequest**](EnhancedTTSRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post**
> object api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post(tts_with_vc_request)

TTS with voice conversion

Combine TTS with voice conversion using TTS API tts_with_vc() method

### Example


```python
import openapi_client
from openapi_client.models.tts_with_vc_request import TTSWithVCRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    tts_with_vc_request = openapi_client.TTSWithVCRequest() # TTSWithVCRequest | 

    try:
        # TTS with voice conversion
        api_response = api_instance.api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post(tts_with_vc_request)
        print("The response of DefaultApi->api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_tts_with_vc_api_v1_tts_with_voice_conversion_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tts_with_vc_request** | [**TTSWithVCRequest**](TTSWithVCRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_utils_model_file_info_api_v1_utils_model_file_info_get**
> object api_v1_utils_model_file_info_api_v1_utils_model_file_info_get()

Get model file information

Get information about currently loaded model files

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get model file information
        api_response = api_instance.api_v1_utils_model_file_info_api_v1_utils_model_file_info_get()
        print("The response of DefaultApi->api_v1_utils_model_file_info_api_v1_utils_model_file_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_utils_model_file_info_api_v1_utils_model_file_info_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_utils_split_sentences_api_v1_utils_split_sentences_post**
> object api_v1_utils_split_sentences_api_v1_utils_split_sentences_post(text_preprocessing_request)

Split text into sentences

Split input text into sentences using Synthesizer.split_into_sentences() method

### Example


```python
import openapi_client
from openapi_client.models.text_preprocessing_request import TextPreprocessingRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    text_preprocessing_request = openapi_client.TextPreprocessingRequest() # TextPreprocessingRequest | 

    try:
        # Split text into sentences
        api_response = api_instance.api_v1_utils_split_sentences_api_v1_utils_split_sentences_post(text_preprocessing_request)
        print("The response of DefaultApi->api_v1_utils_split_sentences_api_v1_utils_split_sentences_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_utils_split_sentences_api_v1_utils_split_sentences_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **text_preprocessing_request** | [**TextPreprocessingRequest**](TextPreprocessingRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_voice_convert_api_v1_voice_convert_convert_post**
> object api_v1_voice_convert_api_v1_voice_convert_convert_post(voice_conversion_request)

Voice conversion

Convert source voice to target speaker using TTS API voice_conversion() method

### Example


```python
import openapi_client
from openapi_client.models.voice_conversion_request import VoiceConversionRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    voice_conversion_request = openapi_client.VoiceConversionRequest() # VoiceConversionRequest | 

    try:
        # Voice conversion
        api_response = api_instance.api_v1_voice_convert_api_v1_voice_convert_convert_post(voice_conversion_request)
        print("The response of DefaultApi->api_v1_voice_convert_api_v1_voice_convert_convert_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_voice_convert_api_v1_voice_convert_convert_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voice_conversion_request** | [**VoiceConversionRequest**](VoiceConversionRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **api_v1_voice_convert_api_v1_voice_convert_post**
> object api_v1_voice_convert_api_v1_voice_convert_post(source_wav, target_wav)

Voice Conversion

Convert voice characteristics from source to target audio

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    source_wav = None # bytearray | Source audio file
    target_wav = None # bytearray | Target audio file for voice characteristics

    try:
        # Voice Conversion
        api_response = api_instance.api_v1_voice_convert_api_v1_voice_convert_post(source_wav, target_wav)
        print("The response of DefaultApi->api_v1_voice_convert_api_v1_voice_convert_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->api_v1_voice_convert_api_v1_voice_convert_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **source_wav** | **bytearray**| Source audio file | 
 **target_wav** | **bytearray**| Target audio file for voice characteristics | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mary_tts_api_locales_locales_get**
> object mary_tts_api_locales_locales_get()

MaryTTS Compatible Locales

MaryTTS-compatible /locales endpoint

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # MaryTTS Compatible Locales
        api_response = api_instance.mary_tts_api_locales_locales_get()
        print("The response of DefaultApi->mary_tts_api_locales_locales_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->mary_tts_api_locales_locales_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mary_tts_api_voices_voices_get**
> object mary_tts_api_voices_voices_get()

MaryTTS Compatible Voices

MaryTTS-compatible /voices endpoint

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # MaryTTS Compatible Voices
        api_response = api_instance.mary_tts_api_voices_voices_get()
        print("The response of DefaultApi->mary_tts_api_voices_voices_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->mary_tts_api_voices_voices_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mary_tts_process_get**
> object mary_tts_process_get(input_text=input_text, voice=voice, locale=locale)

MaryTTS Compatible Process

MaryTTS-compatible /process endpoint

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    input_text = 'input_text_example' # str | Text to synthesize (optional)
    voice = 'voice_example' # str | Voice/speaker ID (optional)
    locale = 'locale_example' # str | Language locale (ignored) (optional)

    try:
        # MaryTTS Compatible Process
        api_response = api_instance.mary_tts_process_get(input_text=input_text, voice=voice, locale=locale)
        print("The response of DefaultApi->mary_tts_process_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->mary_tts_process_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **input_text** | **str**| Text to synthesize | [optional] 
 **voice** | **str**| Voice/speaker ID | [optional] 
 **locale** | **str**| Language locale (ignored) | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mary_tts_process_post**
> object mary_tts_process_post(input_text=input_text, voice=voice, locale=locale)

MaryTTS Compatible Process

MaryTTS-compatible /process endpoint

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    input_text = 'input_text_example' # str | Text to synthesize (optional)
    voice = 'voice_example' # str | Voice/speaker ID (optional)
    locale = 'locale_example' # str | Language locale (ignored) (optional)

    try:
        # MaryTTS Compatible Process
        api_response = api_instance.mary_tts_process_post(input_text=input_text, voice=voice, locale=locale)
        print("The response of DefaultApi->mary_tts_process_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->mary_tts_process_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **input_text** | **str**| Text to synthesize | [optional] 
 **voice** | **str**| Voice/speaker ID | [optional] 
 **locale** | **str**| Language locale (ignored) | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openai_tts_v1_audio_speech_post**
> object openai_tts_v1_audio_speech_post(open_aitts_request)

OpenAI Compatible Speech API

OpenAI-compatible text-to-speech endpoint

### Example


```python
import openapi_client
from openapi_client.models.open_aitts_request import OpenAITTSRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    open_aitts_request = openapi_client.OpenAITTSRequest() # OpenAITTSRequest | 

    try:
        # OpenAI Compatible Speech API
        api_response = api_instance.openai_tts_v1_audio_speech_post(open_aitts_request)
        print("The response of DefaultApi->openai_tts_v1_audio_speech_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->openai_tts_v1_audio_speech_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **open_aitts_request** | [**OpenAITTSRequest**](OpenAITTSRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **tts_synthesis_get**
> object tts_synthesis_get(text=text, speaker_id=speaker_id, language_id=language_id, style_wav=style_wav, speaker_wav=speaker_wav, speaker_id2=speaker_id2, language_id2=language_id2, text2=text2, style_wav2=style_wav2, speaker_wav2=speaker_wav2)

Text-to-Speech Synthesis

Convert text to speech using the currently loaded TTS model

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    text = 'text_example' # str | Text to synthesize (optional)
    speaker_id = 'speaker_id_example' # str | Speaker ID for multi-speaker models (optional)
    language_id = 'language_id_example' # str | Language ID for multilingual models (optional)
    style_wav = 'style_wav_example' # str | Style wav file or GST tokens (optional)
    speaker_wav = 'speaker_wav_example' # str | Speaker wav file for voice cloning (optional)
    speaker_id2 = 'speaker_id_example' # str |  (optional)
    language_id2 = 'language_id_example' # str |  (optional)
    text2 = 'text_example' # str |  (optional)
    style_wav2 = 'style_wav_example' # str |  (optional)
    speaker_wav2 = 'speaker_wav_example' # str |  (optional)

    try:
        # Text-to-Speech Synthesis
        api_response = api_instance.tts_synthesis_get(text=text, speaker_id=speaker_id, language_id=language_id, style_wav=style_wav, speaker_wav=speaker_wav, speaker_id2=speaker_id2, language_id2=language_id2, text2=text2, style_wav2=style_wav2, speaker_wav2=speaker_wav2)
        print("The response of DefaultApi->tts_synthesis_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->tts_synthesis_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **text** | **str**| Text to synthesize | [optional] 
 **speaker_id** | **str**| Speaker ID for multi-speaker models | [optional] 
 **language_id** | **str**| Language ID for multilingual models | [optional] 
 **style_wav** | **str**| Style wav file or GST tokens | [optional] 
 **speaker_wav** | **str**| Speaker wav file for voice cloning | [optional] 
 **speaker_id2** | **str**|  | [optional] 
 **language_id2** | **str**|  | [optional] 
 **text2** | **str**|  | [optional] 
 **style_wav2** | **str**|  | [optional] 
 **speaker_wav2** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **tts_synthesis_post**
> object tts_synthesis_post(text=text, speaker_id=speaker_id, language_id=language_id, style_wav=style_wav, speaker_wav=speaker_wav, speaker_id2=speaker_id2, language_id2=language_id2, text2=text2, style_wav2=style_wav2, speaker_wav2=speaker_wav2)

Text-to-Speech Synthesis

Convert text to speech using the currently loaded TTS model

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    text = 'text_example' # str | Text to synthesize (optional)
    speaker_id = 'speaker_id_example' # str | Speaker ID for multi-speaker models (optional)
    language_id = 'language_id_example' # str | Language ID for multilingual models (optional)
    style_wav = 'style_wav_example' # str | Style wav file or GST tokens (optional)
    speaker_wav = 'speaker_wav_example' # str | Speaker wav file for voice cloning (optional)
    speaker_id2 = 'speaker_id_example' # str |  (optional)
    language_id2 = 'language_id_example' # str |  (optional)
    text2 = 'text_example' # str |  (optional)
    style_wav2 = 'style_wav_example' # str |  (optional)
    speaker_wav2 = 'speaker_wav_example' # str |  (optional)

    try:
        # Text-to-Speech Synthesis
        api_response = api_instance.tts_synthesis_post(text=text, speaker_id=speaker_id, language_id=language_id, style_wav=style_wav, speaker_wav=speaker_wav, speaker_id2=speaker_id2, language_id2=language_id2, text2=text2, style_wav2=style_wav2, speaker_wav2=speaker_wav2)
        print("The response of DefaultApi->tts_synthesis_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->tts_synthesis_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **text** | **str**| Text to synthesize | [optional] 
 **speaker_id** | **str**| Speaker ID for multi-speaker models | [optional] 
 **language_id** | **str**| Language ID for multilingual models | [optional] 
 **style_wav** | **str**| Style wav file or GST tokens | [optional] 
 **speaker_wav** | **str**| Speaker wav file for voice cloning | [optional] 
 **speaker_id2** | **str**|  | [optional] 
 **language_id2** | **str**|  | [optional] 
 **text2** | **str**|  | [optional] 
 **style_wav2** | **str**|  | [optional] 
 **speaker_wav2** | **str**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

