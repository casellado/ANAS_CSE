// imprese-list.js — Lista e dettaglio imprese ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Apertura scheda impresa (naviga alla pagina dettaglio)
// ─────────────────────────────────────────────
function apriSchedaImpresa(impresaId) {
  sessionStorage.setItem('currentImpresaId', impresaId);
  window.location.href = 'impresa-dettaglio.html';
}

// ─────────────────────────────────────────────
// 2. Rendering dettaglio impresa (impresa-dettaglio.html)
// ─────────────────────────────────────────────
async function renderDettaglioImpresa(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const impresaId = sessionStorage.getItem('currentImpresaId');
  if (!impresaId) {
    container.innerHTML = `<p class="text-red-600 font-semibold">⚠️ Errore: nessuna impresa selezionata.</p>`;
    return;
  }

  const imprese = await getAll('imprese');
  const impresa = imprese.find(i => i.id === impresaId);

  if (!impresa) {
    container.innerHTML = `<p class="text-red-600 font-semibold">⚠️ Impresa non trovata.</p>`;
    return;
  }

  // Aggiorna breadcrumb col nome reale
  const breadcrumb = document.getElementById('impresa-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = `${escapeHtml(impresa.nome || impresa.id)} · ID: ${impresa.id}`;

  container.innerHTML = `
    <div class="bg-white p-6 rounded-xl shadow border border-slate-200 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-xl font-bold text-slate-800">${escapeHtml(impresa.nome) || '–'}</h2>
        <div class="shrink-0 flex gap-2">
          <button onclick="apriModalModificaImpresa('${escapeHtml(impresa.id)}')"
                  class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
                  aria-label="Modifica dati impresa">
            ✏️ Modifica
          </button>
          <button onclick="eliminaImpresa('${escapeHtml(impresa.id)}')"
                  class="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg
                         hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 font-semibold"
                  aria-label="Elimina impresa">
            🗑️ Elimina
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">P.IVA / C.F.</div>
          <div class="font-mono font-medium text-slate-800">${escapeHtml(impresa.piva || impresa.id) || '–'}</div>
        </div>
        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Ruolo</div>
          <div class="font-medium text-slate-800">${escapeHtml(impresa.ruolo) || '–'}</div>
        </div>
        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Referente / Preposto</div>
          <div class="font-medium text-slate-800">${escapeHtml(impresa.referente) || '–'}</div>
        </div>
        <div class="bg-slate-50 p-3 rounded-lg">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Contatto (PEC / Email / Tel)</div>
          <div class="font-medium text-slate-800">${escapeHtml(impresa.contatto) || '–'}</div>
        </div>
        <div class="bg-slate-50 p-3 rounded-lg sm:col-span-2 border-l-4 ${impresa.scadenzaDurc && new Date(impresa.scadenzaDurc) < new Date() ? 'border-red-500 bg-red-50' : 'border-blue-500'}">
          <div class="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Scadenza DURC</div>
          <div class="flex items-center gap-2">
            <span class="font-bold ${impresa.scadenzaDurc && new Date(impresa.scadenzaDurc) < new Date() ? 'text-red-700' : 'text-slate-800'}">
              ${impresa.scadenzaDurc ? new Date(impresa.scadenzaDurc).toLocaleDateString('it-IT') : 'Non inserita'}
            </span>
            ${impresa.scadenzaDurc && new Date(impresa.scadenzaDurc) < new Date() ? '<span class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse">SCADUTO</span>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 3. Modal MODIFICA impresa — GAP-4
// ─────────────────────────────────────────────
async function apriModalModificaImpresa(impresaId) {
  const imprese = await getAll('imprese');
  const imp     = imprese.find(i => i.id === impresaId);
  if (!imp) { showToast('Impresa non trovata.', 'error'); return; }

  const existing = document.getElementById('modal-modifica-impresa');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-modifica-impresa';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
      <h2 class="text-lg font-bold text-slate-800">✏️ Modifica Impresa</h2>
      <div class="text-xs text-slate-400 font-mono">ID: ${escapeHtml(imp.id)}</div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-600 block mb-1">
            Ragione Sociale <span class="text-red-500">*</span>
          </label>
          <input id="mod-imp-nome" type="text" value="${escapeHtml(imp.nome || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">P.IVA / C.F.</label>
          <input id="mod-imp-piva" type="text" value="${escapeHtml(imp.piva || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Ruolo in cantiere</label>
          <select id="mod-imp-ruolo"
                  class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white
                         focus:ring-2 focus:ring-blue-400 focus:outline-none">
            <option value="appaltatrice"    ${imp.ruolo==='appaltatrice'    ? 'selected':''}>Appaltatrice</option>
            <option value="subappaltatrice" ${imp.ruolo==='subappaltatrice' ? 'selected':''}>Subappaltatrice</option>
            <option value="fornitrice"      ${imp.ruolo==='fornitrice'      ? 'selected':''}>Fornitrice</option>
            <option value="DL"              ${imp.ruolo==='DL'              ? 'selected':''}>Direzione Lavori</option>
            <option value="RUP"             ${imp.ruolo==='RUP'             ? 'selected':''}>R.U.P.</option>
            <option value="altra"           ${!['appaltatrice','subappaltatrice','fornitrice','DL','RUP'].includes(imp.ruolo) ? 'selected':''}>Altra</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Referente / Preposto</label>
          <input id="mod-imp-referente" type="text" value="${escapeHtml(imp.referente || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">Contatto (PEC / Email / Tel)</label>
          <input id="mod-imp-contatto" type="text" value="${escapeHtml(imp.contatto || '')}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-600 block mb-1">Data Scadenza DURC</label>
          <input id="mod-imp-durc" type="date" value="${imp.scadenzaDurc || ''}"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <button onclick="document.getElementById('modal-modifica-impresa').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaModificaImpresa('${escapeHtml(imp.id)}')"
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
  modal.querySelector('#mod-imp-nome').focus();
}

async function confermaModificaImpresa(impresaId) {
  const nome     = (document.getElementById('mod-imp-nome')?.value     || '').trim();
  const piva     = (document.getElementById('mod-imp-piva')?.value     || '').trim();
  const ruolo    = document.getElementById('mod-imp-ruolo')?.value     || '';
  const referente= (document.getElementById('mod-imp-referente')?.value || '').trim();
  const contatto = (document.getElementById('mod-imp-contatto')?.value  || '').trim();
  const scadenzaDurc = document.getElementById('mod-imp-durc')?.value || '';

  if (!nome) { showToast('La ragione sociale è obbligatoria.', 'warning'); return; }

  const imprese = await getAll('imprese');
  const imp     = imprese.find(i => i.id === impresaId);
  if (!imp) { showToast('Impresa non trovata.', 'error'); return; }

  const updated = { ...imp, nome, piva, ruolo, referente, contatto, scadenzaDurc, updatedAt: new Date().toISOString() };
  await saveItem('imprese', updated);

  document.getElementById('modal-modifica-impresa')?.remove();
  await renderDettaglioImpresa('impresa-dettaglio-container');
  showToast(`Impresa "${nome}" aggiornata ✓`, 'success');
}

// ─────────────────────────────────────────────
// 3-bis. Elimina impresa (con conferma + cleanup lavoratori/assegnazioni)
// ─────────────────────────────────────────────
async function eliminaImpresa(impresaId) {
  const imprese = await getAll('imprese');
  const imp     = imprese.find(i => i.id === impresaId);
  if (!imp) { showToast('Impresa non trovata.', 'error'); return; }

  // Conta dipendenze
  const lavoratori  = await getAll('lavoratori').catch(() => []);
  const assegnaz    = await getAll('imprese_cantieri').catch(() => []);
  const nLav = lavoratori.filter(l => l.impresaId === impresaId).length;
  const nAss = assegnaz.filter(a => a.impresaId === impresaId).length;

  const msg = `Eliminare definitivamente "${imp.nome}"?\n\n` +
              `Verranno eliminati anche:\n` +
              `• ${nLav} lavoratori associati\n` +
              `• ${nAss} assegnazioni a cantieri\n\n` +
              `Questa azione non può essere annullata.`;
  if (!confirm(msg)) return;

  // Cleanup: lavoratori dell'impresa
  for (const l of lavoratori.filter(l => l.impresaId === impresaId)) {
    await deleteItem('lavoratori', l.id);
  }
  // Cleanup: assegnazioni a cantieri
  for (const a of assegnaz.filter(a => a.impresaId === impresaId)) {
    await deleteItem('imprese_cantieri', a.id);
  }
  // Elimina l'impresa
  await deleteItem('imprese', impresaId);

  showToast(`Impresa "${imp.nome}" eliminata ✓`, 'success');

  // Torna alla dashboard cantiere
  setTimeout(() => {
    if (window.appState?.currentProject) {
      window.location.href = 'dashboard-cantiere.html';
    } else {
      window.location.href = 'index.html';
    }
  }, 700);
}

// Inizializzazione centralizzata spostata nei file HTML principali.
