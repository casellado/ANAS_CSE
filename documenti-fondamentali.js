// documenti-fondamentali.js — Checklist documenti obbligatori per cantiere
//
// Un cantiere non può essere considerato operativo senza tutti i documenti
// fondamentali. Questo modulo:
//   1. Definisce la lista standard di documenti richiesti
//   2. Permette drag&drop per caricarli
//   3. Segnala quali mancano con banner rosso sulla dashboard
//   4. Blocca (o almeno avverte) se si prova a lavorare senza completarli

// ─────────────────────────────────────────────
// Lista documenti fondamentali standard ANAS
// ─────────────────────────────────────────────
const DOCUMENTI_FONDAMENTALI = [
  {
    id: 'psc',
    nome: 'PSC — Piano Sicurezza e Coordinamento',
    descrizione: 'Redatto dal CSP prima dell\'affidamento (art. 100 D.Lgs 81/08)',
    obbligatorio: true,
    riferimentoNorma: 'Art. 100 D.Lgs 81/08'
  },
  {
    id: 'pos',
    nome: 'POS — Piano Operativo Sicurezza',
    descrizione: 'Almeno uno per impresa esecutrice (art. 89 D.Lgs 81/08)',
    obbligatorio: true,
    riferimentoNorma: 'Art. 89 D.Lgs 81/08'
  },
  {
    id: 'notifica-preliminare',
    nome: 'Notifica Preliminare',
    descrizione: 'Trasmessa ad ASL e Direzione Territoriale Lavoro prima dell\'inizio',
    obbligatorio: true,
    riferimentoNorma: 'Art. 99 D.Lgs 81/08'
  },
  {
    id: 'nomina-cse',
    nome: 'Nomina CSE',
    descrizione: 'Atto formale di designazione del Coordinatore in Esecuzione',
    obbligatorio: true,
    riferimentoNorma: 'Art. 90 c.3 D.Lgs 81/08'
  },
  {
    id: 'contratto-affidamento',
    nome: 'Contratto di Affidamento / ODS di avvio',
    descrizione: 'Contratto ANAS con impresa affidataria',
    obbligatorio: true,
    riferimentoNorma: 'Codice Appalti D.Lgs 36/2023'
  },
  {
    id: 'fascicolo-opera',
    nome: 'Fascicolo dell\'Opera',
    descrizione: 'Aggiornamento continuo ex art. 92 c.1 lett. b',
    obbligatorio: true,
    riferimentoNorma: 'Art. 92 D.Lgs 81/08'
  },
  {
    id: 'itp-completa',
    nome: 'ITP Completa (Allegato XVII)',
    descrizione: 'DURC, CCIAA, DVR, Organico e Contratti per Affidataria e Subappaltatori',
    obbligatorio: true,
    riferimentoNorma: 'Allegato XVII D.Lgs 81/08'
  },
  {
    id: 'durc-affidataria',
    nome: 'DURC — Impresa Affidataria',
    descrizione: 'Documento unico di regolarità contributiva (validità 120 gg)',
    obbligatorio: false, // reso opzionale perché inglobato nell'ITP Completa
    riferimentoNorma: 'DM 30/01/2015'
  },
  {
    id: 'iscrizione-cciaa',
    nome: 'Iscrizione CCIAA — Impresa Affidataria',
    descrizione: 'Visura camerale aggiornata',
    obbligatorio: false, // reso opzionale perché inglobato nell'ITP Completa
    riferimentoNorma: 'Allegato XVII D.Lgs 81/08'
  },
  {
    id: 'elenco-lavoratori',
    nome: 'Elenco Lavoratori + Formazione',
    descrizione: 'Lista lavoratori con attestati formazione base, specifica e preposto',
    obbligatorio: true,
    riferimentoNorma: 'Art. 37 D.Lgs 81/08'
  },
  {
    id: 'duvri',
    nome: 'DUVRI — Documento Unico Valutazione Rischi Interferenze',
    descrizione: 'Solo se ci sono interferenze con utenza o altre attività',
    obbligatorio: false,
    riferimentoNorma: 'Art. 26 D.Lgs 81/08'
  },
  {
    id: 'autorizzazioni',
    nome: 'Autorizzazioni ANAS (interferenze stradali)',
    descrizione: 'Ordinanza di limitazione traffico, occupazione suolo',
    obbligatorio: true,
    riferimentoNorma: 'Codice della Strada'
  },
  {
    id: 'pimus',
    nome: 'Pi.M.U.S. (Ponteggi)',
    descrizione: 'Piano Montaggio Uso e Smontaggio per eventuali ponteggi metallici',
    obbligatorio: false,
    riferimentoNorma: 'Art. 136 D.Lgs 81/08'
  },
  {
    id: 'spazi-confinati',
    nome: 'Procedure Spazi Confinati',
    descrizione: 'Procedure specifiche per lavori in galleria o ambienti sospetti',
    obbligatorio: false,
    riferimentoNorma: 'D.P.R. 177/2011'
  }
];

