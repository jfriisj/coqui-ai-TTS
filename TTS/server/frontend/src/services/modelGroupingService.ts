/**
 * Model Grouping Service
 * 
 * Service for organizing TTS models into logical groups based on their capabilities
 * and use cases. Provides recommendations and filtering functionality.
 */

import {
  ModelGroup,
  ModelGroupItem,
  ModelUseCase,
  ModelPerformance,
  EnhancedModelCapabilities,
  ModelSelectionCriteria,
  ModelRecommendation,
  MODEL_GROUPS,
  getFilteredModelGroups,
} from '../types/modelGroups';

import { ModelCapabilities } from '../types/api';
import { ModelService } from './modelService';

/**
 * Service for managing model groups and recommendations
 */
export class ModelGroupingService {
  private groupsCache: Map<string, ModelGroup> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(_modelService: ModelService) {
    // Model service reference not needed in current implementation
  }

  /**
   * Get all model groups with populated models
   */
  async getModelGroups(forceRefresh = false): Promise<ModelGroup[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return Array.from(this.groupsCache.values());
    }

    await this.populateModelGroups();
    return Array.from(this.groupsCache.values());
  }

  /**
   * Get a specific model group by ID
   */
  async getModelGroup(groupId: string): Promise<ModelGroup | null> {
    const groups = await this.getModelGroups();
    return groups.find(g => g.id === groupId) || null;
  }

  /**
   * Get model recommendations based on criteria
   */
  async getRecommendations(criteria: ModelSelectionCriteria): Promise<ModelRecommendation[]> {
    await this.populateModelGroups();
    const filteredGroups = getFilteredModelGroups(criteria);
    
    const recommendations: ModelRecommendation[] = [];
    
    for (const group of filteredGroups.slice(0, 3)) { // Top 3 groups
      const recommendedModel = group.models.find(m => m.is_recommended) || group.models[0];
      if (recommendedModel) {
        const confidence = this.calculateConfidence(group, recommendedModel, criteria);
        recommendations.push({
          group,
          model: recommendedModel,
          confidence,
          reason: this.generateRecommendationReason(group, criteria),
          alternatives: group.models.filter(m => m !== recommendedModel).slice(0, 2),
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Populate model groups with actual available models
   */
  private async populateModelGroups(): Promise<void> {
    // Get available models from registry or API
    const availableModels = await this.getAvailableModels();
    
    // Clear existing cache
    this.groupsCache.clear();
    
    // Clone base groups and populate with models
    for (const baseGroup of MODEL_GROUPS) {
      const group: ModelGroup = {
        ...baseGroup,
        models: [],
      };

      // Add models that match this group's use cases
      for (const modelInfo of availableModels) {
        const groupItem = this.createModelGroupItem(modelInfo);
        if (this.doesModelFitGroup(groupItem, group)) {
          group.models.push(groupItem);
        }
      }

      // Sort models by recommendation and availability
      group.models.sort((a, b) => {
        if (a.is_recommended !== b.is_recommended) {
          return a.is_recommended ? -1 : 1;
        }
        if (a.is_available !== b.is_available) {
          return a.is_available ? -1 : 1;
        }
        return a.display_name.localeCompare(b.display_name);
      });

      this.groupsCache.set(group.id, group);
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get available models from various sources
   */
  private async getAvailableModels(): Promise<Array<{ model_id: string; capabilities: ModelCapabilities }>> {
    // This could be enhanced to get models from registry, API, or other sources
    // For now, we'll define known models with their capabilities
    
    return [
      {
        model_id: 'tts_models/multilingual/multi-dataset/bark',
        capabilities: {
          is_multi_speaker: true,
          is_multi_lingual: true,
          supports_cloning: true,
        }
      },
      {
        model_id: 'tts_models/multilingual/multi-dataset/xtts_v2',
        capabilities: {
          is_multi_speaker: true,
          is_multi_lingual: true,
          supports_cloning: true,
        }
      },
      {
        model_id: 'tts_models/en/ljspeech/tacotron2-DDC',
        capabilities: {
          is_multi_speaker: false,
          is_multi_lingual: false,
          supports_cloning: false,
        }
      },
      {
        model_id: 'tts_models/en/ljspeech/fast_pitch',
        capabilities: {
          is_multi_speaker: false,
          is_multi_lingual: false,
          supports_cloning: false,
        }
      },
      {
        model_id: 'tts_models/en/vctk/vits',
        capabilities: {
          is_multi_speaker: true,
          is_multi_lingual: false,
          supports_cloning: false,
        }
      },
    ];
  }

  /**
   * Create a model group item from model information
   */
  private createModelGroupItem(modelInfo: { model_id: string; capabilities: ModelCapabilities }): ModelGroupItem {
    const enhanced = this.enhanceCapabilities(modelInfo.model_id, modelInfo.capabilities);
    
    return {
      model_id: modelInfo.model_id,
      display_name: this.formatModelDisplayName(modelInfo.model_id),
      description: this.generateModelDescription(modelInfo.model_id, enhanced),
      capabilities: enhanced,
      is_recommended: this.isRecommendedModel(modelInfo.model_id),
      is_available: true, // Could check actual availability
      examples: this.generateExamples(modelInfo.model_id),
      tags: this.generateTags(modelInfo.model_id, enhanced),
    };
  }

  /**
   * Enhance basic capabilities with detailed information
   */
  private enhanceCapabilities(modelId: string, basic: ModelCapabilities): EnhancedModelCapabilities {
    const modelName = modelId.toLowerCase();
    
    // Define enhanced capabilities based on model type
    let enhanced: EnhancedModelCapabilities = {
      ...basic,
      supports_streaming: false,
      supports_fine_tuning: false,
      supports_style_transfer: false,
      audio_quality: 'medium',
      synthesis_speed: ModelPerformance.BALANCED,
      memory_requirements: 'medium',
      gpu_recommended: false,
      model_size_mb: 500,
      supports_ssml: false,
      supports_emotions: false,
      supports_accents: false,
      supports_custom_speakers: false,
    };

    // Bark models
    if (modelName.includes('bark')) {
      enhanced = {
        ...enhanced,
        audio_quality: 'high',
        synthesis_speed: ModelPerformance.HIGH_QUALITY,
        memory_requirements: 'high',
        gpu_recommended: true,
        model_size_mb: 1200,
        supports_emotions: true,
        supports_accents: true,
        supports_custom_speakers: true,
        supports_style_transfer: true,
      };
    }
    // XTTS models
    else if (modelName.includes('xtts')) {
      enhanced = {
        ...enhanced,
        audio_quality: 'excellent',
        synthesis_speed: ModelPerformance.BALANCED,
        memory_requirements: 'high',
        gpu_recommended: true,
        model_size_mb: 1800,
        supports_emotions: true,
        supports_accents: true,
        supports_custom_speakers: true,
        supports_streaming: true,
      };
    }
    // Fast models
    else if (modelName.includes('fast_pitch') || modelName.includes('speedy_speech')) {
      enhanced = {
        ...enhanced,
        audio_quality: 'medium',
        synthesis_speed: ModelPerformance.FAST,
        memory_requirements: 'low',
        gpu_recommended: false,
        model_size_mb: 200,
        supports_streaming: true,
      };
    }
    // High-quality models
    else if (modelName.includes('tacotron') || modelName.includes('vits')) {
      enhanced = {
        ...enhanced,
        audio_quality: 'high',
        synthesis_speed: ModelPerformance.BALANCED,
        memory_requirements: 'medium',
        gpu_recommended: true,
        model_size_mb: 400,
      };
    }

    return enhanced;
  }

  /**
   * Check if a model fits in a specific group
   */
  private doesModelFitGroup(model: ModelGroupItem, group: ModelGroup): boolean {
    const caps = model.capabilities;
    
    switch (group.primary_use_case) {
      case ModelUseCase.SYNTHESIS:
        return true; // All models can do basic synthesis
        
      case ModelUseCase.CLONING:
        return caps.supports_cloning;
        
      case ModelUseCase.MULTILINGUAL:
        return caps.is_multi_lingual;
        
      case ModelUseCase.STREAMING:
        return caps.supports_streaming || caps.synthesis_speed === ModelPerformance.REAL_TIME;
        
      case ModelUseCase.HIGH_QUALITY:
        return caps.audio_quality === 'high' || caps.audio_quality === 'excellent';
        
      case ModelUseCase.FAST_SYNTHESIS:
        return caps.synthesis_speed === ModelPerformance.FAST || caps.synthesis_speed === ModelPerformance.REAL_TIME;
        
      case ModelUseCase.CONVERSION:
        return caps.supports_style_transfer || caps.supports_cloning;
        
      default:
        return false;
    }
  }

  /**
   * Format model ID into display name
   */
  private formatModelDisplayName(modelId: string): string {
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1];
    
    // Handle specific model names
    if (modelName.includes('xtts')) return 'XTTS v2';
    if (modelName.includes('bark')) return 'Bark';
    if (modelName.includes('tacotron2')) return 'Tacotron 2';
    if (modelName.includes('fast_pitch')) return 'FastPitch';
    if (modelName.includes('vits')) return 'VITS';
    
    // Default formatting
    return modelName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate model description
   */
  private generateModelDescription(_modelId: string, caps: EnhancedModelCapabilities): string {
    const features = [];
    
    if (caps.supports_cloning) features.push('voice cloning');
    if (caps.is_multi_lingual) features.push('multilingual');
    if (caps.is_multi_speaker) features.push('multi-speaker');
    if (caps.supports_emotions) features.push('emotional expression');
    
    const quality = caps.audio_quality === 'excellent' ? 'Premium' : 
                   caps.audio_quality === 'high' ? 'High' : 'Good';
    
    return `${quality} quality TTS with ${features.join(', ')}`;
  }

  /**
   * Check if model is recommended
   */
  private isRecommendedModel(modelId: string): boolean {
    const recommended = [
      'tts_models/multilingual/multi-dataset/xtts_v2',
      'tts_models/en/ljspeech/fast_pitch',
      'tts_models/multilingual/multi-dataset/bark',
    ];
    return recommended.includes(modelId);
  }

  /**
   * Generate example use cases
   */
  private generateExamples(modelId: string): string[] {
    const modelName = modelId.toLowerCase();
    
    if (modelName.includes('bark')) {
      return ['Clone celebrity voices', 'Generate unique character voices', 'Create emotional speech'];
    }
    if (modelName.includes('xtts')) {
      return ['Multilingual audiobooks', 'Voice assistants', 'Content localization'];
    }
    if (modelName.includes('fast')) {
      return ['Real-time applications', 'Gaming voice-over', 'Live streaming'];
    }
    
    return ['Basic text-to-speech', 'Content narration', 'Accessibility tools'];
  }

  /**
   * Generate tags for filtering
   */
  private generateTags(_modelId: string, caps: EnhancedModelCapabilities): string[] {
    const tags = [];
    
    if (caps.supports_cloning) tags.push('cloning');
    if (caps.is_multi_lingual) tags.push('multilingual');
    if (caps.supports_streaming) tags.push('streaming');
    if (caps.audio_quality === 'excellent') tags.push('premium');
    if (caps.synthesis_speed === ModelPerformance.FAST) tags.push('fast');
    if (caps.memory_requirements === 'low') tags.push('lightweight');
    
    return tags;
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateConfidence(group: ModelGroup, model: ModelGroupItem, criteria: ModelSelectionCriteria): number {
    let confidence = 0.5; // Base confidence
    
    // Boost for matching use cases
    if (criteria.use_cases) {
      const matches = criteria.use_cases.filter(uc => 
        group.primary_use_case === uc || group.secondary_use_cases.includes(uc)
      ).length;
      confidence += (matches / criteria.use_cases.length) * 0.3;
    }
    
    // Boost for recommended models
    if (model.is_recommended) confidence += 0.2;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(group: ModelGroup, criteria: ModelSelectionCriteria): string {
    if (criteria.use_cases && criteria.use_cases.length > 0) {
      return `Optimized for ${criteria.use_cases.join(' and ')}`;
    }
    return `Best choice for ${group.primary_use_case}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return this.groupsCache.size > 0 && (Date.now() - this.lastCacheUpdate) < this.CACHE_DURATION;
  }
}

// ===== Export singleton instance =====

let modelGroupingServiceInstance: ModelGroupingService | null = null;

/**
 * Get the model grouping service instance
 */
export const getModelGroupingService = (modelService?: ModelService): ModelGroupingService => {
  if (!modelGroupingServiceInstance && modelService) {
    modelGroupingServiceInstance = new ModelGroupingService(modelService);
  }
  if (!modelGroupingServiceInstance) {
    throw new Error('ModelGroupingService not initialized. Call with ModelService first.');
  }
  return modelGroupingServiceInstance;
};
