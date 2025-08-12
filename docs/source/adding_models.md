# Adding Models to TTS Registry

This guide explains how to add new models to the Coqui TTS model registry using the command line interface. The model registry system allows researchers and developers to contribute their trained models to the TTS ecosystem.

## Overview

The TTS model registry is stored in the `.models.json` file and organizes models hierarchically by:
- **Model Type**: `tts_models`, `vocoder_models`, or `voice_conversion_models`
- **Language**: Language code (e.g., `en`, `es`, `multilingual`)
- **Dataset**: Training dataset (e.g., `ljspeech`, `common-voice`, `custom`)
- **Model Name**: Unique identifier for the specific model

## Using the CLI Script

The `add_model.py` script provides a command-line interface for adding models to the registry with proper validation and error handling.

### Basic Usage

```bash
python scripts/add_model.py --model-name MODEL_NAME \
    --model-type MODEL_TYPE \
    --language LANGUAGE \
    --dataset DATASET \
    [URL_OPTIONS] [METADATA_OPTIONS]
```

### Required Arguments

All these arguments are mandatory for every model addition:

- `--model-name`: Unique name for your model (alphanumeric, hyphens, underscores only)
- `--model-type`: Type of model - choose from:
  - `tts_models`: Text-to-speech models
  - `vocoder_models`: Vocoder models for audio generation  
  - `voice_conversion_models`: Voice conversion models
- `--language`: Language code (e.g., `en`, `es`, `ja`, `multilingual`)
- `--dataset`: Dataset used for training (e.g., `ljspeech`, `common-voice`, `custom`)

### URL Options (At Least One Required)

Provide at least one URL where the model files can be downloaded:

- `--github-rls-url`: GitHub release URL for the model archive
- `--hf-url`: Hugging Face model repository URL
- `--model-url`: Direct model URL(s) - can be specified multiple times for multiple files

### Optional Metadata

Enhance your model entry with additional information:

- `--description`: Descriptive text about the model
- `--license`: License under which the model is released (e.g., `MIT`, `Apache-2.0`, `CPML`)
- `--author`: Model author (typically GitHub username with @ prefix)
- `--contact`: Contact information for the author
- `--commit`: Git commit hash associated with the model
- `--default-vocoder`: Default vocoder to use with TTS models (format: `type/language/dataset/name`)
- `--tos-required`: Flag indicating if terms of service agreement is required
- `--verbose`: Enable detailed logging output

## Examples

### Adding a TTS Model from GitHub Release

```bash
python scripts/add_model.py --model-name my_vits_model \
    --model-type tts_models --language en --dataset custom \
    --description "Custom VITS model trained on proprietary dataset" \
    --license MIT --author @myusername \
    --github-rls-url https://github.com/myusername/my-tts-model/releases/download/v1.0/model.zip
```

### Adding a Vocoder Model from Hugging Face

```bash
python scripts/add_model.py --model-name custom_hifigan \
    --model-type vocoder_models --language en --dataset ljspeech \
    --description "Optimized HiFi-GAN vocoder for LJSpeech" \
    --license Apache-2.0 --author @researcher \
    --contact researcher@university.edu \
    --hf-url https://huggingface.co/researcher/hifigan-ljspeech
```

### Adding a Voice Conversion Model with Multiple URLs

```bash
python scripts/add_model.py --model-name freevc_multilingual \
    --model-type voice_conversion_models --language multilingual \
    --dataset common-voice --description "FreeVC model for multilingual voice conversion" \
    --license MIT --author @vcresearcher \
    --model-url https://example.com/freevc_model.pth \
    --model-url https://example.com/freevc_config.json \
    --model-url https://example.com/speaker_encoder.pth
```

### Adding a TTS Model with Default Vocoder

```bash
python scripts/add_model.py --model-name tacotron2_custom \
    --model-type tts_models --language es --dataset custom \
    --description "Tacotron2 model for Spanish synthesis" \
    --license Apache-2.0 --author @spanishresearcher \
    --default-vocoder vocoder_models/universal/libri-tts/hifigan \
    --github-rls-url https://github.com/spanishresearcher/tacotron2-es/releases/download/v2.1/model.zip
```

### Adding a Model with Terms of Service Requirement

```bash
python scripts/add_model.py --model-name proprietary_model \
    --model-type tts_models --language multilingual --dataset multi-dataset \
    --description "High-quality multilingual model with usage restrictions" \
    --license "Custom License" --author @company \
    --contact licensing@company.com --tos-required \
    --hf-url https://huggingface.co/company/proprietary-tts
```

