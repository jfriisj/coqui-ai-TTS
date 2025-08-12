# BatchTTSRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**texts** | **List[str]** | List of texts to synthesize | 
**speaker_name** | **str** |  | [optional] 
**language_name** | **str** |  | [optional] 
**speaker_wav** | **str** |  | [optional] 
**split_sentences** | **bool** | Split text into sentences for synthesis | [optional] [default to True]
**format** | **str** | Output audio format | [optional] [default to 'wav']
**concatenate** | **bool** | Concatenate all audio files into one | [optional] [default to True]

## Example

```python
from openapi_client.models.batch_tts_request import BatchTTSRequest

# TODO update the JSON string below
json = "{}"
# create an instance of BatchTTSRequest from a JSON string
batch_tts_request_instance = BatchTTSRequest.from_json(json)
# print the JSON string representation of the object
print(BatchTTSRequest.to_json())

# convert the object into a dict
batch_tts_request_dict = batch_tts_request_instance.to_dict()
# create an instance of BatchTTSRequest from a dict
batch_tts_request_from_dict = BatchTTSRequest.from_dict(batch_tts_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


