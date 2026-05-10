const fs = require('fs');
const path = require('path');

function checkDuplicateIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ids = content.match(/id="([^"]+)"/g) || [];
  const idCounts = {};

  ids.forEach(i => {
    const id = i.match(/id="([^"]+)"/)[1];
    if (id.includes('${')) return;
    idCounts[id] = (idCounts[id] || 0) + 1;
  });

  for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) {
      console.log(`[${path.basename(filePath)}] ID duplicato trovato: ${id} (${count} volte)`);
    }
  }
}

const files = [
  '/home/casella-dogano/Scaricati/ANAS CSE/ANAS_CSE_html.html',
  '/home/casella-dogano/Scaricati/ANAS CSE/index.html'
];

files.forEach(checkDuplicateIds);
