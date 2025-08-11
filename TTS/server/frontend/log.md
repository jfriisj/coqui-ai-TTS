C:\Github\coqui-ai-TTS\.venv\Scripts\python.exe C:\Github\coqui\coqui-ai-TTS\TTS\server\server.py 
GlobalModelState initialized
ModelCacheManager initialized with cache dir: C:\Users\jonfr\AppData\Local\tts\model_cache
Max memory: 4096MB, Max entries: 10
Refreshing model registry from: C:\Github\coqui\coqui-ai-TTS\TTS\.models.json
Registry refresh completed - 94 models loaded
ModelRegistry initialized for file: C:\Github\coqui\coqui-ai-TTS\TTS\.models.json
C:\Github\coqui\coqui-ai-TTS\TTS\server\server.py:280: DeprecationWarning: 
        on_event is deprecated, use lifespan event handlers instead.

        Read more about it in the
        [FastAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/events/).
        
  @app.on_event("startup")
INFO:     Started server process [10692]
INFO:     Waiting for application startup.
Started monitoring registry file: C:\Github\coqui\coqui-ai-TTS\TTS\.models.json (mode: polling)
tts_models/multilingual/multi-dataset/xtts_v2 is already downloaded.
Using model: xtts
Successfully loaded model tts_models/multilingual/multi-dataset/xtts_v2 (speakers: 58, languages: 17, load_time: 9.98s)
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:5002 (Press CTRL+C to quit)
INFO:     127.0.0.1:49270 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49270 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET / HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /assets/index-CMv_nSaq.js HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /vite.svg HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK

Name format: type/language/dataset/model
  1: tts_models/multilingual/multi-dataset/xtts_v2 [already downloaded]
  2: tts_models/multilingual/multi-dataset/xtts_v1.1
  3: tts_models/multilingual/multi-dataset/your_tts
  4: tts_models/multilingual/multi-dataset/bark [already downloaded]
  5: tts_models/bg/cv/vits
  6: tts_models/cs/cv/vits
  7: tts_models/da/cv/vits [already downloaded]
  8: tts_models/et/cv/vits
  9: tts_models/ga/cv/vits
 10: tts_models/en/ek1/tacotron2
 11: tts_models/en/ljspeech/tacotron2-DDC [already downloaded]
 12: tts_models/en/ljspeech/tacotron2-DDC_ph
 13: tts_models/en/ljspeech/glow-tts
 14: tts_models/en/ljspeech/speedy-speech
 15: tts_models/en/ljspeech/tacotron2-DCA
 16: tts_models/en/ljspeech/vits [already downloaded]
 17: tts_models/en/ljspeech/vits--neon
 18: tts_models/en/ljspeech/fast_pitch
 19: tts_models/en/ljspeech/overflow
 20: tts_models/en/ljspeech/neural_hmm
 21: tts_models/en/vctk/vits
 22: tts_models/en/vctk/fast_pitch
 23: tts_models/en/sam/tacotron-DDC
 24: tts_models/en/blizzard2013/capacitron-t2-c50
 25: tts_models/en/blizzard2013/capacitron-t2-c150_v2
 26: tts_models/en/multi-dataset/tortoise-v2
 27: tts_models/en/jenny/jenny
 28: tts_models/es/mai/tacotron2-DDC
 29: tts_models/es/css10/vits
 30: tts_models/fr/mai/tacotron2-DDC
 31: tts_models/fr/css10/vits
 32: tts_models/uk/mai/glow-tts
 33: tts_models/uk/mai/vits
 34: tts_models/zh-CN/baker/tacotron2-DDC-GST
 35: tts_models/nl/mai/tacotron2-DDC
 36: tts_models/nl/css10/vits
 37: tts_models/de/thorsten/tacotron2-DCA
 38: tts_models/de/thorsten/vits
 39: tts_models/de/thorsten/tacotron2-DDC
 40: tts_models/de/css10/vits-neon
 41: tts_models/ja/kokoro/tacotron2-DDC
 42: tts_models/tr/common-voice/glow-tts
 43: tts_models/it/mai_female/glow-tts
 44: tts_models/it/mai_female/vits
 45: tts_models/it/mai_male/glow-tts
 46: tts_models/it/mai_male/vits
 47: tts_models/ewe/openbible/vits
 48: tts_models/hau/openbible/vits
 49: tts_models/lin/openbible/vits
 50: tts_models/tw_akuapem/openbible/vits
 51: tts_models/tw_asante/openbible/vits
 52: tts_models/yor/openbible/vits
 53: tts_models/hu/css10/vits
 54: tts_models/el/cv/vits
 55: tts_models/fi/css10/vits
 56: tts_models/hr/cv/vits
 57: tts_models/lt/cv/vits
 58: tts_models/lv/cv/vits
 59: tts_models/mt/cv/vits
 60: tts_models/pl/mai_female/vits
 61: tts_models/pt/cv/vits
 62: tts_models/ro/cv/vits
 63: tts_models/sk/cv/vits
 64: tts_models/sl/cv/vits
 65: tts_models/sv/cv/vits
 66: tts_models/ca/custom/vits
 67: tts_models/fa/custom/glow-tts
 68: tts_models/fa/custom/vits-female
 69: tts_models/bn/custom/vits-male
 70: tts_models/bn/custom/vits-female
 71: tts_models/be/common-voice/glow-tts [already downloaded]

