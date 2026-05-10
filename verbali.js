// verbali.js - Gestione Verbali di Sopralluogo ANAS SafeHub

// ─────────────────────────────────────────────
// 1. ID univoco
// ─────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// ─────────────────────────────────────────────
// 2. Salvataggio verbale
// ─────────────────────────────────────────────
async function salvaVerbale(event) {
  if (event) event.preventDefault();

  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  // Validazione: oggetto obbligatorio (data ha fallback automatico)
  const dataVal = (document.getElementById('verbale-data')?.value || '').trim();
  if (!dataVal) {
    // usa data odierna silenziosamente — già gestito sotto
  }

  // Validazione minima: oggetto del sopralluogo
  const oggettoVal = (document.getElementById('verbale-oggetto')?.value || '').trim();
  if (!oggettoVal) {
    showToast("Inserisci almeno l'oggetto del sopralluogo.", 'warning');
    document.getElementById('verbale-oggetto')?.focus();
    return;
  }

  // Recupera imprese presenti (select multiple)
  const impreseSelect = document.getElementById('verbale-imprese');
  const impresePresenti = impreseSelect
    ? Array.from(impreseSelect.selectedOptions).map(o => o.value)
    : [];

  // MOD-7: Numerazione progressiva (AAAA/VS-XX)
  const verbaliEsistenti = await getAll('verbali').catch(() => []);
  const annoCorrente = new Date().getFullYear();
  const countVS = verbaliEsistenti.filter(v => 
    v.tipo === 'sopralluogo' && 
    v.data && v.data.startsWith(oggi)
  ).length + 1;
  const dataCompatta = oggi.replace(/-/g, '');
  const progressivoVS = `${dataCompatta}/VS${String(countVS).padStart(2, '0')}`;

  // Recupera firma (se presente)
  const firmaData = window._firmaCorrente || null;
  
  // MOD-7: Gestione firme multiple presenti (FLUSSO 1)
  const firmeExtra = _raccogliPresenti();
  const delegaCSE = _raccogliDelegaCSE();

  const verbale = {
    id:              generateId('verb'),
    protocollo:      progressivoVS,
    tipo:            'sopralluogo',
    projectId:       window.appState.currentProject,
    data:            document.getElementById('verbale-data')?.value        || new Date().toISOString().slice(0, 10),
    km:              document.getElementById('verbale-km')?.value          || '',
    meteo:           document.getElementById('verbale-meteo')?.value       || '',
    impresePresenti,
    referenti:       document.getElementById('verbale-referenti')?.value   || '',
    statoLuoghi:     document.getElementById('verbale-stato-luoghi')?.value || '',
    note:            document.getElementById('verbale-note')?.value        || '',
    oggetto:         document.getElementById('verbale-oggetto')?.value     || '',
    allegaMezzi:     document.getElementById('verbale-allega-mezzi')?.checked || false,
    firma:           firmaData ? firmaData.png       : null,
    presenti:        firmeExtra,   // FLUSSO 1: array [{nome, ruolo, firmaBase64, timestampFirma}]
    delegaCSE,                     // FLUSSO 1: {nome, qualifica, attoDelega} o null
    firmaTimestamp:  firmaData ? firmaData.timestamp : null,
    firmante:        firmaData ? firmaData.firmante  : (window.appState?._firmaNome || 'Coordinatore per l\'Esecuzione'),
    createdAt:       new Date().toISOString()
  };

  await saveItem('verbali', verbale);

  // Archiviazione automatica PDF del verbale in OneDrive o download locale
  try {
    if (typeof generaVerbalePDFBlob === 'function' && typeof salvaDocumento === 'function') {
      const pdfBlob = await generaVerbalePDFBlob(verbale);
      const protSafe = (verbale.protocollo || '').replace(/\//g, '_');
      const filename = `VS_${protSafe}_${verbale.data}.pdf`;
      await salvaDocumento({
        filename,
        blob: pdfBlob,
        cantiereId: verbale.projectId,
        tipoDoc: 'verbale-sopralluogo',
        titoloCondivisione: `Verbale di Sopralluogo ${verbale.protocollo} del ${verbale.data}`
      });
    }
  } catch (err) {
    console.warn('[Verbale] Errore archiviazione PDF automatica:', err);
  }

  // Genera NC automatica se selezionato livello
  const livelloNC    = document.getElementById('livello-nc')?.value      || '';
  const descrizioneNC = document.getElementById('descrizione-nc')?.value || '';

  if (livelloNC && livelloNC !== '') {
    await generaNCdaVerbale(verbale.projectId, livelloNC, descrizioneNC, verbale);
  }

  showToast('Verbale salvato correttamente ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  document.getElementById('form-verbale')?.reset();

  // Resetta la firma dopo il salvataggio — il prossimo verbale
  // deve avere una firma fresca, non ereditare quella precedente
  window._firmaCorrente = null;
  // Reset presenti e delega (FLUSSO 1)
  if (typeof _resetPresentiSopralluogo === 'function') _resetPresentiSopralluogo();
  // Se la firma canvas è presente, la ripristina visivamente
  if (typeof renderFirmaCanvas === 'function') {
    const container = document.getElementById('firma-verbale-container');
    if (container) {
      renderFirmaCanvas('firma-verbale-container', (firmaData) => {
        window._firmaCorrente = firmaData;
      });
    }
  }

  // Aggiorna badge e lista se siamo nella dashboard
  if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
}

// ─────────────────────────────────────────────
// 3. Genera NC automatica dal verbale
// ─────────────────────────────────────────────
async function generaNCdaVerbale(projectId, livello, descrizione, verbale) {
  const nc = {
    id:           generateId('nc'),
    projectId,
    titolo:       `NC da Verbale del ${verbale.data}`,
    livello,
    descrizione,
    stato:        'aperta',
    dataApertura: verbale.data ? new Date(verbale.data).toISOString() : new Date().toISOString(),
    dataScadenza: calcolaScadenzaNC(livello, verbale.data || new Date().toISOString()),
    verbaleId:    verbale.id,
    createdAt:    new Date().toISOString()
  };

  await saveItem('nc', nc);
  showToast(`NC ${livello.toUpperCase()} generata automaticamente ✓`, 'warning');
  console.info('NC generata automaticamente:', nc);
}

// ─────────────────────────────────────────────
// 4. calcolaScadenzaNC (se non già definita da nc.js)
//    Usa var per evitare SyntaxError in strict mode
//    con function declaration dentro if() block
// ─────────────────────────────────────────────
if (typeof calcolaScadenzaNC === 'undefined') {
  var calcolaScadenzaNC = function(livello, dataApertura) {
    const apertura = new Date(dataApertura || new Date());
    switch (livello) {
      case 'gravissima': apertura.setHours(apertura.getHours() + 24); break;
      case 'grave':      apertura.setDate(apertura.getDate() + 7);    break;
      case 'media':      apertura.setDate(apertura.getDate() + 15);   break;
      default:           apertura.setDate(apertura.getDate() + 30);   break; // lieve
    }
    return apertura.toISOString();
  };
}

// ─────────────────────────────────────────────
// 5. Selezione livello NC nella UI verbale
// ─────────────────────────────────────────────
function selezionaNC(livello) {
  const bottoni = document.querySelectorAll('.nc-btn');

  bottoni.forEach(btn => {
    btn.classList.remove(
      'bg-blue-200', 'text-blue-800',
      'bg-orange-200', 'text-orange-800',
      'bg-red-200', 'text-red-800',
      'ring-2'
    );
  });

  const btnAttivo = document.getElementById(`btn-nc-${livello}`);
  if (!btnAttivo) return;

  const colori = {
    lieve:     ['bg-blue-200',   'text-blue-800'],
    media:     ['bg-yellow-200', 'text-yellow-800'],
    grave:     ['bg-orange-200', 'text-orange-800'],
    gravissima:['bg-red-200',    'text-red-800']
  };
  (colori[livello] || []).forEach(cls => btnAttivo.classList.add(cls));
  btnAttivo.classList.add('ring-2');

  const livellaEl = document.getElementById('livello-nc');
  if (livellaEl) livellaEl.value = livello;

  // Template automatico descrizione
  const textArea = document.getElementById('descrizione-nc');
  if (!textArea) return;

  const templates = {
    lieve:      'Non conformità lieve riscontrata. Si richiede adeguamento entro 30 giorni.',
    media:      'Non conformità media riscontrata. Si richiede adeguamento entro 15 giorni.',
    grave:      'Non conformità grave riscontrata. Adeguamento obbligatorio entro 7 giorni.',
    gravissima: 'Pericolo grave e imminente. Si richiede sospensione immediata delle lavorazioni e messa in sicurezza entro 24 ore (art. 92 c.1 lett. f D.Lgs 81/08).'
  };
  textArea.value = templates[livello] || '';
}

// ─────────────────────────────────────────────
// 6. Hook DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-verbale');
  if (form) {
    form.addEventListener('submit', salvaVerbale);
  }
});