## Model Registry Structure

Once added, your model will be accessible in the registry at the path:
```
{model_type}/{language}/{dataset}/{model_name}
```

For example, a model added with `--model-type tts_models --language en --dataset custom --model-name my_vits` will be located at:
```
tts_models/en/custom/my_vits
```

### Detailed Registry Structure

The `.models.json` file follows a hierarchical JSON structure that organizes all available models. Understanding this structure helps when contributing models and referencing them in applications.

#### Registry Hierarchy

The registry is organized in a four-level hierarchy:

```
{
  "model_type": {
    "language": {
      "dataset": {
        "model_name": {
          // Model metadata and URLs
        }
      }
    }
  }
}
```

#### Model Types

The registry supports three main model types:

- **`tts_models`**: Text-to-speech models that convert text to speech
- **`vocoder_models`**: Neural vocoders that convert spectrograms to audio waveforms
- **`voice_conversion_models`**: Models that convert one speaker's voice to another

#### Language Organization

Models are organized by language codes:
- **Language-specific**: `en`, `es`, `fr`, `de`, `ja`, etc.
- **Multi-language**: `multilingual` for models supporting multiple languages
- **Universal**: `universal` for language-agnostic models (typically vocoders)

#### Dataset Categories

Common dataset categories include:
- **Public datasets**: `ljspeech`, `common-voice`, `vctk`, `libri-tts`
- **Multi-dataset**: `multi-dataset` for models trained on multiple datasets
- **Custom datasets**: `custom`, specific dataset names

### Registry Entry Structure

Each model entry contains metadata fields that describe the model and provide download information:

#### Required Fields
```json
{
  "model_name": {
    "description": "Human-readable description of the model",
    "license": "License under which the model is distributed"
  }
}
```

#### URL Fields (at least one required)
```json
{
  "github_rls_url": "https://github.com/user/repo/releases/download/tag/model.zip",
  "hf_url": [
    "https://huggingface.co/user/model/resolve/main/model.pth",
    "https://huggingface.co/user/model/resolve/main/config.json"
  ],
  "model_url": [
    "https://example.com/model.pth",
    "https://example.com/config.json"
  ]
}
```

#### Optional Metadata Fields
```json
{
  "default_vocoder": "vocoder_models/universal/libri-tts/hifigan",
  "author": "@username",
  "contact": "email@domain.com",
  "commit": "git_commit_hash",
  "model_hash": "md5_hash_of_model_files",
  "tos_required": true
}
```

### Registry Examples

#### Example 1: Hugging Face TTS Model with Multiple Files

```json
{
  "tts_models": {
    "multilingual": {
      "multi-dataset": {
        "xtts_v2": {
          "description": "XTTS-v2.0.3 by Coqui with 17 languages.",
          "hf_url": [
            "https://huggingface.co/coqui/XTTS-v2/resolve/main/model.pth",
            "https://huggingface.co/coqui/XTTS-v2/resolve/main/config.json",
            "https://huggingface.co/coqui/XTTS-v2/resolve/main/vocab.json",
            "https://huggingface.co/coqui/XTTS-v2/resolve/main/hash.md5",
            "https://huggingface.co/coqui/XTTS-v2/resolve/main/speakers_xtts.pth"
          ],
          "model_hash": "10f92b55c512af7a8d39d650547a15a7",
          "default_vocoder": null,
          "commit": "480a6cdf7",
          "license": "CPML",
          "contact": "info@coqui.ai",
          "tos_required": true
        }
      }
    }
  }
}
```

**Key features:**
- Multiple file URLs from Hugging Face
- Terms of service requirement (`tos_required: true`)
- Model hash for verification
- Contact information and license

#### Example 2: GitHub Release Vocoder Model

```json
{
  "vocoder_models": {
    "universal": {
      "libri-tts": {
        "wavegrad": {
          "github_rls_url": "https://github.com/coqui-ai/TTS/releases/download/v0.6.1_models/vocoder_models--universal--libri-tts--wavegrad.zip",
          "commit": "ea976b0",
          "author": "Eren Gölge @erogol",
          "license": "MPL",
          "contact": "egolge@coqui.com"
        }
      }
    }
  }
}
```

**Key features:**
- Single GitHub release URL
- Universal language model (language-agnostic)
- Author attribution with GitHub username
- Commit hash for version tracking

#### Example 3: Voice Conversion Model with Default Vocoder

