// search.js
class StatementSearch {
  constructor() {
    this.allLocations = [];
    this.searchInput = document.getElementById('statement-search');
    this.resultsContainer = document.getElementById('search-results');
    this.clearSearchBtn = document.getElementById('clear-search');
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Search input events
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
    this.searchInput.addEventListener('focus', () => this.showResults());
    this.searchInput.addEventListener('blur', () => {
      // Delay hiding to allow clicking on results
      setTimeout(() => this.hideResults(), 200);
    });
    
    // Clear search button
    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (this.searchInput) {
          this.searchInput.focus();
          this.searchInput.select();
        }
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && this.searchInput && this.searchInput.value) {
        this.clearSearch();
        this.searchInput.blur();
      }
    });
  }
  
  setLocations(locations) {
    this.allLocations = locations;
  }
  
  handleSearch(e) {
    const searchTerm = e.target.value.trim();
  
    // Check if we have data loaded
    if (!this.allLocations || this.allLocations.length === 0) {
        console.warn('Search: No locations loaded yet. Please wait...');
        // Show a helpful message in the results
        if (this.resultsContainer) {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
            <i class="fas fa-spinner fa-spin"></i> Loading statement data...
            </div>
        `;
        this.showResults();
        }
        return;
    }
    
    if (searchTerm.length < 1) {
      this.hideResults();
      if (this.clearSearchBtn) {
        this.clearSearchBtn.style.display = 'none';
      }
      return;
    }
    
    if (this.clearSearchBtn) {
      this.clearSearchBtn.style.display = 'flex';
    }
    
    // Normalize search term (remove MAG- prefix if user types just numbers)
    let normalizedTerm = searchTerm.toUpperCase();
    
    // Handle different input formats
    if (searchTerm.match(/^\d+$/)) {
      // User typed just numbers like "1" or "001"
      normalizedTerm = `MAG-${searchTerm.padStart(3, '0')}`;
    } else if (searchTerm.match(/^MAG\s*(\d+)$/i)) {
      // User typed "MAG 1" or "MAG1"
      const num = searchTerm.match(/^MAG\s*(\d+)$/i)[1];
      normalizedTerm = `MAG-${num.padStart(3, '0')}`;
    } else if (searchTerm.match(/^MAG-(\d+)$/i)) {
      // User typed "MAG-1" but might not have leading zeros
      const num = searchTerm.match(/^MAG-(\d+)$/i)[1];
      normalizedTerm = `MAG-${num.padStart(3, '0')}`;
    }
    
    const results = this.searchLocations(normalizedTerm, searchTerm);
    this.displayResults(results);
  }
  
    searchLocations(searchTerm, originalTerm) {
    if (!this.allLocations || this.allLocations.length === 0) {
        console.warn('No locations loaded yet');
        return [];
    }
    
    const results = [];
    
    // Group locations by statement number
    const groupedLocations = {};
    this.allLocations.forEach(location => {
        const statement = location.properties.statement;
        if (!groupedLocations[statement]) {
        groupedLocations[statement] = [];
        }
        groupedLocations[statement].push(location);
    });
    
    // Search through grouped locations
    Object.entries(groupedLocations).forEach(([statement, locations]) => {
        // Check if statement number matches
        if (statement.toUpperCase().includes(searchTerm) || 
            statement.toUpperCase().includes(originalTerm.toUpperCase())) {
        
        const firstLocation = locations[0];
        results.push({
            statement: statement,
            entity: firstLocation.properties.entity || 'Unknown',
            place: firstLocation.properties.place || 'Unknown Location',
            locations: locations, // All locations for this statement
            summary: firstLocation.properties.summary || '',
            hasMultipleLocations: locations.length > 1
        });
        }
    });
    
    // Also search in place names if no direct statement matches
    if (results.length === 0) {
        Object.entries(groupedLocations).forEach(([statement, locations]) => {
        locations.forEach(location => {
            const place = location.properties.place || '';
            if (place.toUpperCase().includes(originalTerm.toUpperCase())) {
            // Check if we already have this statement in results
            if (!results.some(r => r.statement === statement)) {
                results.push({
                statement: statement,
                entity: location.properties.entity || 'Unknown',
                place: location.properties.place || 'Unknown Location',
                locations: [location], // Just this location
                summary: location.properties.summary || '',
                hasMultipleLocations: locations.length > 1
                });
            }
            }
        });
        });
    }
    
    // Sort by statement number
    return results.sort((a, b) => {
        const aNum = parseInt(a.statement.replace('MAG-', '')) || 0;
        const bNum = parseInt(b.statement.replace('MAG-', '')) || 0;
        return aNum - bNum;
    });
    }
  
  displayResults(results) {
  if (!this.resultsContainer) return;
  
  this.resultsContainer.innerHTML = '';
  
  if (results.length === 0) {
    this.resultsContainer.innerHTML = `
      <div class="no-results">
        No statements found matching your search
      </div>
    `;
    this.showResults();
    return;
  }
  
  results.forEach(result => {
    const resultElement = document.createElement('div');
    resultElement.className = 'search-result-item';
    
    // Add location count badge for multi-location statements
    const locationCount = result.locations.length;
    const locationBadge = locationCount > 1 ? 
      `<span class="location-count-badge"><i class="fas fa-map-marker-alt"></i> ${locationCount}</span>` : '';
    
    resultElement.innerHTML = `
      <div class="result-title">
        ${result.statement} ${locationBadge}
      </div>
      <div class="result-subtitle">
        <span>${result.place}</span>
        <span class="result-entity">${result.entity}</span>
      </div>
      ${locationCount > 1 ? 
        `<div class="multi-location-hint">
          <i class="fas fa-info-circle"></i> Click to choose from ${locationCount} locations
        </div>` : ''}
    `;
    
    resultElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (result.locations.length === 1) {
        // Single location - go directly to it
        this.selectLocation(result.locations[0], result.statement);
      } else {
        // Multiple locations - show location picker
        this.showLocationPicker(result);
      }
    });
    
    this.resultsContainer.appendChild(resultElement);
  });
  
  this.showResults();
}

showLocationPicker(result) {
  // Hide the regular search results
  this.hideResults();
  
  // Create location picker overlay
  const pickerOverlay = document.createElement('div');
  pickerOverlay.className = 'location-picker-overlay';
  pickerOverlay.innerHTML = `
    <div class="location-picker">
      <div class="location-picker-header">
        <h4><i class="fas fa-map-pin"></i> ${result.statement} - Choose Location</h4>
        <button class="close-picker"><i class="fas fa-times"></i></button>
      </div>
      <div class="location-picker-subtitle">
        This statement references ${result.locations.length} locations. Select one to view:
      </div>
      <div class="location-picker-list">
        ${result.locations.map((location, index) => `
          <div class="location-option" data-index="${index}">
            <div class="location-option-header">
              <span class="location-number">${index + 1}</span>
              <span class="location-type">${location.properties.location_type || 'Location'}</span>
            </div>
            <div class="location-place">${location.properties.place}</div>
            <div class="location-summary">${location.properties.summary?.substring(0, 100)}${location.properties.summary?.length > 100 ? '...' : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(pickerOverlay);
  
  // Close button event
  pickerOverlay.querySelector('.close-picker').addEventListener('click', () => {
    document.body.removeChild(pickerOverlay);
  });
  
  // Click outside to close
  pickerOverlay.addEventListener('click', (e) => {
    if (e.target === pickerOverlay) {
      document.body.removeChild(pickerOverlay);
    }
  });
  
  // Location option clicks
  pickerOverlay.querySelectorAll('.location-option').forEach(option => {
    option.addEventListener('click', (e) => {
      const index = parseInt(option.getAttribute('data-index'));
      const location = result.locations[index];
      
      // Remove picker
      document.body.removeChild(pickerOverlay);
      
      // Clear search
      this.clearSearch();
      
      // Select the chosen location
      this.selectLocation(location, result.statement);
    });
  });
  
  // ESC key to close
  document.addEventListener('keydown', function closeOnEsc(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(pickerOverlay);
      document.removeEventListener('keydown', closeOnEsc);
    }
  });
}
  
selectLocation(location, statementNumber) {
  // Check if map is available
  if (typeof map === 'undefined') {
    console.error('Map not loaded yet');
    return;
  }
  
  // Get coordinates
  const coords = location.geometry.coordinates;
  
  // Fly to the location
  map.flyTo([coords[1], coords[0]], 12, {
    duration: 1.5,
    easeLinearity: 0.25
  });
  
  // Highlight the marker after a delay
  setTimeout(() => {
    // Find and highlight the specific marker
    markers.getLayers().forEach(layer => {
      if (layer.feature && 
          layer.feature.properties.statement === statementNumber &&
          layer.feature.properties.place === location.properties.place) {
        
        if (layer._icon) {
          layer._icon.classList.add('pulse');
          setTimeout(() => {
            if (layer._icon) {
              layer._icon.classList.remove('pulse');
            }
          }, 2000);
        }
      }
    });
    
    // Show statement details in panel
    if (typeof showLocation === 'function') {
      showLocation(location.properties);
    }
    
    // Highlight connections for this statement
    if (typeof clearAllConnections === 'function' && 
        typeof highlightAllConnectionsForStatement === 'function') {
      clearAllConnections();
      if (typeof currentlySelectedStatement !== 'undefined') {
        currentlySelectedStatement = statementNumber;
      }
      highlightAllConnectionsForStatement(statementNumber);
    }
  }, 1500);
}
  
  showResults() {
    if (this.resultsContainer && this.resultsContainer.innerHTML.trim() !== '') {
      this.resultsContainer.style.display = 'block';
    }
  }
  
  hideResults() {
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'none';
    }
  }
  
  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.hideResults();
    if (this.clearSearchBtn) {
      this.clearSearchBtn.style.display = 'none';
    }
  }
}

// Initialize search globally
let statementSearch = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  statementSearch = new StatementSearch();
  console.log('Search initialized');
});

// Make it globally available
window.statementSearch = statementSearch;