Name format: type/language/dataset/model
  1: vocoder_models/universal/libri-tts/wavegrad
  2: vocoder_models/universal/libri-tts/fullband-melgan
  3: vocoder_models/en/ek1/wavegrad
  4: vocoder_models/en/librispeech100/wavlm-hifigan
  5: vocoder_models/en/librispeech100/wavlm-hifigan_prematched
  6: vocoder_models/en/ljspeech/multiband-melgan
  7: vocoder_models/en/ljspeech/hifigan_v2 [already downloaded]
  8: vocoder_models/en/ljspeech/univnet
  9: vocoder_models/en/blizzard2013/hifigan_v2
 10: vocoder_models/en/vctk/hifigan_v2
 11: vocoder_models/en/sam/hifigan_v2
 12: vocoder_models/nl/mai/parallel-wavegan
 13: vocoder_models/de/thorsten/wavegrad
 14: vocoder_models/de/thorsten/fullband-melgan
 15: vocoder_models/de/thorsten/hifigan_v1
 16: vocoder_models/ja/kokoro/hifigan_v1
 17: vocoder_models/uk/mai/multiband-melgan
 18: vocoder_models/tr/common-voice/hifigan
 19: vocoder_models/be/common-voice/hifigan [already downloaded]

Name format: type/language/dataset/model
  1: voice_conversion_models/multilingual/vctk/freevc24
  2: voice_conversion_models/multilingual/multi-dataset/knnvc
  3: voice_conversion_models/multilingual/multi-dataset/openvoice_v1
  4: voice_conversion_models/multilingual/multi-dataset/openvoice_v2

Path to downloaded models: C:\Users\jonfr\AppData\Local\tts
WARNING: Unknown model type for tts_models/multilingual/multi-dataset/your_tts, using default estimate
WARNING: Unknown model type for tts_models/en/ljspeech/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/en/ljspeech/speedy-speech, using default estimate
WARNING: Unknown model type for tts_models/en/ljspeech/fast_pitch, using default estimate
WARNING: Unknown model type for tts_models/en/ljspeech/overflow, using default estimate
WARNING: Unknown model type for tts_models/en/ljspeech/neural_hmm, using default estimate
WARNING: Unknown model type for tts_models/en/vctk/fast_pitch, using default estimate
WARNING: Unknown model type for tts_models/en/blizzard2013/capacitron-t2-c50, using default estimate
WARNING: Unknown model type for tts_models/en/blizzard2013/capacitron-t2-c150_v2, using default estimate
WARNING: Unknown model type for tts_models/en/jenny/jenny, using default estimate
WARNING: Unknown model type for tts_models/uk/mai/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/tr/common-voice/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/it/mai_female/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/it/mai_male/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/fa/custom/glow-tts, using default estimate
WARNING: Unknown model type for tts_models/be/common-voice/glow-tts, using default estimate
WARNING: Unknown model type for vocoder_models/universal/libri-tts/wavegrad, using default estimate
WARNING: Unknown model type for vocoder_models/universal/libri-tts/fullband-melgan, using default estimate
WARNING: Unknown model type for vocoder_models/en/ek1/wavegrad, using default estimate
WARNING: Unknown model type for vocoder_models/en/librispeech100/wavlm-hifigan, using default estimate
WARNING: Unknown model type for vocoder_models/en/librispeech100/wavlm-hifigan_prematched, using default estimate
WARNING: Unknown model type for vocoder_models/en/ljspeech/multiband-melgan, using default estimate
WARNING: Unknown model type for vocoder_models/en/ljspeech/hifigan_v2, using default estimate
WARNING: Unknown model type for vocoder_models/en/ljspeech/univnet, using default estimate
WARNING: Unknown model type for vocoder_models/en/blizzard2013/hifigan_v2, using default estimate
WARNING: Unknown model type for vocoder_models/en/vctk/hifigan_v2, using default estimate
WARNING: Unknown model type for vocoder_models/en/sam/hifigan_v2, using default estimate
WARNING: Unknown model type for vocoder_models/nl/mai/parallel-wavegan, using default estimate
WARNING: Unknown model type for vocoder_models/de/thorsten/wavegrad, using default estimate
WARNING: Unknown model type for vocoder_models/de/thorsten/fullband-melgan, using default estimate
WARNING: Unknown model type for vocoder_models/de/thorsten/hifigan_v1, using default estimate
WARNING: Unknown model type for vocoder_models/ja/kokoro/hifigan_v1, using default estimate
WARNING: Unknown model type for vocoder_models/uk/mai/multiband-melgan, using default estimate
WARNING: Unknown model type for vocoder_models/tr/common-voice/hifigan, using default estimate
WARNING: Unknown model type for vocoder_models/be/common-voice/hifigan, using default estimate
WARNING: Unknown model type for voice_conversion_models/multilingual/vctk/freevc24, using default estimate
WARNING: Unknown model type for voice_conversion_models/multilingual/multi-dataset/knnvc, using default estimate
WARNING: Unknown model type for voice_conversion_models/multilingual/multi-dataset/openvoice_v1, using default estimate
WARNING: Unknown model type for voice_conversion_models/multilingual/multi-dataset/openvoice_v2, using default estimate
INFO:     127.0.0.1:49281 - "GET /api/v1/models/available HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49282 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49282 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49282 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "GET /api/v1/models/current HTTP/1.1" 200 OK
INFO:     127.0.0.1:49281 - "POST /api/v1/models/cancel HTTP/1.1" 405 Method Not Allowed
INFO:     127.0.0.1:49282 - "POST /api/v1/models/load HTTP/1.1" 422 Unprocessable Entity
INFO:     127.0.0.1:49287 - "POST /api/v1/models/cancel HTTP/1.1" 405 Method Not Allowed
INFO:     127.0.0.1:49288 - "POST /api/v1/models/load HTTP/1.1" 422 Unprocessable Entity