/**
 * Model Categorization Service
 * 
 * Groups TTS models by their capabilities and intended use cases
 * Based on analysis from log.md covering TTS, Vocoder, and Voice Conversion models
 */

export interface ModelCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  examples: string[];
  useCases: string[];
  licensingNotes?: string;
}

export interface CategorizedModel {
  modelName: string;
  category: string;
  architecture: string;
  languages: string[];
  speakers: number;
  license: string;
  features: string[];
  quality: 'high' | 'medium' | 'experimental';
  speed: 'fast' | 'medium' | 'slow';
  commercialUse: boolean;
}

/**
 * Main model categories based on use cases
 */
export const MODEL_CATEGORIES: Record<string, ModelCategory> = {
  // === TTS Categories ===
  
  VOICE_CLONING: {
    id: 'voice_cloning',
    name: 'Voice Cloning & Synthesis',
    description: 'Advanced models that can clone voices from audio samples and synthesize speech in different languages',
    icon: '🎭',
    capabilities: ['voice_cloning', 'cross_lingual', 'multi_speaker', 'high_quality'],
    examples: ['XTTS-v2', 'YourTTS', 'Bark'],
    useCases: [
      'Clone your own voice',
      'Cross-language voice conversion', 
      'Dubbing and localization',
      'Personalized assistants',
      'Content creation'
    ],
    licensingNotes: 'Some models have commercial restrictions (CPML license)'
  },

  MULTILINGUAL_TTS: {
    id: 'multilingual_tts',
    name: 'Multilingual Text-to-Speech',
    description: 'Models supporting multiple languages with natural-sounding speech synthesis',
    icon: '🌍',
    capabilities: ['multi_lingual', 'natural_speech', 'multiple_speakers'],
    examples: ['XTTS-v2 (17 languages)', 'YourTTS', 'Bark'],
    useCases: [
      'International applications',
      'Language learning tools',
      'Accessibility software',
      'Global content creation'
    ]
  },

  HIGH_QUALITY_MONOLINGUAL: {
    id: 'high_quality_mono',
    name: 'High-Quality Monolingual',
    description: 'Premium quality TTS for specific languages, optimized for naturalness',
    icon: '🎯',
    capabilities: ['high_quality', 'natural_prosody', 'single_language'],
    examples: ['VITS models', 'Tacotron2', 'Glow-TTS'],
    useCases: [
      'Professional audiobooks',
      'High-quality podcasts',
      'Premium voice assistants',
      'Accessibility applications'
    ]
  },

  FAST_SYNTHESIS: {
    id: 'fast_synthesis',
    name: 'Fast & Efficient TTS',
    description: 'Optimized models for real-time applications requiring low latency',
    icon: '⚡',
    capabilities: ['low_latency', 'real_time', 'efficient'],
    examples: ['FastPitch', 'SpeedySpeech', 'Neural HMM'],
    useCases: [
      'Real-time chatbots',
      'Live streaming',
      'Interactive applications',
      'Mobile apps with limited resources'
    ]
  },

  CREATIVE_EXPRESSIVE: {
    id: 'creative_expressive',
    name: 'Creative & Expressive',
    description: 'Models with advanced prosody, emotions, and creative speech patterns',
    icon: '🎨',
    capabilities: ['expressive', 'emotional', 'creative'],
    examples: ['Bark', 'Tortoise', 'Capacitron'],
    useCases: [
      'Audiobook narration',
      'Character voices for games',
      'Emotional storytelling',
      'Creative content production'
    ]
  },

  RESEARCH_EXPERIMENTAL: {
    id: 'research_experimental',
    name: 'Research & Experimental',
    description: 'Cutting-edge models for research and experimental applications',
    icon: '🔬',
    capabilities: ['experimental', 'research', 'novel_architecture'],
    examples: ['Neural HMM', 'Overflow', 'Delightful TTS'],
    useCases: [
      'Academic research',
      'Technology demonstration',
      'Proof of concept projects',
      'Algorithm development'
    ]
  },

  // === Voice Conversion Categories ===

  VOICE_CONVERSION: {
    id: 'voice_conversion',
    name: 'Voice Conversion',
    description: 'Convert speech from one speaker to sound like another while preserving content',
    icon: '🔄',
    capabilities: ['voice_conversion', 'speaker_adaptation', 'real_time'],
    examples: ['FreeVC', 'kNN-VC', 'OpenVoice'],
    useCases: [
      'Voice dubbing',
      'Speaker anonymization',
      'Voice changing for privacy',
      'Entertainment applications'
    ]
  },

  // === Vocoder Categories ===

  VOCODERS: {
    id: 'vocoders',
    name: 'Vocoders',
    description: 'Convert mel-spectrograms to high-quality audio waveforms',
    icon: '🔊',
    capabilities: ['spectrogram_to_audio', 'high_fidelity', 'neural_vocoding'],
    examples: ['HiFiGAN', 'WaveGrad', 'UnivNet', 'Parallel WaveGAN'],
    useCases: [
      'TTS pipeline backend',
      'Audio quality enhancement',
      'Custom TTS development',
      'Research applications'
    ]
  }
};

