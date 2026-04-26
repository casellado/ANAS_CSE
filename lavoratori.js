// lavoratori.js - Gestione lavoratori delle imprese ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Recupera lavoratori per impresa
// ─────────────────────────────────────────────
async function getLavoratoriByImpresa(impresaId) {
  return await getByIndex('lavoratori', 'impresaId', impresaId);
}

// ─────────────────────────────────────────────
// 2. Crea un nuovo lavoratore
// ─────────────────────────────────────────────
async function creaLavoratore(impresaId, dati) {
  const lavoratore = {
    id:         'lav_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    impresaId,
    nome:       dati.nome       || '',
    cognome:    dati.cognome    || '',
    mansione:   dati.mansione   || '',
    cf:         dati.cf         || '',
    dpi:        dati.dpi        || [],
    idoneita:   dati.idoneita   || 'non verificata',
    scadenzaVisita: dati.scadenzaVisita || '',
    formazione: dati.formazione || [],
    createdAt:  new Date().toISOString()
  };

  await saveItem('lavoratori', lavoratore);
  showToast('Lavoratore aggiunto correttamente ✓', 'success');
  await renderLavoratoriImpresa('lavoratori-list', impresaId);
}

// ─────────────────────────────────────────────
// 3. Rimuovi lavoratore
// ─────────────────────────────────────────────
async function rimuoviLavoratore(id, impresaId) {
  // Recupera il lavoratore per mostrare un messaggio significativo
  let nome = 'questo lavoratore';
  try {
    const lav = await getItem('lavoratori', id);
    if (lav && lav.nome) nome = `${lav.nome}${lav.cognome ? ' ' + lav.cognome : ''}`;
  } catch(_) {}

  const ok = confirm(`Eliminare definitivamente ${nome}?\n\nQuesta azione non può essere annullata.`);
  if (!ok) return;

  await deleteItem('lavoratori', id);
  showToast('Lavoratore rimosso.', 'info');
  await renderLavoratoriImpresa('lavoratori-list', impresaId);
}

// ─────────────────────────────────────────────
// 4. Apri scheda lavoratore
// ─────────────────────────────────────────────
function apriSchedaLavoratore(id) {
  sessionStorage.setItem('currentLavoratoreId', id);
  window.location.href = `lavoratore-dettaglio.html?id=${id}`;
}

