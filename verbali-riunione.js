// verbali-riunione.js — Riunione di Coordinamento (Mod.RE.01-10)
// Form, salvataggio IndexedDB, export Word (.doc) e PDF
// Geom. Dogano Casella — Ispettore ANAS SpA

// ─────────────────────────────────────────────
// 1. Salva Riunione di Coordinamento
// ─────────────────────────────────────────────
async function salvaRiunione(event) {
  if (event) event.preventDefault();

  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  const data = document.getElementById('riunione-data')?.value;
  if (!data) {
    showToast('La data della riunione è obbligatoria.', 'warning');
    document.getElementById('riunione-data')?.focus();
    return;
  }

  const tipoRiunione = Array.from(
    document.querySelectorAll('input[name="tipo-riunione"]:checked')
  ).map(cb => cb.value);

  // Presenti ANAS
  const presentiANAS = (document.getElementById('riunione-presenti-anas')?.value || '').trim();

  // P3: Imprese presenti = multi-select (imprese del cantiere) + textarea referenti liberi
  const impreseSelect = document.getElementById('riunione-presenti-imprese-select');
  const impreseSelezionate = impreseSelect
    ? Array.from(impreseSelect.selectedOptions).map(o => o.value)
    : [];
  const referentiLiberi = (document.getElementById('riunione-presenti-imprese')?.value || '').trim();

  // Combina: elenco imprese + eventuali referenti aggiuntivi
  const presentiImprese = [
    ...impreseSelezionate,
    ...(referentiLiberi ? [referentiLiberi] : [])
  ].join('\n');

  // Argomenti aggiuntivi
  const argomentiLiberi = (document.getElementById('riunione-argomenti-liberi')?.value || '').trim();

  // Criticità e decisioni
  const criticita  = (document.getElementById('riunione-criticita')?.value || '').trim();
  const decisioni  = (document.getElementById('riunione-decisioni')?.value || '').trim();

  const riunione = {
    id:              'riu_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
    tipo:            'riunione-coordinamento',
    projectId:       window.appState.currentProject,
    data:            document.getElementById('riunione-data')?.value || new Date().toISOString().slice(0,10),
    tipoRiunione,
    presentiANAS,
    presentiImprese,
    impreseSelezionate,   // P3: lista strutturata (utile per export/analisi)
    referentiLiberi,
    argomentiLiberi,
    criticita,
    decisioni,
    // BUG-2 FIX: campo Note motivazionali (sempre presente per tutti gli esiti)
    noteDecisione:   (document.getElementById('riunione-note-decisione')?.value || '').trim(),
    firma:           window._firmaCorrenteRiunione?.png || null,
    firmaTimestamp:  window._firmaCorrenteRiunione?.timestamp || null,
    firmante:        (await caricaImpostazioni().catch(()=>({}))).firmaNome || 'Geom. Dogano Casella',
    presenti:        typeof _raccogliPresentiRiunione === 'function' ? _raccogliPresentiRiunione() : [],
    createdAt:       new Date().toISOString()
  };
  
  if (!riunione.noteDecisione) {
    showToast('La motivazione del CSE è obbligatoria.', 'warning');
    document.getElementById('riunione-note-decisione')?.focus();
    return;
  }

  await saveItem('verbali', riunione);

  showToast('Riunione di Coordinamento salvata ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  document.getElementById('form-riunione')?.reset();
  window._firmaCorrenteRiunione = null;
  if (typeof renderFirmaCanvas === 'function') {
    renderFirmaCanvas('firma-riunione-container', (firmaData) => {
      window._firmaCorrenteRiunione = firmaData;
    });
  }
  if (typeof _resetPresentiRiunione === 'function') _resetPresentiRiunione();
  if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
}

// ─────────────────────────────────────────────
// 2. Export Word — Mod.RE.01-10
//    Usa scaricaComeWord() da salvataggio.js
// ─────────────────────────────────────────────
async function exportRiunioneWord(riunioneId, tipoExport = 'word') {
  const verbali = await getAll('verbali').catch(() => []);
  const r = riunioneId
    ? verbali.find(x => x.id === riunioneId)
    : null;

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  // Legge i campi dal form se non abbiamo un ID (export live durante compilazione)
  const data = r?.data
    ? new Date(r.data).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
    : (document.getElementById('riunione-data')?.value
        ? new Date(document.getElementById('riunione-data').value)
            .toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
        : '___________');

  const tipiScelti  = r?.tipoRiunione
    || Array.from(document.querySelectorAll('input[name="tipo-riunione"]:checked')).map(c => c.value);

  const pAnasVal    = r?.presentiANAS    || document.getElementById('riunione-presenti-anas')?.value    || '';
  const pImpVal     = r?.presentiImprese || document.getElementById('riunione-presenti-imprese')?.value || '';
  const argLiberi   = r?.argomentiLiberi || document.getElementById('riunione-argomenti-liberi')?.value || '';
  const critVal     = r?.criticita       || document.getElementById('riunione-criticita')?.value        || '';
  const decVal      = r?.decisioni       || document.getElementById('riunione-decisioni')?.value        || '';
  // BUG-2 FIX: Note motivazionali
  const noteDecVal  = r?.noteDecisione   || document.getElementById('riunione-note-decisione')?.value   || '';

  // Presenti con firma (FLUSSO 1)
  const presentiFirmati = r?.presenti || (typeof _raccogliPresentiRiunione === 'function' ? _raccogliPresentiRiunione() : []);

  const cantiere = window.appState?.currentProject || '______';
  const nomeCant = window.appState?.projectName    || '';

  // Tipi riunione con checkbox
  const TIPI = ['preliminare', 'in corso d\'opera', 'ingresso nuove imprese', 'coordinamento RLS'];
  const tipiHtml = TIPI.map(t =>
    `<tr><td style="width:20px; border:none; padding:2pt 4pt;">${tipiScelti.includes(t) ? '☑' : '☐'}</td>
     <td style="border:none; font-size:10pt;">${escapeHtml(t)}</td></tr>`
  ).join('');

  // Argomenti fissi
  const argomenti = [
    'Illustrazione piano di sicurezza e coordinamento',
    'Piano operativo di sicurezza dell\'impresa _______________________________',
    'Attribuzione incarichi e competenze all\'interno del cantiere',
    'Individuazione dei responsabili di cantiere delle imprese esecutrici',
    'Modalità di gestione dei servizi e degli impianti comuni',
    'Sorveglianza sanitaria',
    'Coordinamento tra i RLS finalizzato al miglioramento della sicurezza in cantiere',
  ];

  const argHtml = argomenti.map(a => `<li style="margin:3pt 0; font-size:10pt;">${escapeHtml(a)}</li>`).join('');
  const argLibHtml = argLiberi
    ? argLiberi.split('\n').map(l => `<li style="margin:3pt 0; font-size:10pt;">${escapeHtml(l)}</li>`).join('')
    : '';

  // Righe vuote per firme presenti
  const righeAnas    = _generaRigheFirma(pAnasVal,    3);
  const righeImprese = _generaRigheFirma(pImpVal,     3);

  const logoAnas = imp.logoDestro || imp.logoSinistro;
  const logoAnasHtml = logoAnas
    ? `<img src="${logoAnas}" style="max-height:80pt; max-width:180pt; object-fit:contain;">`
    : `<div style="font-size:14pt; font-weight:bold; color:#0369a1;">ANAS</div>`;

  const html = `
    <!-- CONTENITORE LAYOUT INDUSTRIALE DETERMINISTICO -->
    <div style="width:180mm; min-height:257mm; margin:0 auto; font-family:Arial, sans-serif; box-sizing:border-box; color:#000; font-size:10pt;">

      <!-- 3) HEADER COMPLETO -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm; border-bottom:1.5pt solid #0f172a;">
        <tr>
          <td style="width:25%; height:15mm; vertical-align:middle; text-align:left; padding:0; border:none;">
            ${logoAnasHtml}
          </td>
          <td style="width:55%; height:15mm; vertical-align:middle; text-align:center; padding:0; border:none;">
            <h1 style="margin:0; font-size:11pt; text-transform:uppercase; white-space:nowrap;">RIUNIONE DI COORDINAMENTO</h1>
            <div style="font-size:9pt; color:#475569; margin-top:3pt;">
              Ai sensi dell'art. 92 c.1 lett. c) D.Lgs 81/08
            </div>
          </td>
          <td style="width:20%; height:15mm; vertical-align:middle; text-align:right; padding:0; border:none;">
            <div style="font-size:8.5pt; color:#475569;">
              <strong>Mod. RE. 01-10</strong><br>
              Vers. 3.0 del 22/01/2024
            </div>
          </td>
        </tr>
      </table>

      <!-- 4) BLOCCO DATI INIZIALI -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr>
          <td style="width:90mm; border:0.5pt solid #000; padding:4pt 6pt; height:8mm; vertical-align:top;">
            <strong>S.S. N°:</strong> ${escapeHtml(cantiere)}
          </td>
          <td style="width:90mm; border:0.5pt solid #000; padding:4pt 6pt; height:8mm; vertical-align:top;">
            <strong>Codice PPM/SIL:</strong> ${escapeHtml(imp.posCodicePpm || '___________')}
          </td>
        </tr>
        <tr>
          <td style="width:90mm; border:0.5pt solid #000; padding:4pt 6pt; height:8mm; vertical-align:top;">
            <strong>Lavoro di:</strong> ${escapeHtml(nomeCant || '_______________________________')}
          </td>
          <td style="width:90mm; border:0.5pt solid #000; padding:4pt 6pt; height:8mm; vertical-align:top;">
            <strong>Contratto n°:</strong> ___________________________________
          </td>
        </tr>
        <tr>
          <td colspan="2" style="width:180mm; border:0.5pt solid #000; padding:4pt 6pt; height:8mm; vertical-align:top;">
            <strong>Data riunione:</strong> ${data}
          </td>
        </tr>
      </table>

      <!-- 5 & 6) TIPO RIUNIONE (CHECKLIST) E FIRME PRESENTI -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
              Tipo Riunione
            </th>
            <th style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
              Presenti ANAS
            </th>
            <th style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
              Imprese Presenti
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; vertical-align:top;">
              <table style="width:100%; border-collapse:collapse;">
                ${tipiHtml}
              </table>
            </td>
            <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; vertical-align:top; font-size:9pt;">
              ${righeAnas || '<br><br><br><br>'}
            </td>
            <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; vertical-align:top; font-size:9pt;">
              ${righeImprese || '<br><br><br><br>'}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 7) ARGOMENTI DISCUSSI -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr style="background:#f1f5f9;">
          <th style="width:180mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
            Argomenti Discussi
          </th>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; vertical-align:top;">
            <ul style="margin:0; padding-left:14mm; font-size:9pt; line-height:1.4;">
              ${argHtml}
              ${argLibHtml}
            </ul>
            ${Array(4).fill('<div style="border-bottom:0.5pt solid #ccc; height:16pt;"></div>').join('')}
          </td>
        </tr>
      </table>

      <!-- 8) CRITICITÀ -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr style="background:#f1f5f9;">
          <th style="width:180mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
            Criticità riscontrate ed Osservazioni Emerse
          </th>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; height:25mm; vertical-align:top; font-size:9pt; line-height:1.4;">
            ${critVal ? escapeHtml(critVal).replace(/\n/g,'<br>') : '<div style="height:15mm;"></div>'}
          </td>
        </tr>
      </table>

      <!-- 9) DECISIONI -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr style="background:#f1f5f9;">
          <th style="width:180mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
            Istruzioni operative e Decisioni Intraprese
          </th>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; height:25mm; vertical-align:top; font-size:9pt; line-height:1.4;">
            ${decVal ? escapeHtml(decVal).replace(/\n/g,'<br>') : '<div style="height:15mm;"></div>'}
          </td>
        </tr>
      </table>

      <!-- 10) NOTE CSE / MOTIVAZIONE (BUG-2 FIX) -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr style="background:#f1f5f9;">
          <th style="width:180mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">
            Note CSE / Motivazione della Decisione
          </th>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; height:25mm; vertical-align:top; font-size:9pt; line-height:1.4;">
            ${noteDecVal ? escapeHtml(noteDecVal).replace(/\n/g,'<br>') : '<div style="height:15mm;"></div>'}
          </td>
        </tr>
      </table>

      ${(presentiFirmati && presentiFirmati.length > 0) ? `
      <!-- 10.5) PRESENTI CON FIRMA INDIVIDUALE -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr style="background:#f1f5f9;">
          <th style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;" colspan="4">
            Ulteriori Presenti alla Riunione (Presa Visione)
          </th>
        </tr>
        <tr style="background:#f8fafc;">
          <th style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:center; width:30pt;">N.</th>
          <th style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left;">Nome e Cognome</th>
          <th style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left; width:100pt;">Ruolo</th>
          <th style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:center; width:150pt;">Firma</th>
        </tr>
        ${presentiFirmati.map((p, i) => `
        <tr>
          <td style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:center; vertical-align:middle;">${i + 1}</td>
          <td style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left; vertical-align:middle;">${escapeHtml(p.nome || '–')}</td>
          <td style="border:0.5pt solid #000; padding:4pt 6pt; font-size:9pt; text-align:left; vertical-align:middle;">${escapeHtml(p.ruolo || '–')}</td>
          <td style="border:0.5pt solid #000; padding:4pt 6pt; text-align:center; vertical-align:middle;">
            ${p.firmaBase64
              ? `<img src="${p.firmaBase64}" style="max-width:120pt; max-height:35pt; object-fit:contain;">`
              : '<div style="height:35pt; width:100%; border-bottom:1pt dotted #94a3b8; margin-top:5pt;"></div>'}
          </td>
        </tr>`).join('')}
      </table>` : ''}

      <!-- 11) FIRMA FINALE -->
      <table style="width:100%; border-collapse:collapse; margin-top:8mm; border-top:1pt solid #cbd5e1; padding-top:4mm;">
        <tr>
          <td style="width:50%; border:none; padding:0 8mm 0 0; text-align:left; vertical-align:bottom;">
            <!-- Blocco firma CSE -->
            <div style="margin-bottom:2mm; font-size:8pt; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em;">
              Il Coordinatore per la Sicurezza (CSE)
            </div>
            ${(function() {
              // Priorità: 1. Firma salvata nel record, 2. Firma appena fatta (sessione), 3. Firma persistente
              const f = r?.firma || window._firmaCorrenteRiunione?.png || imp.firmaImmagine || null;
              if (f) return `
                <div style="padding:4pt; display:inline-block; margin-bottom:2mm;">
                  <img src="${f}" style="display:block; max-height:40pt; max-width:140pt; width:auto; height:auto; object-fit:contain;" alt="Firma CSE">
                </div>`;
              return '<div style="height:40pt; border-bottom:1px dashed #94a3b8; width:140pt; margin-bottom:2mm;"></div>';
            })()}
            <div style="font-size:9pt; font-weight:700; color:#0f172a;">${escapeHtml(imp.firmaNome || 'Geom. Dogano Casella')}</div>
            <div style="font-size:8pt; color:#64748b;">${escapeHtml(imp.firmaQualifica || 'Coordinatore Sicurezza (CSE)')}</div>
          </td>
          <td style="width:50%; border:none; padding:0 0 0 8mm; text-align:right; vertical-align:bottom;">
            &nbsp;
          </td>
        </tr>
      </table>

    </div>
  `;

  const nomeCantSafe = (cantiere || '').replace(/[^a-z0-9_\-]/gi,'_');
  const dataSafe     = data.replace(/\//g,'-');

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
        <title>Anteprima Riunione Coordinamento — ${cantiere || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
          td, th { border: 1px solid #0f172a; padding: 6pt 8pt; vertical-align: top; }
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

  if (typeof scaricaComeWord === 'function') {
    scaricaComeWord(html, `Riunione_Coordinamento_${nomeCantSafe}_${dataSafe}`);
  } else {
    showToast('Funzione Word non disponibile.', 'error');
  }
}

// ─────────────────────────────────────────────
// 3. Export PDF Riunione
// ─────────────────────────────────────────────
async function exportRiunionePDF(riunioneId) {
  await exportRiunioneWord(riunioneId, 'anteprima');
}

// ─────────────────────────────────────────────
// 4. Helper righe firma
// ─────────────────────────────────────────────
function _generaRigheFirma(testo, minRighe) {
  if (!testo) {
    return Array(minRighe).fill(
      '<div style="border-bottom:1px solid #ccc; height:18pt; margin:4pt 0;"></div>'
    ).join('');
  }
  return testo.split('\n').map(r =>
    `<div style="border-bottom:1px solid #ccc; padding:2pt 0; font-size:10pt;">${escapeHtml(r)}</div>`
  ).join('');
}

// ─────────────────────────────────────────────
// 5. Apri pannello salvataggio riunione
// ─────────────────────────────────────────────
function apriSalvataggioRiunione(riunioneId) {
  const id = riunioneId || null;
  if (typeof mostraPannelloSalvataggio === 'function') {
    mostraPannelloSalvataggio({
      titolo:      'Riunione di Coordinamento',
      nascondJSON: true,
      onPDF:       function() { exportRiunionePDF(id);  },
      onWord:      function() { exportRiunioneWord(id); },
      onEmail:     function() {
        if (typeof mostraPannelloEmail === 'function')
          mostraPannelloEmail({ tipo: 'generico' });
      }
    });
  } else {
    exportRiunioneWord(id);
  }
}

// ─────────────────────────────────────────────
// 6. FLUSSO 1 — Presenti alla Riunione con firma individuale
// ─────────────────────────────────────────────

window._presentiRiunioneCount = 0;
window._firmePresentiRiunione = [];

function aggiungiPresenteRiunione() {
  const MAX_PRESENTI = 15;
  if (window._presentiRiunioneCount >= MAX_PRESENTI) {
    if (typeof showToast === 'function') showToast(`Massimo ${MAX_PRESENTI} presenti raggiunto.`, 'warning');
    return;
  }

  const list = document.getElementById('presenti-riunione-list');
  if (!list) return;

  const idx = window._presentiRiunioneCount;
  window._presentiRiunioneCount++;

  if (!window._firmePresentiRiunione[idx]) window._firmePresentiRiunione[idx] = null;

  const RUOLI_PRESENTI = [
    { value: 'RL',           label: 'R.L. (Responsabile dei Lavori)' },
    { value: 'DL',           label: 'D.L. (Direttore dei Lavori)' },
    { value: 'Capocantiere', label: 'Capo cantiere' },
    { value: 'Preposto',     label: 'Preposto' },
    { value: 'RLS',          label: 'R.L.S. (Rappresentante Lavoratori)' },
    { value: 'Operaio',      label: 'Operaio' },
    { value: 'Tecnico',      label: 'Tecnico di cantiere' },
    { value: 'Rappresentante', label: 'Rappresentante Impresa' },
    { value: 'Altro',        label: 'Altro' }
  ];
  const ruoliOpts = RUOLI_PRESENTI.map(r => `<option value="${r.value}">${r.label}</option>`).join('');

  const row = document.createElement('div');
  row.id = `presente-riu-row-${idx}`;
  row.className = 'bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2';
  row.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-bold text-slate-500 uppercase">#${idx + 1}</span>
      <button type="button" onclick="rimuoviPresenteRiunione(${idx})"
              class="text-xs text-red-500 hover:text-red-700 font-semibold focus:outline-none"
              aria-label="Rimuovi presente ${idx + 1}">✕ Rimuovi</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div class="sm:col-span-2">
        <input id="presente-riu-nome-${idx}" type="text" placeholder="Nome e Cognome"
               class="w-full border border-slate-300 rounded-lg p-2 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none">
      </div>
      <div>
        <select id="presente-riu-ruolo-${idx}"
                class="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white
                       focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="">— Ruolo —</option>
          ${ruoliOpts}
        </select>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button type="button" onclick="apriCanvasFirmaPresenteRiunione(${idx})"
              class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
        ✍️ Firma
      </button>
      <span id="presente-riu-firma-stato-${idx}" class="text-xs text-slate-400">Non firmato</span>
    </div>
  `;

  list.appendChild(row);
  _aggiornaContatorePresentiRiunione();
}

function rimuoviPresenteRiunione(idx) {
  const row = document.getElementById(`presente-riu-row-${idx}`);
  if (row) row.remove();
  window._firmePresentiRiunione[idx] = null;
  _aggiornaContatorePresentiRiunione();
}

function _aggiornaContatorePresentiRiunione() {
  const countEl = document.getElementById('presenti-riunione-count');
  if (!countEl) return;
  const righePresenti = document.querySelectorAll('[id^="presente-riu-row-"]').length;
  countEl.textContent = `${righePresenti}/15 presenti`;
  countEl.classList.toggle('hidden', righePresenti === 0);
}

function apriCanvasFirmaPresenteRiunione(idx) {
  const nome = document.getElementById(`presente-riu-nome-${idx}`)?.value || `Presente #${idx + 1}`;

  const old = document.getElementById('modal-firma-presente-riu');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-firma-presente-riu';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  
  const canvasId = `firma-presente-riu-canvas-${idx}`;

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-slate-800">✍️ Firma di ${escapeHtml(nome)}</h3>
        <button onclick="document.getElementById('modal-firma-presente-riu').remove()"
                class="text-slate-400 hover:text-slate-700 text-lg font-bold focus:outline-none">&times;</button>
      </div>

      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div class="relative bg-white">
          <canvas id="${canvasId}"
                  width="600" height="180"
                  class="w-full touch-none cursor-crosshair block"
                  style="max-height:180px;">
          </canvas>
          <div class="absolute bottom-8 left-8 right-8 h-px bg-slate-200 pointer-events-none"></div>
          <div class="absolute bottom-2 left-8 text-[10px] text-slate-300 pointer-events-none select-none">
            Firma qui — ${escapeHtml(nome)}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button type="button" onclick="_firmaClearPresenteRiunione('${canvasId}')"
                class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none">
          🗑 Cancella
        </button>
        <button type="button" onclick="_firmaConfermaPresenteModalRiunione(${idx}, '${canvasId}')"
                class="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
          ✅ Conferma Firma
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => {
    if (typeof _initCanvasPresente === 'function') {
      _initCanvasPresente(canvasId);
    } else {
      // Fallback in caso verbali.js non sia stato caricato
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#1e293b';
      let drawing=false; let lx=0, ly=0;
      const getPos = (e) => {
        const r=canvas.getBoundingClientRect();
        return {
          x:( (e.touches ? e.touches[0].clientX : e.clientX) - r.left ) * (canvas.width/r.width),
          y:( (e.touches ? e.touches[0].clientY : e.clientY) - r.top ) * (canvas.height/r.height)
        };
      };
      const start = (e) => { e.preventDefault(); drawing=true; const p=getPos(e); lx=p.x; ly=p.y; };
      const draw = (e) => { if(!drawing)return; e.preventDefault(); const p=getPos(e); ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(p.x,p.y); ctx.stroke(); lx=p.x; ly=p.y; };
      const stop = () => { drawing=false; };
      canvas.addEventListener('mousedown',start); canvas.addEventListener('mousemove',draw);
      canvas.addEventListener('mouseup',stop); canvas.addEventListener('mouseleave',stop);
      canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchmove',draw,{passive:false}); canvas.addEventListener('touchend',stop);
    }
  }, 100);
}

function _firmaClearPresenteRiunione(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function _firmaConfermaPresenteModalRiunione(idx, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dataURL = canvas.toDataURL('image/png');
  const nome = document.getElementById(`presente-riu-nome-${idx}`)?.value || `Presente #${idx + 1}`;

  window._firmePresentiRiunione[idx] = {
    png: dataURL,
    timestamp: new Date().toISOString(),
    firmante: nome
  };

  const statoEl = document.getElementById(`presente-riu-firma-stato-${idx}`);
  if (statoEl) statoEl.innerHTML = `<span class="text-green-600 font-semibold">✅ Firmato</span>`;

  document.getElementById('modal-firma-presente-riu')?.remove();
  if (typeof showToast === 'function') showToast(`Firma di ${nome} acquisita ✓`, 'success');
}

function _raccogliPresentiRiunione() {
  const presenti = [];
  for (let i = 0; i < window._presentiRiunioneCount; i++) {
    const row = document.getElementById(`presente-riu-row-${i}`);
    if (!row) continue;
    const nome = (document.getElementById(`presente-riu-nome-${i}`)?.value || '').trim();
    if (!nome) continue;
    const ruolo = document.getElementById(`presente-riu-ruolo-${i}`)?.value || '';
    const firma = window._firmePresentiRiunione[i];
    presenti.push({
      nome,
      ruolo,
      firmaBase64: firma ? firma.png : null,
      timestampFirma: firma ? firma.timestamp : null
    });
  }
  return presenti;
}

function _resetPresentiRiunione() {
  const list = document.getElementById('presenti-riunione-list');
  if (list) list.innerHTML = '';
  window._presentiRiunioneCount = 0;
  window._firmePresentiRiunione = [];
  _aggiornaContatorePresentiRiunione();
}
