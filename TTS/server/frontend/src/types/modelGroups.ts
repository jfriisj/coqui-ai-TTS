/**
 * Model Grouping System for TTS
 * 
 * This file defines how TTS models are grouped by their capabilities and use cases
 * to provide a better user experience when selecting models for specific tasks.
 */

// ===== Model Use Case Categories =====

/**
 * Primary use cases for TTS models
 */
export enum ModelUseCase {
  /** Basic text-to-speech synthesis */
  SYNTHESIS = 'synthesis',
  /** Voice cloning and replication */
  CLONING = 'cloning',
  /** Voice style transfer and conversion */
  CONVERSION = 'conversion',
  /** Real-time streaming synthesis */
  STREAMING = 'streaming',
  /** Multilingual synthesis */
  MULTILINGUAL = 'multilingual',
  /** High-quality audio generation */
  HIGH_QUALITY = 'high_quality',
  /** Fast synthesis for real-time applications */
  FAST_SYNTHESIS = 'fast_synthesis',
}

/**
 * Model complexity/difficulty levels
 */
export enum ModelComplexity {
  /** Easy to use, minimal configuration */
  BEGINNER = 'beginner',
  /** Some configuration options */
  INTERMEDIATE = 'intermediate',
  /** Advanced features, complex setup */
  ADVANCED = 'advanced',
}

/**
 * Model performance characteristics
 */
export enum ModelPerformance {
  /** Very fast, suitable for real-time */
  REAL_TIME = 'real_time',
  /** Fast synthesis */
  FAST = 'fast',
  /** Balanced speed/quality */
  BALANCED = 'balanced',
  /** Slow but high quality */
  HIGH_QUALITY = 'high_quality',
}

// ===== Model Group Interfaces =====

/**
 * Enhanced model capabilities with use case information
 */
export interface EnhancedModelCapabilities {
  /** Basic capabilities */
  is_multi_speaker: boolean;
  is_multi_lingual: boolean;
  supports_cloning: boolean;
  supports_streaming: boolean;
  supports_fine_tuning: boolean;
  supports_style_transfer: boolean;
  
  /** Quality characteristics */
  audio_quality: 'low' | 'medium' | 'high' | 'excellent';
  synthesis_speed: ModelPerformance;
  
  /** Technical specs */
  memory_requirements: 'low' | 'medium' | 'high';
  gpu_recommended: boolean;
  model_size_mb: number;
  
  /** Supported features */
  supports_ssml: boolean;
  supports_emotions: boolean;
  supports_accents: boolean;
  supports_custom_speakers: boolean;
}

/**
 * Model group definition
 */
export interface ModelGroup {
  /** Group identifier */
  id: string;
  /** Display name for the group */
  name: string;
  /** Group description */
  description: string;
  /** Primary use case this group serves */
  primary_use_case: ModelUseCase;
  /** Secondary use cases */
  secondary_use_cases: ModelUseCase[];
  /** Complexity level */
  complexity: ModelComplexity;
  /** Models in this group */
  models: ModelGroupItem[];
  /** Recommended for specific scenarios */
  recommended_for: string[];
  /** Group icon/emoji for UI */
  icon: string;
  /** Priority for display order (lower = higher priority) */
  display_priority: number;
}

/**
 * Individual model within a group
 */
export interface ModelGroupItem {
  /** Model identifier/name */
  model_id: string;
  /** Display name */
  display_name: string;
  /** Short description */
  description: string;
  /** Enhanced capabilities */
  capabilities: EnhancedModelCapabilities;
  /** Whether this is the recommended model in the group */
  is_recommended: boolean;
  /** Whether model is currently available */
  is_available: boolean;
  /** Download size if not available */
  download_size_mb?: number;
  /** Example use cases */
  examples: string[];
  /** Tags for filtering */
  tags: string[];
}

/**
 * Model selection criteria for filtering
 */
export interface ModelSelectionCriteria {
  /** Required use cases */
  use_cases?: ModelUseCase[];
  /** Maximum complexity level */
  max_complexity?: ModelComplexity;
  /** Required performance level */
  required_performance?: ModelPerformance;
  /** Language requirements */
  required_languages?: string[];
  /** Whether cloning is required */
  requires_cloning?: boolean;
  /** Whether multilingual support is required */
  requires_multilingual?: boolean;
  /** Memory constraints */
  memory_limit?: 'low' | 'medium' | 'high';
  /** Whether GPU is available */
  has_gpu?: boolean;
}

/**
 * Model recommendation result
 */
export interface ModelRecommendation {
  /** Recommended model group */
  group: ModelGroup;
  /** Specific model within group */
  model: ModelGroupItem;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Alternative options */
  alternatives: ModelGroupItem[];
}

// ===== Model Group Definitions =====

/**
 * Predefined model groups configuration
 */