// ─────────────────────────────────────────────
// 5. Rendering lista lavoratori
// ─────────────────────────────────────────────
async function renderLavoratoriImpresa(containerId, impresaId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const lavoratori = await getLavoratoriByImpresa(impresaId);

  const idoneitaColore = {
    'idoneo':         'bg-green-100 text-green-800 border-green-300',
    'non idoneo':     'bg-red-100   text-red-800   border-red-300',
    'non verificata': 'bg-slate-100 text-slate-600 border-slate-300'
  };

  if (lavoratori.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-400">
        <p class="text-sm mb-3">Nessun lavoratore registrato.</p>
        <button onclick="mostraPopupNuovoLavoratore('${impresaId}')"
                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Aggiungi lavoratore">
          + Aggiungi Lavoratore
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="mb-4">
      <button onclick="mostraPopupNuovoLavoratore('${impresaId}')"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
        + Aggiungi Lavoratore
      </button>
    </div>

    ${lavoratori.map(l => {
      const nome     = escapeHtml(l.nome);
      const cognome  = escapeHtml(l.cognome);
      const mansione = escapeHtml(l.mansione);
      const dpiTesto = l.dpi?.length > 0 ? l.dpi.map(d => escapeHtml(d)).join(', ') : '';
      return `
      <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-200 mb-3"
           role="article"
           aria-label="Lavoratore ${nome} ${cognome}">
        <div class="flex justify-between items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-800 text-base">${nome} ${cognome}</div>
            <div class="text-xs text-slate-500 mt-0.5">Mansione: ${mansione || '–'}</div>
              <span class="text-xs px-2 py-0.5 rounded border font-semibold
                           ${idoneitaColore[l.idoneita] || idoneitaColore['non verificata']}">
                ${l.idoneita || 'Non verificata'}
              </span>
              ${l.scadenzaVisita ? `
                <span class="text-[10px] ml-2 font-mono ${new Date(l.scadenzaVisita) < new Date() ? 'text-red-600 font-bold animate-pulse' : 'text-slate-500'}">
                  Scad. ${new Date(l.scadenzaVisita).toLocaleDateString('it-IT')}
                </span>
              ` : ''}
            </div>
            ${dpiTesto
              ? `<div class="text-xs text-slate-400 mt-1">DPI: ${dpiTesto}</div>`
              : ''
            }
          </div>

          <div class="flex gap-2 shrink-0">
            <button onclick="apriSchedaLavoratore('${l.id}')"
                    class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg
                           hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Apri scheda ${nome} ${cognome}">
              Scheda →
            </button>
            <button onclick="rimuoviLavoratore('${l.id}', '${impresaId}')"
                    class="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg
                           hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                    aria-label="Rimuovi lavoratore ${nome} ${cognome}">
              Rimuovi
            </button>
          </div>
        </div>
      </div>
    `; }).join('')}
  `;
}

// ─────────────────────────────────────────────
// 6. Popup aggiunta lavoratore
// ─────────────────────────────────────────────
function mostraPopupNuovoLavoratore(impresaId) {
  const existing = document.getElementById('popup-lavoratore');
  if (existing) existing.remove();

  const html = `
    <div id="popup-lavoratore"
         class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
         role="dialog" aria-modal="true" aria-labelledby="popup-lav-title">
      <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md mx-4 space-y-4
                  max-h-[90vh] overflow-y-auto">

        <h2 id="popup-lav-title" class="text-lg font-bold text-slate-800">
          👷 Nuovo Lavoratore
        </h2>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="lav-nome" class="text-xs font-semibold text-slate-600 block mb-1">
              Nome <span class="text-red-500">*</span>
            </label>
            <input id="lav-nome"
                   type="text"
                   placeholder="Es. Mario"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none"
                   aria-required="true" />
          </div>
          <div>
            <label for="lav-cognome" class="text-xs font-semibold text-slate-600 block mb-1">
              Cognome <span class="text-red-500">*</span>
            </label>
            <input id="lav-cognome"
                   type="text"
                   placeholder="Es. Rossi"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none"
                   aria-required="true" />
          </div>
        </div>

        <div>
          <label for="lav-cf" class="text-xs font-semibold text-slate-600 block mb-1">
            Codice Fiscale
          </label>
          <input id="lav-cf"
                 type="text"
                 placeholder="Es. RSSMRA80A01H501T"
                 maxlength="16"
                 style="text-transform:uppercase"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>

        <div>
          <label for="lav-mansione" class="text-xs font-semibold text-slate-600 block mb-1">
            Mansione
          </label>
          <input id="lav-mansione"
                 type="text"
                 placeholder="Es. Operatore, Capocantiere, Gruista"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>

        <fieldset>
          <legend class="text-xs font-semibold text-slate-600 mb-2">DPI consegnati</legend>
          <div class="grid grid-cols-2 gap-2 text-sm">
            ${[
              'Casco',
              'Guanti',
              'Gilet Alta Visibilità',
              'Scarpe Antinfortunistiche',
              'Imbracatura',
              'Occhiali di Protezione'
            ].map(dpi => `
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="lav-dpi-check rounded" value="${dpi}" />
                <span>${dpi}</span>
              </label>
            `).join('')}
          </div>
        </fieldset>

        <div>
          <label for="lav-idoneita" class="text-xs font-semibold text-slate-600 block mb-1">
            Idoneità lavorativa
          </label>
          <select id="lav-idoneita"
                  class="w-full border border-slate-300 rounded-lg p-2 text-sm
                         focus:ring-2 focus:ring-blue-400 focus:outline-none">
            <option value="idoneo">✅ Idoneo</option>
            <option value="non idoneo">❌ Non idoneo</option>
            <option value="non verificata">⚪ Non verificata</option>
          </select>
        </div>

        <div>
          <label for="lav-scadenza" class="text-xs font-semibold text-slate-600 block mb-1">
            Scadenza Idoneità Medica
          </label>
          <input id="lav-scadenza"
                 type="date"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button onclick="document.getElementById('popup-lavoratore').remove()"
                  class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                         hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
            Annulla
          </button>
          <button onclick="confermaNuovoLavoratore('${impresaId}')"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            ✅ Salva Lavoratore
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('popup-lavoratore').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('popup-lavoratore')?.remove();
  });
  document.getElementById('lav-nome')?.focus();
}

