/**
 * Integration Example: How to use ModelBrowser in the TTS interface
 * 
 * This example shows how to integrate the new model categorization system
 * into the existing TTS server frontend.
 */

import React, { useState, useEffect } from 'react';
import ModelBrowser from './ModelBrowser';
import { modelCategorizationService } from '../services/modelCategorization';

// Example usage in main TTS component
const TTSInterfaceWithModelBrowser: React.FC = () => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [showModelBrowser, setShowModelBrowser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch available models from API
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/v1/models');
      const data = await response.json();
      
      // Extract model names from API response
      const modelNames = data.models ? Object.keys(data.models) : [];
      setAvailableModels(modelNames);
      
      // Set current model if available
      if (data.current_model) {
        setCurrentModel(data.current_model);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleModelSelect = async (modelName: string) => {
    if (modelName === currentModel) return;
    
    setLoading(true);
    try {
      // Load the selected model
      const response = await fetch('/api/v1/models/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
      });
      
      if (response.ok) {
        setCurrentModel(modelName);
        setShowModelBrowser(false);
        
        // Show success message with model info
        const categorizedModel = modelCategorizationService.categorizeModel(modelName);
        showModelLoadedNotification(categorizedModel);
      } else {
        throw new Error('Failed to load model');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Failed to load model. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showModelLoadedNotification = (model: any) => {
    const features = model.features.join(', ');
    const message = `
      ✅ ${model.modelName} loaded successfully!
      
      🏗️ Architecture: ${model.architecture}
      🌍 Languages: ${model.languages.length} supported
      🎭 Speakers: ${model.speakers}
      ⚡ Speed: ${model.speed}
      🎯 Quality: ${model.quality}
      ${model.commercialUse ? '💼 Commercial use approved' : '⚠️ Check license for commercial use'}
      
      Features: ${features}
    `;
    
    // You could replace this with a proper notification system
    alert(message);
  };

  const getModelSummary = () => {
    if (!currentModel) return null;
    
    const categorized = modelCategorizationService.categorizeModel(currentModel);
    
    return (
      <div className="current-model-summary">
        <h3>Current Model: {currentModel}</h3>
        <div className="model-quick-info">
          <span className={`quality-badge ${categorized.quality}`}>
            {categorized.quality} quality
          </span>
          <span className={`speed-badge ${categorized.speed}`}>
            {categorized.speed}
          </span>
          {categorized.commercialUse && (
            <span className="commercial-badge">💼 Commercial OK</span>
          )}
        </div>
        <p className="model-description">
          <strong>{categorized.architecture}</strong> • 
          {categorized.languages.length} languages • 
          {categorized.speakers} speakers
        </p>
        <div className="model-features-inline">
          {categorized.features.map(feature => (
            <span key={feature} className="feature-tag-small">
              {feature.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const getRecommendations = () => {
    if (availableModels.length === 0) return [];
    
    // Get some smart recommendations based on current model
    const currentCategorized = currentModel ? 
      modelCategorizationService.categorizeModel(currentModel) : null;
    
    if (currentCategorized?.category === 'voice_cloning') {
      return modelCategorizationService.getRecommendedModels('multilingual', availableModels);
    } else if (currentCategorized?.speed === 'slow') {
      return modelCategorizationService.getRecommendedModels('real_time', availableModels);
    } else {
      return modelCategorizationService.getRecommendedModels('high_quality', availableModels);
    }
  };

  return (
    <div className="tts-interface">
      {/* Current Model Display */}
      <div className="model-section">
        <div className="model-selector-header">
          <h2>🎤 TTS Model</h2>
          <button 
            className="browse-models-btn"
            onClick={() => setShowModelBrowser(!showModelBrowser)}
            disabled={loading}
          >
            {showModelBrowser ? '× Close Browser' : '🔍 Browse Models'}
          </button>
        </div>
        
        {currentModel ? getModelSummary() : (
          <div className="no-model-selected">
            <p>No model selected. Choose a model to get started!</p>
            <button 
              className="select-model-btn"
              onClick={() => setShowModelBrowser(true)}
            >
              🎯 Select Perfect Model
            </button>
          </div>
        )}
        
        {loading && (
          <div className="loading-indicator">
            <p>🔄 Loading model... This may take a few minutes.</p>
          </div>
        )}
      </div>

      {/* Model Browser Panel */}
      {showModelBrowser && (
        <div className="model-browser-panel">
          <ModelBrowser
            availableModels={availableModels}
            onModelSelect={handleModelSelect}
            currentModel={currentModel}
          />
        </div>
      )}

      {/* Quick Recommendations */}
      {!showModelBrowser && availableModels.length > 0 && (
        <div className="quick-recommendations">
          <h3>💡 You might also like:</h3>
          <div className="recommendation-cards">
            {getRecommendations().slice(0, 3).map(model => (
              <div 
                key={model.modelName} 
                className="recommendation-card"
                onClick={() => handleModelSelect(model.modelName)}
              >
                <h4>{model.modelName}</h4>
                <p>{model.architecture} • {model.languages.length} languages</p>
                <div className="rec-features">
                  {model.features.slice(0, 2).map(feature => (
                    <span key={feature} className="feature-tag-small">
                      {feature.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rest of TTS Interface */}
      <div className="tts-controls">
        {/* Your existing TTS controls (text input, speakers, languages, etc.) */}
        {currentModel && (
          <div className="synthesis-section">
            <h3>🎯 Text-to-Speech Synthesis</h3>
            {/* Existing TTS interface components would go here */}
            <p className="model-ready">Ready to synthesize with {currentModel}!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TTSInterfaceWithModelBrowser;

/* 
 * CSS to add to your main styles:
 */
/*
.tts-interface {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.model-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.model-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.browse-models-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.browse-models-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.browse-models-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.current-model-summary {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}

.model-quick-info {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
  flex-wrap: wrap;
}

.model-features-inline {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.feature-tag-small {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
  text-transform: capitalize;
}

.model-browser-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 2rem;
  max-height: 80vh;
  overflow-y: auto;
}

.no-model-selected {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

.select-model-btn {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
}

.loading-indicator {
  text-align: center;
  padding: 1rem;
  color: #4299e1;
  font-weight: 500;
}

.quick-recommendations {
  margin-bottom: 2rem;
}

.recommendation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.recommendation-card {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.recommendation-card:hover {
  border-color: #cbd5e0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.rec-features {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.synthesis-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.model-ready {
  color: #38a169;
  font-weight: 500;
  margin-top: 1rem;
}
*/
