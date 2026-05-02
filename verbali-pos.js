// verbali-pos.js — Verifica Idoneità Piano Operativo di Sicurezza (Mod.RE.01-5)
// Form, salvataggio IndexedDB, export Word (.doc) e PDF
// Geom. Dogano Casella — Ispettore ANAS SpA

// ─────────────────────────────────────────────
// 1. Salva Verifica POS
// ─────────────────────────────────────────────
async function salvaVerificaPOS(event) {
  if (event) event.preventDefault();

  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  const esito = document.querySelector('input[name="pos-esito"]:checked')?.value || '';
  if (!esito) {
    showToast('Seleziona il giudizio di idoneità prima di salvare.', 'warning');
    return;
  }

  const nomeImpresaCheck = (document.getElementById('pos-impresa')?.value || '').trim();
  if (!nomeImpresaCheck) {
    showToast("Il nome dell'impresa è obbligatorio.", 'warning');
    document.getElementById('pos-impresa')?.focus();
    return;
  }

  const verificaPOS = {
    id:           'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
    tipo:         'verifica-pos',
    projectId:    window.appState.currentProject,
    data:         document.getElementById('pos-data')?.value || new Date().toISOString().slice(0,10),
    nomeImpresa:  (document.getElementById('pos-impresa')?.value || '').trim(),
    pecImpresa:   (document.getElementById('pos-pec')?.value    || '').trim(),
    esito,        // 'idoneo' | 'idoneo-con-integrazioni' | 'non-idoneo'
    integrazioni: (document.getElementById('pos-integrazioni')?.value || '').trim(),
    cse:          (document.getElementById('pos-cse')?.value || '').trim() || 'Geom. Dogano Casella',
    createdAt:    new Date().toISOString()
  };

  await saveItem('verbali', verificaPOS);

  showToast('Verifica POS salvata ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  document.getElementById('form-pos')?.reset();
  if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
}

// ─────────────────────────────────────────────
// 2. Export Word — Mod.RE.01-5
// ─────────────────────────────────────────────
async function exportPOSWord(posId, tipoExport = 'word') {
  const verbali = await getAll('verbali').catch(() => []);
  const p = posId ? verbali.find(x => x.id === posId) : null;

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  // Legge dal form se non abbiamo un ID salvato
  const nomeImpresa = p?.nomeImpresa || (document.getElementById('pos-impresa')?.value || '').trim();
  const pecImpresa  = p?.pecImpresa  || (document.getElementById('pos-pec')?.value    || '').trim();
  const esito       = p?.esito       || document.querySelector('input[name="pos-esito"]:checked')?.value || '';
  const integrazioni= p?.integrazioni|| (document.getElementById('pos-integrazioni')?.value || '').trim();
  const cse         = p?.cse         || imp.posTecnicoNome || imp.firmaNome || 'Geom. Dogano Casella';

  const data = p?.data
    ? new Date(p.data).toLocaleDateString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric'})
    : (document.getElementById('pos-data')?.value
        ? new Date(document.getElementById('pos-data').value)
            .toLocaleDateString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric'})
        : '___________');

  const cantiere = window.appState?.currentProject || '______';
  const nomeCant = window.appState?.projectName    || '';

  // Tre checkbox esito
  const isIdoneo  = esito === 'idoneo';
  const isConInt  = esito === 'idoneo-con-integrazioni';
  const isNonId   = esito === 'non-idoneo';

  function chk(val) { return val ? '☑' : '☐'; }

  const logoAnas = imp.logoDestro || imp.logoSinistro;
  const logoAnasHtml = logoAnas
    ? `<img src="${logoAnas}" style="max-height:30mm; max-width:50mm; object-fit:contain;">`
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
              Verifica Piano Operativo di Sicurezza
            </div>
          </td>
          <td style="width:60mm; height:15mm; vertical-align:middle; text-align:right; padding:0; border:none;">
            <div style="font-size:9pt; color:#475569; line-height:1.3;">
              <strong>Mod. RE. 01-5</strong><br>
              Vers. 3.0 del 22/01/2024<br>
              <span style="font-size:8pt; font-style:italic;">Ai sensi dell'art. 92 c.1 lett. b) D.Lgs 81/08</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- 4) METADATI (Griglia Stretta) -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <!-- Riga 1 -->
        <tr>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">PPM/SIL/OdA</strong><br>
            <div style="font-size:10pt;">${escapeHtml(imp.posCodicePpm || '___________')}</div>
          </td>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">Commessa</strong><br>
            <div style="font-size:10pt;">${escapeHtml(imp.posCommessa || '___________')}</div>
          </td>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">Protocollo</strong><br>
            <div style="font-size:10pt;">___________</div>
          </td>
        </tr>
        <!-- Riga 2 -->
        <tr>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">Voce Budget/Spesa</strong><br>
            <div style="font-size:10pt;">${escapeHtml(imp.posStruttura || '___________')}</div>
          </td>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">CUP</strong><br>
            <div style="font-size:10pt;">${escapeHtml(imp.posCUP || '___________')}</div>
          </td>
          <td style="width:60mm; border:0.5pt solid #000; padding:4pt 6pt; height:10mm; vertical-align:top;">
            <strong style="font-size:8pt; color:#475569;">CIG</strong><br>
            <div style="font-size:10pt;">${escapeHtml(imp.posCIG || '___________')}</div>
          </td>
        </tr>
      </table>

      <!-- 5) DESTINATARIO -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr>
          <td style="width:20mm; border:none; padding:4pt 0; vertical-align:top; font-size:10pt;">
            <strong>All'</strong>
          </td>
          <td style="width:160mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:10pt; vertical-align:top;">
            <strong>Impresa Affidataria:</strong> ${escapeHtml(nomeImpresa || '___________________________')}
          </td>
        </tr>
        <tr>
          <td style="width:20mm; border:none; padding:4pt 0; vertical-align:top; font-size:10pt;">
            <strong>PEC:</strong>
          </td>
          <td style="width:160mm; border:0.5pt solid #000; padding:4pt 6pt; font-size:10pt; vertical-align:top;">
            ${escapeHtml(pecImpresa || '_____________________________')}
          </td>
        </tr>
      </table>

      <!-- 6) OGGETTO / LAVORI -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm;">
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; font-size:10pt; vertical-align:top;">
            <strong>Oggetto:</strong> S.S. n° ${escapeHtml(cantiere)} — ${escapeHtml(nomeCant || '___________________________')}
          </td>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; font-size:10pt; vertical-align:top;">
            <strong>Lavori:</strong> ${escapeHtml(nomeCant || '___________________________________________')}
          </td>
        </tr>
        <tr>
          <td style="width:180mm; border:0.5pt solid #000; padding:6pt 8pt; font-size:10pt; vertical-align:top;">
            <strong>Cod. PPM/SIL:</strong> ${escapeHtml(imp.posCodicePpm || '___________')}
          </td>
        </tr>
      </table>

      <!-- 7) BLOCCO TESTO (Normativo) -->
      <div style="margin-bottom:5mm; text-align:justify; line-height:1.4; font-size:10pt;">
        <p style="margin-bottom:3mm;">
          Il sottoscritto <strong>${escapeHtml(cse)}</strong>, nella sua qualità di Coordinatore per l'Esecuzione dei lavori ai sensi e per gli effetti dell'art. 92 comma 1 del D.Lgs. 81/2008,
        </p>
        <div style="text-align:center; font-weight:bold; margin-bottom:3mm; font-size:11pt;">VISTO</div>
        <p style="margin-bottom:3mm;">
          il Piano Operativo di Sicurezza inoltrato da codesta Impresa Affidataria e verificata la congruenza dello stesso a quanto previsto dal D.Lgs 81/08,
        </p>
        <div style="text-align:center; font-weight:bold; margin-bottom:3mm; font-size:11pt;">DICHIARA</div>
      </div>

      <!-- 8) BLOCCO ESITO -->
      <div style="margin-bottom:5mm; font-size:10pt;">
        <!-- Riga 1: Idoneo -->
        <div style="display:flex; align-items:flex-start; margin-bottom:4mm;">
          <div style="font-size:14pt; margin-right:8mm; line-height:1;">${chk(isIdoneo)}</div>
          <div>
            <strong>idoneo</strong> il Piano Operativo di Sicurezza dell'impresa <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong>.
          </div>
        </div>

        <!-- Riga 2: Idoneo con integrazioni -->
        <div style="display:flex; align-items:flex-start; margin-bottom:4mm;">
          <div style="font-size:14pt; margin-right:8mm; line-height:1;">${chk(isConInt)}</div>
          <div>
            <strong>idoneo</strong> il Piano Operativo di Sicurezza dell'impresa <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong> con la richiesta delle seguenti integrazioni:
          </div>
        </div>
        ${isConInt && integrazioni ? `
        <div style="margin-left:12mm; margin-bottom:4mm; font-style:italic;">
          ${escapeHtml(integrazioni).replace(/\n/g,'<br>')}
        </div>` : `
        <div style="margin-left:12mm; margin-bottom:4mm; border-bottom:0.5pt solid #000; height:16pt;"></div>`}

        <!-- Riga 3: Non idoneo -->
        <div style="display:flex; align-items:flex-start; margin-bottom:4mm;">
          <div style="font-size:14pt; margin-right:8mm; line-height:1;">${chk(isNonId)}</div>
          <div>
            <strong>non idoneo</strong> il Piano Operativo di Sicurezza dell'impresa <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong>.
          </div>
        </div>
      </div>

      <!-- 9) FIRME -->
      <table style="width:100%; border-collapse:collapse; margin-top:6mm;">
        <tr>
          <td style="width:60mm; border:none; padding:4pt 0; text-align:left; vertical-align:top; font-size:9pt;">
            <strong>Coordinatore Sicurezza (CSE)</strong><br><br><br><br>
            <span>__________________________</span>
          </td>
          <td style="width:60mm; border:none; padding:4pt 0; text-align:center; vertical-align:top; font-size:9pt;">
            <strong>Responsabile dei Lavori</strong><br><br><br><br>
            <span>__________________________</span>
          </td>
          <td style="width:60mm; border:none; padding:4pt 0; text-align:right; vertical-align:top; font-size:9pt;">
            <strong>Responsabile Struttura</strong><br><br><br><br>
            <span>__________________________</span>
          </td>
        </tr>
      </table>

    </div>
  `;

  const nomeSafe = (nomeImpresa || 'impresa').replace(/[^a-z0-9_\-]/gi,'_');
  const dataSafe = data.replace(/\//g,'-');

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
        <title>Anteprima Verifica POS — ${nomeImpresa || ''}</title>
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
    scaricaComeWord(html, `Verifica_POS_${nomeSafe}_${dataSafe}`);
  } else {
    showToast('Funzione Word non disponibile.', 'error');
  }
}

// ─────────────────────────────────────────────
// 3. Export PDF Verifica POS
// ─────────────────────────────────────────────
async function exportPOSPDF(posId) {
  await exportPOSWord(posId, 'anteprima');
}

// ─────────────────────────────────────────────
// 4. Apri pannello salvataggio POS
// ─────────────────────────────────────────────
function apriSalvataggioVerificaPOS(posId) {
  const id = posId || null;
  if (typeof mostraPannelloSalvataggio === 'function') {
    mostraPannelloSalvataggio({
      titolo:      'Verifica Idoneità POS',
      nascondJSON: true,
      onPDF:       function() { exportPOSPDF(id);  },
      onWord:      function() { exportPOSWord(id); },
      onEmail:     function() {
        if (typeof mostraPannelloEmail === 'function')
          mostraPannelloEmail({ tipo: 'generico' });
      }
    });
  } else {
    exportPOSWord(id);
  }
}