```json
{
  "voice_conversion_models": {
    "multilingual": {
      "vctk": {
        "freevc24": {
          "github_rls_url": "https://github.com/coqui-ai/TTS/releases/download/v0.13.0_models/voice_conversion_models--multilingual--vctk--freevc24.zip",
          "description": "FreeVC model trained on VCTK dataset from https://github.com/OlaWod/FreeVC",
          "default_vocoder": null,
          "author": "Jing-Yi Li @OlaWod",
          "license": "MIT",
          "commit": null
        }
      }
    }
  }
}
```

**Key features:**
- Voice conversion model structure
- Reference to original implementation
- MIT license (common for research models)
- No default vocoder specified

#### Example 4: Language-Specific Model

```json
{
  "tts_models": {
    "en": {
      "ljspeech": {
        "tacotron2-DDC": {
          "description": "Tacotron2 with Dynamic Convolution Attention trained on LJSpeech",
          "github_rls_url": "https://github.com/coqui-ai/TTS/releases/download/v0.6.1_models/tts_models--en--ljspeech--tacotron2-DDC.zip",
          "default_vocoder": "vocoder_models/en/ljspeech/hifigan_v2",
          "commit": "4132240",
          "author": "Eren Gölge @erogol",
          "license": "MPL"
        }
      }
    }
  }
}
```

**Key features:**
- Language-specific model (`en`)
- Specific dataset (`ljspeech`)
- Default vocoder specification
- References compatible vocoder model

### Model Naming Conventions

The registry follows consistent naming patterns to ensure organization and discoverability:

#### Model Architecture Names
- Use lowercase model architecture names: `tacotron2`, `glow_tts`, `vits`, `hifigan`
- Include version suffixes when applicable: `xtts_v2`, `tacotron2-DCA`
- Use descriptive suffixes for variants: `tacotron2-DDC` (Dynamic Convolution), `hifigan_v2`

#### Language Codes
- Follow ISO 639-1 codes where possible: `en`, `es`, `fr`, `de`, `ja`
- Use `multilingual` for multi-language models
- Use `universal` for language-agnostic models (typically vocoders)

#### Dataset Names
- Use lowercase, hyphenated names: `ljspeech`, `common-voice`, `libri-tts`
- Use `multi-dataset` for models trained on multiple datasets
- Use descriptive names for custom datasets: `custom`, `proprietary`

#### Model Reference Format
When referencing models (e.g., for default vocoders), use the full path format:
```
model_type/language/dataset/model_name
```

Examples:
- `tts_models/en/ljspeech/tacotron2-DDC`
- `vocoder_models/universal/libri-tts/hifigan`
- `voice_conversion_models/multilingual/vctk/freevc24`

### Registry Organization Best Practices

#### Hierarchical Grouping
The registry groups related models together:
- Models for the same language are grouped under language codes
- Models trained on the same dataset are grouped together
- Different versions of the same model architecture are kept in the same dataset group

#### URL Management
- **Hugging Face URLs**: Use specific file URLs with `/resolve/main/` or `/resolve/tag/` for version control
- **GitHub Release URLs**: Use permanent release URLs that won't change
- **Multiple Files**: List all required files in the URL array
- **Single Archives**: Use GitHub releases for bundled model files

#### Metadata Consistency
- Always include `description` and `license` fields
- Add `author` information with GitHub username when possible
- Include `contact` information for maintainability
- Use `commit` hashes for version tracking
- Set `tos_required: true` for models with usage restrictions

## Validation Rules

The CLI script enforces several validation rules to ensure registry consistency:

### Naming Conventions
- **Model names**: Only letters, numbers, hyphens, and underscores (`a-zA-Z0-9_-`)
- **Language codes**: Only letters, numbers, hyphens, and underscores (`a-zA-Z0-9_-`)
- **Dataset names**: Only letters, numbers, hyphens, and underscores (`a-zA-Z0-9_-`)

### URL Validation
- All URLs must use HTTP or HTTPS protocol
- URLs are validated for proper format before adding to registry
- Multiple model URLs can be provided for models with multiple files

### Default Vocoder Format
- Must follow the pattern: `{model_type}/{language}/{dataset}/{model_name}`
- Model type must be one of the valid vocoder types
- Example: `vocoder_models/universal/libri-tts/hifigan`

## Troubleshooting

### Common Error Messages and Solutions

