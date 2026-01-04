function showLocation(properties) {
  const title = properties.place || "Unknown Location";
  const statement = properties.statement || "STATEMENT-UNKNOWN";
  const entity = properties.entity || "Unclassified";
  const summary = properties.summary || "No statement summary available. Recording may be corrupted or incomplete.";
  const archivistNote = properties.archivist_note || "Statement recorded for posterity.";
  
  // Format entity tag
  const entityColors = {
    'The Spiral': '#9932CC',
    'The Stranger': '#8B0000',
    'The Eye': '#FFD700',
    'The Lonely': '#4682B4',
    'The Buried': '#8B4513',
    'The Corruption': '#32CD32',
    'The Desolation': '#FF4500',
    'The Hunt': '#A0522D',
    'The Slaughter': '#DC143C',
    'The Vast': '#1E90FF',
    'The Web': '#4B0082',
    'The End': '#000000',
    'The Flesh': '#FF69B4',
    'The Dark': '#2F4F4F'
  };
  
  const entityColor = entityColors[entity] || '#8b0000';
  
  // Update panel
  document.getElementById("panel-title").innerHTML = `<i class="fas fa-map-pin"></i> ${title}`;
  
  document.getElementById("panel-meta").innerHTML = `
    <span class="statement-number"><i class="fas fa-file-audio"></i> ${statement}</span>
    <span class="entity-tag" style="background: ${entityColor}">
      <i class="fas fa-eye"></i> ${entity}
    </span>
  `;
  
  document.getElementById("panel-text").innerHTML = `<p>${summary.replace(/\n/g, '</p><p>')}</p>`;
  
  // Update Archivist's Note
  const archivistNoteElement = document.querySelector('.archivist-note');
  if (archivistNoteElement) {
    archivistNoteElement.innerHTML = `
      <i class="fas fa-microphone"></i> <strong>Archivist's Note:</strong> ${archivistNote}
    `;
  }
  
  // Add other details if available
  if (properties.date) {
    const dateElement = document.createElement('div');
    dateElement.className = 'statement-date';
    dateElement.innerHTML = `<i class="far fa-calendar"></i> Statement given: ${properties.date}`;
    document.getElementById("panel-text").appendChild(dateElement);
  }
  
  if (properties.statement_giver) {
    const giverElement = document.createElement('div');
    giverElement.className = 'statement-giver';
    giverElement.innerHTML = `<i class="fas fa-user"></i> Statement giver: ${properties.statement_giver}`;
    document.getElementById("panel-text").appendChild(giverElement);
  }
  
  if (properties.supplemental) {
    const supplementalElement = document.createElement('div');
    supplementalElement.className = 'supplemental-info';
    supplementalElement.innerHTML = `<strong>Supplemental:</strong> ${properties.supplemental}`;
    document.getElementById("panel-text").appendChild(supplementalElement);
  }
}