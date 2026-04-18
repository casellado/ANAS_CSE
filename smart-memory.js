// smart-memory.js — Memoria Intelligente Campi Frequenti
// Salva in localStorage i valori inseriti e suggerisce gli ultimi usati
// Geom. Dogano Casella — Ispettore ANAS SpA

// ─────────────────────────────────────────────
// CONFIGURAZIONE — campi da ricordare
// ─────────────────────────────────────────────
const MEMORY_FIELDS = {
  // Verbale
  'verbale-km':           { label: 'Progressiva KM', max: 8 },
  'verbale-oggetto':      { label: 'Oggetto sopralluogo', max: 5 },
  'verbale-referenti':    { label: 'Referenti presenti', max: 5 },
  'verbale-stato-luoghi': { label: 'Stato dei luoghi', max: 5 },
  'verbale-note':         { label: 'Note CSE', max: 5 },

  // Anagrafica imprese
  'ragione_sociale':      { label: 'Ragione sociale', max: 10 },
  'referente':            { label: 'Referente', max: 8 },
  'contatto':             { label: 'Contatto', max: 8 },

  // Cantiere
  'nc-loc':               { label: 'Localizzazione', max: 8 },

  // NC
  'nc-titolo':            { label: 'Titolo NC', max: 6 },
};

const STORAGE_KEY  = 'safehub_field_memory';
const DROPDOWN_ID  = 'smart-memory-dropdown';

// ─────────────────────────────────────────────
// 1. Lettura / scrittura localStorage
// ─────────────────────────────────────────────
function _loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) { return {}; }
}

function _saveMemory(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

/** Aggiunge un valore alla lista di un campo */
function _recordValue(fieldId, value) {
  const v = (value || '').trim();
  if (!v || v.length < 3) return; // ignora valori troppo corti

  const mem    = _loadMemory();
  const config = MEMORY_FIELDS[fieldId];
  if (!config) return;

  if (!mem[fieldId]) mem[fieldId] = [];

  // Rimuovi duplicato se esiste
  mem[fieldId] = mem[fieldId].filter(x => x !== v);

  // Aggiungi in cima (più recente = primo)
  mem[fieldId].unshift(v);

  // Mantieni solo gli ultimi N valori
  if (mem[fieldId].length > config.max) {
    mem[fieldId] = mem[fieldId].slice(0, config.max);
  }

  _saveMemory(mem);
}

/** Restituisce i valori memorizzati per un campo */
function _getValues(fieldId, query) {
  const mem  = _loadMemory();
  const list = mem[fieldId] || [];
  if (!query) return list;
  const q = query.toLowerCase();
  return list.filter(v => v.toLowerCase().includes(q));
}

// ─────────────────────────────────────────────
// 2. Dropdown suggerimenti
// ─────────────────────────────────────────────
function _showDropdown(field, values) {
  _hideDropdown();
  if (!values || values.length === 0) return;

  const rect = field.getBoundingClientRect();

  const dd = document.createElement('div');
  dd.id        = DROPDOWN_ID;
  dd.className = [
    'fixed z-[9990]',
    'bg-white border border-slate-200 rounded-xl shadow-2xl',
    'overflow-hidden',
    'max-h-52 overflow-y-auto'
  ].join(' ');

  dd.style.top   = `${rect.bottom + window.scrollY + 4}px`;
  dd.style.left  = `${rect.left  + window.scrollX}px`;
  dd.style.width = `${rect.width}px`;
  dd.setAttribute('role', 'listbox');
  dd.setAttribute('aria-label', 'Valori suggeriti');

  values.forEach((v, i) => {
    const item = document.createElement('div');
    item.className = [
      'px-4 py-2.5 text-sm cursor-pointer',
      'hover:bg-blue-50 hover:text-blue-800',
      'flex items-center justify-between gap-3',
      i > 0 ? 'border-t border-slate-100' : ''
    ].join(' ');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');

    item.innerHTML = `
      <span class="truncate flex-1">${escapeHtml(v)}</span>
      <span class="text-slate-300 text-xs shrink-0">↵</span>
    `;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // evita blur sul field
      field.value = v;
      _hideDropdown();

      // Trigger input event per ricerche live
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });

    dd.appendChild(item);
  });

  // Aggiunge in fondo il link "Cancella memoria campo"
  const clear = document.createElement('div');
  clear.className = 'px-4 py-2 text-xs text-slate-400 hover:text-red-500 cursor-pointer border-t border-slate-100 text-right';
  clear.textContent = '🗑 Cancella suggerimenti per questo campo';
  clear.addEventListener('mousedown', (e) => {
    e.preventDefault();
    _clearField(field.id);
    _hideDropdown();
    showToast('Suggerimenti cancellati.', 'info');
  });
  dd.appendChild(clear);

  document.body.appendChild(dd);
}