// ─────────────────────────────────────────────
// 1. Render della checklist per un cantiere
// ─────────────────────────────────────────────
async function renderDocumentiFondamentali(containerId, projectId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!projectId) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-sm">
        Seleziona un cantiere per vedere i documenti fondamentali.
      </div>`;
    return;
  }

  // Carica documenti già presenti
  const tuttiDocs = await getAll('documenti').catch(() => []);
  // Un documento fondamentale è legato a un cantiere + un id fondamentale
  // Usiamo il campo tags per identificarli: ["fondamentale:psc", "cantiere:CZ399"]
  const docsCantiere = tuttiDocs.filter(d =>
    (d.tags || []).includes(`cantiere:${projectId}`)
  );

  // Indicizza i fondamentali caricati per ID
  const caricati = {};
  docsCantiere.forEach(d => {
    const fondTag = (d.tags || []).find(t => t.startsWith('fondamentale:'));
    if (fondTag) caricati[fondTag.substring(13)] = d;
  });

  // Calcola stato
  const totali     = DOCUMENTI_FONDAMENTALI.filter(d => d.obbligatorio).length;
  const presenti   = DOCUMENTI_FONDAMENTALI.filter(d => d.obbligatorio && caricati[d.id]).length;
  const mancanti   = totali - presenti;
  const percentuale = Math.round((presenti / totali) * 100);

  const statoColor = mancanti === 0 ? 'green' : mancanti <= 2 ? 'orange' : 'red';
  const statoIcon  = mancanti === 0 ? '✅' : '⚠️';
  const statoMsg   = mancanti === 0
    ? 'Cantiere pronto: tutti i documenti obbligatori sono presenti'
    : `Cantiere NON pronto: ${mancanti} documenti obbligatori mancanti`;

  container.innerHTML = `
    <!-- Banner stato cantiere -->
    <div class="bg-${statoColor}-50 border-l-4 border-${statoColor}-500 rounded-r-xl p-4 mb-4
                ${mancanti > 0 ? 'alert-pulse' : ''}"
         role="status" aria-live="polite">
      <div class="flex items-center gap-3">
        <div class="text-3xl" aria-hidden="true">${statoIcon}</div>
        <div class="flex-1">
          <div class="font-bold text-${statoColor}-900 text-sm">${escapeHtml(statoMsg)}</div>
          <div class="text-xs text-${statoColor}-700 mt-1">
            Completati ${presenti} di ${totali} documenti obbligatori (${percentuale}%)
          </div>
          <div class="w-full bg-${statoColor}-100 rounded-full h-2 mt-2 overflow-hidden">
            <div class="h-full bg-${statoColor}-500 transition-all duration-500"
                 style="width: ${percentuale}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista documenti -->
    <div class="space-y-2">
      ${DOCUMENTI_FONDAMENTALI.map(def => _renderDocRow(def, caricati[def.id], projectId)).join('')}
    </div>

    <!-- Zona drop globale -->
    <div id="doc-fond-drop-zone"
         class="mt-4 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center
                hover:border-blue-400 hover:bg-blue-50 transition"
         aria-label="Trascina qui i documenti">
      <div class="text-3xl mb-2" aria-hidden="true">📎</div>
      <div class="text-sm font-semibold text-slate-700">
        Trascina qui i documenti fondamentali
      </div>
      <div class="text-xs text-slate-500 mt-1">
        Oppure clicca i singoli riquadri sopra per caricare un documento specifico.
      </div>
    </div>
  `;

  _wireDragDrop('doc-fond-drop-zone', projectId);
  _wireRowDrops(projectId);
}

// ─────────────────────────────────────────────
// 2. Render di una singola riga documento
// ─────────────────────────────────────────────
function _renderDocRow(def, docCaricato, projectId) {
  const presente = !!docCaricato;
  const optionale = !def.obbligatorio;
  const stato = presente
    ? 'presente'
    : optionale ? 'opzionale' : 'mancante';

  const colori = {
    presente:  { bg: 'bg-green-50',  border: 'border-green-300',  icon: '✅', iconColor: 'text-green-600' },
    mancante:  { bg: 'bg-red-50',    border: 'border-red-300',    icon: '🔴', iconColor: 'text-red-600' },
    opzionale: { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: '⚪', iconColor: 'text-slate-500' }
  };
  const c = colori[stato];

  return `
    <div class="doc-fond-row ${c.bg} ${c.border} border rounded-xl p-3 flex items-start gap-3
                cursor-pointer hover:shadow-md transition"
         data-doc-id="${escapeHtml(def.id)}"
         data-project-id="${escapeHtml(projectId)}"
         role="button" tabindex="0"
         aria-label="${def.nome}, stato: ${stato}">
      <div class="text-2xl shrink-0" aria-hidden="true">${c.icon}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-semibold text-sm text-slate-800">
              ${escapeHtml(def.nome)}
              ${optionale ? '<span class="text-xs text-slate-500 font-normal">(opzionale)</span>' : ''}
            </div>
            <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(def.descrizione)}</div>
            <div class="text-xs text-slate-400 mt-1 font-mono">${escapeHtml(def.riferimentoNorma)}</div>
          </div>
        </div>

        ${presente ? `
          <div class="mt-2 flex items-center justify-between gap-2 bg-white rounded-lg p-2 border border-slate-200">
            <div class="flex items-center gap-2 text-xs min-w-0">
              <span aria-hidden="true">📄</span>
              <span class="font-medium text-slate-700 truncate">${escapeHtml(docCaricato.nome)}</span>
              <span class="text-slate-400 shrink-0">
                ${docCaricato.uploadedAt ? new Date(docCaricato.uploadedAt).toLocaleDateString('it-IT') : ''}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="event.stopPropagation(); scaricaDocFondamentale('${escapeHtml(docCaricato.id)}')"
                      class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      aria-label="Scarica documento">
                📥
              </button>
              <button onclick="event.stopPropagation(); rimuoviDocFondamentale('${escapeHtml(docCaricato.id)}', '${escapeHtml(projectId)}')"
                      class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                      aria-label="Rimuovi documento">
                🗑️
              </button>
            </div>
          </div>
        ` : `
          <div class="mt-2 text-xs text-slate-500 italic">
            Clicca o trascina qui il documento per caricarlo
          </div>
        `}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 3. Drag & drop globale (uno o più file)
