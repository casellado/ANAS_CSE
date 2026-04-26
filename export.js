// export.js - Esportazione PDF / JSON per ANAS SafeHub

// ─────────────────────────────────────────────
// 0. Download blob generico — delega a salvaDocumento
//    per picker nativo su desktop / share su mobile / fallback
// ─────────────────────────────────────────────
function downloadBlob(blob, filename, opts = {}) {
  if (typeof salvaDocumento === 'function') {
    return salvaDocumento({
      filename,
      blob,
      cantiereId:    opts.cantiereId   || window.appState?.currentProject,
      cantiereNome:  opts.cantiereNome || window.appState?.projectName,
      tipoDoc:       opts.tipoDoc      || 'documento',
      titoloCondivisione: opts.titolo  || filename
    });
  }
  // Fallback se salva-file.js non caricato
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─────────────────────────────────────────────
// 1. Raccolta dati cantiere corrente
// ─────────────────────────────────────────────
async function raccogliDatiCantiere() {
  const projectId = window.appState?.currentProject || null;

  const stores = ['verbali', 'nc', 'imprese', 'lavoratori', 'doc_links'];
  const result  = { meta: { esportatoIl: new Date().toISOString(), projectId } };

  for (const store of stores) {
    try { result[store] = await getAll(store); } catch (_) { result[store] = []; }
  }

  if (projectId) {
    const byProject = item => item.projectId === projectId;
    ['verbali', 'nc'].forEach(store => {
      if (result[store].length) result[store] = result[store].filter(byProject);
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 2. Export JSON archivio completo
// ─────────────────────────────────────────────
async function exportArchivioJSON() {
  const dati = await raccogliDatiCantiere();
  const blob  = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const nome  = `ANAS_SafeHub_${dati.meta.projectId || 'globale'}_${new Date().toISOString().slice(0,10)}.json`;
  downloadBlob(blob, nome);
  showToast('Archivio JSON esportato ✓', 'success');
}

// ─────────────────────────────────────────────
// 3. Export JSON singoli record
// ─────────────────────────────────────────────
async function exportVerbaleJSON(id) {
  const v = await getItem('verbali', id);
  if (!v) { showToast('Verbale non trovato.', 'error'); return; }
  downloadBlob(new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' }), `verbale_${id}.json`);
}

async function exportNCJSON(id) {
  const n = await getItem('nc', id);
  if (!n) { showToast('NC non trovata.', 'error'); return; }
  downloadBlob(new Blob([JSON.stringify(n, null, 2)], { type: 'application/json' }), `nc_${id}.json`);
}

async function exportImpresaJSON(id) {
  const impresa = await getItem('imprese', id);
  if (!impresa) { showToast('Impresa non trovata.', 'error'); return; }
  downloadBlob(new Blob([JSON.stringify(impresa, null, 2)], { type: 'application/json' }), `impresa_${id}.json`);
}

async function exportLavoratoreJSON(id) {
  const l = await getItem('lavoratori', id);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }
  downloadBlob(new Blob([JSON.stringify(l, null, 2)], { type: 'application/json' }), `lavoratore_${id}.json`);
}

// ─────────────────────────────────────────────
// 4. Export PDF (finestra di stampa)
// ─────────────────────────────────────────────
function apriFinestraStampa(titolo, htmlContenuto) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Impossibile aprire la finestra di stampa (popup bloccato?).', 'warning');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>${titolo} - ANAS SafeHub</title>
      <style>
        body        { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1          { font-size: 20px; margin-bottom: 4px; color: #0f172a; }
        h2, h3      { margin: 16px 0 4px; font-size: 14px; text-transform: uppercase;
                      letter-spacing: .05em; color: #475569; }
        .meta       { font-size: 11px; color: #94a3b8; margin-bottom: 16px; }
        .campo      { margin-bottom: 12px; }
        .label      { font-size: 11px; font-weight: bold; text-transform: uppercase;
                      letter-spacing: .05em; color: #64748b; }
        .valore     { font-size: 13px; margin-top: 2px; }
        table       { border-collapse: collapse; width: 100%; margin-top: 8px; }
        th, td      { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
        th          { background: #f1f5f9; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="meta">ANAS SafeHub · Stampato il ${new Date().toLocaleString('it-IT')}</div>
      ${htmlContenuto}
      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

async function exportVerbalePDF(id) {
  const v = await getItem('verbali', id);
  if (!v) { showToast('Verbale non trovato.', 'error'); return; }

  // Usa template personalizzato se impostazioni.js è caricato
  if (typeof caricaImpostazioni === 'function' &&
      typeof apriStampaVerbaleConImpostazioni === 'function') {
    const imp = await caricaImpostazioni();
    apriStampaVerbaleConImpostazioni(v, imp);
    return;
  }

  // Fallback base
  const _e = typeof escapeHtml === 'function' ? escapeHtml : (s) => (s || '');
  const firmaHtml = v.firma
    ? `<div style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
         <div class="label">Firma CSE</div>
         <img src="${v.firma}" style="max-width:300px; max-height:100px; border:1px solid #e2e8f0; border-radius:6px; margin-top:6px;" alt="Firma CSE">
         <div class="label" style="margin-top:4px;">${_e(v.firmante) || 'Geom. Dogano Casella — CSE'}</div>
         <div style="font-size:11px; color:#94a3b8;">
           Firmato il: ${v.firmaTimestamp ? new Date(v.firmaTimestamp).toLocaleString('it-IT') : '–'}
         </div>
       </div>`
    : `<div style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
         <div class="label">Firma CSE</div>
         <div style="width:300px;height:80px;border:1px solid #cbd5e1;border-radius:6px;
                     display:flex;align-items:flex-end;padding:8px;margin-top:6px;">
           <div style="font-size:11px;color:#94a3b8;">Geom. Dogano Casella — CSE</div>
         </div>
       </div>`;

  apriFinestraStampa('Verbale', `
    <h1>Verbale di Sopralluogo</h1>
    <div class="campo"><div class="label">Data</div><div class="valore">${_e(v.data) || '–'}</div></div>
    <div class="campo"><div class="label">Cantiere</div><div class="valore">${_e(v.projectId) || '–'}</div></div>
    <div class="campo"><div class="label">Progressiva KM</div><div class="valore">${_e(v.km) || '–'}</div></div>
    <div class="campo"><div class="label">Condizioni Meteo</div><div class="valore">${_e(v.meteo) || '–'}</div></div>
    <div class="campo"><div class="label">Oggetto</div><div class="valore">${_e(v.oggetto) || '–'}</div></div>
    <div class="campo"><div class="label">Imprese Presenti</div><div class="valore">${(v.impresePresenti || []).map(i => _e(i)).join(', ') || '–'}</div></div>
    <div class="campo"><div class="label">Referenti</div><div class="valore">${_e(v.referenti || '–').replace(/\n/g,'<br>')}</div></div>
    <div class="campo"><div class="label">Stato dei Luoghi</div><div class="valore">${_e(v.statoLuoghi || '–').replace(/\n/g,'<br>')}</div></div>
    <div class="campo"><div class="label">Note CSE</div><div class="valore">${_e(v.note || '–').replace(/\n/g,'<br>')}</div></div>
    ${firmaHtml}
  `);
}

async function exportNCPDF(id) {
  const n = await getItem('nc', id);
  if (!n) { showToast('NC non trovata.', 'error'); return; }

  const _e = typeof escapeHtml === 'function' ? escapeHtml : (s) => (s || '');
  apriFinestraStampa('Non Conformità', `
    <h1>Non Conformità — ${_e((n.livello || '').toUpperCase())}</h1>
    <div class="campo"><div class="label">Cantiere</div><div class="valore">${_e(n.projectId) || '–'}</div></div>
    <div class="campo"><div class="label">Livello</div><div class="valore">${_e(n.livello) || '–'}</div></div>
    <div class="campo"><div class="label">Stato</div><div class="valore">${_e(n.stato) || '–'}</div></div>
    <div class="campo"><div class="label">Data Apertura</div><div class="valore">${n.dataApertura ? new Date(n.dataApertura).toLocaleString('it-IT') : '–'}</div></div>
    <div class="campo"><div class="label">Scadenza</div><div class="valore">${n.dataScadenza ? new Date(n.dataScadenza).toLocaleString('it-IT') : '–'}</div></div>
    <div class="campo"><div class="label">Descrizione</div><div class="valore">${_e(n.descrizione || '–').replace(/\n/g,'<br>')}</div></div>
  `);
}

async function exportImpresaPDF(id) {
  const impresa = await getItem('imprese', id);
  if (!impresa) { showToast('Impresa non trovata.', 'error'); return; }

  const _e = typeof escapeHtml === 'function' ? escapeHtml : (s) => (s || '');
  apriFinestraStampa('Scheda Impresa', `
    <h1>${_e(impresa.nome) || '–'}</h1>
    <div class="campo"><div class="label">P.IVA / C.F.</div><div class="valore">${_e(impresa.piva || impresa.id) || '–'}</div></div>
    <div class="campo"><div class="label">Ruolo</div><div class="valore">${_e(impresa.ruolo) || '–'}</div></div>
    <div class="campo"><div class="label">Referente</div><div class="valore">${_e(impresa.referente) || '–'}</div></div>
    <div class="campo"><div class="label">Contatto</div><div class="valore">${_e(impresa.contatto) || '–'}</div></div>
  `);
}

async function exportLavoratorePDF(id) {
  const l = await getItem('lavoratori', id);
  if (!l) { showToast('Lavoratore non trovato.', 'error'); return; }

  const _e = typeof escapeHtml === 'function' ? escapeHtml : (s) => (s || '');
  apriFinestraStampa('Scheda Lavoratore', `
    <h1>${_e(l.nome) || ''} ${_e(l.cognome) || ''}</h1>
    <div class="campo"><div class="label">Codice Fiscale</div><div class="valore">${_e(l.cf) || '–'}</div></div>
    <div class="campo"><div class="label">Mansione</div><div class="valore">${_e(l.mansione) || '–'}</div></div>
    <div class="campo"><div class="label">Idoneità</div><div class="valore">${_e(l.idoneita) || '–'}</div></div>
    <h3>DPI Consegnati</h3>
    <ul>${(l.dpi || []).map(d => `<li>${_e(d)}</li>`).join('') || '<li>Nessuno</li>'}</ul>
    <h3>Formazione</h3>
    <ul>${(l.formazione || []).map(f => `<li>${_e(f)}</li>`).join('') || '<li>Nessuna formazione registrata</li>'}</ul>
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// MOD-25: ESPORTAZIONE MASSIVA (ZIP + PDF + FOTO)
// ─────────────────────────────────────────────────────────────────────────────

/** Genera un pacchetto ZIP completo del lotto corrente */
async function exportMassivoZIP() {
  const projectId = window.appState?.currentProject;
  if (!projectId) {
    showToast('Seleziona un progetto per l\'esportazione massiva.', 'warning');
    return;
  }

  if (!window.JSZip || !window.jspdf) {
    showToast('Librerie di esportazione non caricate.', 'error');
    return;
  }

  showToast('📦 Preparazione pacchetto massivo in corso...', 'info');

  try {
    const zip = new JSZip();
    const folderVerbali = zip.folder("Verbali");
    const folderFoto    = zip.folder("Foto_NC");
    const folderDati    = zip.folder("Dati_Tecnici");

    // 1. Dati JSON
    const dati = await raccogliDatiCantiere();
    folderDati.file(`struttura_dati_${projectId}.json`, JSON.stringify(dati, null, 2));

    // 2. Verbali in PDF
    const verbali = dati.verbali || [];
    if (verbali.length > 0) {
      console.log(`[Export] Generazione di ${verbali.length} PDF...`);
      for (const v of verbali) {
        const pdfBlob = await generaVerbalePDFBlob(v);
        const filename = `Verbale_${v.data.replace(/\//g, '-')}_${v.id.slice(-4)}.pdf`;
        folderVerbali.file(filename, pdfBlob);
      }
    }

    // 3. Foto Non Conformità
    const ncs = dati.nc || [];
    const tutteFoto = await getAll('foto');
    const fotoProgetto = tutteFoto.filter(f => ncs.some(n => n.id === f.ncId));

    if (fotoProgetto.length > 0) {
      console.log(`[Export] Inserimento di ${fotoProgetto.length} foto...`);
      for (const f of fotoProgetto) {
        if (f.blob) {
          const ext = f.blob.type === 'image/png' ? 'png' : 'jpg';
          folderFoto.file(`Foto_NC_${f.ncId}_${f.id.slice(-4)}.${ext}`, f.blob);
        }
      }
    }

    // 4. Generazione Finale
    const content = await zip.generateAsync({ type: 'blob' });
    const zipName = `CONSEGNA_FINALE_${projectId}_${new Date().toISOString().slice(0, 10)}.zip`;
    
    downloadBlob(content, zipName, { tipoDoc: 'archivio_zip' });
    showToast('📦 Pacchetto ZIP generato con successo ✓', 'success');

  } catch (err) {
    console.error('[Export] Errore esportazione massiva:', err);
    showToast('Errore durante la generazione dello ZIP.', 'error');
  }
}

/** Helper per generare un Blob PDF di un verbale senza aprire finestre */
async function generaVerbalePDFBlob(v) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 20;
  let cursor = 20;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Verbale di Sopralluogo", margin, cursor);
  cursor += 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`ANAS SafeHub · ID: ${v.id}`, margin, cursor);
  cursor += 15;

  // Campi
  const campi = [
    ["Data:", v.data],
    ["Cantiere:", v.projectId],
    ["Progressiva KM:", v.km],
    ["Meteo:", v.meteo],
    ["Oggetto:", v.oggetto],
    ["Imprese:", (v.impresePresenti || []).join(', ')],
    ["Referenti:", v.referenti],
    ["Stato Luoghi:", v.statoLuoghi],
    ["Note CSE:", v.note]
  ];

  doc.setFontSize(11);
  for (const [label, valore] of campi) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, cursor);
    
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    const textLines = doc.splitTextToSize(valore || "–", 150);
    doc.text(textLines, margin + 40, cursor);
    
    cursor += (textLines.length * 5) + 5;
    if (cursor > 270) { doc.addPage(); cursor = 20; }
  }

  // Firma (se presente)
  if (v.firma) {
    try {
      cursor += 10;
      doc.setFontSize(10);
      doc.text("Firma CSE:", margin, cursor);
      doc.addImage(v.firma, 'PNG', margin, cursor + 5, 50, 20);
      cursor += 30;
      doc.text(v.firmante || "Geom. Dogano Casella", margin, cursor);
    } catch (e) {
      console.warn("Impossibile inserire firma nel PDF:", e);
    }
  }

  return doc.output('blob');
}