// ─────────────────────────────────────────────
// 7. Conta Mezzi per Checkbox Verbale
// ─────────────────────────────────────────────
window._aggiornaConteggioMezziVerbale = async function() {
  const lbl = document.getElementById('label-conteggio-mezzi');
  const chk = document.getElementById('verbale-allega-mezzi');
  if (!lbl || !chk || !window.appState?.currentProject) return;
  
  if (typeof getMezziByProject !== 'function') return;
  
  try {
    const mezzi = await getMezziByProject(window.appState.currentProject);
    const presenti = mezzi.filter(m => m.presenteInCantiere).length;
    
    if (presenti === 0) {
      lbl.innerHTML = `<span class="text-amber-600">Nessun mezzo registrato nel cantiere. La tabella sarà vuota.</span>`;
      chk.disabled = true;
      chk.checked = false;
    } else {
      lbl.innerHTML = `${presenti} mezzi/attrezzature riscontrati.`;
      chk.disabled = false;
    }
  } catch (err) {
    lbl.innerText = 'Errore caricamento mezzi.';
  }
};

// ─────────────────────────────────────────────
// 7. FLUSSO 1 — Presenti al Sopralluogo con firma individuale
// ─────────────────────────────────────────────

/** Contatore righe presenti */
window._presentiSopralluogoCount = 0;
/** Array firme presenti (indexato per rowIndex) */
window._firmePresenti = [];

