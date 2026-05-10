const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const labels = content.match(/for="([^"]+)"/g) || [];
  const ids = content.match(/id="([^"]+)"/g) || [];
  const idSet = new Set(ids.map(i => i.match(/id="([^"]+)"/)[1]));

  labels.forEach(l => {
    const labelFor = l.match(/for="([^"]+)"/)[1];
    // Se l'ID contiene template literals (es. ${id}), lo ignoriamo perché è dinamico
    if (labelFor.includes('${')) return;
    
    if (!idSet.has(labelFor)) {
      console.log(`[${path.basename(filePath)}] Label orfano: ${labelFor}`);
    }
  });
}

const files = [
  '/home/casella-dogano/Scaricati/ANAS CSE/ANAS_CSE_html.html',
  '/home/casella-dogano/Scaricati/ANAS CSE/index.html',
  '/home/casella-dogano/Scaricati/ANAS CSE/ui.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/impostazioni.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/lettera-sospensione.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/lettera-segnalazione-rup.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/ods-inviati.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/imprese-assegnazione.js',
  '/home/casella-dogano/Scaricati/ANAS CSE/lavoratori.js'
];

files.forEach(checkFile);
