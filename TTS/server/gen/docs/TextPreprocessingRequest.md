# TextPreprocessingRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | Text to preprocess | 
**language** | **str** | Language code for sentence segmentation | [optional] [default to 'en']

## Example

```python
from openapi_client.models.text_preprocessing_request import TextPreprocessingRequest

# TODO update the JSON string below
json = "{}"
# create an instance of TextPreprocessingRequest from a JSON string
text_preprocessing_request_instance = TextPreprocessingRequest.from_json(json)
# print the JSON string representation of the object
print(TextPreprocessingRequest.to_json())

# convert the object into a dict
text_preprocessing_request_dict = text_preprocessing_request_instance.to_dict()
# create an instance of TextPreprocessingRequest from a dict
text_preprocessing_request_from_dict = TextPreprocessingRequest.from_dict(text_preprocessing_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


