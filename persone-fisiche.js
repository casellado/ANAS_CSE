// persone-fisiche.js — Anagrafiche Persone Fisiche (P9)
// CSE SafeHub v2.2.14 — Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// Gestisce: RUP, RL, DL, CSP, CSE, Dirigenti, Funzionari ANAS
// Store: 'persone_fisiche' (IndexedDB)

// ─────────────────────────────────────────────
// 1. COSTANTI E UTILITÀ
// ─────────────────────────────────────────────

const RUOLI_PERSONA = [
  { value: 'RUP',         label: 'R.U.P. (Responsabile Unico del Procedimento)', color: '#2563eb', bg: '#dbeafe' },
  { value: 'RL',          label: 'R.L. (Responsabile dei Lavori)',               color: '#059669', bg: '#d1fae5' },
  { value: 'DL',          label: 'D.L. (Direttore dei Lavori)',                  color: '#d97706', bg: '#fef3c7' },
  { value: 'CSP',         label: 'C.S.P. (Coord. Sicurezza Progettazione)',      color: '#7c3aed', bg: '#ede9fe' },
  { value: 'CSE',         label: 'C.S.E. (Coord. Sicurezza Esecuzione)',         color: '#dc2626', bg: '#fee2e2' },
  { value: 'DIRIGENTE',   label: 'Dirigente ANAS',                               color: '#0f172a', bg: '#e2e8f0' },
  { value: 'FUNZIONARIO', label: 'Funzionario Tecnico',                          color: '#475569', bg: '#f1f5f9' },
  { value: 'ALTRO',       label: 'Altro',                                        color: '#64748b', bg: '#f8fafc' }
];

function _getRuoloInfo(ruoloValue) {
  return RUOLI_PERSONA.find(r => r.value === ruoloValue) || RUOLI_PERSONA[RUOLI_PERSONA.length - 1];
}

function _badgeRuolo(ruolo) {
  const info = _getRuoloInfo(ruolo);
  return `<span style="display:inline-block; font-size:10px; font-weight:700; padding:2px 8px;
    border-radius:9999px; background:${info.bg}; color:${info.color}; letter-spacing:.03em;
    text-transform:uppercase; white-space:nowrap;">${info.value}</span>`;
}

// ─────────────────────────────────────────────
// 2. SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaPersonaFisica() {
  const nome      = (document.getElementById('pf-nome')?.value || '').trim();
  const cognome   = (document.getElementById('pf-cognome')?.value || '').trim();
  const ruolo     = document.getElementById('pf-ruolo')?.value || 'ALTRO';
  const qualifica = (document.getElementById('pf-qualifica')?.value || '').trim();
  const ente      = (document.getElementById('pf-ente')?.value || '').trim();
  const email     = (document.getElementById('pf-email')?.value || '').trim();
  const telefono  = (document.getElementById('pf-telefono')?.value || '').trim();
  const cellulare = (document.getElementById('pf-cellulare')?.value || '').trim();
  const cf        = (document.getElementById('pf-cf')?.value || '').trim();
  const ordine    = (document.getElementById('pf-ordine')?.value || '').trim();
  const note      = (document.getElementById('pf-note')?.value || '').trim();

  // Validazione
  if (!nome || !cognome) {
    if (typeof showToast === 'function') showToast('Nome e Cognome sono obbligatori.', 'warning');
    return;
  }

  const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};

  const persona = {
    id:                   'pf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    ruolo,
    nome,
    cognome,
    qualifica,
    ente,
    email,
    telefono,
    cellulare,
    codiceFiscale:        cf,
    ordineProfessionale:  ordine,
    cantieriAssegnati:    [],  // gestito in fase di modifica
    note,
    modifiedAt:           new Date().toISOString(),
    modifiedBy:           imp.firmaNome || 'CSE'
  };

  try {
    await saveItem('persone_fisiche', persona);
    if (typeof showToast === 'function') showToast(`${nome} ${cognome} (${ruolo}) salvato ✓`, 'success');

    // Reset form
    document.getElementById('form-persona-fisica')?.reset();

    // Refresh lista
    await renderListaPersoneFisiche();
  } catch (err) {
    console.error('[P9] Errore salvataggio persona:', err);
    if (typeof showToast === 'function') showToast('Errore salvataggio: ' + err, 'error');
  }
}

