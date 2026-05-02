// salvataggio.js — Salvataggio unificato ANAS SafeHub
// Destinazioni: USB / PC / OneDrive
// Formati: PDF (stampa), Word (.doc), JSON
// Dogano Casella · Ispettore ANAS SpA

// ─────────────────────────────────────────────
// 1. Pannello scelta salvataggio
//    Chiamato da: export.js, verbali-list.js
// ─────────────────────────────────────────────
function mostraPannelloSalvataggio(opzioni = {}) {
  /*
    opzioni = {
      titolo:       string   — es. "Verbale del 15/01/2025"
      onPDF:        function — callback per export PDF
      onWord:       function — callback per export Word
      onJSON:       function — callback per export JSON
      onEmail:      function — callback per email
      nascondWord:  bool     — se true non mostra Word
      nascondJSON:  bool     — se true non mostra JSON
    }
  */
  const existing = document.getElementById('pannello-salvataggio');
  if (existing) existing.remove();

  // Coercizione esplicita a bool — previene problemi con stringhe 'true'/'false'
  const mostraWord = !opzioni.nascondWord;
  const mostraJSON = !opzioni.nascondJSON;
  const panel = document.createElement('div');
  panel.id        = 'pannello-salvataggio';
  panel.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'save-panel-title');

  panel.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

      <!-- Header -->
      <div class="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
        <div>
          <h2 id="save-panel-title" class="font-bold text-sm">💾 Salva / Esporta Documento</h2>
          ${opzioni.titolo ? `<div class="text-xs text-slate-400 mt-0.5">${escapeHtml(opzioni.titolo)}</div>` : ''}
        </div>
        <button onclick="chiudiPannelloSalvataggio()"
                class="text-slate-400 hover:text-white text-xl focus:outline-none"
                aria-label="Chiudi">✕</button>
      </div>

      <!-- Sezione Formato -->
      <div class="p-5 space-y-4">

        <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
          Scegli formato e destinazione
        </div>

        <!-- PDF -->
        ${opzioni.onPDF ? `
        <div class="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-slate-800 text-sm">🖨️ PDF (Stampa / Salva)</div>
              <div class="text-xs text-slate-500 mt-1">
                Apre la finestra di stampa. Scegli "Salva come PDF"
                per salvare su PC, USB o OneDrive.
              </div>
            </div>
            <button onclick="_salvaPDF()" 
                    class="shrink-0 bg-red-600 text-white text-xs px-4 py-2 rounded-lg
                           hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 font-semibold">
              Apri PDF
            </button>
          </div>
        </div>` : ''}

        <!-- Word -->
        ${mostraWord ? `
        <div class="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-slate-800 text-sm">📄 Word (.doc)</div>
              <div class="text-xs text-slate-500 mt-1">
                Scarica un file editabile in Word, LibreOffice o Google Docs.
                Salvalo dove vuoi (PC, USB, OneDrive).
              </div>
            </div>
            <button onclick="_salvaWord()"
                    class="shrink-0 bg-blue-600 text-white text-xs px-4 py-2 rounded-lg
                           hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold">
              Scarica .doc
            </button>
          </div>
        </div>` : ''}

        <!-- JSON -->
        ${mostraJSON ? `
        <div class="border border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-slate-800 text-sm">📦 Archivio JSON</div>
              <div class="text-xs text-slate-500 mt-1">
                Backup completo dei dati del cantiere in formato JSON.
                Reimportabile in qualsiasi copia dell'app.
              </div>
            </div>
            <button onclick="_salvaJSON()"
                    class="shrink-0 bg-slate-700 text-white text-xs px-4 py-2 rounded-lg
                           hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 font-semibold">
              Scarica JSON
            </button>
          </div>
        </div>` : ''}

        <!-- Destinazioni -->
        <div class="bg-slate-50 rounded-xl p-4 space-y-2">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">
            📍 Dove salvare il file scaricato
          </div>
          <div class="space-y-1.5 text-xs text-slate-600">
            <div class="flex items-start gap-2">
              <span class="text-green-600 shrink-0 mt-0.5">✓</span>
              <span><strong>PC locale:</strong> il browser scarica nella cartella Download — poi sposta il file dove vuoi</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-green-600 shrink-0 mt-0.5">✓</span>
              <span><strong>OneDrive:</strong> nelle impostazioni browser imposta la cartella OneDrive come destinazione download</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-green-600 shrink-0 mt-0.5">✓</span>
              <span><strong>USB:</strong> usa il salvataggio diretto su USB (File System API, solo Chrome)</span>
            </div>
          </div>
          <!-- Salvataggio diretto su USB via File System Access API -->
          <button onclick="_salvaDirectoUSB()"
                  class="mt-2 w-full text-center text-xs bg-slate-800 text-white px-3 py-2 rounded-lg
                         hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            💾 Salva direttamente su USB / Cartella (Chrome)
          </button>
        </div>

        <!-- Email -->
        ${opzioni.onEmail ? `
        <div class="border border-indigo-200 bg-indigo-50 rounded-xl p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-indigo-800 text-sm">✉️ Invia via Email / Outlook</div>
              <div class="text-xs text-indigo-600 mt-1">
                Apre Outlook (o il client email predefinito) con i dati precompilati.
                Allega manualmente il PDF dopo averlo salvato.
              </div>
            </div>
            <button onclick="_apriEmail()"
                    class="shrink-0 bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg
                           hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold">
              Apri Email
            </button>
          </div>
        </div>` : ''}

      </div>
    </div>
  `;

  // Chiudi cliccando fuori o con Escape
  panel.addEventListener('click', (e) => { if (e.target === panel) chiudiPannelloSalvataggio(); });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiPannelloSalvataggio(); });

  // Salva le callbacks nel DOM
  panel._onPDF   = opzioni.onPDF   || null;
  panel._onWord  = opzioni.onWord  || null;
  panel._onJSON  = opzioni.onJSON  || null;
  panel._onEmail = opzioni.onEmail || null;

  document.body.appendChild(panel);
}

function chiudiPannelloSalvataggio() {
  document.getElementById('pannello-salvataggio')?.remove();
}

// Handler interni — leggono i callback dal panel
function _salvaPDF()   { const p = document.getElementById('pannello-salvataggio'); if (p?._onPDF)   { p._onPDF();   chiudiPannelloSalvataggio(); } }
function _salvaWord()  { const p = document.getElementById('pannello-salvataggio'); if (p?._onWord)  { p._onWord();  chiudiPannelloSalvataggio(); } }
function _salvaJSON()  { const p = document.getElementById('pannello-salvataggio'); if (p?._onJSON)  { p._onJSON();  chiudiPannelloSalvataggio(); } }
function _apriEmail()  { const p = document.getElementById('pannello-salvataggio'); if (p?._onEmail) { p._onEmail(); } }

// Salvataggio diretto su USB via File System Access API
async function _salvaDirectoUSB() {
  if (!window.showSaveFilePicker) {
    showToast('Salvataggio diretto disponibile solo su Chrome. Usa il download normale.', 'warning');
    return;
  }
  // Usa la funzione di export JSON esistente con FSAPI
  if (typeof exportDatabaseWithFSAPI === 'function') {
    chiudiPannelloSalvataggio();
    await exportDatabaseWithFSAPI();
  }
}

// ─────────────────────────────────────────────
// 2. Export Word (.doc) — HTML con MIME Word
//    Aperto da Word, LibreOffice, Google Docs
// ─────────────────────────────────────────────
function scaricaComeWord(htmlContenuto, nomeFile = 'documento') {
  const wordTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <meta name=ProgId content=Word.Document>
      <meta name=Generator content="ANAS SafeHub">
      <!--[if gte mso 9]>
      <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>
      <![endif]-->
      <style>
        @page { margin: 2cm; }
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          color: #1e293b;
          line-height: 1.5;
        }
        h1 { font-size: 16pt; color: #0f172a; margin-bottom: 6pt; }
        h2 { font-size: 13pt; color: #1e40af; margin-top: 12pt; margin-bottom: 4pt;
             border-bottom: 1px solid #e2e8f0; padding-bottom: 2pt; }
        h3 { font-size: 11pt; color: #475569; margin-top: 8pt; text-transform: uppercase;
             letter-spacing: 0.05em; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; font-size: 10pt; }
        th, td { border: 1px solid #cbd5e1; padding: 5pt 8pt; }
        th { background: #f1f5f9; font-weight: bold; }
        .intestazione { border-bottom: 2px solid #0f172a; padding-bottom: 8pt; margin-bottom: 16pt; }
        .campo { margin-bottom: 8pt; }
        .label { font-size: 9pt; font-weight: bold; text-transform: uppercase;
                 letter-spacing: 0.05em; color: #64748b; }
        .valore { font-size: 11pt; margin-top: 1pt; }
        .firma-box { width: 200pt; height: 60pt; border: 1px solid #94a3b8;
                     margin-top: 4pt; border-radius: 3pt; }
        .footer-word { font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0;
                       padding-top: 4pt; margin-top: 16pt; text-align: center; }
        .highlight { background: #fefce8; padding: 4pt 8pt; border-left: 3px solid #ca8a04; }
      </style>
    </head>
    <body>
      ${htmlContenuto}
      <div style="font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 4pt; margin-top: 16pt; text-align: center;">
        Documento generato dal Sistema Informativo in data ${new Date().toLocaleString('it-IT')}
      </div>
    </body>
    </html>
  `;

  const blob     = new Blob([wordTemplate], { type: 'application/msword' });
  const filename = `${nomeFile.replace(/[^a-z0-9_\-]/gi, '_')}.doc`;

  if (typeof salvaDocumento === 'function') {
    salvaDocumento({
      filename,
      blob,
      cantiereId:   window.appState?.currentProject,
      cantiereNome: window.appState?.projectName,
      tipoDoc:      'documento',
      titoloCondivisione: nomeFile
    });
    return;
  }

  // Fallback estremo
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  showToast('File Word scaricato ✓', 'success');
}