function _hideDropdown() {
  document.getElementById(DROPDOWN_ID)?.remove();
}

function _clearField(fieldId) {
  const mem = _loadMemory();
  delete mem[fieldId];
  _saveMemory(mem);
}

// ─────────────────────────────────────────────
// 3. Wire un singolo campo
// ─────────────────────────────────────────────
function _wireField(field) {
  const fieldId = field.id;
  if (!MEMORY_FIELDS[fieldId]) return;
  if (field.dataset.memoryWired) return; // evita doppio wiring
  field.dataset.memoryWired = '1';

  // Focus → mostra ultimi valori usati (senza filtro)
  field.addEventListener('focus', () => {
    const values = _getValues(fieldId, '');
    if (values.length > 0) _showDropdown(field, values);
  });

  // Input → filtra suggerimenti in tempo reale
  field.addEventListener('input', () => {
    const q      = field.value.trim();
    const values = _getValues(fieldId, q);
    if (values.length > 0 && q.length >= 1) {
      _showDropdown(field, values);
    } else {
      _hideDropdown();
    }
  });

  // Blur → salva il valore e nascondi dropdown
  field.addEventListener('blur', () => {
    // Piccolo delay per permettere il click sulle opzioni
    setTimeout(() => {
      _recordValue(fieldId, field.value);
      _hideDropdown();
    }, 150);
  });

  // Escape → chiudi dropdown
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { _hideDropdown(); field.blur(); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = document.querySelector(`#${DROPDOWN_ID} div[role="option"]`);
      first?.focus();
    }
  });
}

// Navigazione tastiera nel dropdown
document.addEventListener('keydown', (e) => {
  const dd = document.getElementById(DROPDOWN_ID);
  if (!dd) return;
  const items = Array.from(dd.querySelectorAll('[role="option"]'));
  const idx   = items.indexOf(document.activeElement);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[Math.min(idx + 1, items.length - 1)]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx <= 0) _hideDropdown();
    else items[idx - 1]?.focus();
  } else if (e.key === 'Enter' && idx >= 0) {
    e.preventDefault();
    items[idx]?.dispatchEvent(new MouseEvent('mousedown'));
  }
});

// Chiudi se si clicca fuori
document.addEventListener('click', (e) => {
  if (!e.target.closest(`#${DROPDOWN_ID}`)) _hideDropdown();
});

// ─────────────────────────────────────────────
// 4. Wire automatico — osserva tutti i campi
//    (si attiva anche su elementi aggiunti dopo)
// ─────────────────────────────────────────────
function wireMemoryFields() {
  Object.keys(MEMORY_FIELDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) _wireField(el);
  });
}

// Osserva nuovi elementi aggiunti al DOM (modal, popup, ecc.)
// Ottimizzato: filtra solo mutation che aggiungono elementi form-related
// e debounce per evitare chiamate troppo frequenti
let _memDebounceTimer = null;

function _memHandleMutations(mutations) {
  // Filtra: ci interessano solo le mutations che aggiungono nodi contenenti input/textarea/select
  const hasRelevantAdditions = mutations.some(m => {
    if (m.type !== 'childList' || m.addedNodes.length === 0) return false;
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue; // solo element nodes
      // Controlla se il nodo aggiunto (o un suo figlio) è un campo monitorato
      for (const id of Object.keys(MEMORY_FIELDS)) {
        if (node.id === id) return true;
        if (node.querySelector && node.querySelector('#' + id)) return true;
      }
    }
    return false;
  });

  if (!hasRelevantAdditions) return;

  // Debounce: aspetta 150ms che il DOM si stabilizzi prima di ricablare
  if (_memDebounceTimer) clearTimeout(_memDebounceTimer);
  _memDebounceTimer = setTimeout(() => {
    wireMemoryFields();
    _memDebounceTimer = null;
  }, 150);
}

const _memObserver = new MutationObserver(_memHandleMutations);

document.addEventListener('DOMContentLoaded', () => {
  wireMemoryFields();
  // subtree necessario perché i modal sono aggiunti come figli di body
  // ma il filtro in _memHandleMutations evita re-cabling inutili
  _memObserver.observe(document.body, { childList: true, subtree: true });
});

// ─────────────────────────────────────────────
// 5. API pubblica
// ─────────────────────────────────────────────

/** Salva manualmente un valore (chiamata da altri moduli) */
function memoryRecord(fieldId, value) {
  _recordValue(fieldId, value);
}

/** Svuota tutta la memoria */
function memoryClear() {
  localStorage.removeItem(STORAGE_KEY);
  showToast('Memoria campi svuotata ✓', 'success');
}

/** Svuota la memoria di un singolo campo */
function memoryClearField(fieldId) {
  _clearField(fieldId);
}
