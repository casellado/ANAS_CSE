// catalogo-tipologie-mezzi.js - Catalogo Centralizzato (FASE 4.4 & 4.5)

const MACRO_CATEGORIE_MEZZI = [
  {
    id: 'SC',
    nome: 'Strumenti per Carichi',
    icona: '📦',
    mezzi: [
      { id: 'gru-torre', nome: 'Gru a torre' },
      { id: 'gru-auto', nome: 'Autogru' },
      { id: 'gru-mobile', nome: 'Gru mobile' },
      { id: 'carrello-elevatore', nome: 'Carrello elevatore' },
      { id: 'transpallet', nome: 'Transpallet elettrico' },
      { id: 'paranco', nome: 'Paranco / Argano' }
    ]
  },
  {
    id: 'SP',
    nome: 'Strumenti Perforanti/Demolizione',
    icona: '⛏️',
    mezzi: [
      { id: 'martello-demolitore', nome: 'Martello demolitore' },
      { id: 'perforatrice', nome: 'Perforatrice' },
      { id: 'fresa-stradale', nome: 'Fresa stradale' },
      { id: 'scarificatrice', nome: 'Scarificatrice' }
    ]
  },
  {
    id: 'MT',
    nome: 'Macchine Terra',
    icona: '🏗️',
    mezzi: [
      { id: 'escavatore-cing', nome: 'Escavatore cingolato' },
      { id: 'escavatore-gomma', nome: 'Escavatore gommato' },
      { id: 'pala-meccanica', nome: 'Pala meccanica / caricatrice' },
      { id: 'bulldozer', nome: 'Bulldozer' },
      { id: 'terna', nome: 'Terna' },
      { id: 'miniescavatore', nome: 'Miniescavatore' }
    ]
  },
  {
    id: 'OP',
    nome: 'Operatrici',
    icona: '🛠️',
    mezzi: [
      { id: 'autobetoniera', nome: 'Autobetoniera' },
      { id: 'pompa-cls', nome: 'Pompa calcestruzzo' },
      { id: 'finitrice', nome: 'Vibrofinitrice' },
      { id: 'rullo-compatto', nome: 'Rullo compattatore' },
      { id: 'camion-ribaltabile', nome: 'Camion ribaltabile' }
    ]
  },
  {
    id: 'AT',
    nome: 'Attrezzature Speciali',
    icona: '⚡',
    mezzi: [
      { id: 'ple', nome: 'PLE (Piattaforma Lavoro Elevabile)' },
      { id: 'piattaforma-aerea', nome: 'Piattaforma aerea autocarrata' },
      { id: 'generatore', nome: 'Generatore di corrente' },
      { id: 'compressore', nome: 'Motocompressore' },
      { id: 'saldatrice', nome: 'Saldatrice' },
      { id: 'ponteggio-mobile', nome: 'Ponteggio mobile / Trabattello' }
    ]
  }
];

// Helper per ottenere la flat list delle opzioni (per popolare i select HTML)
function getOpzioniTipologieMezziHtml() {
  let html = '<option value="">-- Seleziona tipologia --</option>';
  MACRO_CATEGORIE_MEZZI.forEach(cat => {
    html += `<optgroup label="${cat.icona} ${cat.nome}">`;
    cat.mezzi.forEach(m => {
      html += `<option value="${m.id}">${m.nome}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

// Helper per ottenere il nome leggibile dato l'id
function getNomeTipologiaMezzo(id) {
  for (const cat of MACRO_CATEGORIE_MEZZI) {
    const mezzo = cat.mezzi.find(m => m.id === id);
    if (mezzo) return mezzo.nome;
  }
  return id;
}
