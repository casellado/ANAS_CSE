// imprese-assegnazione.js - Collegamento Imprese ↔ Cantiere ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Recupera imprese assegnate al cantiere corrente
// ─────────────────────────────────────────────
async function getImpreseAssegnate() {
  if (!window.appState?.currentProject) return [];

  const projectId    = window.appState.currentProject;
  const assegnazioni = await getByIndex('imprese_cantieri', 'projectId', projectId);
  const tutteImprese = await getAll('imprese');

  return assegnazioni
    .map(a => {
      const impresa = tutteImprese.find(i => i.id === a.impresaId);
      if (!impresa) return null;
      return { ...impresa, ruolo: a.ruolo, assegnazioneId: a.id };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// 2. Assegna impresa al cantiere
// ─────────────────────────────────────────────
async function assegnaImpresaAlCantiere(impresaId, ruolo = 'subappaltatrice') {
  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  const assegnazione = {
    id:         'ass_' + Date.now(),
    projectId:  window.appState.currentProject,
    impresaId,
    ruolo,
    createdAt:  new Date().toISOString()
  };

  await saveItem('imprese_cantieri', assegnazione);
  showToast('Impresa assegnata al cantiere ✓', 'success');

  await aggiornaBadgeImprese();
  await renderImpreseList('imprese-list');
}

// ─────────────────────────────────────────────
// 3. Rimuovi impresa dal cantiere
// ─────────────────────────────────────────────
async function rimuoviImpresaDalCantiere(assegnazioneId) {
  await deleteItem('imprese_cantieri', assegnazioneId);
  showToast('Impresa rimossa dal cantiere.', 'info');

  await aggiornaBadgeImprese();
  await renderImpreseList('imprese-list');
}

// ─────────────────────────────────────────────
// 4. Rendering lista imprese (panel dashboard)
// ─────────────────────────────────────────────
async function renderImpreseList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const imprese = await getImpreseAssegnate();

  if (!imprese || imprese.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <div class="text-4xl mb-2">🏗️</div>
        <p class="text-sm font-medium mb-4">Nessuna impresa assegnata al cantiere.</p>
        <button onclick="mostraPopupAssegnaImpresa()"
                class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Assegna impresa al cantiere">
          + Assegna Impresa
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="mb-4">
      <button onclick="mostraPopupAssegnaImpresa()"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Assegna nuova impresa">
        + Assegna Impresa
      </button>
    </div>

    ${imprese.map(i => {
      const nome      = escapeHtml(i.nome);
      const ruolo     = escapeHtml(i.ruolo);
      const referente = escapeHtml(i.referente);
      const contatto  = escapeHtml(i.contatto);
      return `
      <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-200 mb-3"
           role="article"
           aria-label="Impresa ${nome}">
        <div class="flex justify-between items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-800 text-base truncate">${nome || '–'}</div>
            <div class="text-xs text-slate-500 mt-0.5">Ruolo: <strong>${ruolo || '–'}</strong></div>
            <div class="text-xs text-slate-500">Referente: ${referente || '–'}</div>
            <div class="text-xs text-slate-500">Contatto: ${contatto || '–'}</div>
          </div>

          <div class="flex gap-2 shrink-0">
            <button onclick="apriSchedaImpresa('${i.id}')"
                    class="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg
                           hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label="Apri scheda impresa ${nome}">
              Scheda →
            </button>
            <button onclick="rimuoviImpresaDalCantiere('${i.assegnazioneId}')"
                    class="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg
                           hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                    aria-label="Rimuovi impresa ${nome} dal cantiere">
              Rimuovi
            </button>
          </div>
        </div>
      </div>
    `; }).join('')}
  `;
}

// ─────────────────────────────────────────────
// 5. Badge imprese nel tab
// ─────────────────────────────────────────────
async function aggiornaBadgeImprese() {
  const imprese = await getImpreseAssegnate();
  const badge   = document.getElementById('badge-imprese');
  if (badge) {
    badge.textContent = imprese.length;
    badge.setAttribute('aria-label', `${imprese.length} imprese assegnate`);
  }
}

// ─────────────────────────────────────────────
// 6. Popup assegnazione impresa
// ─────────────────────────────────────────────
async function mostraPopupAssegnaImpresa() {
  const existing = document.getElementById('popup-assegna');
  if (existing) existing.remove();

  const tutte = await getAll('imprese');

  const html = `
    <div id="popup-assegna"
         class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
         role="dialog" aria-modal="true" aria-labelledby="popup-assegna-title">
      <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md mx-4 space-y-4">

        <h2 id="popup-assegna-title" class="text-lg font-bold text-slate-800">
          🏗️ Assegna Impresa al Cantiere
        </h2>

        <div>
          <label for="sel-impresa" class="text-sm font-semibold text-slate-700 block mb-1">
            Impresa <span class="text-red-500">*</span>
          </label>
          ${tutte.length > 0
            ? `<select id="sel-impresa"
                       class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                              focus:ring-2 focus:ring-blue-400 focus:outline-none">
                 ${tutte.map(i => `<option value="${i.id}">${escapeHtml(i.nome)} (${escapeHtml(i.piva || i.id)})</option>`).join('')}
               </select>`
            : `<p class="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                 ⚠️ Nessuna impresa in anagrafica. <br>
                 Aggiungila prima dalla sezione <strong>Anagrafiche</strong> nell'Hub.
               </p>`
          }
        </div>

        <div>
          <label for="sel-ruolo" class="text-sm font-semibold text-slate-700 block mb-1">
            Ruolo nel cantiere
          </label>
          <select id="sel-ruolo"
                  class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                         focus:ring-2 focus:ring-blue-400 focus:outline-none">
            <option value="affidataria">Impresa Affidataria</option>
            <option value="subappaltatrice">Impresa Subappaltatrice</option>
            <option value="fornitore">Fornitore / Nolo</option>
            <option value="lavoratore_autonomo">Lavoratore Autonomo</option>
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button onclick="document.getElementById('popup-assegna').remove()"
                  class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                         hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
            Annulla
          </button>
          ${tutte.length > 0
            ? `<button onclick="confermaAssegnazioneImpresa()"
                       class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                 ✅ Assegna
               </button>`
            : ''
          }
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('popup-assegna').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('popup-assegna')?.remove();
  });
}

async function confermaAssegnazioneImpresa() {
  const impresaId = document.getElementById('sel-impresa')?.value;
  const ruolo     = document.getElementById('sel-ruolo')?.value || 'subappaltatrice';
  if (!impresaId) return;

  await assegnaImpresaAlCantiere(impresaId, ruolo);
  document.getElementById('popup-assegna')?.remove();
}

// ─────────────────────────────────────────────
// 7. Hook automatico
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.pathname.includes('dashboard-cantiere.html')) return;
  // renderImpreseList viene invocato dal DOMContentLoaded dell'HTML
});
