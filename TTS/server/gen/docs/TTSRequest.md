# TTSRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | Text to synthesize | 
**speaker** | **str** |  | [optional] 
**language** | **str** |  | [optional] 
**speaker_id** | **str** |  | [optional] 
**language_id** | **str** |  | [optional] 
**format** | **str** | Output audio format | [optional] [default to 'wav']

## Example

```python
from openapi_client.models.tts_request import TTSRequest

# TODO update the JSON string below
json = "{}"
# create an instance of TTSRequest from a JSON string
tts_request_instance = TTSRequest.from_json(json)
# print the JSON string representation of the object
print(TTSRequest.to_json())

# convert the object into a dict
tts_request_dict = tts_request_instance.to_dict()
# create an instance of TTSRequest from a dict
tts_request_from_dict = TTSRequest.from_dict(tts_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


