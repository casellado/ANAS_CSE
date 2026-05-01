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
    firmante:        window.appState._firmaNome || 'Geom. Dogano Casella',
    createdAt:       new Date().toISOString()
  };

  await saveItem('verbali', riunione);

  showToast('Riunione di Coordinamento salvata ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  document.getElementById('form-riunione')?.reset();
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
    ? `<img src="${logoAnas}" style="max-height:15mm; max-width:25mm; object-fit:contain;">`
    : `<div style="font-size:14pt; font-weight:bold; color:#0369a1;">ANAS</div>`;

  const html = `
    <!-- CONTENITORE LAYOUT INDUSTRIALE DETERMINISTICO -->
    <div style="width:180mm; min-height:257mm; margin:0 auto; font-family:Arial, sans-serif; box-sizing:border-box; color:#000; font-size:10pt;">

      <!-- 3) HEADER COMPLETO -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm; border-bottom:1.5pt solid #0f172a;">
        <tr>
          <td style="width:25mm; height:15mm; vertical-align:middle; text-align:left; padding:0; border:none;">
            ${logoAnasHtml}
          </td>
          <td style="width:95mm; height:15mm; vertical-align:middle; text-align:center; padding:0; border:none;">
            <div style="font-size:12pt; font-weight:bold; text-transform:uppercase;">
              Riunione di Coordinamento
            </div>
          </td>
          <td style="width:60mm; height:15mm; vertical-align:middle; text-align:right; padding:0; border:none;">
            <div style="font-size:9pt; color:#475569; line-height:1.3;">
              <strong>Mod. RE. 01-10</strong><br>
              Vers. 3.0 del 22/01/2024<br>
              <span style="font-size:8pt; font-style:italic;">D.Lgs 81/08</span>
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

      <!-- 10) FIRMA FINALE -->
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:90mm; border:none; padding:4pt 0; text-align:left; vertical-align:top; font-size:9pt;">
            <strong>Il Coordinatore per la Sicurezza (CSE)</strong><br><br><br><br>
            <span>__________________________</span><br>
            <span style="font-size:8pt; color:#475569;">${escapeHtml(imp.riuTecnicoNome || imp.firmaNome || 'Geom. Dogano Casella')}</span>
          </td>
          <td style="width:90mm; border:none; padding:4pt 0; text-align:right; vertical-align:top; font-size:9pt;">
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
  await exportRiunioneWord(riunioneId);  // genera Word
  // Poi apri stampa
  if (typeof apriStampaRiunione === 'function') {
    apriStampaRiunione(riunioneId);
  } else {
    window.print();
  }
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