// ─────────────────────────────────────────────
function _wireDragDrop(zoneId, projectId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('bg-blue-100', 'border-blue-500');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('bg-blue-100', 'border-blue-500');
  });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('bg-blue-100', 'border-blue-500');
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Se c'è un solo file, chiedi a quale documento associarlo
    if (files.length === 1) {
      _chiediAssociazione(files[0], projectId);
    } else {
      // Più file: carichiamoli come "generici" nella cartella documenti del cantiere
      for (const f of files) {
        await _caricaDocumentoGenerico(f, projectId);
      }
      showToast(`Caricati ${files.length} documenti.`, 'success');
      renderDocumentiFondamentali('view-documenti-fondamentali-container', projectId);
    }
  });

  // Click apre input file
  zone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 1) {
        _chiediAssociazione(files[0], projectId);
      } else {
        for (const f of files) await _caricaDocumentoGenerico(f, projectId);
        showToast(`Caricati ${files.length} documenti.`, 'success');
        renderDocumentiFondamentali('view-documenti-fondamentali-container', projectId);
      }
    };
    input.click();
  });
}

// ─────────────────────────────────────────────
// 4. Drop su una riga specifica (associa direttamente al tipo)
// ─────────────────────────────────────────────
function _wireRowDrops(projectId) {
  document.querySelectorAll('.doc-fond-row').forEach(row => {
    const docId = row.dataset.docId;

    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // non confondere con i bottoni
      _apriInputFileRiga(docId, projectId);
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _apriInputFileRiga(docId, projectId);
      }
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('ring-2', 'ring-blue-400');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('ring-2', 'ring-blue-400');
    });
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('ring-2', 'ring-blue-400');
      const file = e.dataTransfer.files[0];
      if (file) await _caricaDocumentoFondamentale(file, docId, projectId);
    });
  });
}

function _apriInputFileRiga(docId, projectId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) await _caricaDocumentoFondamentale(file, docId, projectId);
  };
  input.click();
}

