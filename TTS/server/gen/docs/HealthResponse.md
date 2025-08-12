# HealthResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **str** | Overall health status | 
**model_loaded** | **bool** | Whether a TTS model is currently loaded | 
**components** | **Dict[str, object]** | Status of individual components | 
**cache** | **Dict[str, object]** |  | [optional] 
**model_name** | **str** |  | [optional] 
**model_capabilities** | **Dict[str, object]** |  | [optional] 

## Example

```python
from openapi_client.models.health_response import HealthResponse

# TODO update the JSON string below
json = "{}"
# create an instance of HealthResponse from a JSON string
health_response_instance = HealthResponse.from_json(json)
# print the JSON string representation of the object
print(HealthResponse.to_json())

# convert the object into a dict
health_response_dict = health_response_instance.to_dict()
# create an instance of HealthResponse from a dict
health_response_from_dict = HealthResponse.from_dict(health_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


