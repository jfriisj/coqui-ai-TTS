# ModelLoadRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_id** | **str** | Name of the model to load | 
**force_reload** | **bool** | Force reload even if model is already loaded | [optional] [default to False]

## Example

```python
from openapi_client.models.model_load_request import ModelLoadRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ModelLoadRequest from a JSON string
model_load_request_instance = ModelLoadRequest.from_json(json)
# print the JSON string representation of the object
print(ModelLoadRequest.to_json())

# convert the object into a dict
model_load_request_dict = model_load_request_instance.to_dict()
# create an instance of ModelLoadRequest from a dict
model_load_request_from_dict = ModelLoadRequest.from_dict(model_load_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


