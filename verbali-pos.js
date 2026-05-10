// verbali-pos.js — Verifica Idoneità Piano Operativo di Sicurezza (Mod.RE.01-5)
// Form, salvataggio IndexedDB, export Word (.doc) e PDF
// Geom. Dogano Casella — Ispettore ANAS SpA

// ─────────────────────────────────────────────
// 1. Salva Verifica POS
// ─────────────────────────────────────────────
async function salvaVerificaPOS(event) {
  if (event) event.preventDefault();

  // BUG-2 FIX: Note obbligatorie e numerazione progressiva
  const noteCSE = (document.getElementById('pos-note')?.value || '').trim();
  
  // Calcolo progressivo annuale (AAAA/VAP-XX)
  const verbaliEsistenti = await getAll('verbali').catch(() => []);
  const annoCorrente = new Date().getFullYear();
  const countVAP = verbaliEsistenti.filter(v => 
    v.tipo === 'verifica-pos' && 
    v.data && v.data.startsWith(annoCorrente.toString())
  ).length + 1;
  const progressivoVAP = `${annoCorrente}/VAP-${String(countVAP).padStart(2, '0')}`;

  const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
  const firmaData = window._firmaCorrente || null;

  const verificaPOS = {
    id:           'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
    tipo:         'verifica-pos',
    protocollo:   progressivoVAP,
    stato:        'redatto',      // FLUSSO 2: workflow stato
    projectId:    window.appState.currentProject,
    data:         document.getElementById('pos-data')?.value || new Date().toISOString().slice(0,10),
    nomeImpresa:  (document.getElementById('pos-impresa')?.value || '').trim(),
    pecImpresa:   (document.getElementById('pos-pec')?.value    || '').trim(),
    esito,        // 'idoneo' | 'idoneo-con-integrazioni' | 'non-idoneo'
    integrazioni: (document.getElementById('pos-integrazioni')?.value || '').trim(),
    noteCSE,      // MOD-2: Motivazione decisione CSE
    cse:          (document.getElementById('pos-cse')?.value || '').trim() || 'Geom. Dogano Casella',
    firma:        firmaData ? firmaData.png : (imp.firmaImmagine || null),
    firmaTimestamp: firmaData ? firmaData.timestamp : null,
    protocolloANAS:   (document.getElementById('pos-protocollo-anas')?.value || '').trim(),
    dataProtocollo:   (document.getElementById('pos-data-protocollo')?.value || '').trim(),
    createdAt:    new Date().toISOString()
  };
  
  if (!verificaPOS.noteCSE) {
    showToast('La motivazione del CSE è obbligatoria per la verifica POS.', 'warning');
    document.getElementById('pos-note')?.focus();
    return;
  }
  
  if (!verificaPOS.nomeImpresa) {
    showToast("Inserire il nome dell'impresa esecutrice.", 'warning');
    document.getElementById('pos-impresa')?.focus();
    return;
  }

  await saveItem('verbali', verificaPOS);

  // MOD-7: Archiviazione automatica PDF
  try {
    if (typeof generaVerificaPOSPDFBlob === 'function' && typeof salvaDocumento === 'function') {
      const pdfBlob = await generaVerificaPOSPDFBlob(verificaPOS);
      const protSafe = (verificaPOS.protocollo || '').replace(/\//g, '_');
      const filename = `VAP_${protSafe}_${verificaPOS.nomeImpresa.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      await salvaDocumento({
        filename,
        blob: pdfBlob,
        cantiereId: verificaPOS.projectId,
        tipoDoc: 'verifica-pos',
        titoloCondivisione: `Verifica POS ${verificaPOS.protocollo} - ${verificaPOS.nomeImpresa}`
      });
    }
  } catch (err) {
    console.warn('[Verifica POS] Errore archiviazione PDF:', err);
  }

  showToast(`Verifica POS ${progressivoVAP} salvata ✓`, 'success');
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
  const noteCSE     = p?.noteCSE      || (document.getElementById('pos-note')?.value || '').trim();
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
    ? `<img src="${logoAnas}" style="max-height:80pt; max-width:180pt; object-fit:contain;">`
    : `<div style="font-size:14pt; font-weight:bold; color:#0369a1;">ANAS</div>`;

  // Priorità: 1. Firma salvata nel record, 2. Firma appena fatta (sessione), 3. Firma persistente
  const firmaImg = p?.firma || window._firmaCorrente?.png || imp.firmaImmagine;

  const html = `
    <!-- CONTENITORE LAYOUT INDUSTRIALE DETERMINISTICO -->
    <div style="width:180mm; min-height:257mm; margin:0 auto; font-family:Arial, sans-serif; box-sizing:border-box; color:#000; font-size:10pt;">

      <!-- 3) HEADER COMPLETO -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:5mm; border-bottom:1.5pt solid #0f172a;">
        <tr>
          <td style="width:25%; height:15mm; vertical-align:middle; text-align:left; padding:0; border:none;">
            ${logoAnasHtml}
          </td>
          <td style="width:50%; height:15mm; vertical-align:middle; text-align:center; padding:0; border:none;">
            <h1 style="margin:0; font-size:12pt; text-transform:uppercase;">VERIFICA PIANO OPERATIVO DI SICUREZZA</h1>
            <div style="font-size:9pt; color:#475569; margin-top:3pt;">
              Mod. RE. 01-5 · Vers. 3.0 del 22/01/2024 · Ai sensi dell'art. 92 c.1 lett. b) D.Lgs 81/08
            </div>
          </td>
          <td style="width:25%; height:15mm; vertical-align:middle; text-align:right; padding:0; border:none;">
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

        <!-- BUG-2 FIX: Note / Motivazione Decisione -->
        <div style="margin-top:6mm; padding:8pt; background:#f8fafc; border:0.5pt solid #cbd5e1; border-radius:4pt;">
          <div style="font-size:9pt; font-weight:bold; color:#475569; margin-bottom:3pt; text-transform:uppercase;">
            Note CSE / Motivazione della Decisione
          </div>
          <div style="font-size:10pt; line-height:1.4;">
            ${escapeHtml(noteCSE || '__________________________________________________________________').replace(/\n/g,'<br>')}
          </div>
        </div>
      </div>

      <!-- 9) FIRME -->
      <table style="width:100%; border-collapse:collapse; margin-top:8mm; border-top:1pt solid #e2e8f0; padding-top:4mm;">
        <tr>
          <td style="width:33%; border:none; padding:0 6mm 0 0; text-align:left; vertical-align:bottom;">
            <!-- Blocco firma CSE -->
            <div style="margin-bottom:2mm; font-size:8pt; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em;">
              Il Coordinatore per la Sicurezza (CSE)
            </div>
            ${firmaImg ? `
            <div style="padding:4pt; display:inline-block; margin-bottom:2mm;">
              <img src="${firmaImg}"
                   style="display:block; max-height:40pt; max-width:140pt; width:auto; height:auto; object-fit:contain;"
                   alt="Firma CSE">
            </div>
            ` : `
            <div style="height:40pt; border-bottom:1px dashed #94a3b8; width:140pt; margin-bottom:2mm;"></div>
            `}
            <div style="font-size:9pt; font-weight:700; color:#0f172a;">${escapeHtml(cse)}</div>
            ${imp.posTecnicoQualifica ? `<div style="font-size:8pt; color:#64748b;">${escapeHtml(imp.posTecnicoQualifica)}</div>` : ''}
          </td>
          <td style="width:33%; border:none; padding:0 3mm; text-align:center; vertical-align:bottom;">
            <div style="margin-bottom:2mm; font-size:8pt; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em;">
              Responsabile dei Lavori
            </div>
            <div style="height:22mm; border-bottom:1pt solid #000; width:100%; margin-bottom:2mm;"></div>
            <div style="font-size:8pt; color:#94a3b8;">${escapeHtml(imp.posRup || '___________________________')}</div>
          </td>
          <td style="width:33%; border:none; padding:0 0 0 6mm; text-align:right; vertical-align:bottom;">
            <div style="margin-bottom:2mm; font-size:8pt; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em;">
              Responsabile Struttura
            </div>
            <div style="height:22mm; border-bottom:1pt solid #000; width:100%; margin-bottom:2mm;"></div>
            <div style="font-size:8pt; color:#94a3b8;">___________________________</div>
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
          mostraPannelloEmail({ tipo: 'verifica-pos' });
      }
    });
  } else {
    exportPOSWord(id);
  }
}

