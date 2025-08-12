# TTSWithVCRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | Text to synthesize | 
**language** | **str** |  | [optional] 
**speaker_wav** | **str** | Path or URL to speaker wav file for voice cloning | 
**speaker** | **str** |  | [optional] 
**split_sentences** | **bool** | Split text into sentences for synthesis | [optional] [default to True]
**format** | **str** | Output audio format | [optional] [default to 'wav']

## Example

```python
from openapi_client.models.tts_with_vc_request import TTSWithVCRequest

# TODO update the JSON string below
json = "{}"
# create an instance of TTSWithVCRequest from a JSON string
tts_with_vc_request_instance = TTSWithVCRequest.from_json(json)
# print the JSON string representation of the object
print(TTSWithVCRequest.to_json())

# convert the object into a dict
tts_with_vc_request_dict = tts_with_vc_request_instance.to_dict()
# create an instance of TTSWithVCRequest from a dict
tts_with_vc_request_from_dict = TTSWithVCRequest.from_dict(tts_with_vc_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


