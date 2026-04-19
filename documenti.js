// documenti.js - Gestione Documenti & Normative ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Tag automatici dal nome file
// ─────────────────────────────────────────────
function generaTagsAutomatici(nome) {
  const lower = nome.toLowerCase();
  const tags  = [];

  // ── Documenti cantiere ──
  if (lower.includes('psc'))                                     tags.push('PSC');
  if (lower.includes('pos'))                                     tags.push('POS');
  if (lower.includes('dvr'))                                     tags.push('DVR');
  if (lower.includes('duvri'))                                   tags.push('DUVRI');
  if (lower.includes('pimus') || lower.includes('pim'))         tags.push('PiMUS');
  if (lower.includes('segnalet') || lower.includes('segnalam'))  tags.push('Segnaletica');
  if (lower.includes('verbale'))                                 tags.push('Verbale');
  if (lower.includes('non conform') || /\bnc\b/.test(lower))    tags.push('NC');

  // ── Normative ──
  if (lower.includes('81') || lower.includes('sicurezza'))       tags.push('D.Lgs 81/08');
  if (lower.includes('2019') || lower.includes('segnalamento'))  tags.push('D.I. 22/01/2019');
  if (lower.includes('circolare'))                               tags.push('Circolare ANAS');
  if (lower.includes('istruz') || lower.includes('ist_tec'))     tags.push('Istruzione Tecnica');
  if (lower.includes('capitolat'))                               tags.push('Capitolato');
  if (lower.includes('decreto') || lower.includes('d.lgs'))      tags.push('Decreto');
  if (lower.includes('uni ') || lower.includes('en ') ||
      lower.includes('iso '))                                    tags.push('Norma UNI/EN/ISO');
  if (lower.includes('codice appalti') || lower.includes('dlgs36'))
                                                                 tags.push('Codice Appalti');

  // ── ODS — Ordini di Servizio ──
  if (lower.includes('ods') || lower.includes('ordine di serv') ||
      lower.includes('ord_serv') || lower.includes('ordserv') ||
      lower.includes('ordine_di_serv'))                           tags.push('ODS');
  if (lower.includes('ordine di lavoro') || lower.includes('ord_lav'))
                                                                 tags.push('Ordine di Lavoro');
  if (lower.includes('disposizione'))                            tags.push('Disposizione');
  if (lower.includes('diffida'))                                 tags.push('Diffida');
  if (lower.includes('comunicaz') && lower.includes('anas'))     tags.push('Comunicazione ANAS');

  return tags;
}

// ─────────────────────────────────────────────
// 2. Salvataggio documenti (da FileList)
// ─────────────────────────────────────────────
async function handleFiles(files) {
  let saved = 0;
  for (const file of files) {
    const doc = {
      id:    'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      nome:  file.name,
      tipo:  file.type,
      size:  file.size,
      data:  new Date().toISOString(),
      tags:  generaTagsAutomatici(file.name),
      blob:  file
    };
    try {
      await salvaDocumentoInDB(doc);
      saved++;
    } catch (err) {
      showToast('Errore salvataggio documento: ' + file.name, 'error');
    }
  }

  if (saved > 0) {
    showToast(`${saved} documento/i caricato/i correttamente ✓`, 'success');
    renderDocumenti();
  }
}