// ─────────────────────────────────────────────
// 3. Export Word del Verbale
// ─────────────────────────────────────────────
async function exportVerbaleWord(verbaleId, tipoExport = 'word') {
  let imp = {};
  if (typeof caricaImpostazioni === 'function') {
    imp = await caricaImpostazioni();
  }

  let v = null;
  if (verbaleId) {
    const verbali = await getAll('verbali').catch(() => []);
    v = verbali.find(x => x.id === verbaleId);
  } else {
    v = {
      data: document.getElementById('verbale-data')?.value,
      km: document.getElementById('verbale-km')?.value,
      oggetto: document.getElementById('verbale-oggetto')?.value,
      meteo: document.getElementById('verbale-meteo')?.value,
      impresePresenti: Array.from(document.getElementById('verbale-imprese')?.selectedOptions || []).map(o => o.value),
      referenti: document.getElementById('verbale-referenti')?.value,
      statoLuoghi: document.getElementById('verbale-stato-luoghi')?.value,
      note: document.getElementById('verbale-note')?.value,
      projectId: window.appState?.currentProject,
      firmante: imp.firmaNome || 'Geom. Dogano Casella'
    };
  }
  if (!v) { showToast('Verbale non trovato.', 'error'); return; }

  const dataLabel = v.data
    ? new Date(v.data).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '–';

  const logoSxHtml = imp.logoSinistro
    ? `<img src="${imp.logoSinistro}" style="max-height:100pt; max-width:300pt;">`
    : `<div style="font-size:10pt; color:#64748b;">${imp.studioNome || ''}</div>`;

  const logoDxHtml = imp.logoDestro
    ? `<img src="${imp.logoDestro}" style="max-height:100pt; max-width:300pt;">`
    : `<div style="font-size:10pt; color:#64748b;">${imp.committenteNome || 'ANAS SpA'}</div>`;

  const firmaImg = v.firma
    ? `<img src="${v.firma}" style="max-width:180pt; max-height:70pt; border:1px solid #e2e8f0;">`
    : `<div class="firma-box"></div>`;

  let normativaClean = imp.normativa || 'D.Lgs 81/08 · D.I. 22/01/2019';
  if (normativaClean.includes('Contratto ANAS')) {
    normativaClean = normativaClean.replace(' · Contratto ANAS', '').replace('· Contratto ANAS', '');
  }

  const html = `
    <!-- INTESTAZIONE -->
    <div class="intestazione">
      <table style="border:none; width:100%;">
        <tr>
          <td style="border:none; width:50%; vertical-align:middle;">${logoDxHtml}</td>
          <td style="border:none; width:50%; vertical-align:middle; text-align:right;">${logoSxHtml}</td>
        </tr>
        <tr>
          <td colspan="2" style="border:none; text-align:center; padding-top:8pt;">
            <h1 style="margin:0;">VERBALE DI SOPRALLUOGO CSE</h1>
            <div style="font-size:10pt; color:#64748b;">${normativaClean}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- DATI PRINCIPALI -->
    <table>
      <tr>
        <th>Data</th><td>${dataLabel}</td>
        <th>Cantiere (ID)</th><td>${escapeHtml(v.projectId) || '–'}</td>
      </tr>
      <tr>
        <th>Progressiva KM</th><td>${escapeHtml(v.km) || '–'}</td>
        <th>Condizioni Meteo</th><td>${escapeHtml(v.meteo) || '–'}</td>
      </tr>
      ${imp.rup || imp.dl ? `
      <tr>
        <th>R.U.P.</th><td>${escapeHtml(imp.rup) || '–'}</td>
        <th>D.L.</th><td>${escapeHtml(imp.dl) || '–'}</td>
      </tr>` : ''}
    </table>

    <div class="campo">
      <div class="label">Oggetto del sopralluogo</div>
      <div class="valore">${escapeHtml(v.oggetto) || '–'}</div>
    </div>

    <div class="campo">
      <div class="label">Imprese presenti</div>
      <div class="valore">${(v.impresePresenti || []).map(i => '· ' + escapeHtml(i)).join('<br>') || '–'}</div>
    </div>

    <div class="campo">
      <div class="label">Referenti / Preposti presenti</div>
      <div class="valore">${escapeHtml(v.referenti) || '–'}</div>
    </div>

    <div class="campo">
      <div class="label">Stato dei luoghi e lavorazioni in corso</div>
      <div class="valore" style="white-space:pre-wrap;">${escapeHtml(v.statoLuoghi) || '–'}</div>
    </div>

    ${v.note ? `
    <div class="campo highlight">
      <div class="label">Note / Prescrizioni CSE</div>
      <div class="valore" style="white-space:pre-wrap;">${escapeHtml(v.note)}</div>
    </div>` : ''}

    <!-- FIRMA -->
    <table style="margin-top:20pt; width:100%;">
      <tr>
        <td style="width:50%; vertical-align:top; border:none; padding-right:16pt;">
          <div class="label">Firma del CSE</div>
          ${firmaImg}
          <div style="margin-top:6pt; font-weight:bold;">${escapeHtml(imp.firmaNome || v.firmante || 'Dogano Casella')}</div>
          <div style="font-size:9pt; color:#64748b;">${escapeHtml(imp.firmaQualifica || 'CSE')}</div>
          ${imp.firmaAlbo && !imp.firmaAlbo.includes('Albo Geometri') ? `<div style="font-size:9pt; color:#64748b;">${escapeHtml(imp.firmaAlbo)}</div>` : ''}
          ${v.firmaTimestamp ? `<div style="font-size:9pt; color:#94a3b8;">Firmato il: ${new Date(v.firmaTimestamp).toLocaleString('it-IT')}</div>` : ''}
        </td>
        <td style="width:50%; vertical-align:top; border:none; padding-left:16pt;">
          <div class="label">Timbro / Per ricevuta</div>
          <div class="firma-box" style="width:100%; height:80pt;"></div>
        </td>
      </tr>
    </table>
  `;

  if (tipoExport === 'anteprima') {
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Popup bloccato — abilita i popup per la stampa.', 'warning');
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Anteprima Verbale di Sopralluogo</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11pt; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
          th, td { border: 1px solid #000; padding: 6pt 8pt; vertical-align: top; text-align: left; }
          th { background-color: #f8fafc; width: 20%; font-weight: bold; }
          .label { font-weight: bold; color: #1e293b; margin-top: 12pt; margin-bottom: 4pt; }
          .valore { padding: 6pt 8pt; border: 1px solid #000; background: #fff; min-height: 24pt; }
          @media print {
            body { padding: 0; margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
            🖨️ Stampa Verbale
          </button>
        </div>
        ${html}
      </body>
      </html>
    `);
    win.document.close();
    return;
  }

  scaricaComeWord(html, `Verbale_CSE_${v.projectId || ''}_${dataLabel.replace(/\//g, '-')}`);
}

// ─────────────────────────────────────────────
// 4. Export Word della NC
// ─────────────────────────────────────────────
async function exportNCWord(ncId) {
  const list = await getAll('nc').catch(() => []);
  const n    = list.find(x => x.id === ncId);
  if (!n) { showToast('NC non trovata.', 'error'); return; }

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  const html = `
    <div class="intestazione">
      <h1>NON CONFORMITÀ — ${(n.livello || '').toUpperCase()}</h1>
      <div style="font-size:10pt; color:#64748b;">D.Lgs 81/08 · ANAS SafeHub</div>
    </div>

    <table>
      <tr><th>Cantiere</th><td>${escapeHtml(n.projectId) || '–'}</td>
          <th>Livello</th><td style="font-weight:bold; color:#dc2626;">${(n.livello || '').toUpperCase()}</td></tr>
      <tr><th>Stato</th><td>${escapeHtml(n.stato) || '–'}</td>
          <th>Data Apertura</th><td>${n.dataApertura ? new Date(n.dataApertura).toLocaleString('it-IT') : '–'}</td></tr>
      <tr><th>Scadenza</th><td colspan="3" style="color:#dc2626; font-weight:bold;">
        ${n.dataScadenza ? new Date(n.dataScadenza).toLocaleString('it-IT') : '–'}
      </td></tr>
    </table>

    ${n.titolo ? `<div class="campo"><div class="label">Titolo</div><div class="valore">${escapeHtml(n.titolo)}</div></div>` : ''}

    <div class="campo">
      <div class="label">Descrizione Non Conformità</div>
      <div class="valore highlight" style="white-space:pre-wrap;">${escapeHtml(n.descrizione) || '–'}</div>
    </div>

    <div style="margin-top:20pt;">
      <div class="label">Firma del CSE</div>
      <div class="firma-box" style="margin-top:4pt;"></div>
      <div style="margin-top:4pt; font-weight:bold;">${escapeHtml(imp.firmaNome || 'Dogano Casella')}</div>
      <div style="font-size:9pt; color:#64748b;">Coordinatore Sicurezza in Esecuzione (CSE)</div>
    </div>
  `;

  const dataLabel = n.dataApertura
    ? new Date(n.dataApertura).toLocaleDateString('it-IT').replace(/\//g, '-')
    : 'data';

  scaricaComeWord(html, `NC_${n.livello || ''}_${n.projectId || ''}_${dataLabel}`);
}

// ─────────────────────────────────────────────
// 5. Export Word del Lavoratore
// ─────────────────────────────────────────────
async function exportLavoratoreWord(lavId) {
  const list = await getAll('lavoratori').catch(() => []);
  const l    = list.find(x => x.id === lavId);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }

  const idoneitaColore = {
    'idoneo':         '#dcfce7',
    'non idoneo':     '#fee2e2',
    'non verificata': '#f1f5f9'
  };
  const bg = idoneitaColore[l.idoneita] || '#f1f5f9';

  const html = `
    <div class="intestazione">
      <h1>SCHEDA LAVORATORE</h1>
      <div style="font-size:10pt; color:#64748b;">D.Lgs 81/08 · ANAS SafeHub</div>
    </div>

    <table>
      <tr>
        <th>Nome e Cognome</th>
        <td style="font-weight:bold;">${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}</td>
        <th>Codice Fiscale</th>
        <td style="font-family:monospace;">${escapeHtml(l.cf) || '–'}</td>
      </tr>
      <tr>
        <th>Mansione</th>
        <td>${escapeHtml(l.mansione) || '–'}</td>
        <th>Idoneità Lavorativa</th>
        <td style="background:${bg}; font-weight:bold;">${escapeHtml(l.idoneita) || 'Non verificata'}</td>
      </tr>
    </table>

    <h2>DPI Consegnati</h2>
    ${l.dpi?.length > 0
      ? `<table>
           <tr>${l.dpi.map(d => `<td>✅ ${escapeHtml(d)}</td>`).join('')}</tr>
         </table>`
      : '<p style="color:#94a3b8; font-style:italic;">Nessun DPI registrato.</p>'}

    <h2>Formazione</h2>
    ${l.formazione?.length > 0
      ? `<ul>${l.formazione.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
      : '<p style="color:#94a3b8; font-style:italic;">Nessuna formazione registrata.</p>'}

    <h2>Dichiarazione di Consegna DPI</h2>
    <p>Il sottoscritto <strong>${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}</strong>
    dichiara di aver ricevuto i DPI sopra elencati in data ___________
    e di essere stato istruito sul corretto utilizzo.</p>

    <table style="margin-top:20pt; width:100%;">
      <tr>
        <td style="width:50%; border:none; vertical-align:top; padding-right:16pt;">
          <div class="label">Firma del Lavoratore</div>
          <div class="firma-box" style="margin-top:4pt;"></div>
          <div style="margin-top:4pt; font-size:9pt; color:#64748b;">
            ${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}
          </div>
        </td>
        <td style="width:50%; border:none; vertical-align:top; padding-left:16pt;">
          <div class="label">Firma del CSE / Datore di Lavoro</div>
          <div class="firma-box" style="margin-top:4pt;"></div>
        </td>
      </tr>
    </table>
  `;

  scaricaComeWord(html, `Scheda_Lavoratore_${l.cognome || ''}_${l.nome || ''}`);
}

// ─────────────────────────────────────────────
// 6. Export Word dell'Impresa
// ─────────────────────────────────────────────
async function exportImpresaWord(impresaId) {
  const list    = await getAll('imprese').catch(() => []);
  const impresa = list.find(x => x.id === impresaId);
  if (!impresa) { showToast('Impresa non trovata.', 'error'); return; }

  const lavoratori = await getAll('lavoratori').catch(() => []);
  const lavImpresa = lavoratori.filter(l => l.impresaId === impresaId);

  const html = `
    <div class="intestazione">
      <h1>SCHEDA IMPRESA</h1>
      <div style="font-size:10pt; color:#64748b;">D.Lgs 81/08 · ANAS SafeHub</div>
    </div>

    <table>
      <tr>
        <th>Ragione Sociale</th>
        <td style="font-weight:bold; font-size:13pt;" colspan="3">${escapeHtml(impresa.nome) || '–'}</td>
      </tr>
      <tr>
        <th>P.IVA / C.F.</th><td style="font-family:monospace;">${escapeHtml(impresa.piva || impresa.id) || '–'}</td>
        <th>Ruolo</th><td>${escapeHtml(impresa.ruolo) || '–'}</td>
      </tr>
      <tr>
        <th>Referente / Preposto</th><td>${escapeHtml(impresa.referente) || '–'}</td>
        <th>Contatto</th><td>${escapeHtml(impresa.contatto) || '–'}</td>
      </tr>
    </table>

    <h2>Lavoratori dell'Impresa (${lavImpresa.length})</h2>
    ${lavImpresa.length > 0
      ? `<table>
           <tr>
             <th>Nome e Cognome</th><th>Mansione</th>
             <th>Idoneità</th><th>DPI</th>
           </tr>
           ${lavImpresa.map(l => `
             <tr>
               <td>${escapeHtml(l.nome)} ${escapeHtml(l.cognome)}</td>
               <td>${escapeHtml(l.mansione) || '–'}</td>
               <td>${escapeHtml(l.idoneita) || '–'}</td>
               <td>${(l.dpi || []).map(d => escapeHtml(d)).join(', ') || '–'}</td>
             </tr>
           `).join('')}
         </table>`
      : '<p style="color:#94a3b8; font-style:italic;">Nessun lavoratore registrato.</p>'}
  `;

  scaricaComeWord(html, `Scheda_Impresa_${(impresa.nome || '').replace(/\s+/g, '_')}`);
}