async function confermaNuovoLavoratore(impresaId) {
  const nome    = (document.getElementById('lav-nome')?.value     || '').trim();
  const cognome = (document.getElementById('lav-cognome')?.value   || '').trim();

  if (!nome || !cognome) {
    showToast('Nome e Cognome sono obbligatori.', 'warning');
    return;
  }

  const dpi = Array.from(
    document.querySelectorAll('#popup-lavoratore .lav-dpi-check:checked')
  ).map(c => c.value);

  await creaLavoratore(impresaId, {
    nome,
    cognome,
    cf:       (document.getElementById('lav-cf')?.value       || '').toUpperCase(),
    mansione: document.getElementById('lav-mansione')?.value   || '',
    dpi,
    idoneita: document.getElementById('lav-idoneita')?.value   || 'non verificata',
    scadenzaVisita: document.getElementById('lav-scadenza')?.value || ''
  });

  document.getElementById('popup-lavoratore')?.remove();
}

// Inizializzazione centralizzata spostata nei file HTML principali.

// ─────────────────────────────────────────────
// 8. Modal MODIFICA lavoratore — GAP-5
// ─────────────────────────────────────────────
const DPI_LISTA = [
  'Casco', 'Guanti', 'Scarpe antinfortunistiche', 'Gilet alta visibilità',
  'Otoprotettori', 'Mascherina FFP2/FFP3', 'Occhiali protezione',
  'Imbracatura anticaduta', 'Stivali', 'Tuta da lavoro'
];

