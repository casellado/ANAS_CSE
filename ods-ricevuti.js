// ods-ricevuti.js — Archivio Ordini di Servizio ricevuti dai superiori
//
// Il CSE riceve ODS da RUP / DL / Capo Area / ANAS Sede.
// Vanno archiviati perché sono la base legale di ogni azione richiesta.
// Qui l'utente carica i file (PDF, Word) tramite drag&drop, li categorizza
// e può ritrovarli per cantiere o per mittente.

// ─────────────────────────────────────────────
// 1. Render della sezione
// ─────────────────────────────────────────────
async function renderOdsRicevuti(containerId, projectId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tuttiDocs = await getAll('documenti').catch(() => []);
  const odsRicevuti = tuttiDocs.filter(d =>
    (d.tags || []).includes('ods-ricevuto') &&
    (!projectId || (d.tags || []).includes(`cantiere:${projectId}`))
  );

  // Ordina per data ricezione decrescente
  odsRicevuti.sort((a, b) => {
    const dateA = new Date(a.dataOds || a.uploadedAt || 0);
    const dateB = new Date(b.dataOds || b.uploadedAt || 0);
    return dateB - dateA;
  });

  container.innerHTML = `
    <div class="space-y-4">

      <!-- Header + stats -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-slate-800">📥 ODS Ricevuti</h3>
          <div class="text-xs text-slate-500 mt-1">
            Ordini di servizio ricevuti da RUP, DL, Capo Area, Sede ANAS
            ${projectId ? ` per il cantiere <strong>${escapeHtml(projectId)}</strong>` : ''}
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-blue-700">${odsRicevuti.length}</div>
          <div class="text-xs text-slate-500">archiviati</div>
        </div>
      </div>

      <!-- Drop zone -->
      <div id="ods-drop-zone"
           class="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-6 text-center
                  hover:border-blue-500 hover:bg-blue-100 transition cursor-pointer"
           role="button"
           tabindex="0"
           aria-label="Trascina qui ODS ricevuti">
        <div class="text-4xl mb-2" aria-hidden="true">📥</div>
        <div class="text-sm font-semibold text-blue-900">
          Trascina qui gli ODS ricevuti
        </div>
        <div class="text-xs text-blue-700 mt-1">
          oppure clicca per selezionare file (PDF, Word, immagini)
        </div>
      </div>

      <!-- Lista -->
      ${odsRicevuti.length === 0 ? `
        <div class="text-center py-10 text-slate-400">
          <div class="text-4xl mb-2" aria-hidden="true">📭</div>
          <div class="text-sm">Nessun ODS ricevuto archiviato.</div>
        </div>
      ` : `
        <div class="space-y-2" role="list" aria-label="Lista ODS ricevuti">
          ${odsRicevuti.map(ods => _renderOdsCard(ods)).join('')}
        </div>
      `}
    </div>
  `;

  _wireOdsDropZone('ods-drop-zone', projectId);
}

