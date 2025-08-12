# OpenAITTSRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** | Model to use (ignored, uses currently loaded model) | [optional] [default to 'tts-1']
**voice** | **str** | Voice ID or file path for voice cloning | 
**input** | **str** | Text to synthesize | 
**response_format** | **str** | Audio format | [optional] [default to 'wav']
**speed** | **float** | Speed of speech | [optional] [default to 1]

## Example

```python
from openapi_client.models.open_aitts_request import OpenAITTSRequest

# TODO update the JSON string below
json = "{}"
# create an instance of OpenAITTSRequest from a JSON string
open_aitts_request_instance = OpenAITTSRequest.from_json(json)
# print the JSON string representation of the object
print(OpenAITTSRequest.to_json())

# convert the object into a dict
open_aitts_request_dict = open_aitts_request_instance.to_dict()
# create an instance of OpenAITTSRequest from a dict
open_aitts_request_from_dict = OpenAITTSRequest.from_dict(open_aitts_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