async function apriModalModificaLavoratore(lavId) {
  const l = await getItem('lavoratori', lavId);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }

  document.getElementById('modal-modifica-lavoratore')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-modifica-lavoratore';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh]
                overflow-y-auto p-6 space-y-4">
      <h2 class="text-lg font-bold text-slate-800">✏️ Modifica Lavoratore</h2>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Nome <span class="text-red-500">*</span></label>
          <input id="mod-lav-nome" type="text" value="${escapeHtml(l.nome || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Cognome <span class="text-red-500">*</span></label>
          <input id="mod-lav-cognome" type="text" value="${escapeHtml(l.cognome || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Codice Fiscale</label>
          <input id="mod-lav-cf" type="text" value="${escapeHtml(l.cf || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-mono
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Mansione</label>
          <input id="mod-lav-mansione" type="text" value="${escapeHtml(l.mansione || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-semibold text-slate-600 block mb-1">Idoneità Lavorativa</label>
          <select id="mod-lav-idoneita"
                  class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white
                         focus:ring-2 focus:ring-blue-400 focus:outline-none">
            <option value="idoneo"         ${l.idoneita==='idoneo'         ? 'selected':''}>✅ Idoneo</option>
            <option value="non idoneo"     ${l.idoneita==='non idoneo'     ? 'selected':''}>❌ Non Idoneo</option>
            <option value="non verificata" ${l.idoneita==='non verificata' ? 'selected':''}>⬜ Non Verificata</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="text-xs font-semibold text-slate-600 block mb-1">Scadenza Idoneità Medica</label>
          <input id="mod-lav-scadenza" type="date" value="${l.scadenzaVisita || ''}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-600 block mb-2">DPI Consegnati</label>
        <div class="grid grid-cols-2 gap-1.5">
          ${DPI_LISTA.map(dpi => `
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox"
                     class="mod-lav-dpi-check rounded"
                     value="${escapeHtml(dpi)}"
                     ${(l.dpi || []).includes(dpi) ? 'checked' : ''} />
              ${escapeHtml(dpi)}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button onclick="document.getElementById('modal-modifica-lavoratore').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaModificaLavoratore('${escapeHtml(l.id)}')"
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
  modal.querySelector('#mod-lav-nome').focus();
}

async function confermaModificaLavoratore(lavId) {
  const nome     = (document.getElementById('mod-lav-nome')?.value     || '').trim();
  const cognome  = (document.getElementById('mod-lav-cognome')?.value  || '').trim();
  const cf       = (document.getElementById('mod-lav-cf')?.value       || '').toUpperCase().trim();
  const mansione = (document.getElementById('mod-lav-mansione')?.value || '').trim();
  const idoneita = document.getElementById('mod-lav-idoneita')?.value  || 'non verificata';
  const scadenzaVisita = document.getElementById('mod-lav-scadenza')?.value || '';
  const dpi      = Array.from(document.querySelectorAll('.mod-lav-dpi-check:checked')).map(c => c.value);

  if (!nome || !cognome) { showToast('Nome e Cognome sono obbligatori.', 'warning'); return; }

  const l = await getItem('lavoratori', lavId);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }

  const updated = { ...l, nome, cognome, cf, mansione, idoneita, scadenzaVisita, dpi, updatedAt: new Date().toISOString() };
  await saveItem('lavoratori', updated);

  document.getElementById('modal-modifica-lavoratore')?.remove();
  showToast(`Lavoratore "${nome} ${cognome}" aggiornato ✓`, 'success');

  // Ricarica scheda se siamo sulla pagina dettaglio
  const container = document.getElementById('lavoratore-dettaglio-container');
  if (container) window.location.reload();
}

// ─────────────────────────────────────────────
// 9. Gestione Formazione — GAP-6
// ─────────────────────────────────────────────
async function apriPannelloFormazione(lavId) {
  const l = await getItem('lavoratori', lavId);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }

  document.getElementById('pannello-formazione')?.remove();

  const panel = document.createElement('div');
  panel.id        = 'pannello-formazione';
  panel.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const corsi = l.formazione || [];

  panel.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
      <h2 class="text-lg font-bold text-slate-800">📚 Formazione Lavoratore</h2>
      <div class="text-sm text-slate-500">
        ${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}
      </div>

      <div id="lista-corsi" class="space-y-2 max-h-48 overflow-y-auto">
        ${corsi.length > 0
          ? corsi.map((c, i) => `
            <div class="flex items-center justify-between bg-slate-50 border border-slate-200
                        rounded-lg px-3 py-2">
              <span class="text-sm text-slate-700">${escapeHtml(c)}</span>
              <button onclick="_rimuoviCorso('${escapeHtml(lavId)}', ${i})"
                      class="text-red-400 hover:text-red-700 text-xs font-bold ml-2
                             focus:outline-none" aria-label="Rimuovi corso">
                ✕
              </button>
            </div>
          `).join('')
          : '<p class="text-xs text-slate-400 italic py-2 text-center">Nessun corso registrato.</p>'
        }
      </div>

      <div class="flex gap-2">
        <input id="nuovo-corso" type="text"
               placeholder="Es. Corso RLS 8h — 15/01/2025"
               class="flex-1 border border-slate-300 rounded-lg p-2.5 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none"
               onkeydown="if(event.key==='Enter') _aggiungiCorso('${escapeHtml(lavId)}')" />
        <button onclick="_aggiungiCorso('${escapeHtml(lavId)}')"
                class="bg-blue-600 text-white text-sm px-3 py-2.5 rounded-lg font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          + Aggiungi
        </button>
      </div>

      <div class="flex justify-end pt-2">
        <button onclick="document.getElementById('pannello-formazione').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Chiudi
        </button>
      </div>
    </div>
  `;

  panel.addEventListener('click', e => { if (e.target === panel) panel.remove(); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') panel.remove(); });
  document.body.appendChild(panel);
  panel.querySelector('#nuovo-corso').focus();
}

async function _aggiungiCorso(lavId) {
  const input = document.getElementById('nuovo-corso');
  const corso = (input?.value || '').trim();
  if (!corso) { showToast('Inserisci il nome del corso.', 'warning'); return; }

  const l = await getItem('lavoratori', lavId);
  if (!l) return;

  const formazione = [...(l.formazione || []), corso];
  await saveItem('lavoratori', { ...l, formazione, updatedAt: new Date().toISOString() });

  showToast('Corso aggiunto ✓', 'success');
  await apriPannelloFormazione(lavId); // ricarica il pannello
}

async function _rimuoviCorso(lavId, indice) {
  const l = await getItem('lavoratori', lavId);
  if (!l) return;

  const formazione = (l.formazione || []).filter((_, i) => i !== indice);
  await saveItem('lavoratori', { ...l, formazione, updatedAt: new Date().toISOString() });

  showToast('Corso rimosso.', 'info');
  await apriPannelloFormazione(lavId); // ricarica il pannello
}

// ─────────────────────────────────────────────
// 10. Modal rapido lavoratori (per Dashboard) — MOD-22
// ─────────────────────────────────────────────
async function mostraLavoratoriImpresaModal(impresaId) {
  const [impresa, lavoratori] = await Promise.all([
    getItem('imprese', impresaId),
    getLavoratoriByImpresa(impresaId)
  ]);

  if (!impresa) { showToast('Impresa non trovata.', 'error'); return; }

  document.getElementById('modal-lavoratori-rapido')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-lavoratori-rapido';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4';
  modal.setAttribute('role', 'dialog');

  const idoneitaColore = {
    'idoneo':         'text-green-600',
    'non idoneo':     'text-red-600',
    'non verificata': 'text-slate-400'
  };

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 class="text-lg font-bold text-slate-800">${escapeHtml(impresa.nome)}</h2>
          <p class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Registro Lavoratori Attivi</p>
        </div>
        <button onclick="document.getElementById('modal-lavoratori-rapido').remove()" 
                class="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5">
        ${lavoratori.length === 0 
          ? `<div class="text-center py-10 text-slate-400 italic text-sm">Nessun lavoratore registrato per questa impresa.</div>`
          : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${lavoratori.map(l => {
              const isScaduto = l.scadenzaIdoneita && new Date(l.scadenzaIdoneita) < new Date();
              return `
                <div class="p-3 rounded-xl border ${isScaduto ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white'} shadow-sm">
                  <div class="flex justify-between items-start">
                    <div class="font-bold text-slate-800 text-sm">${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}</div>
                    ${isScaduto ? '<span class="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">SCADUTO</span>' : ''}
                  </div>
                  <div class="text-[10px] text-slate-500 font-medium">${escapeHtml(l.mansione || '–')}</div>
                  <div class="mt-2 flex items-center justify-between">
                    <span class="text-[10px] font-bold ${idoneitaColore[l.idoneita] || 'text-slate-400'}">
                      ● ${l.idoneita?.toUpperCase() || 'DA VERIFICARE'}
                    </span>
                    ${l.scadenzaIdoneita ? `
                      <span class="text-[9px] font-mono ${isScaduto ? 'text-red-700 font-bold' : 'text-slate-400'}">
                        Scad: ${new Date(l.scadenzaIdoneita).toLocaleDateString('it-IT')}
                      </span>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
        <div class="text-[10px] text-slate-400">Totale: ${lavoratori.length} lavoratori</div>
        <button onclick="apriSchedaImpresa('${impresa.id}')"
                class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
          Gestisci Anagrafica Full →
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}
