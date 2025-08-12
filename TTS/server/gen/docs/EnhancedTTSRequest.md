# EnhancedTTSRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | Text to synthesize | 
**speaker_name** | **str** |  | [optional] 
**language_name** | **str** |  | [optional] 
**speaker_wav** | **str** |  | [optional] 
**style_wav** | **str** |  | [optional] 
**style_text** | **str** |  | [optional] 
**source_wav** | **str** |  | [optional] 
**source_speaker_name** | **str** |  | [optional] 
**split_sentences** | **bool** | Split text into sentences for synthesis | [optional] [default to True]
**voice_dir** | **str** |  | [optional] 
**format** | **str** | Output audio format | [optional] [default to 'wav']

## Example

```python
from openapi_client.models.enhanced_tts_request import EnhancedTTSRequest

# TODO update the JSON string below
json = "{}"
# create an instance of EnhancedTTSRequest from a JSON string
enhanced_tts_request_instance = EnhancedTTSRequest.from_json(json)
# print the JSON string representation of the object
print(EnhancedTTSRequest.to_json())

# convert the object into a dict
enhanced_tts_request_dict = enhanced_tts_request_instance.to_dict()
# create an instance of EnhancedTTSRequest from a dict
enhanced_tts_request_from_dict = EnhancedTTSRequest.from_dict(enhanced_tts_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


