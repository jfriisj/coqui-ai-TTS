cd /mnt/c/Github/coqui/coqui-ai-TTS/TTS/server/frontend && yarn run build
jonfriis@Gamer:/mnt/c/Github/coqui/coqui-ai-TTS$ cd /mnt/c/Github/coqui/coqui-ai-TTS/TTS/server/frontend && yarn run build
yarn run v1.22.22
$ npx tsc && vite build
src/gen/apis/DefaultApi.ts:2:47 - error TS6133: 'COLLECTION_FORMATS' is declared but its value is never read.

2 import {BaseAPIRequestFactory, RequiredError, COLLECTION_FORMATS} from './baseapi';
                                                ~~~~~~~~~~~~~~~~~~

src/gen/index.ts:5:10 - error TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'.

5 export { Configuration } from "./configuration"
           ~~~~~~~~~~~~~

src/gen/index.ts:10:10 - error TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'.

10 export { PromiseMiddleware as Middleware } from './middleware';
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/AvailableLanguagesGet200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/AvailableModelsGet200Response.ts:14:1 - error TS6133: 'HttpFile' is declared but its value is never read.

14 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/AvailableModelsGet200ResponseModelsInner.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/AvailableSpeakersGet200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/BatchTTSRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/CacheStatsGet200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/CleanupCachePost200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/CurrentModelGet200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/EnhancedTTSRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/HTTPValidationError.ts:14:1 - error TS6133: 'HttpFile' is declared but its value is never read.

14 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/HealthResponse.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/LoadModelPost200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/LocationInner.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/ModelLoadRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/ModelStatusGet200Response.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/OpenAITTSRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/TTSRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/TTSWithVCRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/TextPreprocessingRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/ValidationError.ts:14:1 - error TS6133: 'HttpFile' is declared but its value is never read.

14 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/models/VoiceConversionRequest.ts:13:1 - error TS6133: 'HttpFile' is declared but its value is never read.

13 import { HttpFile } from '../http/http';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/rxjsStub.ts:13:21 - error TS6133: 'T' is declared but its value is never read.