// ─────────────────────────────────────────────
// 3. RENDERING LISTA
// ─────────────────────────────────────────────

async function renderListaPersoneFisiche() {
  const container = document.getElementById('lista-persone-fisiche');
  if (!container) return;

  let persone = [];
  try {
    persone = await getAll('persone_fisiche');
  } catch (err) {
    console.warn('[P9] Store persone_fisiche non disponibile:', err);
    container.innerHTML = `<p class="text-sm text-slate-400">Anagrafica non ancora inizializzata.</p>`;
    return;
  }

  // Filtro per ruolo
  const filtroRuolo = document.getElementById('pf-filtro-ruolo')?.value || '';
  // Filtro ricerca testo
  const filtroTesto = (document.getElementById('pf-filtro-testo')?.value || '').toLowerCase().trim();

  let filtrate = persone;
  if (filtroRuolo) filtrate = filtrate.filter(p => p.ruolo === filtroRuolo);
  if (filtroTesto) filtrate = filtrate.filter(p =>
    (p.nome + ' ' + p.cognome + ' ' + (p.qualifica || '') + ' ' + (p.ente || '')).toLowerCase().includes(filtroTesto)
  );

  // Ordina per cognome
  filtrate.sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));

  if (filtrate.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <div class="text-3xl mb-2">👤</div>
        <p class="text-sm">Nessuna persona fisica registrata${filtroRuolo ? ' per il ruolo selezionato' : ''}.</p>
        <p class="text-xs mt-1">Compila il form sopra per aggiungere un RUP, RL, DL o altro.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      ${filtrate.map(p => `
        <div class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow
                    flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              ${_badgeRuolo(p.ruolo)}
              <span class="font-bold text-slate-800 text-sm truncate">${escapeHtml(p.cognome)} ${escapeHtml(p.nome)}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 truncate">
              ${escapeHtml(p.qualifica || '–')} · ${escapeHtml(p.ente || '–')}
            </div>
            ${p.email ? `<div class="text-xs text-blue-600 mt-0.5 truncate">${escapeHtml(p.email)}</div>` : ''}
            ${p.telefono || p.cellulare ? `<div class="text-xs text-slate-400 mt-0.5">${escapeHtml(p.telefono || '')} ${p.cellulare ? '· ' + escapeHtml(p.cellulare) : ''}</div>` : ''}
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button onclick="apriModalModificaPersona('${p.id}')"
                    class="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700
                           focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
                    aria-label="Modifica ${escapeHtml(p.cognome)}">
              ✏️
            </button>
            <button onclick="eliminaPersonaFisica('${p.id}')"
                    class="text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700
                           focus:outline-none focus:ring-2 focus:ring-red-400 font-semibold"
                    aria-label="Elimina ${escapeHtml(p.cognome)}">
              🗑️
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="text-xs text-slate-400 mt-3">${filtrate.length} person${filtrate.length === 1 ? 'a' : 'e'} registrat${filtrate.length === 1 ? 'a' : 'e'}</div>
  `;
}

// ─────────────────────────────────────────────
// 4. MODAL MODIFICA
// ─────────────────────────────────────────────

async function apriModalModificaPersona(personaId) {
  let persone = [];
  try { persone = await getAll('persone_fisiche'); } catch (_) {}
  const p = persone.find(x => x.id === personaId);
  if (!p) { if (typeof showToast === 'function') showToast('Persona non trovata.', 'error'); return; }

  const existing = document.getElementById('modal-modifica-persona');
  if (existing) existing.remove();

  const ruoliOptions = RUOLI_PERSONA.map(r =>
    `<option value="${r.value}" ${r.value === p.ruolo ? 'selected' : ''}>${r.label}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'modal-modifica-persona';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
      <h2 class="text-lg font-bold text-slate-800">✏️ Modifica Persona Fisica</h2>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Nome <span class="text-red-500">*</span></label>
          <input id="mod-pf-nome" type="text" value="${escapeHtml(p.nome)}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Cognome <span class="text-red-500">*</span></label>
          <input id="mod-pf-cognome" type="text" value="${escapeHtml(p.cognome)}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Ruolo</label>
        <select id="mod-pf-ruolo" class="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white
                     focus:ring-2 focus:ring-blue-400 focus:outline-none">${ruoliOptions}</select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Qualifica / Mansione</label>
        <input id="mod-pf-qualifica" type="text" value="${escapeHtml(p.qualifica || '')}"
               class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Ente / Struttura</label>
        <input id="mod-pf-ente" type="text" value="${escapeHtml(p.ente || '')}"
               class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Email</label>
          <input id="mod-pf-email" type="email" value="${escapeHtml(p.email || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Telefono</label>
          <input id="mod-pf-telefono" type="tel" value="${escapeHtml(p.telefono || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Cellulare</label>
        <input id="mod-pf-cellulare" type="tel" value="${escapeHtml(p.cellulare || '')}"
               class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Codice Fiscale</label>
          <input id="mod-pf-cf" type="text" maxlength="16" value="${escapeHtml(p.codiceFiscale || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Ordine Professionale</label>
          <input id="mod-pf-ordine" type="text" value="${escapeHtml(p.ordineProfessionale || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-1">Note</label>
        <textarea id="mod-pf-note" rows="2"
                  class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-y">${escapeHtml(p.note || '')}</textarea>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button onclick="document.getElementById('modal-modifica-persona').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaModificaPersona('${p.id}')"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          💾 Salva Modifiche
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);
}

async function confermaModificaPersona(personaId) {
  const nome    = (document.getElementById('mod-pf-nome')?.value || '').trim();
  const cognome = (document.getElementById('mod-pf-cognome')?.value || '').trim();

  if (!nome || !cognome) {
    if (typeof showToast === 'function') showToast('Nome e Cognome sono obbligatori.', 'warning');
    return;
  }

  let persone = [];
  try { persone = await getAll('persone_fisiche'); } catch (_) {}
  const old = persone.find(x => x.id === personaId);
  if (!old) { if (typeof showToast === 'function') showToast('Persona non trovata.', 'error'); return; }

  const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};

  const updated = {
    ...old,
    nome,
    cognome,
    ruolo:                document.getElementById('mod-pf-ruolo')?.value || old.ruolo,
    qualifica:            (document.getElementById('mod-pf-qualifica')?.value || '').trim(),
    ente:                 (document.getElementById('mod-pf-ente')?.value || '').trim(),
    email:                (document.getElementById('mod-pf-email')?.value || '').trim(),
    telefono:             (document.getElementById('mod-pf-telefono')?.value || '').trim(),
    cellulare:            (document.getElementById('mod-pf-cellulare')?.value || '').trim(),
    codiceFiscale:        (document.getElementById('mod-pf-cf')?.value || '').trim(),
    ordineProfessionale:  (document.getElementById('mod-pf-ordine')?.value || '').trim(),
    note:                 (document.getElementById('mod-pf-note')?.value || '').trim(),
    modifiedAt:           new Date().toISOString(),
    modifiedBy:           imp.firmaNome || 'CSE'
  };

  try {
    await saveItem('persone_fisiche', updated);
    if (typeof showToast === 'function') showToast(`${cognome} ${nome} aggiornato ✓`, 'success');
    document.getElementById('modal-modifica-persona')?.remove();
    await renderListaPersoneFisiche();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Errore modifica: ' + err, 'error');
  }
}

// ─────────────────────────────────────────────
// 5. ELIMINAZIONE (con check collegamento verbali)
// ─────────────────────────────────────────────

async function eliminaPersonaFisica(personaId) {
  let persone = [];
  try { persone = await getAll('persone_fisiche'); } catch (_) {}
  const p = persone.find(x => x.id === personaId);
  if (!p) return;

  const nomeCompleto = `${p.cognome} ${p.nome} (${p.ruolo})`;

  if (!confirm(`Eliminare ${nomeCompleto}?\n\nQuesta azione è irreversibile.`)) return;

  try {
    await deleteItem('persone_fisiche', personaId);
    if (typeof showToast === 'function') showToast(`${nomeCompleto} eliminato ✓`, 'success');
    await renderListaPersoneFisiche();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Errore eliminazione: ' + err, 'error');
  }
}

// ─────────────────────────────────────────────
// 6. UTILITY: Popola <select> nei form verbali
// ─────────────────────────────────────────────

/**
 * Popola un <select> con le persone fisiche filtrate per ruolo.
 * Aggiunge opzione "— Altro (inserisci manualmente)" con data-other="true".
 * @param {string} selectId — ID dell'elemento <select>
 * @param {string|string[]} ruoli — Ruolo o array di ruoli da includere
 * @param {string} [valoreCorrente] — Valore da pre-selezionare
 */
async function popolaSelectPersoneFisiche(selectId, ruoli, valoreCorrente) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const ruoliArr = Array.isArray(ruoli) ? ruoli : [ruoli];

  let persone = [];
  try { persone = await getAll('persone_fisiche'); } catch (_) {}

  const filtrate = persone
    .filter(p => ruoliArr.includes(p.ruolo))
    .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));

  // Salva il valore corrente se esiste
  const currentVal = valoreCorrente || sel.value;

  sel.innerHTML = '<option value="">— Seleziona —</option>';

  for (const p of filtrate) {
    const label = `${p.cognome} ${p.nome} — ${p.qualifica || p.ruolo}`;
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    if (currentVal && currentVal === label) opt.selected = true;
    sel.appendChild(opt);
  }

  // Opzione "Altro"
  const optAltro = document.createElement('option');
  optAltro.value = '__ALTRO__';
  optAltro.textContent = '✏️ Altro (inserisci manualmente)';
  optAltro.dataset.other = 'true';
  sel.appendChild(optAltro);

  // Se il valore corrente non matcha nessuna option → probabilmente testo libero
  if (currentVal && currentVal !== '__ALTRO__' && !filtrate.some(p => `${p.cognome} ${p.nome} — ${p.qualifica || p.ruolo}` === currentVal)) {
    // Aggiungi come opzione custom
    const optCustom = document.createElement('option');
    optCustom.value = currentVal;
    optCustom.textContent = currentVal;
    optCustom.selected = true;
    sel.insertBefore(optCustom, optAltro);
  }

  // Handler "Altro" → mostra input testo
  sel.onchange = function() {
    if (this.value === '__ALTRO__') {
      const input = prompt('Inserisci nome e qualifica:');
      if (input && input.trim()) {
        const optNew = document.createElement('option');
        optNew.value = input.trim();
        optNew.textContent = input.trim();
        optNew.selected = true;
        sel.insertBefore(optNew, optAltro);
      } else {
        sel.value = '';
      }
    }
  };
}

// Esponi globalmente
window.salvaPersonaFisica          = salvaPersonaFisica;
window.renderListaPersoneFisiche   = renderListaPersoneFisiche;
window.apriModalModificaPersona    = apriModalModificaPersona;
window.confermaModificaPersona     = confermaModificaPersona;
window.eliminaPersonaFisica        = eliminaPersonaFisica;
window.popolaSelectPersoneFisiche  = popolaSelectPersoneFisiche;
