# VoiceConversionRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**source_wav** | **str** | Path or URL to source wav file | 
**target_wav** | **str** |  | [optional] 
**speaker** | **str** |  | [optional] 
**voice_dir** | **str** |  | [optional] 
**source_speaker** | **str** |  | [optional] 
**format** | **str** | Output audio format | [optional] [default to 'wav']

## Example

```python
from openapi_client.models.voice_conversion_request import VoiceConversionRequest

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceConversionRequest from a JSON string
voice_conversion_request_instance = VoiceConversionRequest.from_json(json)
# print the JSON string representation of the object
print(VoiceConversionRequest.to_json())

# convert the object into a dict
voice_conversion_request_dict = voice_conversion_request_instance.to_dict()
# create an instance of VoiceConversionRequest from a dict
voice_conversion_request_from_dict = VoiceConversionRequest.from_dict(voice_conversion_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