13 export function from<T>(promise: Promise<any>) {
                       ~~~

src/gen/types/ObjectParamAPI.ts:1:10 - error TS6133: 'ResponseContext' is declared but its value is never read.

1 import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
           ~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:1:27 - error TS6133: 'RequestContext' is declared but its value is never read.

1 import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
                            ~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:6:1 - error TS6133: 'AvailableModelsGet200ResponseModelsInner' is declared but its value is never read.

6 import { AvailableModelsGet200ResponseModelsInner } from '../models/AvailableModelsGet200ResponseModelsInner';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:8:1 - error TS6133: 'BatchTTSRequest' is declared but its value is never read.

8 import { BatchTTSRequest } from '../models/BatchTTSRequest';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:9:1 - error TS6133: 'BodyApiV1VoiceConvertApiV1VoiceConvertPost' is declared but its value is never read.

9 import { BodyApiV1VoiceConvertApiV1VoiceConvertPost } from '../models/BodyApiV1VoiceConvertApiV1VoiceConvertPost';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:13:1 - error TS6133: 'EnhancedTTSRequest' is declared but its value is never read.

13 import { EnhancedTTSRequest } from '../models/EnhancedTTSRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:14:1 - error TS6133: 'HTTPValidationError' is declared but its value is never read.

14 import { HTTPValidationError } from '../models/HTTPValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:17:1 - error TS6133: 'LocationInner' is declared but its value is never read.

17 import { LocationInner } from '../models/LocationInner';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:22:1 - error TS6133: 'TTSWithVCRequest' is declared but its value is never read.

22 import { TTSWithVCRequest } from '../models/TTSWithVCRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:23:1 - error TS6133: 'TextPreprocessingRequest' is declared but its value is never read.

23 import { TextPreprocessingRequest } from '../models/TextPreprocessingRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:24:1 - error TS6133: 'ValidationError' is declared but its value is never read.

24 import { ValidationError } from '../models/ValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:25:1 - error TS6133: 'VoiceConversionRequest' is declared but its value is never read.

25 import { VoiceConversionRequest } from '../models/VoiceConversionRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObjectParamAPI.ts:297:50 - error TS6133: 'param' is declared but its value is never read.

297     public apiV1HealthApiV1HealthGetWithHttpInfo(param: DefaultApiApiV1HealthApiV1HealthGetRequest = {}, options?: Configuration): Promise<HttpInfo<HealthResponse>> {
                                                     ~~~~~

src/gen/types/ObjectParamAPI.ts:306:38 - error TS6133: 'param' is declared but its value is never read.

306     public apiV1HealthApiV1HealthGet(param: DefaultApiApiV1HealthApiV1HealthGetRequest = {}, options?: Configuration): Promise<HealthResponse> {
                                         ~~~~~

src/gen/types/ObjectParamAPI.ts:315:50 - error TS6133: 'param' is declared but its value is never read.

315     public apiV1ModelsApiV1ModelsGetWithHttpInfo(param: DefaultApiApiV1ModelsApiV1ModelsGetRequest = {}, options?: Configuration): Promise<HttpInfo<any>> {
                                                     ~~~~~

src/gen/types/ObjectParamAPI.ts:324:38 - error TS6133: 'param' is declared but its value is never read.

324     public apiV1ModelsApiV1ModelsGet(param: DefaultApiApiV1ModelsApiV1ModelsGetRequest = {}, options?: Configuration): Promise<any> {
                                         ~~~~~

src/gen/types/ObjectParamAPI.ts:351:46 - error TS6133: 'param' is declared but its value is never read.

351     public availableLanguagesGetWithHttpInfo(param: DefaultApiAvailableLanguagesGetRequest = {}, options?: Configuration): Promise<HttpInfo<AvailableLanguagesGet200Response>> {
                                                 ~~~~~

src/gen/types/ObjectParamAPI.ts:360:34 - error TS6133: 'param' is declared but its value is never read.

360     public availableLanguagesGet(param: DefaultApiAvailableLanguagesGetRequest = {}, options?: Configuration): Promise<AvailableLanguagesGet200Response> {
                                     ~~~~~

src/gen/types/ObjectParamAPI.ts:369:43 - error TS6133: 'param' is declared but its value is never read.

369     public availableModelsGetWithHttpInfo(param: DefaultApiAvailableModelsGetRequest = {}, options?: Configuration): Promise<HttpInfo<AvailableModelsGet200Response>> {
                                              ~~~~~

src/gen/types/ObjectParamAPI.ts:378:31 - error TS6133: 'param' is declared but its value is never read.

378     public availableModelsGet(param: DefaultApiAvailableModelsGetRequest = {}, options?: Configuration): Promise<AvailableModelsGet200Response> {
                                  ~~~~~

src/gen/types/ObjectParamAPI.ts:387:45 - error TS6133: 'param' is declared but its value is never read.

387     public availableSpeakersGetWithHttpInfo(param: DefaultApiAvailableSpeakersGetRequest = {}, options?: Configuration): Promise<HttpInfo<AvailableSpeakersGet200Response>> {
                                                ~~~~~

src/gen/types/ObjectParamAPI.ts:396:33 - error TS6133: 'param' is declared but its value is never read.

396     public availableSpeakersGet(param: DefaultApiAvailableSpeakersGetRequest = {}, options?: Configuration): Promise<AvailableSpeakersGet200Response> {
                                    ~~~~~

src/gen/types/ObjectParamAPI.ts:405:38 - error TS6133: 'param' is declared but its value is never read.

405     public cacheStatsGetWithHttpInfo(param: DefaultApiCacheStatsGetRequest = {}, options?: Configuration): Promise<HttpInfo<CacheStatsGet200Response>> {
                                         ~~~~~

src/gen/types/ObjectParamAPI.ts:414:26 - error TS6133: 'param' is declared but its value is never read.

414     public cacheStatsGet(param: DefaultApiCacheStatsGetRequest = {}, options?: Configuration): Promise<CacheStatsGet200Response> {
                             ~~~~~

src/gen/types/ObjectParamAPI.ts:423:47 - error TS6133: 'param' is declared but its value is never read.

423     public cancelModelLoadingPostWithHttpInfo(param: DefaultApiCancelModelLoadingPostRequest = {}, options?: Configuration): Promise<HttpInfo<LoadModelPost200Response>> {
                                                  ~~~~~

src/gen/types/ObjectParamAPI.ts:432:35 - error TS6133: 'param' is declared but its value is never read.

432     public cancelModelLoadingPost(param: DefaultApiCancelModelLoadingPostRequest = {}, options?: Configuration): Promise<LoadModelPost200Response> {
                                      ~~~~~

src/gen/types/ObjectParamAPI.ts:441:41 - error TS6133: 'param' is declared but its value is never read.

441     public cleanupCachePostWithHttpInfo(param: DefaultApiCleanupCachePostRequest = {}, options?: Configuration): Promise<HttpInfo<CleanupCachePost200Response>> {
                                            ~~~~~

src/gen/types/ObjectParamAPI.ts:450:29 - error TS6133: 'param' is declared but its value is never read.

450     public cleanupCachePost(param: DefaultApiCleanupCachePostRequest = {}, options?: Configuration): Promise<CleanupCachePost200Response> {
                                ~~~~~

src/gen/types/ObjectParamAPI.ts:459:39 - error TS6133: 'param' is declared but its value is never read.

459     public clearCachePostWithHttpInfo(param: DefaultApiClearCachePostRequest = {}, options?: Configuration): Promise<HttpInfo<LoadModelPost200Response>> {
                                          ~~~~~

src/gen/types/ObjectParamAPI.ts:468:27 - error TS6133: 'param' is declared but its value is never read.

468     public clearCachePost(param: DefaultApiClearCachePostRequest = {}, options?: Configuration): Promise<LoadModelPost200Response> {
                              ~~~~~

src/gen/types/ObjectParamAPI.ts:477:40 - error TS6133: 'param' is declared but its value is never read.

477     public currentModelGetWithHttpInfo(param: DefaultApiCurrentModelGetRequest = {}, options?: Configuration): Promise<HttpInfo<CurrentModelGet200Response>> {
                                           ~~~~~

src/gen/types/ObjectParamAPI.ts:486:28 - error TS6133: 'param' is declared but its value is never read.

486     public currentModelGet(param: DefaultApiCurrentModelGetRequest = {}, options?: Configuration): Promise<CurrentModelGet200Response> {
                               ~~~~~

src/gen/types/ObjectParamAPI.ts:513:52 - error TS6133: 'param' is declared but its value is never read.

513     public maryTtsApiLocalesLocalesGetWithHttpInfo(param: DefaultApiMaryTtsApiLocalesLocalesGetRequest = {}, options?: Configuration): Promise<HttpInfo<any>> {
                                                       ~~~~~

src/gen/types/ObjectParamAPI.ts:522:40 - error TS6133: 'param' is declared but its value is never read.

522     public maryTtsApiLocalesLocalesGet(param: DefaultApiMaryTtsApiLocalesLocalesGetRequest = {}, options?: Configuration): Promise<any> {
                                           ~~~~~

src/gen/types/ObjectParamAPI.ts:531:50 - error TS6133: 'param' is declared but its value is never read.

531     public maryTtsApiVoicesVoicesGetWithHttpInfo(param: DefaultApiMaryTtsApiVoicesVoicesGetRequest = {}, options?: Configuration): Promise<HttpInfo<any>> {
                                                     ~~~~~

src/gen/types/ObjectParamAPI.ts:540:38 - error TS6133: 'param' is declared but its value is never read.

540     public maryTtsApiVoicesVoicesGet(param: DefaultApiMaryTtsApiVoicesVoicesGetRequest = {}, options?: Configuration): Promise<any> {
                                         ~~~~~

src/gen/types/ObjectParamAPI.ts:585:39 - error TS6133: 'param' is declared but its value is never read.

585     public modelStatusGetWithHttpInfo(param: DefaultApiModelStatusGetRequest = {}, options?: Configuration): Promise<HttpInfo<ModelStatusGet200Response>> {
                                          ~~~~~

src/gen/types/ObjectParamAPI.ts:594:27 - error TS6133: 'param' is declared but its value is never read.

594     public modelStatusGet(param: DefaultApiModelStatusGetRequest = {}, options?: Configuration): Promise<ModelStatusGet200Response> {
                              ~~~~~

src/gen/types/ObservableAPI.ts:7:1 - error TS6133: 'AvailableModelsGet200ResponseModelsInner' is declared but its value is never read.

7 import { AvailableModelsGet200ResponseModelsInner } from '../models/AvailableModelsGet200ResponseModelsInner';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:9:1 - error TS6133: 'BatchTTSRequest' is declared but its value is never read.

9 import { BatchTTSRequest } from '../models/BatchTTSRequest';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:10:1 - error TS6133: 'BodyApiV1VoiceConvertApiV1VoiceConvertPost' is declared but its value is never read.

10 import { BodyApiV1VoiceConvertApiV1VoiceConvertPost } from '../models/BodyApiV1VoiceConvertApiV1VoiceConvertPost';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:14:1 - error TS6133: 'EnhancedTTSRequest' is declared but its value is never read.

14 import { EnhancedTTSRequest } from '../models/EnhancedTTSRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:15:1 - error TS6133: 'HTTPValidationError' is declared but its value is never read.

15 import { HTTPValidationError } from '../models/HTTPValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:18:1 - error TS6133: 'LocationInner' is declared but its value is never read.

18 import { LocationInner } from '../models/LocationInner';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:23:1 - error TS6133: 'TTSWithVCRequest' is declared but its value is never read.

23 import { TTSWithVCRequest } from '../models/TTSWithVCRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:24:1 - error TS6133: 'TextPreprocessingRequest' is declared but its value is never read.

24 import { TextPreprocessingRequest } from '../models/TextPreprocessingRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:25:1 - error TS6133: 'ValidationError' is declared but its value is never read.

25 import { ValidationError } from '../models/ValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/ObservableAPI.ts:26:1 - error TS6133: 'VoiceConversionRequest' is declared but its value is never read.

26 import { VoiceConversionRequest } from '../models/VoiceConversionRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:1:10 - error TS6133: 'ResponseContext' is declared but its value is never read.

1 import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
           ~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:1:27 - error TS6133: 'RequestContext' is declared but its value is never read.

1 import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
                            ~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:6:1 - error TS6133: 'AvailableModelsGet200ResponseModelsInner' is declared but its value is never read.

6 import { AvailableModelsGet200ResponseModelsInner } from '../models/AvailableModelsGet200ResponseModelsInner';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:8:1 - error TS6133: 'BatchTTSRequest' is declared but its value is never read.

8 import { BatchTTSRequest } from '../models/BatchTTSRequest';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:9:1 - error TS6133: 'BodyApiV1VoiceConvertApiV1VoiceConvertPost' is declared but its value is never read.

9 import { BodyApiV1VoiceConvertApiV1VoiceConvertPost } from '../models/BodyApiV1VoiceConvertApiV1VoiceConvertPost';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:13:1 - error TS6133: 'EnhancedTTSRequest' is declared but its value is never read.

13 import { EnhancedTTSRequest } from '../models/EnhancedTTSRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:14:1 - error TS6133: 'HTTPValidationError' is declared but its value is never read.

14 import { HTTPValidationError } from '../models/HTTPValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:17:1 - error TS6133: 'LocationInner' is declared but its value is never read.

17 import { LocationInner } from '../models/LocationInner';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:22:1 - error TS6133: 'TTSWithVCRequest' is declared but its value is never read.

22 import { TTSWithVCRequest } from '../models/TTSWithVCRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:23:1 - error TS6133: 'TextPreprocessingRequest' is declared but its value is never read.

23 import { TextPreprocessingRequest } from '../models/TextPreprocessingRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:24:1 - error TS6133: 'ValidationError' is declared but its value is never read.

24 import { ValidationError } from '../models/ValidationError';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/gen/types/PromiseAPI.ts:25:1 - error TS6133: 'VoiceConversionRequest' is declared but its value is never read.

25 import { VoiceConversionRequest } from '../models/VoiceConversionRequest';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/ttsService.ts:560:49 - error TS2345: Argument of type 'TTSRequest' is not assignable to parameter of type 'SynthesisRequest'.
  Types of property 'format' are incompatible.
    Type 'string | undefined' is not assignable to type '"wav" | "mp3" | "opus" | "aac" | "flac" | "pcm" | undefined'.
      Type 'string' is not assignable to type '"wav" | "mp3" | "opus" | "aac" | "flac" | "pcm" | undefined'.

560         return await apiClient.synthesizeTextV1(request, config);
                                                    ~~~~~~~

src/services/ttsService.ts:568:26 - error TS2339: Property 'speed' does not exist on type 'TTSRequest'.

568           speed: request.speed || 1.0,
                             ~~~~~


Found 87 errors in 28 files.

Errors  Files
     1  src/gen/apis/DefaultApi.ts:2
     2  src/gen/index.ts:5
     1  src/gen/models/AvailableLanguagesGet200Response.ts:13
     1  src/gen/models/AvailableModelsGet200Response.ts:14
     1  src/gen/models/AvailableModelsGet200ResponseModelsInner.ts:13
     1  src/gen/models/AvailableSpeakersGet200Response.ts:13
     1  src/gen/models/BatchTTSRequest.ts:13
     1  src/gen/models/CacheStatsGet200Response.ts:13
     1  src/gen/models/CleanupCachePost200Response.ts:13
     1  src/gen/models/CurrentModelGet200Response.ts:13
     1  src/gen/models/EnhancedTTSRequest.ts:13
     1  src/gen/models/HTTPValidationError.ts:14
     1  src/gen/models/HealthResponse.ts:13
     1  src/gen/models/LoadModelPost200Response.ts:13
     1  src/gen/models/LocationInner.ts:13
     1  src/gen/models/ModelLoadRequest.ts:13
     1  src/gen/models/ModelStatusGet200Response.ts:13
     1  src/gen/models/OpenAITTSRequest.ts:13
     1  src/gen/models/TTSRequest.ts:13
     1  src/gen/models/TTSWithVCRequest.ts:13
     1  src/gen/models/TextPreprocessingRequest.ts:13
     1  src/gen/models/ValidationError.ts:14
     1  src/gen/models/VoiceConversionRequest.ts:13
     1  src/gen/rxjsStub.ts:13
    38  src/gen/types/ObjectParamAPI.ts:1
    10  src/gen/types/ObservableAPI.ts:7
    12  src/gen/types/PromiseAPI.ts:1
     2  src/services/ttsService.ts:560
error Command failed with exit code 2.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