// ─────────────────────────────────────────────
// 5. Modal "A quale documento associare?"
// ─────────────────────────────────────────────
function _chiediAssociazione(file, projectId) {
  const existing = document.getElementById('modal-associa-doc');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-associa-doc';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Scegli tipo documento');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[80vh] overflow-auto">
      <h3 class="font-bold text-slate-800 text-sm mb-2">A che documento corrisponde?</h3>
      <div class="text-xs text-slate-500 mb-4">File: <strong>${escapeHtml(file.name)}</strong></div>
      <div class="space-y-1">
        ${DOCUMENTI_FONDAMENTALI.map(def => `
          <button onclick="_confermaAssociazione('${escapeHtml(def.id)}')"
                  class="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-sm"
                  data-doc-def="${escapeHtml(def.id)}">
            <div class="font-semibold text-slate-800">${escapeHtml(def.nome)}</div>
            <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(def.descrizione)}</div>
          </button>
        `).join('')}
        <button onclick="_confermaAssociazione('generico')"
                class="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-slate-400 text-sm mt-3">
          <div class="font-semibold text-slate-600">📄 Altro documento (non obbligatorio)</div>
        </button>
      </div>
      <button onclick="document.getElementById('modal-associa-doc').remove()"
              class="mt-4 w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200">
        Annulla
      </button>
    </div>
  `;

  // Salva file temporaneo nel modal per accesso successivo
  modal._file = file;
  modal._projectId = projectId;

  document.body.appendChild(modal);
}

async function _confermaAssociazione(docDefId) {
  const modal = document.getElementById('modal-associa-doc');
  if (!modal) return;
  const file = modal._file;
  const projectId = modal._projectId;
  modal.remove();

  if (docDefId === 'generico') {
    await _caricaDocumentoGenerico(file, projectId);
  } else {
    await _caricaDocumentoFondamentale(file, docDefId, projectId);
  }
  renderDocumentiFondamentali('view-documenti-fondamentali-container', projectId);
}

// ─────────────────────────────────────────────
// 6. Salvataggio documento fondamentale
// ─────────────────────────────────────────────
async function _caricaDocumentoFondamentale(file, docDefId, projectId) {
  const def = DOCUMENTI_FONDAMENTALI.find(d => d.id === docDefId);
  if (!def) return;

  try {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const doc = {
      id:         'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      nome:       file.name,
      tipo:       file.type,
      dimensione: file.size,
      tags:       [`cantiere:${projectId}`, `fondamentale:${docDefId}`],
      categoria:  'fondamentale',
      blob:       blob,
      uploadedAt: new Date().toISOString(),
      defNome:    def.nome
    };

    await saveItem('documenti', doc);
    showToast(`"${def.nome}" caricato ✓`, 'success');
    if (typeof showCheckmark === 'function') showCheckmark();
    renderDocumentiFondamentali('view-documenti-fondamentali-container', projectId);
  } catch (err) {
    showToast('Errore caricamento: ' + err.message, 'error');
  }
}

async function _caricaDocumentoGenerico(file, projectId) {
  try {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const doc = {
      id:         'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      nome:       file.name,
      tipo:       file.type,
      dimensione: file.size,
      tags:       [`cantiere:${projectId}`, 'documento:generico'],
      categoria:  'generico',
      blob:       blob,
      uploadedAt: new Date().toISOString()
    };
    await saveItem('documenti', doc);
  } catch (err) {
    console.error('Errore:', err);
  }
}

// ─────────────────────────────────────────────
// 7. Azioni documento
// ─────────────────────────────────────────────
async function scaricaDocFondamentale(docId) {
  const doc = await getItem('documenti', docId);
  if (!doc || !doc.blob) { showToast('Documento non trovato.', 'error'); return; }

  if (typeof salvaDocumento === 'function') {
    await salvaDocumento({
      filename: doc.nome,
      blob:     doc.blob,
      cantiereId:   window.appState?.currentProject,
      cantiereNome: window.appState?.projectName,
      tipoDoc:  'documento'
    });
  } else {
    const url = URL.createObjectURL(doc.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function rimuoviDocFondamentale(docId, projectId) {
  if (!confirm('Rimuovere questo documento?')) return;
  try {
    await deleteItem('documenti', docId);
    showToast('Documento rimosso ✓', 'info');
    renderDocumentiFondamentali('view-documenti-fondamentali-container', projectId);
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// ─────────────────────────────────────────────
// 8. Helper pubblico — check stato per Hub/Dashboard
// ─────────────────────────────────────────────
async function getStatoDocFondamentali(projectId) {
  const tuttiDocs = await getAll('documenti').catch(() => []);
  const docsCantiere = tuttiDocs.filter(d =>
    (d.tags || []).includes(`cantiere:${projectId}`)
  );

  const caricati = {};
  docsCantiere.forEach(d => {
    const fondTag = (d.tags || []).find(t => t.startsWith('fondamentale:'));
    if (fondTag) caricati[fondTag.substring(13)] = d;
  });

  const obbligatori = DOCUMENTI_FONDAMENTALI.filter(d => d.obbligatorio);
  const mancanti    = obbligatori.filter(d => !caricati[d.id]);

  return {
    totali:     obbligatori.length,
    presenti:   obbligatori.length - mancanti.length,
    mancanti:   mancanti.length,
    lista:      mancanti,
    completo:   mancanti.length === 0
  };
}