#### "Invalid model name format"
```
Model name can only contain letters, numbers, underscores, and hyphens
```
**Solution**: Remove spaces and special characters from your model name. Use underscores or hyphens instead.
```bash
# ❌ Wrong
--model-name "my model v1.0"

# ✅ Correct  
--model-name my_model_v1-0
```

#### "At least one URL must be provided"
```
At least one URL must be provided: --github-rls-url, --hf-url, or --model-url
```
**Solution**: Provide at least one URL option where the model can be downloaded.
```bash
# Add one of these:
--github-rls-url https://github.com/user/repo/releases/download/v1.0/model.zip
--hf-url https://huggingface.co/user/model
--model-url https://example.com/model.pth
```

#### "Invalid URL format"
```
Invalid GitHub release URL: not-a-valid-url
```
**Solution**: Ensure URLs are complete and properly formatted with http:// or https://.
```bash
# ❌ Wrong
--github-rls-url github.com/user/model.zip

# ✅ Correct
--github-rls-url https://github.com/user/model.zip
```

#### "Default vocoder must be in format: type/language/dataset/name"
```
Default vocoder must be in format: type/language/dataset/name
```
**Solution**: Use the exact four-part format for vocoder references.
```bash
# ❌ Wrong
--default-vocoder hifigan

# ✅ Correct
--default-vocoder vocoder_models/universal/libri-tts/hifigan
```

#### "Model already exists in registry"
```
Model 'tts_models/en/custom/my_model' already exists in registry
```
**Solution**: Choose a different model name or update the existing entry manually if you're replacing a model.

### Registry File Issues

#### "Failed to load registry file"
```
Failed to load registry file: Invalid JSON format
```
**Solution**: The `.models.json` file may be corrupted. Restore from backup or fix the JSON syntax manually.

#### "Permission denied writing to registry"
```
PermissionError: [Errno 13] Permission denied: 'TTS/.models.json'
```
**Solution**: Ensure you have write permissions to the TTS directory, or run with appropriate permissions.

### Network and Download Issues

#### "URL validation failed during testing"
Some URLs may be valid but inaccessible during validation. The script only validates URL format, not accessibility.

**Solution**: Ensure your URLs are publicly accessible and point to the correct model files.

### Debugging with Verbose Output

Use the `--verbose` flag to get detailed logging information:

```bash
python scripts/add_model.py --model-name debug_model \
    --model-type tts_models --language en --dataset custom \
    --github-rls-url https://github.com/user/model.zip \
    --verbose
```

This will show:
- Detailed argument validation steps
- Registry loading process
- Model entry creation details
- Any warnings or intermediate errors

## Advanced Usage

### Testing with Custom Registry Path

For development and testing, you can specify a custom registry file:

```bash
python scripts/add_model.py --model-name test_model \
    --model-type tts_models --language en --dataset test \
    --github-rls-url https://github.com/user/model.zip \
    --registry-path /path/to/test_models.json
```

### Batch Model Addition

While the script handles one model at a time, you can create shell scripts for batch operations:

```bash
#!/bin/bash
# batch_add_models.sh

models=(
    "model1,tts_models,en,dataset1,https://github.com/user/model1.zip"
    "model2,vocoder_models,es,dataset2,https://github.com/user/model2.zip" 
)

for model_info in "${models[@]}"; do
    IFS=',' read -r name type lang dataset url <<< "$model_info"
    python scripts/add_model.py --model-name "$name" \
        --model-type "$type" --language "$lang" --dataset "$dataset" \
        --github-rls-url "$url"
done
```

## Best Practices

### Model Naming
- Use descriptive names that indicate the model architecture and purpose
- Include version numbers for iterative improvements: `vits_v2`, `tacotron2_improved`
- Use consistent naming within your model series

### Documentation
- Always provide a meaningful `--description`
- Include `--license` information for proper attribution
- Add `--author` and `--contact` for maintainability

### URL Management
- Use stable, long-term URLs (GitHub releases, Hugging Face, institutional servers)
- Avoid temporary file sharing services
- For models with multiple files, use `--model-url` multiple times rather than archives when possible

### License Compliance
- Clearly specify the license under which your model is released
- Use `--tos-required` for models with usage restrictions
- Ensure your license is compatible with the model's training data license

## Integration with TTS

Once added to the registry, your model can be used with the standard TTS APIs:

```python
import TTS
from TTS.api import TTS

# Your model will be available through the standard API
tts = TTS("tts_models/en/custom/my_vits_model")
tts.tts_to_file("Hello world!", "output.wav")
```

The model will be automatically downloaded when first used, and cached locally for subsequent usage.