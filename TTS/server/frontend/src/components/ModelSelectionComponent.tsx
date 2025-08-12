/**
 * Model Selection Component with Grouping
 * 
 * Demonstrates how the model grouping system can be used to create
 * an intuitive model selection interface for users.
 */

import React, { useState, useEffect } from 'react';
import { 
  ModelGroup, 
  ModelUseCase, 
  ModelSelectionCriteria, 
  ModelRecommendation,
  getAllUseCases
} from '../types/modelGroups';
import { getModelGroupingService } from '../services/modelGroupingService';
import { modelService } from '../services/modelService';

interface ModelSelectionProps {
  onModelSelect: (modelId: string) => void;
  currentModelId?: string;
}

export const ModelSelectionComponent: React.FC<ModelSelectionProps> = ({
  onModelSelect,
  currentModelId
}) => {
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [selectedUseCases, setSelectedUseCases] = useState<ModelUseCase[]>([]);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'groups' | 'recommendations'>('groups');

  const groupingService = getModelGroupingService(modelService);
  const useCases = getAllUseCases();

  useEffect(() => {
    loadModelGroups();
  }, []);

  useEffect(() => {
    if (selectedUseCases.length > 0) {
      getRecommendations();
    }
  }, [selectedUseCases]);

  const loadModelGroups = async () => {
    setLoading(true);
    try {
      const groups = await groupingService.getModelGroups();
      setModelGroups(groups);
    } catch (error) {
      console.error('Failed to load model groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async () => {
    const criteria: ModelSelectionCriteria = {
      use_cases: selectedUseCases,
    };
    
    try {
      const recs = await groupingService.getRecommendations(criteria);
      setRecommendations(recs);
      if (recs.length > 0) {
        setViewMode('recommendations');
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error);
    }
  };

  const handleUseCaseToggle = (useCase: ModelUseCase) => {
    setSelectedUseCases(prev => 
      prev.includes(useCase) 
        ? prev.filter(uc => uc !== useCase)
        : [...prev, useCase]
    );
  };

  const renderUseCaseSelector = () => (
    <div className="use-case-selector">
      <h3>What do you want to do?</h3>
      <div className="use-case-grid">
        {useCases.map(({ value, label, description }) => (
          <div
            key={value}
            className={`use-case-card ${selectedUseCases.includes(value) ? 'selected' : ''}`}
            onClick={() => handleUseCaseToggle(value)}
          >
            <h4>{label}</h4>
            <p>{description}</p>
          </div>
        ))}
      </div>
      {selectedUseCases.length > 0 && (
        <button 
          className="clear-selection"
          onClick={() => setSelectedUseCases([])}
        >
          Clear Selection
        </button>
      )}
    </div>
  );

  const renderRecommendations = () => (
    <div className="recommendations">
      <div className="recommendations-header">
        <h3>🎯 Recommended Models</h3>
        <button onClick={() => setViewMode('groups')}>
          View All Categories
        </button>
      </div>
      
      {recommendations.map((rec, index) => (
        <div key={rec.model.model_id} className="recommendation-card">
          <div className="recommendation-rank">#{index + 1}</div>
          <div className="recommendation-content">
            <div className="recommendation-header">
              <h4>{rec.model.display_name}</h4>
              <div className="confidence-score">
                {Math.round(rec.confidence * 100)}% match
              </div>
            </div>
            
            <p className="recommendation-reason">{rec.reason}</p>
            <p className="model-description">{rec.model.description}</p>
            
            <div className="model-capabilities">
              {rec.model.capabilities.supports_cloning && <span className="capability">🎭 Voice Cloning</span>}
              {rec.model.capabilities.is_multi_lingual && <span className="capability">🌍 Multilingual</span>}
              {rec.model.capabilities.supports_streaming && <span className="capability">⚡ Streaming</span>}
              {rec.model.capabilities.audio_quality === 'excellent' && <span className="capability">💎 Premium Quality</span>}
            </div>
            
            <div className="model-actions">
              <button
                className={`select-model ${currentModelId === rec.model.model_id ? 'current' : ''}`}
                onClick={() => onModelSelect(rec.model.model_id)}
                disabled={currentModelId === rec.model.model_id}
              >
                {currentModelId === rec.model.model_id ? 'Currently Selected' : 'Select Model'}
              </button>
              
              {rec.model.examples.length > 0 && (
                <div className="examples">
                  <strong>Examples:</strong> {rec.model.examples.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderModelGroups = () => (
    <div className="model-groups">
      <div className="groups-header">
        <h3>📋 All Model Categories</h3>
        {selectedUseCases.length > 0 && (
          <button onClick={() => setViewMode('recommendations')}>
            View Recommendations
          </button>
        )}
      </div>
      
      {modelGroups.map(group => (
        <div key={group.id} className="model-group">
          <div className="group-header">
            <h4>{group.name}</h4>
            <p>{group.description}</p>
          </div>
          
          <div className="group-meta">
            <span className="complexity">{group.complexity}</span>
            <div className="recommended-for">
              <strong>Great for:</strong> {group.recommended_for.join(', ')}
            </div>
          </div>
          
          <div className="group-models">
            {group.models.map(model => (
              <div key={model.model_id} className="model-card">
                <div className="model-header">
                  <h5>{model.display_name}</h5>
                  {model.is_recommended && <span className="recommended-badge">⭐ Recommended</span>}
                </div>
                
                <p>{model.description}</p>
                
                <div className="model-specs">
                  <span className="spec">Quality: {model.capabilities.audio_quality}</span>
                  <span className="spec">Speed: {model.capabilities.synthesis_speed}</span>
                  <span className="spec">Memory: {model.capabilities.memory_requirements}</span>
                </div>
                
                <div className="model-tags">
                  {model.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                
                <button
                  className={`select-model ${currentModelId === model.model_id ? 'current' : ''}`}
                  onClick={() => onModelSelect(model.model_id)}
                  disabled={currentModelId === model.model_id}
                >
                  {currentModelId === model.model_id ? 'Current' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return <div className="loading">Loading model groups...</div>;
  }

  return (
    <div className="model-selection">
      {renderUseCaseSelector()}
      
      {viewMode === 'recommendations' && selectedUseCases.length > 0 
        ? renderRecommendations() 
        : renderModelGroups()
      }
    </div>
  );
};

export default ModelSelectionComponent;