// ─────────────────────────────────────────────
// 3. Rendering lista documenti — vedi sezione 11 (con filtro categoria)
//    (la definizione principale è più sotto, con supporto filtro per tab)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 4. Download documento
// ─────────────────────────────────────────────
async function scaricaDocumento(id) {
  const doc = await getItem('documenti', id);
  if (!doc) { showToast('Documento non trovato.', 'error'); return; }

  const url = URL.createObjectURL(doc.blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = doc.nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// 5. Helper: formatta byte in KB/MB
// ─────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '–';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─────────────────────────────────────────────
// 6. Stato tab attivo
// ─────────────────────────────────────────────
let _docTabAttivo = 'tutti';

// Mappa tag → categoria (per filtro tab)
const _CATEGORIA_TAG = {
  cantiere:  ['PSC','POS','DVR','DUVRI','PiMUS','Segnaletica','Verbale','NC',
               'Patente','DURC','Polizza','Iscrizione CCIAA','Idoneità','DPI','Collaudo'],
  normative: ['D.Lgs 81/08','D.I. 22/01/2019','Circolare ANAS','Istruzione Tecnica',
               'Capitolato','Decreto','Norma UNI/EN/ISO','Codice Appalti','Formazione'],
  ods:       ['ODS','Ordine di Lavoro','Disposizione','Diffida','Comunicazione ANAS']
};

function _categoriaDocumento(doc) {
  const tags = doc.tags || [];
  for (const [cat, tagList] of Object.entries(_CATEGORIA_TAG)) {
    if (tags.some(t => tagList.includes(t))) return cat;
  }
  return 'cantiere'; // default
}

// ─────────────────────────────────────────────
// 7. Switch Tab documenti
// ─────────────────────────────────────────────
async function switchDocTab(tabId) {
  _docTabAttivo = tabId;

  // Aggiorna bottoni tab
  document.querySelectorAll('.doc-tab-btn').forEach(btn => {
    const isActive = btn.dataset.docTab === tabId;
    btn.classList.toggle('doc-tab-active',   isActive);
    btn.classList.toggle('bg-slate-900',     isActive);
    btn.classList.toggle('text-white',       isActive);
    btn.classList.toggle('bg-slate-200',    !isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Mostra/nascondi drop area corretta
  ['tutti','cantiere','normative','ods'].forEach(id => {
    const panel = document.getElementById(`panel-doc-${id}`);
    if (panel) panel.classList.toggle('hidden', id !== tabId && !(tabId==='tutti' && id==='tutti'));
  });
  // "Tutti" mostra drop-area del cantiere (default)
  if (tabId === 'tutti') {
    document.getElementById('panel-doc-tutti')?.classList.remove('hidden');
  }

  // Renderizza lista filtrata
  await renderDocumenti(tabId === 'tutti' ? null : tabId);
  aggiornaBadgeODS();
}

// ─────────────────────────────────────────────
// 8. Badge ODS
// ─────────────────────────────────────────────
async function aggiornaBadgeODS() {
  const docs = await getDocumenti();
  const count = docs.filter(d => _categoriaDocumento(d) === 'ods').length;
  const badge = document.getElementById('badge-ods');
  if (badge) badge.textContent = count;
}

// ─────────────────────────────────────────────
// 9. Wire drop area generica (helper riusabile)
// ─────────────────────────────────────────────
function _wireDropArea(dropAreaId, fileInputId, categoria) {
  const dropArea = document.getElementById(dropAreaId);
  const fileElem = document.getElementById(fileInputId);
  if (!dropArea || !fileElem) return;

  const hoverOn  = dropAreaId === 'drop-area-ods'
    ? ['border-green-500', 'bg-green-100']
    : dropAreaId === 'drop-area-normative'
      ? ['border-indigo-500', 'bg-indigo-100']
      : ['border-blue-500', 'bg-blue-50'];
  const hoverOff = hoverOn;

  dropArea.addEventListener('dragover',  (e) => { e.preventDefault(); hoverOn.forEach(c => dropArea.classList.add(c)); });
  dropArea.addEventListener('dragleave', ()  => { hoverOff.forEach(c => dropArea.classList.remove(c)); });
  dropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    hoverOff.forEach(c => dropArea.classList.remove(c));
    await handleFilesConCategoria(e.dataTransfer.files, categoria);
  });
  fileElem.addEventListener('change', async () => {
    await handleFilesConCategoria(fileElem.files, categoria);
    fileElem.value = '';
  });
}

// ─────────────────────────────────────────────
// 10. handleFiles con categoria forzata
// ─────────────────────────────────────────────
async function handleFilesConCategoria(files, categoriaForzata) {
  if (!files || files.length === 0) return;
  const MAX_MB = 10;
  const ok = [], skip = [];

  for (const file of files) {
    if (file.size > MAX_MB * 1024 * 1024) { skip.push(file.name); continue; }

    let tags = generaTagsAutomatici(file.name);

    // Se la categoria è forzata e non c'è già un tag della categoria, aggiunge il tag principale
    if (categoriaForzata === 'ods'       && !tags.includes('ODS'))             tags.push('ODS');
    if (categoriaForzata === 'normative' && !tags.some(t => _CATEGORIA_TAG.normative.includes(t)))
      tags.push('Normativa ANAS');

    const doc = {
      id:        'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
      nome:      file.name,
      tipo:      file.type || 'application/octet-stream',
      size:      file.size,
      tags,
      data:      new Date().toISOString(),
      blob:      file,
      projectId: window.appState?.currentProject || null
    };

    await saveItem('documenti', doc);
    ok.push(file.name);
  }

  if (skip.length) showToast(`${skip.length} file troppo grandi (>10MB) saltati.`, 'warning');
  if (ok.length)   showToast(`${ok.length} document${ok.length>1?'i':''} caricati ✓`, 'success');

  await renderDocumenti(_docTabAttivo === 'tutti' ? null : _docTabAttivo);
  await aggiornaBadgeODS();
}

// ─────────────────────────────────────────────
// 11. renderDocumenti con filtro categoria
// ─────────────────────────────────────────────
async function renderDocumenti(categoriaFiltro) {
  const container = document.getElementById('documenti-list');
  if (!container) return;

  let docs = await getDocumenti();
  docs = docs.sort((a, b) => new Date(b.data) - new Date(a.data));

  // Filtro per categoria tab
  if (categoriaFiltro && categoriaFiltro !== 'tutti') {
    docs = docs.filter(d => _categoriaDocumento(d) === categoriaFiltro);
  }

  // Filtro per ricerca testuale (search-doc o search-ods)
  const searchVal = (document.getElementById('search-ods')?.value ||
                     document.getElementById('search-doc')?.value || '').trim().toLowerCase();
  if (searchVal) {
    docs = docs.filter(d =>
      d.nome?.toLowerCase().includes(searchVal) ||
      (d.tags || []).some(t => t.toLowerCase().includes(searchVal))
    );
  }

  if (!docs || docs.length === 0) {
    const etichetta = categoriaFiltro === 'ods' ? 'Ordini di Servizio'
      : categoriaFiltro === 'normative' ? 'normative'
      : 'documenti';
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <div class="text-4xl mb-2">📭</div>
        <p class="text-sm font-medium">Nessun ${etichetta} caricato.</p>
        <p class="text-xs mt-1">Trascina i file nell'area sopra.</p>
      </div>`;
    return;
  }

  container.innerHTML = docs.map(d => {
    const nome   = escapeHtml(d.nome);
    const tags   = (d.tags || []).map(t => escapeHtml(t)).join(' · ') || 'Nessun tag';
    const catBadge = _categoriaDocumento(d);
    const catColor = catBadge === 'ods' ? 'bg-green-100 text-green-800'
      : catBadge === 'normative'        ? 'bg-indigo-100 text-indigo-800'
      : 'bg-slate-100 text-slate-600';
    const catLabel = catBadge === 'ods' ? 'ODS'
      : catBadge === 'normative'        ? 'Normativa'
      : 'Cantiere';

    return `
    <div class="p-4 bg-white rounded-xl border border-slate-200 shadow-sm
                flex items-center justify-between gap-4"
         role="listitem"
         aria-label="Documento: ${nome}">

      <div class="flex items-center space-x-4 min-w-0">
        ${renderAnteprimaIcona(d)}
        <div class="min-w-0">
          <div class="font-bold text-slate-800 truncate">${nome}</div>
          <div class="text-xs text-slate-500 mt-0.5">${formatBytes(d.size || 0)}</div>
          <div class="text-xs text-slate-400 mt-0.5">${tags}</div>
          <span class="inline-block text-xs px-1.5 py-0.5 rounded ${catColor} mt-1 font-semibold">
            ${catLabel}
          </span>
        </div>
      </div>

      <div class="flex gap-2 shrink-0 flex-wrap">
        <button onclick="mostraPreviewDocumento('${d.id}')"
                class="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg
                       hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Anteprima ${nome}">
          Anteprima
        </button>
        <button onclick="scaricaDocumento('${d.id}')"
                class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Scarica ${nome}">
          Scarica
        </button>
        <button onclick="apriModalModificaDocumento('${d.id}')"
                class="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Modifica tag e scadenza ${nome}">
          ✏️ Tag
        </button>
        <button onclick="confermaEliminaDocumento('${d.id}', '${nome}')"
                class="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                aria-label="Elimina ${nome}">
          🗑️
        </button>
      </div>

    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// 12. Init — wire tutti gli elementi DOM
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Drop area Documenti cantiere (default)
  _wireDropArea('drop-area', 'fileElem', 'cantiere');

  // Drop area Normative
  _wireDropArea('drop-area-normative', 'fileElem-normative', 'normative');

  // Drop area ODS
  _wireDropArea('drop-area-ods', 'fileElem-ods', 'ods');

  // Ricerca globale live
  document.getElementById('search-doc')?.addEventListener('input', async (e) => {
    await renderDocumenti(_docTabAttivo === 'tutti' ? null : _docTabAttivo);
  });

  // Ricerca ODS dedicata live
  document.getElementById('search-ods')?.addEventListener('input', async () => {
    await renderDocumenti('ods');
  });

  // Tab documenti (inizializzati ma non attivati qui — switchDocTab viene chiamato
  // da switchView('documenti') in ANAS_CSE_html.html)
  // Aggiunta stile base al tab attivo via CSS inline se Tailwind non ha la classe
  const style = document.createElement('style');
  style.textContent = '.doc-tab-active { background-color: #0f172a; color: white; }';
  document.head.appendChild(style);

  // Caricamento iniziale lista documenti
  if (document.getElementById('documenti-list')) {
    renderDocumenti();
    aggiornaBadgeODS();
  }
});



// ─────────────────────────────────────────────
// GAP-7: Elimina documento con conferma
// ─────────────────────────────────────────────
async function confermaEliminaDocumento(id, nomeDoc) {
  // nomeDoc potrebbe essere già escaped, ma per sicurezza usiamo textContent
  const nomeSafe = typeof escapeHtml === 'function' ? escapeHtml(nomeDoc) : nomeDoc;
  const modal = document.createElement('div');
  modal.id        = 'modal-elimina-doc';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 text-center">
      <div class="text-4xl">🗑️</div>
      <h2 class="text-base font-bold text-slate-800">Elimina Documento</h2>
      <p class="text-sm text-slate-600">
        Vuoi eliminare <strong id="nome-doc-elimina"></strong>?<br>
        <span class="text-red-600 text-xs">Il file verrà rimosso da IndexedDB. Irreversibile.</span>
      </p>
      <div class="flex justify-center gap-3 pt-2">
        <button onclick="document.getElementById('modal-elimina-doc').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button id="btn-conferma-elimina-doc"
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
          🗑️ Elimina
        </button>
      </div>
    </div>
  `;
  // Inserisci il nome via textContent per prevenire XSS
  modal.querySelector('#nome-doc-elimina').textContent = nomeDoc;
  // Usa addEventListener invece di onclick inline per evitare injection via id
  modal.querySelector('#btn-conferma-elimina-doc').addEventListener('click', () => _eseguiEliminaDocumento(id));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);
  if (typeof trapFocus === 'function') trapFocus(modal);
}

async function _eseguiEliminaDocumento(id) {
  await eliminaDocumento(id);   // definita in documenti-indexeddb.js
  document.getElementById('modal-elimina-doc')?.remove();
  await renderDocumenti();
  showToast('Documento eliminato.', 'info');
}

// ─────────────────────────────────────────────
// GAP-8: Modal modifica tag e data scadenza
// ─────────────────────────────────────────────
async function apriModalModificaDocumento(id) {
  const doc = await getItem('documenti', id);
  if (!doc) { showToast('Documento non trovato.', 'error'); return; }

  document.getElementById('modal-modifica-doc')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-modifica-doc';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  // Tag predefiniti suggeriti
  const tagSuggeriti = ['PSC', 'POS', 'DVR', 'Segnaletica', 'DUVRI', 'Patente',
                        'Iscrizione CCIAA', 'Polizza', 'DURC', 'Idoneità',
                        'Formazione', 'DPI', 'PiMUS', 'Collaudo'];

  const tagsAttuali = (doc.tags || []).join(', ');
  const scadenza    = doc.dataScadenza ? doc.dataScadenza.slice(0, 10) : '';
  const nomeSafe    = escapeHtml(doc.nome);

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
      <h2 class="text-base font-bold text-slate-800">✏️ Modifica Documento</h2>
      <div class="text-xs text-slate-500 truncate">${nomeSafe}</div>

      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Tag (separati da virgola)</label>
        <input id="mod-doc-tags" type="text"
               value="${escapeHtml(tagsAttuali)}"
               placeholder="Es. PSC, Formazione, Idoneità"
               class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        <div class="flex flex-wrap gap-1.5 mt-2">
          ${tagSuggeriti.map(t => `
            <button type="button"
                    onclick="_aggiungiTagSuggerito('${t}')"
                    class="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full
                           hover:bg-blue-100 hover:text-blue-800 border border-slate-200
                           focus:outline-none transition">
              + ${t}
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">
          Data Scadenza
          <span class="text-slate-400 font-normal">(opzionale — per alert scadenze)</span>
        </label>
        <input id="mod-doc-scadenza" type="date"
               value="${escapeHtml(scadenza)}"
               class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        <button type="button"
                onclick="document.getElementById('mod-doc-scadenza').value=''"
                class="text-xs text-slate-400 hover:text-red-500 mt-1 underline focus:outline-none">
          Rimuovi scadenza
        </button>
      </div>

      <div class="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button onclick="document.getElementById('modal-modifica-doc').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaModificaDocumento('${id}')"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          ✅ Salva
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);
  if (typeof trapFocus === 'function') trapFocus(modal);
  modal.querySelector('#mod-doc-tags').focus();
}

function _aggiungiTagSuggerito(tag) {
  const input = document.getElementById('mod-doc-tags');
  if (!input) return;
  const attuali = input.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!attuali.includes(tag)) {
    input.value = [...attuali, tag].join(', ');
  }
}

async function confermaModificaDocumento(id) {
  const tagsRaw  = document.getElementById('mod-doc-tags')?.value    || '';
  const scadenza = document.getElementById('mod-doc-scadenza')?.value || '';

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const doc = await getItem('documenti', id);
  if (!doc) { showToast('Documento non trovato.', 'error'); return; }

  const updated = {
    ...doc,
    tags,
    dataScadenza: scadenza || null,
    updatedAt:    new Date().toISOString()
  };

  await saveItem('documenti', { ...updated, blob: doc.blob }); // mantieni il blob
  document.getElementById('modal-modifica-doc')?.remove();
  await renderDocumenti();
  showToast('Documento aggiornato ✓', 'success');
}
