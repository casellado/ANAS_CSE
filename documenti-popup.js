// documenti-popup.js - Popup selezione documenti da collegare
// Migliorato: documenti ordinati per ultimo salvataggio, ricerca live con suggerimenti

async function apriPopupCollegamento(tipo, riferimentoId) {
  const existing = document.getElementById('popup-collega-doc');
  if (existing) existing.remove();

  let docs = await getDocumenti();
  // Ordina per data (più recenti prima)
  docs = docs.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

  const modal = document.createElement('div');
  modal.id        = 'popup-collega-doc';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'popup-collega-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col overflow-hidden">

      <div class="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
        <h3 id="popup-collega-title" class="text-lg font-bold text-slate-800">
          🔗 Collega Documenti
        </h3>
        <button onclick="chiudiPopupCollegamento()"
                class="text-slate-400 hover:text-slate-800 text-2xl leading-none
                       focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                aria-label="Chiudi popup">✕</button>
      </div>

      <div class="p-3 border-b border-slate-100 shrink-0">
        <input id="popup-doc-search"
               type="search"
               placeholder="🔍 Digita per cercare (es. pos, psc, dvr, verbale...)"
               class="w-full p-2.5 rounded-lg border border-slate-300 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none"
               autocomplete="off"
               aria-label="Cerca documento da collegare" />
        <div id="popup-doc-count" class="text-[10px] text-slate-400 mt-1 px-1">
          ${docs.length} documenti disponibili · Ordinati per data (più recenti in alto)
        </div>
      </div>

      <div id="popup-doc-list"
           class="flex-1 overflow-auto p-3 space-y-2"
           role="list"
           aria-label="Lista documenti selezionabili">
        ${docs.length > 0
          ? docs.map(d => renderRigaDocumentoPopup(d)).join('')
          : '<p class="text-sm text-slate-400 text-center py-8">Nessun documento disponibile.<br>Carica prima un documento nella sezione Documenti.</p>'
        }
      </div>

      <div class="p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
        <div id="popup-doc-selected" class="text-xs text-slate-500">0 selezionati</div>
        <div class="flex gap-3">
          <button onclick="chiudiPopupCollegamento()"
                  class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                         hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
            Annulla
          </button>
          <button onclick="confermaCollegamento('${tipo}', '${riferimentoId}')"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            ✅ Collega Selezionati
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) chiudiPopupCollegamento(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiPopupCollegamento(); });

  // Ricerca live con debounce
  const searchInput = document.getElementById('popup-doc-search');
  let _debounceTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => filtraPopupDocumenti(e.target.value), 150);
  });

  // Traccia selezioni
  modal.addEventListener('change', (e) => {
    if (e.target.classList.contains('doc-select-checkbox')) {
      _aggiornaContatoreSelezionati();
    }
  });

  // Focus sulla ricerca
  searchInput.focus();
}

function chiudiPopupCollegamento() {
  document.getElementById('popup-collega-doc')?.remove();
}

function _formattaDataDocumento(dataISO) {
  if (!dataISO) return '';
  try {
    const d = new Date(dataISO);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
         + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

function _formattaBytesPopup(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderRigaDocumentoPopup(doc) {
  const dataFmt = _formattaDataDocumento(doc.data || doc.updatedAt);
  const sizeFmt = _formattaBytesPopup(doc.size);
  const tagsStr = (doc.tags || []).join(' · ') || '';

  return `
    <label class="flex items-center justify-between p-3 bg-white border border-slate-200
                  rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition"
           role="listitem">
      <div class="flex items-center gap-3 min-w-0">
        <input type="checkbox"
               class="doc-select-checkbox w-4 h-4 rounded accent-blue-600"
               value="${doc.id}"
               aria-label="Seleziona ${doc.nome}" />
        ${typeof renderAnteprimaIcona === 'function' ? renderAnteprimaIcona(doc) : '📄'}
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${doc.nome}</div>
          <div class="flex items-center gap-2 mt-0.5">
            ${tagsStr ? `<span class="text-xs text-blue-600 font-medium">${tagsStr}</span>` : ''}
            ${sizeFmt ? `<span class="text-[10px] text-slate-400">${sizeFmt}</span>` : ''}
          </div>
          ${dataFmt ? `<div class="text-[10px] text-slate-400 mt-0.5">📅 ${dataFmt}</div>` : ''}
        </div>
      </div>
      <button onclick="mostraPreviewDocumento('${doc.id}'); event.preventDefault(); event.stopPropagation();"
              class="shrink-0 ml-2 text-xs bg-slate-700 text-white px-2 py-1 rounded
                     hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Anteprima ${doc.nome}">
        Anteprima
      </button>
    </label>
  `;
}

async function filtraPopupDocumenti(term) {
  const lower    = (term || '').trim().toLowerCase();
  let docs       = await getDocumenti();
  // Ordina sempre per data (più recenti prima)
  docs = docs.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

  const filtrati = lower
    ? docs.filter(d =>
        (d.nome || '').toLowerCase().includes(lower) ||
        (d.tags || []).some(t => t.toLowerCase().includes(lower))
      )
    : docs;

  const list = document.getElementById('popup-doc-list');
  if (!list) return;

  const countEl = document.getElementById('popup-doc-count');

  if (filtrati.length > 0) {
    list.innerHTML = filtrati.map(d => renderRigaDocumentoPopup(d)).join('');
    if (countEl) {
      countEl.textContent = lower
        ? `${filtrati.length} risultati per "${term}" · Ordinati per data`
        : `${filtrati.length} documenti disponibili · Ordinati per data (più recenti in alto)`;
    }
  } else {
    list.innerHTML = `
      <div class="text-center py-8">
        <div class="text-3xl mb-2">🔍</div>
        <p class="text-sm text-slate-500">Nessun documento trovato per "<strong>${term || ''}</strong>".</p>
        <p class="text-xs text-slate-400 mt-1">Prova con meno caratteri o controlla nella sezione Documenti.</p>
      </div>`;
    if (countEl) countEl.textContent = '0 risultati';
  }
}

function _aggiornaContatoreSelezionati() {
  const count = document.querySelectorAll('.doc-select-checkbox:checked').length;
  const el = document.getElementById('popup-doc-selected');
  if (el) {
    el.textContent = count > 0 ? `${count} selezionato/i` : '0 selezionati';
    el.classList.toggle('text-blue-600', count > 0);
    el.classList.toggle('font-semibold', count > 0);
    el.classList.toggle('text-slate-500', count === 0);
  }
}

async function confermaCollegamento(tipo, riferimentoId) {
  const checkboxes = document.querySelectorAll('.doc-select-checkbox:checked');

  if (checkboxes.length === 0) {
    showToast('Seleziona almeno un documento.', 'warning');
    return;
  }

  let count = 0;
  for (const cb of checkboxes) {
    try {
      await collegaDocumentoARiferimento(cb.value, tipo, riferimentoId);
      count++;
    } catch (_) {}
  }

  chiudiPopupCollegamento();

  // Aggiorna UI documento collegato
  const containerId = tipo === 'verbale'    ? 'documenti-verbale'
                    : tipo === 'nc'         ? 'documenti-nc'
                    : tipo === 'impresa'    ? 'documenti-impresa'
                    : tipo === 'lavoratore' ? 'documenti-lavoratore'
                    : null;

  if (containerId) {
    await renderDocumentiCollegati(containerId, tipo, riferimentoId);
  }

  showToast(`${count} documento/i collegato/i correttamente ✓`, 'success');
}