export const MODEL_GROUPS: ModelGroup[] = [
  {
    id: 'beginner_synthesis',
    name: '🎯 Quick Start TTS',
    description: 'Easy-to-use models for basic text-to-speech conversion',
    primary_use_case: ModelUseCase.SYNTHESIS,
    secondary_use_cases: [ModelUseCase.FAST_SYNTHESIS],
    complexity: ModelComplexity.BEGINNER,
    models: [], // Will be populated dynamically
    recommended_for: [
      'First-time users',
      'Simple applications',
      'Testing and prototyping',
      'Educational projects'
    ],
    icon: '🚀',
    display_priority: 1,
  },
  {
    id: 'voice_cloning',
    name: '🎭 Voice Cloning',
    description: 'Clone and replicate specific voices with uploaded audio samples',
    primary_use_case: ModelUseCase.CLONING,
    secondary_use_cases: [ModelUseCase.SYNTHESIS],
    complexity: ModelComplexity.INTERMEDIATE,
    models: [],
    recommended_for: [
      'Voice replication',
      'Personalized assistants',
      'Content creation',
      'Audiobook production',
      'Character voices'
    ],
    icon: '👥',
    display_priority: 2,
  },
  {
    id: 'multilingual',
    name: '🌍 Multilingual TTS',
    description: 'Support for multiple languages and accents',
    primary_use_case: ModelUseCase.MULTILINGUAL,
    secondary_use_cases: [ModelUseCase.SYNTHESIS, ModelUseCase.CLONING],
    complexity: ModelComplexity.INTERMEDIATE,
    models: [],
    recommended_for: [
      'International applications',
      'Language learning',
      'Global content creation',
      'Accessibility tools'
    ],
    icon: '🗺️',
    display_priority: 3,
  },
  {
    id: 'real_time',
    name: '⚡ Real-time TTS',
    description: 'Fast synthesis for live applications and streaming',
    primary_use_case: ModelUseCase.STREAMING,
    secondary_use_cases: [ModelUseCase.FAST_SYNTHESIS],
    complexity: ModelComplexity.BEGINNER,
    models: [],
    recommended_for: [
      'Live streaming',
      'Interactive applications',
      'Gaming',
      'Real-time assistants',
      'Low-latency requirements'
    ],
    icon: '🔥',
    display_priority: 4,
  },
  {
    id: 'high_quality',
    name: '💎 Studio Quality',
    description: 'Premium quality synthesis for professional applications',
    primary_use_case: ModelUseCase.HIGH_QUALITY,
    secondary_use_cases: [ModelUseCase.SYNTHESIS, ModelUseCase.CLONING],
    complexity: ModelComplexity.ADVANCED,
    models: [],
    recommended_for: [
      'Professional audio production',
      'Audiobooks',
      'Podcasts',
      'Commercial applications',
      'High-end content creation'
    ],
    icon: '🎬',
    display_priority: 5,
  },
  {
    id: 'voice_conversion',
    name: '🔄 Voice Conversion',
    description: 'Transform and modify existing voices with style transfer',
    primary_use_case: ModelUseCase.CONVERSION,
    secondary_use_cases: [ModelUseCase.CLONING],
    complexity: ModelComplexity.ADVANCED,
    models: [],
    recommended_for: [
      'Voice modification',
      'Style transfer',
      'Audio post-processing',
      'Creative voice effects',
      'Voice anonymization'
    ],
    icon: '🎨',
    display_priority: 6,
  },
];

// ===== Model Group Utilities =====

/**
 * Get model groups filtered by criteria
 */
export const getFilteredModelGroups = (criteria: ModelSelectionCriteria): ModelGroup[] => {
  return MODEL_GROUPS.filter(group => {
    // Filter by use cases
    if (criteria.use_cases && criteria.use_cases.length > 0) {
      const hasRequiredUseCase = criteria.use_cases.some(useCase =>
        group.primary_use_case === useCase || group.secondary_use_cases.includes(useCase)
      );
      if (!hasRequiredUseCase) return false;
    }

    // Filter by complexity
    if (criteria.max_complexity) {
      const complexityOrder = [ModelComplexity.BEGINNER, ModelComplexity.INTERMEDIATE, ModelComplexity.ADVANCED];
      const maxIndex = complexityOrder.indexOf(criteria.max_complexity);
      const groupIndex = complexityOrder.indexOf(group.complexity);
      if (groupIndex > maxIndex) return false;
    }

    return true;
  }).sort((a, b) => a.display_priority - b.display_priority);
};

/**
 * Get model recommendation based on criteria
 */
export const getModelRecommendation = (criteria: ModelSelectionCriteria): ModelRecommendation | null => {
  const filteredGroups = getFilteredModelGroups(criteria);
  
  if (filteredGroups.length === 0) return null;

  const bestGroup = filteredGroups[0];
  const recommendedModel = bestGroup.models.find(m => m.is_recommended) || bestGroup.models[0];

  if (!recommendedModel) return null;

  return {
    group: bestGroup,
    model: recommendedModel,
    confidence: 0.85, // This could be calculated based on how well criteria match
    reason: `Best match for ${criteria.use_cases?.join(', ') || 'your requirements'}`,
    alternatives: bestGroup.models.filter(m => m !== recommendedModel).slice(0, 3),
  };
};

/**
 * Get all available use cases
 */
export const getAllUseCases = (): { value: ModelUseCase; label: string; description: string }[] => [
  { value: ModelUseCase.SYNTHESIS, label: 'Basic Synthesis', description: 'Convert text to speech' },
  { value: ModelUseCase.CLONING, label: 'Voice Cloning', description: 'Replicate specific voices' },
  { value: ModelUseCase.CONVERSION, label: 'Voice Conversion', description: 'Transform voice characteristics' },
  { value: ModelUseCase.STREAMING, label: 'Real-time Streaming', description: 'Live synthesis applications' },
  { value: ModelUseCase.MULTILINGUAL, label: 'Multilingual', description: 'Multiple language support' },
  { value: ModelUseCase.HIGH_QUALITY, label: 'High Quality', description: 'Premium audio quality' },
  { value: ModelUseCase.FAST_SYNTHESIS, label: 'Fast Synthesis', description: 'Quick generation' },
];