const RUOLI_PRESENTI = [
  { value: 'RL',           label: 'R.L. (Responsabile dei Lavori)' },
  { value: 'DL',           label: 'D.L. (Direttore dei Lavori)' },
  { value: 'Capocantiere', label: 'Capo cantiere' },
  { value: 'Preposto',     label: 'Preposto' },
  { value: 'RLS',          label: 'R.L.S. (Rappresentante Lavoratori)' },
  { value: 'Operaio',      label: 'Operaio' },
  { value: 'Tecnico',      label: 'Tecnico di cantiere' },
  { value: 'Altro',        label: 'Altro' }
];

const MAX_PRESENTI = 15;

/**
 * Aggiunge una riga "Presente" nel form sopralluogo
 */
function aggiungiPresenteSopralluogo() {
  if (window._presentiSopralluogoCount >= MAX_PRESENTI) {
    if (typeof showToast === 'function') showToast(`Massimo ${MAX_PRESENTI} presenti raggiunto.`, 'warning');
    return;
  }

  const list = document.getElementById('presenti-sopralluogo-list');
  if (!list) return;

  const idx = window._presentiSopralluogoCount;
  window._presentiSopralluogoCount++;

  // Garantisci slot nell'array firme
  if (!window._firmePresenti[idx]) window._firmePresenti[idx] = null;

  const ruoliOpts = RUOLI_PRESENTI.map(r => `<option value="${r.value}">${r.label}</option>`).join('');

  const row = document.createElement('div');
  row.id = `presente-row-${idx}`;
  row.className = 'bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2';
  row.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-bold text-slate-500 uppercase">#${idx + 1}</span>
      <button type="button" onclick="rimuoviPresenteSopralluogo(${idx})"
              class="text-xs text-red-500 hover:text-red-700 font-semibold focus:outline-none"
              aria-label="Rimuovi presente ${idx + 1}">✕ Rimuovi</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div class="sm:col-span-2">
        <input id="presente-nome-${idx}" type="text" placeholder="Nome e Cognome"
               class="w-full border border-slate-300 rounded-lg p-2 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none">
      </div>
      <div>
        <select id="presente-ruolo-${idx}"
                class="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white
                       focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="">— Ruolo —</option>
          ${ruoliOpts}
        </select>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button type="button" onclick="apriCanvasFirmaPresente(${idx})"
              class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
        ✍️ Firma
      </button>
      <span id="presente-firma-stato-${idx}" class="text-xs text-slate-400">Non firmato</span>
    </div>
  `;

  list.appendChild(row);
  _aggiornaContatorePresenti();
}

/**
 * Rimuove una riga presente
 */
function rimuoviPresenteSopralluogo(idx) {
  const row = document.getElementById(`presente-row-${idx}`);
  if (row) row.remove();
  window._firmePresenti[idx] = null;
  _aggiornaContatorePresenti();
}

function _aggiornaContatorePresenti() {
  const countEl = document.getElementById('presenti-count');
  if (!countEl) return;
  const righePresenti = document.querySelectorAll('[id^="presente-row-"]').length;
  countEl.textContent = `${righePresenti}/${MAX_PRESENTI} presenti`;
  countEl.classList.toggle('hidden', righePresenti === 0);
}

/**
 * Apre un modal a schermo intero con canvas firma per il presente
 */
function apriCanvasFirmaPresente(idx) {
  const nome = document.getElementById(`presente-nome-${idx}`)?.value || `Presente #${idx + 1}`;

  // Rimuovi modal precedente se esiste
  const old = document.getElementById('modal-firma-presente');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-firma-presente';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const canvasId = `firma-presente-canvas-${idx}`;

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-slate-800">✍️ Firma di ${escapeHtml(nome)}</h3>
        <button onclick="document.getElementById('modal-firma-presente').remove()"
                class="text-slate-400 hover:text-slate-700 text-lg font-bold focus:outline-none">&times;</button>
      </div>

      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div class="relative bg-white">
          <canvas id="${canvasId}"
                  width="600" height="180"
                  class="w-full touch-none cursor-crosshair block"
                  style="max-height:180px;"
                  aria-label="Area firma ${escapeHtml(nome)}">
          </canvas>
          <div class="absolute bottom-8 left-8 right-8 h-px bg-slate-200 pointer-events-none"></div>
          <div class="absolute bottom-2 left-8 text-[10px] text-slate-300 pointer-events-none select-none">
            Firma qui — ${escapeHtml(nome)}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button type="button" onclick="_firmaClearPresente('${canvasId}')"
                class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700
                       hover:bg-red-200 focus:outline-none">
          🗑 Cancella
        </button>
        <button type="button" onclick="_firmaConfermaPresenteModal(${idx}, '${canvasId}')"
                class="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          ✅ Conferma Firma
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Inizializza canvas
  setTimeout(() => _initCanvasPresente(canvasId), 100);
}