function _renderOdsCard(ods) {
  const data = ods.dataOds
    ? new Date(ods.dataOds).toLocaleDateString('it-IT')
    : new Date(ods.uploadedAt).toLocaleDateString('it-IT');

  const mittente = ods.mittente || 'Mittente non specificato';
  const protocollo = ods.protocollo || '—';

  return `
    <div class="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md transition"
         role="listitem">
      <div class="flex items-start gap-3">
        <div class="text-2xl shrink-0" aria-hidden="true">📄</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-slate-800 truncate">${escapeHtml(ods.nome)}</div>
          <div class="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
            <span>📅 ${escapeHtml(data)}</span>
            <span>✉️ ${escapeHtml(mittente)}</span>
            <span>🔖 ${escapeHtml(protocollo)}</span>
          </div>
          ${ods.oggetto ? `
            <div class="text-xs text-slate-600 mt-1 italic">
              Oggetto: ${escapeHtml(ods.oggetto)}
            </div>
          ` : ''}
        </div>
        <div class="flex gap-1 shrink-0">
          <button onclick="visualizzaOds('${escapeHtml(ods.id)}')"
                  class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  aria-label="Visualizza documento">
            👁️
          </button>
          <button onclick="modificaOdsMetadati('${escapeHtml(ods.id)}')"
                  class="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded hover:bg-slate-200"
                  aria-label="Modifica metadati">
            ✏️
          </button>
          <button onclick="scaricaOds('${escapeHtml(ods.id)}')"
                  class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                  aria-label="Scarica documento">
            📥
          </button>
          <button onclick="rimuoviOds('${escapeHtml(ods.id)}')"
                  class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                  aria-label="Rimuovi documento">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 2. Drag & drop zone
// ─────────────────────────────────────────────
function _wireOdsDropZone(zoneId, projectId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  const handleFiles = async (files) => {
    for (const f of files) {
      _apriModalNuovoOds(f, projectId);
      // Un modal per ogni file (l'utente inserisce metadati ciascuno)
      break; // per ora gestiamo uno alla volta
    }
  };

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('ring-4', 'ring-blue-400');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('ring-4', 'ring-blue-400');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('ring-4', 'ring-blue-400');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  zone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.onchange = (e) => handleFiles(Array.from(e.target.files));
    input.click();
  });

  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      zone.click();
    }
  });
}

// ─────────────────────────────────────────────
// 3. Modal inserimento metadati ODS
// ─────────────────────────────────────────────
function _apriModalNuovoOds(file, projectId) {
  const existing = document.getElementById('modal-nuovo-ods');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-nuovo-ods';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden">
      <div class="bg-blue-700 text-white px-5 py-3 flex justify-between items-center">
        <h2 class="font-bold text-sm">📥 Archivia ODS Ricevuto</h2>
        <button onclick="document.getElementById('modal-nuovo-ods').remove()"
                class="text-blue-200 hover:text-white text-2xl">✕</button>
      </div>
      <div class="p-5 space-y-3">
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
          <strong>File:</strong> ${escapeHtml(file.name)}<br>
          <strong>Dimensione:</strong> ${(file.size / 1024).toFixed(1)} KB
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-700 block mb-1">
            Mittente <span class="text-red-500">*</span>
          </label>
          <select id="ods-mittente"
                  class="w-full border border-slate-300 rounded-lg p-2 text-sm">
            <option value="">— Scegli —</option>
            <option>RUP</option>
            <option>Direttore Lavori</option>
            <option>Capo Area</option>
            <option>Struttura Territoriale ANAS</option>
            <option>Sede ANAS Roma</option>
            <option>Prefettura</option>
            <option>ASL</option>
            <option>Altro</option>
          </select>
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-700 block mb-1">Data ODS</label>
          <input type="date" id="ods-data"
                 value="${new Date().toISOString().slice(0,10)}"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm">
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-700 block mb-1">Protocollo / Riferimento</label>
          <input type="text" id="ods-protocollo"
                 placeholder="Es. Prot. 2026/12345"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm">
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-700 block mb-1">Oggetto sintetico</label>
          <input type="text" id="ods-oggetto"
                 placeholder="Es. Sospensione lavorazioni KM 42+000"
                 class="w-full border border-slate-300 rounded-lg p-2 text-sm">
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-700 block mb-1">Note / Azioni richieste</label>
          <textarea id="ods-note" rows="3"
                    placeholder="Cosa chiede l'ODS?"
                    class="w-full border border-slate-300 rounded-lg p-2 text-sm resize-y"></textarea>
        </div>

        ${!projectId ? `
          <div>
            <label class="text-xs font-semibold text-slate-700 block mb-1">Cantiere (se specifico)</label>
            <select id="ods-cantiere"
                    class="w-full border border-slate-300 rounded-lg p-2 text-sm">
              <option value="">— Generico / Nessun cantiere —</option>
            </select>
          </div>
        ` : `
          <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded">
            Cantiere: <strong>${escapeHtml(projectId)}</strong>
          </div>
        `}
      </div>
      <div class="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t">
        <button onclick="document.getElementById('modal-nuovo-ods').remove()"
                class="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold
                       hover:bg-slate-100">Annulla</button>
        <button id="btn-salva-ods"
                class="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold
                       hover:bg-blue-800">
          💾 Archivia
        </button>
      </div>
    </div>
  `;

  modal._file = file;
  modal._projectId = projectId;
  document.body.appendChild(modal);

  // Popola select cantieri se serve
  if (!projectId) {
    getAll('projects').then(projects => {
      const sel = document.getElementById('ods-cantiere');
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.id} — ${p.nome || ''}`;
        sel.appendChild(opt);
      });
    });
  }

  document.getElementById('btn-salva-ods').onclick = async () => {
    const mittente   = document.getElementById('ods-mittente').value;
    const dataOds    = document.getElementById('ods-data').value;
    const protocollo = document.getElementById('ods-protocollo').value.trim();
    const oggetto    = document.getElementById('ods-oggetto').value.trim();
    const note       = document.getElementById('ods-note').value.trim();
    const cantiereScelto = projectId || document.getElementById('ods-cantiere')?.value || '';

    if (!mittente) {
      showToast('Seleziona un mittente.', 'warning');
      return;
    }

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const tags = ['ods-ricevuto'];
      if (cantiereScelto) tags.push(`cantiere:${cantiereScelto}`);

      const doc = {
        id:         'ods_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        nome:       file.name,
        tipo:       file.type,
        dimensione: file.size,
        blob:       blob,
        tags:       tags,
        categoria:  'ods-ricevuto',
        mittente,
        dataOds,
        protocollo,
        oggetto,
        note,
        uploadedAt: new Date().toISOString()
      };

      await saveItem('documenti', doc);
      modal.remove();
      showToast(`ODS archiviato ✓`, 'success');
      if (typeof showCheckmark === 'function') showCheckmark();
      // Ricarica la view se visibile
      renderOdsRicevuti('view-ods-ricevuti-container', projectId);
    } catch (err) {
      showToast('Errore: ' + err.message, 'error');
    }
  };
}

// ─────────────────────────────────────────────
// 4. Azioni sui singoli ODS
// ─────────────────────────────────────────────
async function visualizzaOds(odsId) {
  const ods = await getItem('documenti', odsId);
  if (!ods || !ods.blob) { showToast('Documento non trovato.', 'error'); return; }
  const url = URL.createObjectURL(ods.blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function scaricaOds(odsId) {
  const ods = await getItem('documenti', odsId);
  if (!ods || !ods.blob) { showToast('Documento non trovato.', 'error'); return; }

  if (typeof salvaDocumento === 'function') {
    await salvaDocumento({
      filename:     ods.nome,
      blob:         ods.blob,
      cantiereId:   window.appState?.currentProject,
      cantiereNome: window.appState?.projectName,
      tipoDoc:      'documento',
      titoloCondivisione: `ODS Ricevuto — ${ods.oggetto || ods.nome}`
    });
  } else {
    const url = URL.createObjectURL(ods.blob);
    const a = document.createElement('a');
    a.href = url; a.download = ods.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function rimuoviOds(odsId) {
  if (!confirm('Rimuovere questo ODS dall\'archivio?\n\nIl file NON sarà più recuperabile.')) return;
  try {
    await deleteItem('documenti', odsId);
    showToast('ODS rimosso ✓', 'info');
    renderOdsRicevuti('view-ods-ricevuti-container', window.appState?.currentProject);
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

async function modificaOdsMetadati(odsId) {
  const ods = await getItem('documenti', odsId);
  if (!ods) return;

  const nuovoOggetto = prompt('Oggetto:', ods.oggetto || '');
  if (nuovoOggetto === null) return;
  const nuovoProt = prompt('Protocollo:', ods.protocollo || '');
  if (nuovoProt === null) return;

  ods.oggetto    = nuovoOggetto.trim();
  ods.protocollo = nuovoProt.trim();
  ods.modifiedAt = new Date().toISOString();
  await saveItem('documenti', ods);
  showToast('Metadati aggiornati ✓', 'success');
  renderOdsRicevuti('view-ods-ricevuti-container', window.appState?.currentProject);
}
