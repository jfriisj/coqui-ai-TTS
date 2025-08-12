/**
 * Model Browser Component
 * 
 * Demonstrates the model categorization system with an intuitive UI
 * for browsing models by use case, capabilities, and licensing
 */

import React, { useState, useMemo } from 'react';
import './ModelBrowser.css';
import { 
  MODEL_CATEGORIES, 
  modelCategorizationService,
  type CategorizedModel 
} from '../services/modelCategorization';

interface ModelBrowserProps {
  availableModels: string[];
  onModelSelect: (model: string) => void;
  currentModel?: string;
}

const ModelBrowser: React.FC<ModelBrowserProps> = ({
  availableModels,
  onModelSelect,
  currentModel
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCommercialOnly, setShowCommercialOnly] = useState(false);
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [speedFilter, setSpeedFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Categorize all available models
  const categorizedModels = useMemo(() => {
    return availableModels.map(model => 
      modelCategorizationService.categorizeModel(model)
    );
  }, [availableModels]);

  // Apply filters
  const filteredModels = useMemo(() => {
    return categorizedModels.filter(model => {
      // Category filter
      if (selectedCategory !== 'all' && model.category !== selectedCategory) {
        return false;
      }
      
      // Commercial use filter
      if (showCommercialOnly && !model.commercialUse) {
        return false;
      }
      
      // Quality filter
      if (qualityFilter !== 'all' && model.quality !== qualityFilter) {
        return false;
      }
      
      // Speed filter
      if (speedFilter !== 'all' && model.speed !== speedFilter) {
        return false;
      }
      
      // Search filter
      if (searchTerm && !model.modelName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [categorizedModels, selectedCategory, showCommercialOnly, qualityFilter, speedFilter, searchTerm]);

  // Group models by category for display
  const modelsByCategory = useMemo(() => {
    const grouped: Record<string, CategorizedModel[]> = {};
    
    filteredModels.forEach(model => {
      if (!grouped[model.category]) {
        grouped[model.category] = [];
      }
      grouped[model.category].push(model);
    });
    
    return grouped;
  }, [filteredModels]);

  const renderModelCard = (model: CategorizedModel) => {
    const isSelected = model.modelName === currentModel;
    
    return (
      <div 
        key={model.modelName}
        className={`model-card ${isSelected ? 'selected' : ''}`}
        onClick={() => onModelSelect(model.modelName)}
      >
        <div className="model-header">
          <h4 className="model-name">{model.modelName}</h4>
          <div className="model-badges">
            <span className={`quality-badge ${model.quality}`}>
              {model.quality}
            </span>
            <span className={`speed-badge ${model.speed}`}>
              {model.speed}
            </span>
            {model.commercialUse && (
              <span className="commercial-badge">💼 Commercial</span>
            )}
          </div>
        </div>
        
        <div className="model-details">
          <p className="architecture">
            <strong>Architecture:</strong> {model.architecture}
          </p>
          <p className="languages">
            <strong>Languages:</strong> {model.languages.slice(0, 3).join(', ')}
            {model.languages.length > 3 && ` +${model.languages.length - 3} more`}
          </p>
          <p className="speakers">
            <strong>Speakers:</strong> {model.speakers === 1 ? 'Single' : model.speakers}
          </p>
          <p className="license">
            <strong>License:</strong> {model.license}
          </p>
        </div>
        
        <div className="model-features">
          {model.features.map(feature => (
            <span key={feature} className="feature-tag">
              {feature.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderCategorySection = (categoryId: string, models: CategorizedModel[]) => {
    const category = MODEL_CATEGORIES[categoryId];
    if (!category || models.length === 0) return null;
    
    return (
      <div key={categoryId} className="category-section">
        <div className="category-header">
          <h3>
            <span className="category-icon">{category.icon}</span>
            {category.name}
          </h3>
          <p className="category-description">{category.description}</p>
          
          <div className="category-info">
            <div className="use-cases">
              <strong>Perfect for:</strong>
              <ul>
                {category.useCases.slice(0, 3).map(useCase => (
                  <li key={useCase}>{useCase}</li>
                ))}
              </ul>
            </div>
            
            {category.licensingNotes && (
              <div className="licensing-note">
                <strong>⚠️ Licensing:</strong> {category.licensingNotes}
              </div>
            )}
          </div>
        </div>
        
        <div className="models-grid">
          {models.map(renderModelCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="model-browser">
      <div className="browser-header">
        <h2>🎯 Choose the Perfect Model for Your Needs</h2>
        <p>Browse models organized by capabilities and use cases</p>
      </div>
      
      {/* Filters */}
      <div className="filters-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label>Category:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Object.entries(MODEL_CATEGORIES).map(([id, category]) => (
                <option key={id} value={id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Quality:</label>
            <select 
              value={qualityFilter} 
              onChange={(e) => setQualityFilter(e.target.value)}
            >
              <option value="all">Any Quality</option>
              <option value="high">High Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="experimental">Experimental</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Speed:</label>
            <select 
              value={speedFilter} 
              onChange={(e) => setSpeedFilter(e.target.value)}
            >
              <option value="all">Any Speed</option>
              <option value="fast">Fast (Real-time)</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow (High Quality)</option>
            </select>
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showCommercialOnly}
                onChange={(e) => setShowCommercialOnly(e.target.checked)}
              />
              Commercial use only
            </label>
          </div>
        </div>
      </div>
      
      {/* Quick Recommendations */}
      <div className="recommendations">
        <h3>🌟 Popular Choices</h3>
        <div className="quick-picks">
          <button 
            className="quick-pick"
            onClick={() => setSelectedCategory('voice_cloning')}
          >
            🎭 Voice Cloning
          </button>
          <button 
            className="quick-pick"
            onClick={() => setSelectedCategory('multilingual_tts')}
          >
            🌍 Multilingual
          </button>
          <button 
            className="quick-pick"
            onClick={() => setSelectedCategory('fast_synthesis')}
          >
            ⚡ Real-time
          </button>
          <button 
            className="quick-pick"
            onClick={() => setShowCommercialOnly(!showCommercialOnly)}
          >
            💼 Commercial
          </button>
        </div>
      </div>
      
      {/* Models by Category */}
      <div className="models-container">
        {selectedCategory === 'all' ? (
          // Show all categories
          Object.entries(modelsByCategory).map(([categoryId, models]) =>
            renderCategorySection(categoryId, models)
          )
        ) : (
          // Show selected category only
          renderCategorySection(selectedCategory, modelsByCategory[selectedCategory] || [])
        )}
        
        {filteredModels.length === 0 && (
          <div className="no-models">
            <h3>😔 No models match your criteria</h3>
            <p>Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
      
      {/* Stats */}
      <div className="browser-stats">
        <p>
          Showing {filteredModels.length} of {categorizedModels.length} models
          {showCommercialOnly && (
            <span className="commercial-note"> (commercial use approved)</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ModelBrowser;