/**
 * License categories for easy filtering
 */
export const LICENSE_CATEGORIES = {
  COMMERCIAL_FRIENDLY: {
    licenses: ['MIT', 'Apache 2.0', 'BSD-3-Clause'],
    description: 'Can be used in commercial applications'
  },
  NON_COMMERCIAL: {
    licenses: ['CC BY-NC-ND 4.0', 'CC-BY-SA 4.0'],
    description: 'Research and non-commercial use only'
  },
  RESTRICTED: {
    licenses: ['CPML', 'Custom'],
    description: 'Check specific terms, may have commercial restrictions'
  }
};

/**
 * Architecture families for technical users
 */
export const ARCHITECTURE_FAMILIES = {
  AUTOREGRESSIVE: ['Tacotron2', 'Tortoise'],
  FLOW_BASED: ['Glow-TTS', 'Overflow'],
  GAN_BASED: ['HiFiGAN', 'UnivNet'],
  VAE_BASED: ['VITS', 'YourTTS'],
  TRANSFORMER: ['XTTS', 'Bark'],
  DIFFUSION: ['WaveGrad', 'Grad-TTS'],
  NEURAL_VOCODER: ['WaveGrad', 'Parallel WaveGAN']
};

/**
 * Service class for model categorization
 */
export class ModelCategorizationService {
  /**
   * Categorize a model based on its name and properties
   */
  categorizeModel(modelName: string, capabilities?: any): CategorizedModel {
    const name = modelName.toLowerCase();
    
    // Determine category
    let category = 'research_experimental';
    let architecture = 'unknown';
    let license = 'unknown';
    let features: string[] = [];
    let quality: 'high' | 'medium' | 'experimental' = 'medium';
    let speed: 'fast' | 'medium' | 'slow' = 'medium';
    let commercialUse = false;

    // XTTS models
    if (name.includes('xtts')) {
      category = 'voice_cloning';
      architecture = 'Transformer';
      license = 'CPML';
      features = ['voice_cloning', 'cross_lingual', 'multi_speaker'];
      quality = 'high';
      speed = 'slow';
      commercialUse = false; // CPML has restrictions
    }
    
    // Bark
    else if (name.includes('bark')) {
      category = 'creative_expressive';
      architecture = 'Transformer';
      license = 'MIT';
      features = ['expressive', 'multilingual', 'creative'];
      quality = 'high';
      speed = 'slow';
      commercialUse = true;
    }
    
    // YourTTS
    else if (name.includes('yourtts')) {
      category = 'voice_cloning';
      architecture = 'VITS';
      license = 'CC BY-NC-ND 4.0';
      features = ['voice_cloning', 'multilingual'];
      quality = 'high';
      speed = 'medium';
      commercialUse = false;
    }
    
    // VITS models
    else if (name.includes('vits')) {
      category = 'high_quality_mono';
      architecture = 'VITS';
      license = 'BSD-3-Clause';
      features = ['high_quality', 'end_to_end'];
      quality = 'high';
      speed = 'medium';
      commercialUse = true;
    }
    
    // Fast models
    else if (name.includes('fastpitch') || name.includes('speedyspeech')) {
      category = 'fast_synthesis';
      architecture = name.includes('fastpitch') ? 'FastPitch' : 'SpeedySpeech';
      license = 'Apache 2.0';
      features = ['fast', 'real_time'];
      quality = 'medium';
      speed = 'fast';
      commercialUse = true;
    }
    
    // Tacotron models
    else if (name.includes('tacotron')) {
      category = 'high_quality_mono';
      architecture = 'Tacotron2';
      license = 'Apache 2.0';
      features = ['attention_based', 'natural'];
      quality = 'high';
      speed = 'medium';
      commercialUse = true;
    }
    
    // Voice conversion
    else if (name.includes('freevc') || name.includes('knn-vc') || name.includes('openvoice')) {
      category = 'voice_conversion';
      architecture = name.includes('knn') ? 'kNN-VC' : 'FreeVC';
      license = 'MIT';
      features = ['voice_conversion', 'speaker_adaptation'];
      quality = 'high';
      speed = 'medium';
      commercialUse = true;
    }
    
    // Vocoders
    else if (name.includes('hifigan') || name.includes('wavegrad') || name.includes('univnet')) {
      category = 'vocoders';
      architecture = name.includes('hifigan') ? 'HiFiGAN' : 
                    name.includes('wavegrad') ? 'WaveGrad' : 'UnivNet';
      license = 'MIT';
      features = ['neural_vocoding', 'high_fidelity'];
      quality = 'high';
      speed = 'fast';
      commercialUse = true;
    }

    // Extract language info
    const languages = this.extractLanguages(modelName);
    const speakers = this.estimateSpeakers(modelName, capabilities);

    return {
      modelName,
      category,
      architecture,
      languages,
      speakers,
      license,
      features,
      quality,
      speed,
      commercialUse
    };
  }