/** Inizializza gli eventi touch/mouse sul canvas firma presente */
function _initCanvasPresente(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x; lastY = pos.y;
  }
  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x; lastY = pos.y;
  }
  function stopDraw() { drawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
}

function _firmaClearPresente(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function _firmaConfermaPresenteModal(idx, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dataURL = canvas.toDataURL('image/png');
  const tsISO = new Date().toISOString();
  const nome = document.getElementById(`presente-nome-${idx}`)?.value || `Presente #${idx + 1}`;

  // Salva nell'array globale
  window._firmePresenti[idx] = {
    png: dataURL,
    timestamp: tsISO,
    firmante: nome
  };

  // Aggiorna badge stato
  const statoEl = document.getElementById(`presente-firma-stato-${idx}`);
  if (statoEl) {
    statoEl.innerHTML = `<span class="text-green-600 font-semibold">✅ Firmato</span>`;
  }

  // Chiudi modal
  const modal = document.getElementById('modal-firma-presente');
  if (modal) modal.remove();

  if (typeof showToast === 'function') showToast(`Firma di ${nome} acquisita ✓`, 'success');
}

/**
 * Raccoglie tutti i presenti con firme per il salvataggio
 * @returns {Array} [{nome, ruolo, firmaBase64, timestampFirma}]
 */
function _raccogliPresenti() {
  const presenti = [];
  for (let i = 0; i < window._presentiSopralluogoCount; i++) {
    const row = document.getElementById(`presente-row-${i}`);
    if (!row) continue; // riga rimossa

    const nome = (document.getElementById(`presente-nome-${i}`)?.value || '').trim();
    const ruolo = document.getElementById(`presente-ruolo-${i}`)?.value || '';
    const firma = window._firmePresenti[i];

    if (!nome) continue; // ignora righe senza nome

    presenti.push({
      nome,
      ruolo,
      firmaBase64: firma ? firma.png : null,
      timestampFirma: firma ? firma.timestamp : null
    });
  }
  return presenti;
}

/**
 * Raccoglie i dati di delega CSE
 * @returns {Object|null} {nome, qualifica, attoDelega} o null se non delegato
 */
function _raccogliDelegaCSE() {
  const chk = document.getElementById('cse-delegato');
  if (!chk || !chk.checked) return null;

  return {
    nome:       (document.getElementById('delegato-nome')?.value || '').trim(),
    qualifica:  (document.getElementById('delegato-qualifica')?.value || '').trim(),
    attoDelega: (document.getElementById('delegato-atto')?.value || '').trim()
  };
}

/** Toggle visibilità campi delega */
function toggleDelegaCSE() {
  const chk = document.getElementById('cse-delegato');
  const div = document.getElementById('dati-delegato');
  if (chk && div) {
    div.classList.toggle('hidden', !chk.checked);
  }
}

/** Reset presenti (chiamata dopo salvataggio verbale) */
function _resetPresentiSopralluogo() {
  const list = document.getElementById('presenti-sopralluogo-list');
  if (list) list.innerHTML = '';
  window._presentiSopralluogoCount = 0;
  window._firmePresenti = [];
  _aggiornaContatorePresenti();

  // Reset delega
  const chk = document.getElementById('cse-delegato');
  if (chk) chk.checked = false;
  toggleDelegaCSE();
}