// ─────────────────────────────────────────────
// 5. FLUSSO 2 — Workflow Verbale Approvazione POS
// ─────────────────────────────────────────────

/** Stati possibili del workflow POS */
const POS_STATI = ['redatto', 'firmato_cse', 'in_protocollo', 'protocollato', 'archiviato'];
const POS_STATI_COLORS = {
  redatto:        { bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  firmato_cse:    { bg: 'bg-cyan-100',   text: 'text-cyan-700',   ring: 'ring-cyan-400' },
  in_protocollo:  { bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-400' },
  protocollato:   { bg: 'bg-green-100',  text: 'text-green-700',  ring: 'ring-green-400' },
  archiviato:     { bg: 'bg-emerald-100',text: 'text-emerald-700',ring: 'ring-emerald-400' }
};

/** File temporanei caricati (per salvataggio) */
window._posPDFFirmato = null;
window._posLetteraTrasmissione = null;

/**
 * Aggiorna visivamente i badge del workflow allo stato dato
 */
function _aggiornaWorkflowBadges(statoCorrente) {
  const badges = document.querySelectorAll('.pos-badge-stato');
  const statoIdx = POS_STATI.indexOf(statoCorrente);

  badges.forEach(badge => {
    const stato = badge.dataset.stato;
    const idx = POS_STATI.indexOf(stato);
    const colors = POS_STATI_COLORS[stato] || POS_STATI_COLORS.redatto;

    // Reset classi
    badge.classList.remove('ring-2', 'bg-blue-100', 'text-blue-700', 'ring-blue-400',
      'bg-cyan-100', 'text-cyan-700', 'ring-cyan-400',
      'bg-amber-100', 'text-amber-700', 'ring-amber-400',
      'bg-green-100', 'text-green-700', 'ring-green-400',
      'bg-emerald-100', 'text-emerald-700', 'ring-emerald-400',
      'bg-slate-100', 'text-slate-400');

    if (idx <= statoIdx) {
      // Stato raggiunto o superato
      badge.classList.add(colors.bg, colors.text);
      if (idx === statoIdx) badge.classList.add('ring-2', colors.ring);
    } else {
      // Stato futuro
      badge.classList.add('bg-slate-100', 'text-slate-400');
    }
  });
}

/**
 * Gestisce drag&drop del PDF firmato
 */
function _handlePOSDropFirmato(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
  const file = event.dataTransfer?.files?.[0];
  if (file) _processaPOSFileFirmato(file);
}

function _handlePOSFileFirmato(input) {
  const file = input.files?.[0];
  if (file) _processaPOSFileFirmato(file);
}

async function _processaPOSFileFirmato(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    if (typeof showToast === 'function') showToast('Solo file PDF accettati.', 'warning');
    return;
  }

  window._posPDFFirmato = file;

  const info = document.getElementById('pos-firmato-info');
  if (info) {
    info.classList.remove('hidden');
    info.innerHTML = `✅ PDF firmato caricato: <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
  }

  if (typeof showToast === 'function') showToast('PDF firmato caricato — verrà salvato con "Aggiorna Stato"', 'success');
}

/**
 * Gestisce drag&drop della lettera di trasmissione
 */
function _handlePOSDropLettera(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('border-amber-500', 'bg-amber-50');
  const file = event.dataTransfer?.files?.[0];
  if (file) _processaPOSFileLettera(file);
}

function _handlePOSFileLettera(input) {
  const file = input.files?.[0];
  if (file) _processaPOSFileLettera(file);
}

function _processaPOSFileLettera(file) {
  window._posLetteraTrasmissione = file;

  const info = document.getElementById('pos-lettera-info');
  if (info) {
    info.classList.remove('hidden');
    info.innerHTML = `📋 Lettera caricata: <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
  }

  if (typeof showToast === 'function') showToast('Lettera di trasmissione caricata', 'success');
}

/**
 * Aggiorna lo stato del workflow POS:
 * - Determina lo stato in base ai dati inseriti
 * - Salva PDF firmato e lettera su OneDrive
 * - Aggiorna il record verbale
 */
async function aggiornaPOSWorkflowStato() {
  // Determina stato automaticamente
  const protocollo = (document.getElementById('pos-protocollo-anas')?.value || '').trim();
  const dataProtocollo = (document.getElementById('pos-data-protocollo')?.value || '').trim();
  const haFirmato = !!window._posPDFFirmato;
  const haLettera = !!window._posLetteraTrasmissione;

  let nuovoStato = 'redatto';
  if (haFirmato && haLettera && protocollo && dataProtocollo) nuovoStato = 'archiviato';
  else if (protocollo && dataProtocollo) nuovoStato = 'protocollato';
  else if (haFirmato) nuovoStato = 'firmato_cse';
  else if (protocollo) nuovoStato = 'in_protocollo';

  // Aggiorna badge visuale
  _aggiornaWorkflowBadges(nuovoStato);

  // Salva file su OneDrive se disponibili
  const projectId = window.appState?.currentProject;
  if (!projectId) {
    if (typeof showToast === 'function') showToast('Nessun cantiere selezionato.', 'error');
    return;
  }

  try {
    // Salva PDF firmato
    if (window._posPDFFirmato && typeof salvaDocumento === 'function') {
      await salvaDocumento({
        filename: window._posPDFFirmato.name,
        blob: window._posPDFFirmato,
        cantiereId: projectId,
        tipoDoc: 'verifica-pos-firmato',
        titoloCondivisione: `Verifica POS firmata — ${window._posPDFFirmato.name}`
      });
    }

    // Salva lettera trasmissione
    if (window._posLetteraTrasmissione && typeof salvaDocumento === 'function') {
      await salvaDocumento({
        filename: window._posLetteraTrasmissione.name,
        blob: window._posLetteraTrasmissione,
        cantiereId: projectId,
        tipoDoc: 'lettera-trasmissione',
        titoloCondivisione: `Lettera di trasmissione POS — ${window._posLetteraTrasmissione.name}`
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Stato aggiornato: ${nuovoStato.replace(/_/g, ' ').toUpperCase()} ✓`, 'success');
    }
  } catch (err) {
    console.error('[FLUSSO 2] Errore aggiornamento workflow POS:', err);
    if (typeof showToast === 'function') showToast('Errore durante il salvataggio dei file.', 'error');
  }
}