  /**
   * Extract supported languages from model name
   */
  private extractLanguages(modelName: string): string[] {
    const name = modelName.toLowerCase();
    
    if (name.includes('multilingual') || name.includes('xtts')) {
      return ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko'];
    }
    
    // Extract specific language codes
    const languageCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'bg', 'da', 'et', 'ga'];
    const detected = languageCodes.filter(lang => name.includes(lang));
    
    return detected.length > 0 ? detected : ['en']; // Default to English
  }

  /**
   * Estimate number of speakers
   */
  private estimateSpeakers(modelName: string, capabilities?: any): number {
    const name = modelName.toLowerCase();
    
    if (capabilities?.speakers) {
      return Array.isArray(capabilities.speakers) ? capabilities.speakers.length : capabilities.speakers;
    }
    
    if (name.includes('xtts')) return 58; // Known XTTS speaker count
    if (name.includes('vctk')) return 109; // VCTK dataset speakers
    if (name.includes('ljspeech')) return 1; // Single speaker
    if (name.includes('multi')) return 10; // Estimated for multi-speaker
    
    return 1; // Default single speaker
  }

  /**
   * Get models by category
   */
  getModelsByCategory(models: string[], category: string): CategorizedModel[] {
    return models
      .map(model => this.categorizeModel(model))
      .filter(model => model.category === category);
  }

  /**
   * Filter models by commercial usability
   */
  getCommercialFriendlyModels(models: string[]): CategorizedModel[] {
    return models
      .map(model => this.categorizeModel(model))
      .filter(model => model.commercialUse);
  }

  /**
   * Get recommended models for specific use case
   */
  getRecommendedModels(useCase: string, models: string[]): CategorizedModel[] {
    const categorized = models.map(model => this.categorizeModel(model));
    
    switch (useCase.toLowerCase()) {
      case 'voice_cloning':
        return categorized.filter(m => m.features.includes('voice_cloning'));
      
      case 'multilingual':
        return categorized.filter(m => m.languages.length > 5);
      
      case 'real_time':
        return categorized.filter(m => m.speed === 'fast');
      
      case 'high_quality':
        return categorized.filter(m => m.quality === 'high');
      
      case 'commercial':
        return categorized.filter(m => m.commercialUse);
      
      default:
        return categorized;
    }
  }
}

export const modelCategorizationService = new ModelCategorizationService();
