// Create map
const map = L.map("map", {
  minZoom: 2,
  maxZoom: 20,
  zoomControl: false,
  attributionControl: false
}).setView([54, -2], 5);

// Add zoom control
L.control.zoom({
  position: 'topright'
}).addTo(map);

// Base tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
  className: 'map-tiles'
}).addTo(map);


// Add attribution
L.control.attribution({
  position: 'bottomleft',
  prefix: '<a href="https://leafletjs.com/" target="_blank">Leaflet</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Marker cluster
const markers = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 60,
  spiderfyOnMaxZoom: true,
  zoomToBoundsOnClick: true,
  iconCreateFunction: function(cluster) {
    const count = cluster.getChildCount();
    let size = 'small';
    if (count > 20) size = 'large';
    else if (count > 10) size = 'medium';
    
    return L.divIcon({
      html: '<div class="marker-cluster-' + size + '">' + count + '</div>',
      className: 'marker-cluster',
      iconSize: L.point(40, 40)
    });
  }
});

map.addLayer(markers);

// Custom icon
const statementIcon = L.divIcon({
  html: '<div class="statement-marker"><i class="fas fa-eye"></i></div>',
  className: 'statement-marker-icon',
  iconSize: [30, 30]
});

// Store data globally
// Store data globally
let allLocations = [];
let allConnections = [];
let activeConnectionLayer = null;
let allConnectionLayers = {};
let currentlyHighlightedConnections = [];
let currentlySelectedStatement = null;

// Color mapping for connection types
const connectionColors = {
  'same_statement': '#FF6B6B',
  'entity': '#8B0000',
  'artifact': '#8B4513',
  'character': '#4682B4',
  'organization': '#32CD32',
  'location': '#9932CC',
  'timeline': '#FFD700',
  'default': '#666666'
};

// Load both data files
Promise.all([
  fetch("data/locations.geojson").then(r => r.json()),
  fetch("data/connections.json").then(r => r.json())
])
.then(([locationsData, connectionsData]) => {
  allLocations = locationsData.features;
  allConnections = connectionsData.connections || [];


  console.log(`Loaded ${allLocations.length} locations and ${allConnections.length} connections`);
  
  // Make sure search is initialized with data
  if (typeof statementSearch !== 'undefined' && statementSearch) {
    statementSearch.setLocations(allLocations);
    console.log('Search initialized with location data');
  } else if (window.statementSearch) {
    window.statementSearch.setLocations(allLocations);
    console.log('Search initialized via window object');
  } else {
    console.warn('Search not available yet, trying to initialize...');
    // Initialize search directly
    statementSearch = new StatementSearch();
    statementSearch.setLocations(allLocations);
  }

  if (window.statementSearch) {
    window.statementSearch.setLocations(allLocations);
  }
  
  console.log(`Loaded ${allLocations.length} locations and ${allConnections.length} connections`);
  
  // Create all connection layers (but don't add to map yet)
  allConnections.forEach(conn => {
    createConnectionLayer(conn);
  });
  
  // Create markers
  const geoLayer = L.geoJSON(locationsData, {
    pointToLayer: (feature, latlng) => {
      const marker = L.marker(latlng, {
        icon: statementIcon
      });
      
      marker.on('mouseover', function() {
        this._icon.classList.add('pulse');
      });
      
      marker.on('mouseout', function() {
        this._icon.classList.remove('pulse');
      });
      
      return marker;
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties.place) {
        layer.bindTooltip(`${feature.properties.place}<br>${feature.properties.statement}`, {
          className: 'magnus-tooltip',
          direction: 'top',
          offset: [0, -10]
        });
      }
      
    layer.on("click", (e) => {
    e.originalEvent.stopPropagation(); // Prevent map click from firing
    
    // Get the statement number
    const statementNumber = feature.properties.statement;
    
    // If clicking the same marker that's already selected, toggle connections
    if (currentlySelectedStatement === statementNumber) {
        // Toggle connections
        if (currentlyHighlightedConnections.length > 0) {
        // Connections are visible, hide them
        clearAllConnections();
        currentlySelectedStatement = null;
        } else {
        // Connections were hidden, show them
        highlightAllConnectionsForStatement(statementNumber);
        }
    } else {
        // New marker clicked - show connections
        clearAllConnections();
        currentlySelectedStatement = statementNumber;
        highlightAllConnectionsForStatement(statementNumber);
    }
    
    // Always update the panel with location details
    showLocation(feature.properties);
    });
    }
  });

  markers.addLayer(geoLayer);
  
  // Fit bounds
  const bounds = geoLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { 
      padding: [50, 50],
      maxZoom: 8
    });
  }
  
  // Update UI with count
  updateMapInfo(allLocations.length, allConnections.length);
  
  // ADD THIS: Clear connections when clicking on empty map area
  map.on('click', function(e) {
    // Only clear if not clicking on a marker or connection
    if (!e.originalEvent.target.closest('.statement-marker') && 
        !e.originalEvent.target.closest('.connection-label') &&
        !e.originalEvent.target.closest('.leaflet-tooltip')) {
      clearAllConnections();
      // Reset panel to default state or previous location
      resetPanelToDefault();
    }
  });
})
.catch(error => {
  console.error("Error loading data:", error);
  showErrorState();
});

