const fs = require('fs');
const html = fs.readFileSync('/home/casella-dogano/Scaricati/ANAS CSE/ANAS_CSE_html.html', 'utf8');

const labels = html.match(/for="([^"]+)"/g) || [];
const ids = html.match(/id="([^"]+)"/g) || [];

const idSet = new Set(ids.map(i => i.match(/id="([^"]+)"/)[1]));

labels.forEach(l => {
  const labelFor = l.match(/for="([^"]+)"/)[1];
  if (!idSet.has(labelFor)) {
    console.log(`Label orfano trovato: ${labelFor}`);
  }
});
