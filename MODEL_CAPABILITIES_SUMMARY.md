# 🐸 Coqui TTS Model Capabilities Summary

This document provides a comprehensive overview of the speakers and languages supported by various TTS models in the Coqui TTS ecosystem.

## 📋 Model Overview

| Model | Type | Multi-Speaker | Multi-Lingual | Voice Cloning | Streaming |
|-------|------|:-------------:|:-------------:|:-------------:|:---------:|
| Bark | Generative TTS | ✅ | ✅ | ✅ | ❌ |
| XTTS v1.1/v2 | Neural TTS | ✅ | ✅ | ✅ | ✅ |
| Tortoise v2 | Autoregressive | ✅ | ❌ | ✅ | ❌ |
| YourTTS | Neural TTS | ✅ | ✅ | ✅ | ❌ |
| OpenVoice v1/v2 | Voice Conversion | ✅ | ✅ | ✅ | ❌ |
| KNNVC | Voice Conversion | ✅ | ✅ | ❌ | ❌ |

---

## 🗣️ Model-Specific Details

### 🐶 Bark - MULTI-DATASET (MULTILINGUAL)
**Architecture:** Transformer-based generative model  
**Specialty:** Conversational speech, music, and sound effects

#### **Speakers:**
- **Voice Cloning:** Upload 5-30 seconds of reference audio
- **Random Generation:** Generate unique random voices
- **No Predefined Speakers:** Uses voice cloning instead of fixed speaker IDs

#### **Languages (16 supported):**
- **Primary:** English, Spanish, French, German, Italian, Portuguese
- **Good Support:** Polish, Turkish, Russian, Dutch, Czech
- **Experimental:** Arabic, Chinese, Japanese, Hungarian, Korean

#### **Key Features:**
- Automatic language detection from text
- Can generate non-speech sounds and music
- Excels at emotional and conversational speech
- Slower synthesis but high quality

---

### 🤖 XTTS v1.1/v2 - MULTI-DATASET (MULTILINGUAL)
**Architecture:** GPT-based with streaming support  
**Specialty:** Real-time voice cloning with <200ms latency

#### **Speakers (58 built-in + cloning):**
**Named Speakers:**
- Claribel Dervla, Daisy Studious, Gracie Wise, Ana Florence
- Rainbow Rainbow, Libri female, Libri male, Briauna, Mohegan
- Santa, Baldur, Bruce Wayne, Carla, Claes, Elisabeth
- Emma, Florian, Hans, Holly, Ijeoma, Janet, Jenna
- Kazuhiko, Kenji, Klaus, Leonidas, Marcus, Narrator
- Niel, Patrick, Rosalyn, Roy, Samaki, Serenity, Sofia
- Stefanie, Victor, Wayne, Zora

**Generic Speakers:**
- female_01 through female_10
- male_01 through male_10

**Voice Cloning:** 3+ seconds of reference audio

#### **Languages (17 supported):**
- Arabic (ar), Chinese (zh), Czech (cs), Dutch (nl)
- English (en), French (fr), German (de), Hindi (hi)
- Hungarian (hu), Italian (it), Japanese (ja), Korean (ko)
- Polish (pl), Portuguese (pt), Russian (ru), Spanish (es), Turkish (tr)

#### **Key Features:**
- Streaming synthesis with <200ms latency
- Cross-language voice cloning
- Fine-tuning support
- 24kHz output quality

---

### 🐢 Tortoise v2 - MULTI-DATASET (EN)
**Architecture:** Autoregressive with diffusion vocoder  
**Specialty:** Extremely expressive voice cloning (English only)

#### **Speakers (Voice cloning + presets):**
**Predefined Voices:**
- angie, daniel, deniro, emma, freeman, geralt
- halle, jlaw, lj, mol, pat, pat2, rainbow
- snakes, tim_reynolds, tom, train_daws, train_dreams
- train_grace, train_lescault, train_mouse, weaver, william

**Voice Cloning:** 10+ seconds of reference audio for best results

#### **Languages:**
- **English only** - Optimized for English speech patterns

#### **Key Features:**
- Highest quality voice cloning available
- Very slow synthesis (trade-off for quality)
- Excellent at capturing speaker characteristics
- Support for custom inference settings