// Create a connection layer for a specific connection
function createConnectionLayer(connection) {
  const fromLocation = allLocations.find(loc => 
    loc.properties.statement === connection.from
  );
  
  const toLocation = allLocations.find(loc => 
    loc.properties.statement === connection.to
  );
  
  if (!fromLocation || !toLocation) {
    console.warn(`Could not find locations for connection ${connection.id}`);
    return;
  }
  
  // Get all locations for "from" statement (multiple locations per statement)
  const fromLocations = allLocations.filter(loc => 
    loc.properties.statement === connection.from
  );
  
  // Get all locations for "to" statement (multiple locations per statement)
  const toLocations = allLocations.filter(loc => 
    loc.properties.statement === connection.to
  );
  
  // Create a layer group for this connection
  const connectionLayer = L.layerGroup();
  
  // Draw lines between ALL location pairs for these statements
  fromLocations.forEach(fromLoc => {
    toLocations.forEach(toLoc => {
      // Don't draw line from a location to itself
      if (fromLoc === toLoc) return;
      
      const fromCoords = fromLoc.geometry.coordinates;
      const toCoords = toLoc.geometry.coordinates;
      
      const latlngs = [
        [fromCoords[1], fromCoords[0]],
        [toCoords[1], toCoords[0]]
      ];
      
      // Get color for this connection type
      const color = connectionColors[connection.type] || connection.color || connectionColors.default;
      
      // Draw the connection line
      const line = L.polyline(latlngs, {
        color: color,
        weight: connection.strength === 'high' ? 4 : 
                connection.strength === 'medium' ? 3 : 2,
        opacity: 0,
        dashArray: connection.type === 'same_statement' ? null : '10, 10',
        className: `connection-line connection-${connection.type} connection-${connection.id}`
      });
      
      // Store connection data on the line
      line._connectionData = connection;
      line._fromLocation = fromLoc;
      line._toLocation = toLoc;
      
      // Make line clickable
      line.options.interactive = true;
      line.on('click', function(e) {
        e.originalEvent.stopPropagation(); // Prevent map click
        showConnectionDetails(this._connectionData);
        highlightSingleConnection(this._connectionData.id);
      });
      
      line.addTo(connectionLayer);
      
      // Add interactive label in the middle
      if (connection.label) {
        const midLat = (fromCoords[1] + toCoords[1]) / 2;
        const midLng = (fromCoords[0] + toCoords[0]) / 2;
        
        const labelMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<div class="connection-label" style="background: ${color}; opacity: 0;">
                   <i class="fas fa-link"></i> ${connection.label}
                   </div>`,
            className: 'connection-label-icon',
            iconSize: [150, 30]
          }),
          interactive: true
        });
        
        labelMarker._connectionData = connection;
        labelMarker.on('click', function(e) {
          e.originalEvent.stopPropagation(); // Prevent map click
          showConnectionDetails(this._connectionData);
          highlightSingleConnection(this._connectionData.id);
        });
        
        labelMarker.addTo(connectionLayer);
      }
    });
  });
  
  // Store the layer
  allConnectionLayers[connection.id] = connectionLayer;
}

// Clear all connections from map
function clearAllConnections() {
  Object.values(allConnectionLayers).forEach(layer => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  currentlyHighlightedConnections = [];
  
  // Reset all connection lines to invisible
  Object.values(allConnectionLayers).forEach(layer => {
    layer.eachLayer(l => {
      if (l.setStyle) {
        l.setStyle({ opacity: 0 });
      }
      if (l._icon) {
        l._icon.style.opacity = '0';
      }
    });
  });
}

// Highlight connections for a specific statement
function highlightAllConnectionsForStatement(statementNumber) {
  clearAllConnections();
  
  if (!statementNumber) return;
  
  // Find all connections involving this statement
  const relevantConnections = allConnections.filter(conn => 
    conn.from === statementNumber || conn.to === statementNumber
  );
  
  if (relevantConnections.length === 0) return;
  
  // Show and highlight each connection
  relevantConnections.forEach(conn => {
    highlightSingleConnection(conn.id);
  });
}

// Highlight a single connection
function highlightSingleConnection(connectionId) {
  const connectionLayer = allConnectionLayers[connectionId];
  if (!connectionLayer) return;
  
  // Add to map if not already
  if (!map.hasLayer(connectionLayer)) {
    map.addLayer(connectionLayer);
  }
  
  // Make lines visible
  connectionLayer.eachLayer(layer => {
    if (layer.setStyle) {
      layer.setStyle({ opacity: 0.7 });
    }
    if (layer._icon) {
      layer._icon.style.opacity = '1';
    }
  });
  
  // Store as currently highlighted
  if (!currentlyHighlightedConnections.includes(connectionId)) {
    currentlyHighlightedConnections.push(connectionId);
  }
}

// Function to show connection details in sidebar
// Function to show connection details in sidebar
function showConnectionDetails(connection) {
  const connectionDetails = `
    <div class="connection-details">
      <h3><i class="fas fa-link"></i> ${connection.label}</h3>
      
      <div class="connection-info-grid">
        <div class="connection-info-item">
          <span class="connection-info-label">Type:</span>
          <span class="connection-info-value">${connection.type}</span>
        </div>
        
        <div class="connection-info-item">
          <span class="connection-info-label">Strength:</span>
          <span class="connection-info-value strength-${connection.strength}">${connection.strength}</span>
        </div>
        
        <div class="connection-info-item">
          <span class="connection-info-label">From:</span>
          <span class="connection-info-value statement-link" onclick="highlightAllConnectionsForStatement('${connection.from}')">${connection.from}</span>
        </div>
        
        <div class="connection-info-item">
          <span class="connection-info-label">To:</span>
          <span class="connection-info-value statement-link" onclick="highlightAllConnectionsForStatement('${connection.to}')">${connection.to}</span>
        </div>
      </div>
      
      <div class="connection-description">
        <h4><i class="fas fa-scroll"></i> Description</h4>
        <p>${connection.description}</p>
      </div>
      
      ${connection.evidence ? `
      <div class="connection-evidence">
        <h4><i class="fas fa-search"></i> Evidence</h4>
        <p>${connection.evidence}</p>
      </div>
      ` : ''}
      
      ${connection.characters && connection.characters.length > 0 ? `
      <div class="connection-characters">
        <h4><i class="fas fa-users"></i> Involved Characters/Entities</h4>
        <div class="character-tags">
          ${connection.characters.map(char => 
            `<span class="character-tag">${char}</span>`
          ).join('')}
        </div>
      </div>
      ` : ''}
      
      <div class="connection-episodes">
        <h4><i class="fas fa-podcast"></i> Related Episodes</h4>
        <div class="episode-tags">
          ${connection.episodes.map(ep => 
            `<span class="episode-tag" onclick="highlightAllConnectionsForStatement('${ep}')">${ep}</span>`
          ).join('')}
        </div>
      </div>
      
      <div class="connection-actions">
        <button class="connection-action-btn" onclick="highlightSingleConnection('${connection.id}')">
          <i class="fas fa-eye"></i> Highlight This Connection
        </button>
        <button class="connection-action-btn" onclick="clearAllConnections()">
          <i class="fas fa-times"></i> Clear All Connections
        </button>
      </div>
    </div>
  `;
  
  // Replace panel content with connection details
  document.getElementById("panel-title").innerHTML = `<i class="fas fa-project-diagram"></i> Connection Details`;
  document.getElementById("panel-meta").innerHTML = `
    <span class="statement-number"><i class="fas fa-link"></i> ${connection.id}</span>
  `;
  document.getElementById("panel-text").innerHTML = connectionDetails;
}

// Function to show location details
// Function to show location details
// Function to show location details
// Function to show location details
function showLocation(properties) {
  const title = properties.place || "Unknown Location";
  const statement = properties.statement || "STATEMENT-UNKNOWN";
  const summary = properties.summary || "No statement summary available.";
  
  // Just check if connections should be visible for button text
  const connectionsVisible = currentlySelectedStatement === statement && currentlyHighlightedConnections.length > 0;
  
  // Update panel
  document.getElementById("panel-title").innerHTML = `<i class="fas fa-map-pin"></i> ${title}`;
  
  document.getElementById("panel-meta").innerHTML = `
    <span class="statement-number"><i class="fas fa-file-audio"></i> ${statement}</span>
  `;
  
  let contentHTML = `<p>${summary.replace(/\n/g, '</p><p>')}</p>`;
  
  // Add other details
  if (properties.date) {
    contentHTML += `<div class="statement-date"><i class="far fa-calendar"></i> Statement given: ${properties.date}</div>`;
  }
  
  if (properties.statement_giver) {
    contentHTML += `<div class="statement-giver"><i class="fas fa-user"></i> Statement giver: ${properties.statement_giver}</div>`;
  }
  
  // Add supplemental info if available
  if (properties.supplemental) {
    contentHTML += `<div class="supplemental-info"><strong>Supplemental:</strong> ${properties.supplemental}</div>`;
  }
  
  // Add archivist note - ONLY if it exists in properties and isn't the default
  if (properties.archivist_note && properties.archivist_note !== "Statement recorded for posterity.") {
    contentHTML += `<div class="archivist-note">
      <i class="fas fa-microphone"></i> <strong>Archivist's Note:</strong> ${properties.archivist_note}
    </div>`;
  }
  
  // Find connections for this statement
  const relevantConnections = allConnections.filter(conn => 
    conn.from === statement || conn.to === statement
  );
  
  // ADD CONNECTIONS SECTION AT THE BOTTOM (after archivist note)
  if (relevantConnections.length > 0) {
    const buttonText = connectionsVisible ? "Hide Connections" : "Show Connections";
    const buttonIcon = connectionsVisible ? "fa-eye-slash" : "fa-link";
    
    contentHTML += `<div class="connections-section">
      <h4><i class="fas fa-project-diagram"></i> Connections (${relevantConnections.length})</h4>
      <div class="connections-list">`;
    
    relevantConnections.forEach(conn => {
      const otherStatement = conn.from === statement ? conn.to : conn.from;
      const color = connectionColors[conn.type] || conn.color || connectionColors.default;
      
      contentHTML += `
        <div class="connection-item" onclick="showConnectionDetails(${JSON.stringify(conn).replace(/"/g, '&quot;')}); highlightSingleConnection('${conn.id}')">
          <span class="connection-dot" style="background: ${color}"></span>
          <div class="connection-info">
            <div class="connection-header">
              <span class="connection-type">${conn.type}</span>
              <span class="connection-strength strength-${conn.strength}">${conn.strength}</span>
            </div>
            <div class="connection-label">${conn.label}</div>
            <div class="connection-target">→ ${otherStatement}</div>
          </div>
          <i class="fas fa-chevron-right connection-arrow"></i>
        </div>`;
    });
  }
  
  document.getElementById("panel-text").innerHTML = contentHTML;
}
// Toggle connections for a statement
function toggleConnectionsForStatement(statementNumber) {
  if (currentlySelectedStatement === statementNumber && currentlyHighlightedConnections.length > 0) {
    // Toggle OFF
    clearAllConnections();
    currentlySelectedStatement = null;
  } else {
    // Toggle ON
    clearAllConnections();
    currentlySelectedStatement = statementNumber;
    highlightAllConnectionsForStatement(statementNumber);
  }
  
  // Update the button in the panel
  updateConnectionButton(statementNumber);
}



// Make it globally available
window.toggleConnectionsForStatement = toggleConnectionsForStatement;

// Reset panel to default state
// Reset panel to default state
function resetPanelToDefault() {
  document.getElementById("panel-title").innerHTML = `<i class="fas fa-map-pin"></i> Statement Archive`;
  document.getElementById("panel-meta").innerHTML = `
    <span class="statement-number">Select a location to view details</span>
  `;
  document.getElementById("panel-text").innerHTML = `
    <p>Click on any marker to view statement details and connections.</p>
  `;
  currentlySelectedStatement = null;
}

// Helper functions
function updateMapInfo(locationCount, connectionCount) {
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.textContent = `Statement Location Index • ${locationCount} locations • ${connectionCount} connections`;
  }
}

function showErrorState() {
  const panelText = document.getElementById('panel-text');
  if (panelText) {
    panelText.innerHTML = `
      <p>Unable to load statement data.</p>
      <div class="archivist-note">
        <i class="fas fa-exclamation-triangle"></i> 
        <strong>Archivist's Note:</strong> Check that data files exist and contain valid JSON.
      </div>
    `;
  }
}

// Add custom CSS for markers and connections
const style = document.createElement('style');
style.textContent = `
  .statement-marker {
    width: 30px;
    height: 30px;
    background: rgba(139, 0, 0, 0.85);
    border: 2px solid #c9a86a;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(139, 0, 0, 0.5);
    transition: all 0.3s ease;
  }
  
  .statement-marker:hover {
    background: rgba(201, 168, 106, 0.9);
    border-color: #8b0000;
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(201, 168, 106, 0.7);
  }
  
  .statement-marker.pulse {
    animation: pulse 1.5s infinite;
  }
  
  .statement-marker.highlight {
    animation: highlight 1s ease;
  }
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(139, 0, 0, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(139, 0, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(139, 0, 0, 0); }
  }
  
  @keyframes highlight {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  
  /* Connection lines */
  .connection-line {
    transition: opacity 0.3s;
    cursor: pointer;
  }
  
  .connection-line:hover {
    opacity: 1 !important;
    stroke-width: 4;
  }
  
  .connection-label-icon {
    background: transparent;
    border: none;
  }
  
  .connection-label {
    padding: 2px 8px;
    border-radius: 3px;
    color: white;
    font-family: 'Special Elite', monospace;
    font-size: 10px;
    text-align: center;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .connection-label:hover {
    opacity: 1 !important;
    transform: scale(1.1);
  }
  
  .magnus-tooltip {
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid #8b0000;
    color: #d4d4d4;
    font-family: 'Special Elite', monospace;
    font-size: 0.85rem;
    padding: 6px 12px;
    border-radius: 3px;
    backdrop-filter: blur(2px);
    max-width: 250px;
    white-space: normal;
  }
  
  .leaflet-tooltip-top:before {
    border-top-color: #8b0000;
  }
`;
document.head.appendChild(style);

// Window resize
window.addEventListener('resize', function() {
  map.invalidateSize();
});

// Make functions globally available
window.highlightAllConnectionsForStatement = highlightAllConnectionsForStatement;
window.highlightSingleConnection = highlightSingleConnection;
window.clearAllConnections = clearAllConnections;
window.showConnectionDetails = showConnectionDetails;
window.resetPanelToDefault = resetPanelToDefault;