---

### 🎯 YourTTS - MULTI-DATASET (MULTILINGUAL)
**Architecture:** VITS-based with speaker adaptation  
**Specialty:** Multi-speaker, multi-lingual synthesis

#### **Speakers (22+ speakers):**
**VCTK Speakers:**
- p225, p226, p227, p228, p229, p230, p231, p232
- p233, p234, p235, p236, p237, p238, p239, p240

**Generic Speakers:**
- female_01, female_02, female_03
- male_01, male_02, male_03

**Voice Cloning:** 5+ seconds of reference audio

#### **Languages (6 supported):**
- English (en), Spanish (es), French (fr)
- German (de), Italian (it), Portuguese (pt)

#### **Key Features:**
- Good balance of quality and speed
- Zero-shot voice adaptation
- Cross-lingual voice cloning

---

### 🔄 OpenVoice v1/v2 - MULTI-DATASET (MULTILINGUAL)
**Architecture:** Voice conversion and cloning system  
**Specialty:** Cross-lingual voice cloning and style transfer

#### **Speakers:**
- **Voice Cloning:** Primary functionality
- **Base Speakers:** base_v1, base_v2 (reference voices)
- **Custom Voices:** Upload any reference audio

#### **Languages (14+ supported):**
- English, Spanish, French, German, Italian, Portuguese
- Polish, Turkish, Russian, Dutch, Czech
- Chinese, Japanese, Korean

#### **Key Features:**
- Cross-lingual voice cloning
- Instant voice conversion
- Style and emotion transfer
- Minimal reference audio needed

---

### 🔗 KNNVC - MULTI-DATASET (MULTILINGUAL)
**Architecture:** K-Nearest Neighbors Voice Conversion  
**Specialty:** Voice conversion between speakers

#### **Functionality:**
- **Source Voice:** Any input speaker
- **Target Voice:** Any target speaker to convert to
- **Language Agnostic:** Works with any language

#### **Languages:**
- **Universal:** Language-independent voice conversion

#### **Key Features:**
- Real-time voice conversion
- No training required for new speakers
- Preserves linguistic content while changing voice
- Efficient K-NN based approach

---

## 🎨 Usage Recommendations

### **For Voice Cloning:**
1. **XTTS v2** - Best overall balance (speed + quality)
2. **Tortoise** - Highest quality (English only, slow)
3. **Bark** - Most creative/expressive
4. **OpenVoice** - Fastest instant cloning

### **For Multi-lingual TTS:**
1. **XTTS v2** - Most languages (17) with streaming
2. **Bark** - Creative speech in 16 languages
3. **YourTTS** - Good quality in 6 languages
4. **OpenVoice** - Cross-lingual voice transfer

### **For Real-time Applications:**
1. **XTTS v2** - <200ms latency streaming
2. **KNNVC** - Real-time voice conversion
3. **OpenVoice** - Fast voice cloning

### **For Creative Content:**
1. **Bark** - Music, sound effects, emotional speech
2. **Tortoise** - Highly expressive English speech
3. **XTTS v2** - Conversational and streaming content

---

## 🔧 Technical Notes

### **Audio Requirements:**
- **XTTS:** 3+ seconds, 22kHz preferred
- **Bark:** 5-30 seconds, any quality
- **Tortoise:** 10+ seconds, high quality preferred
- **YourTTS:** 5+ seconds, clean audio
- **OpenVoice:** 1+ seconds, minimal requirements

### **Performance Characteristics:**
- **Fastest:** KNNVC, OpenVoice, XTTS (streaming)
- **Balanced:** YourTTS, XTTS (batch)
- **Slowest:** Bark, Tortoise (highest quality)

### **Memory Usage:**
- **Low:** KNNVC, OpenVoice
- **Medium:** YourTTS, XTTS
- **High:** Bark, Tortoise

---

## 🚀 Getting Started

Each model can be loaded and used through the Coqui TTS server. The API will now properly detect and return the correct speakers and languages for each model type, enabling dynamic UI updates based on the selected model's actual capabilities.

For detailed usage examples and API documentation, refer to the individual model documentation in the `/docs/source/models/` directory.
