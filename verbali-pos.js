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
async function exportPOSWord(posId) {
  const verbali = await getAll('verbali').catch(() => []);
  const p = posId ? verbali.find(x => x.id === posId) : null;

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  // Legge dal form se non abbiamo un ID salvato
  const nomeImpresa = p?.nomeImpresa || (document.getElementById('pos-impresa')?.value || '').trim();
  const pecImpresa  = p?.pecImpresa  || (document.getElementById('pos-pec')?.value    || '').trim();
  const esito       = p?.esito       || document.querySelector('input[name="pos-esito"]:checked')?.value || '';
  const integrazioni= p?.integrazioni|| (document.getElementById('pos-integrazioni')?.value || '').trim();
  const cse         = p?.cse         || imp.firmaNome || 'Geom. Dogano Casella';

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

  const html = `
    <!-- INTESTAZIONE ANAS -->
    <div class="intestazione">
      <h1 style="font-size:13pt; margin:0; text-align:center;">
        VERIFICA PIANO OPERATIVO DI SICUREZZA
      </h1>
      <div style="font-size:9pt; color:#64748b; text-align:center; margin-top:2pt;">
        Ai sensi dell'art. 92 c.1 lett. b) del D.Lgs 81/08 ·
        Mod.RE.01-5 · Vers. 3.0 del 22/01/2024
      </div>
    </div>

    <!-- TABELLA RIFERIMENTI CANTIERE -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6pt;">
      <tr>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt; width:20%;">
          <strong>PPM/SIL/OdA</strong><br>___________
        </td>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt; width:20%;">
          <strong>Commessa</strong><br>___________
        </td>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt; width:20%;">
          <strong>Protocollo</strong><br>___________
        </td>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt; width:20%;">
          <strong>CUP</strong><br>___________
        </td>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt; width:20%;">
          <strong>CIG</strong><br>___________
        </td>
      </tr>
      <tr>
        <td colspan="5" style="border:1px solid #000; padding:4pt 6pt; font-size:10pt;">
          ___________
        </td>
      </tr>
    </table>

    <!-- TABELLA DESTINATARIO -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6pt;">
      <tr>
        <td style="border:none; padding:4pt 6pt; font-size:10pt; width:6%; vertical-align:top;">
          All'
        </td>
        <td style="border:none; padding:4pt 6pt; font-size:10pt; vertical-align:top;">
        </td>
        <td style="border:1px solid #000; padding:4pt 8pt; font-size:10pt; width:36%;">
          <strong>Impresa Affidataria</strong><br>
          <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong><br>
          PEC: ${escapeHtml(pecImpresa || '_____________________________')}
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:1px solid #000; padding:4pt 6pt; font-size:10pt;">
          <strong>Oggetto:</strong> S.S. n° ${escapeHtml(cantiere)} 
          — ${escapeHtml(nomeCant || '___________________________')}
        </td>
      </tr>
      <tr>
        <td style="border:1px solid #000; padding:4pt 6pt; font-size:10pt;">
          <strong>Lavori</strong>
        </td>
        <td colspan="2" style="border:1px solid #000; padding:4pt 6pt; font-size:10pt;">
          ${escapeHtml(nomeCant || '___________________________________________')}
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:1px solid #000; padding:4pt 6pt; font-size:10pt;">
          <strong>Cod. PPM/SIL</strong> ___________________________________________
        </td>
      </tr>
    </table>

    <!-- TITOLO -->
    <div style="text-align:center; font-weight:bold; font-size:11pt;
                margin:12pt 0 8pt; text-transform:uppercase; letter-spacing:0.03em;">
      Verifica Piano Operativo di Sicurezza ai sensi dell'art. 92 c.1 lettera b) del D.Lgs 81/08
    </div>

    <!-- CORPO -->
    <p style="font-size:10pt; text-align:justify; margin:6pt 0;">
      Il sottoscritto <strong>${escapeHtml(cse)}</strong>, nella sua qualità di
      Coordinatore per l'Esecuzione dei lavori ai sensi e per gli effetti dell'art. 92
      comma 1 del D.Lgs. 81/2008
    </p>

    <div style="text-align:center; font-weight:bold; font-size:11pt; margin:10pt 0 6pt;">VISTO</div>

    <p style="font-size:10pt; text-align:justify; margin:6pt 0;">
      Il Piano Operativo di Sicurezza inoltrato da codesta Impresa Affidataria e verificata
      la congruenza dello stesso a quanto previsto dal D.lgs 81/08,
    </p>

    <div style="text-align:center; font-weight:bold; font-size:11pt; margin:10pt 0 6pt;">DICHIARA</div>

    <!-- ESITO CON CHECKBOX -->
    <table style="border-collapse:collapse; width:100%; margin:8pt 0;">

      <!-- OPZIONE 1: IDONEO -->
      <tr>
        <td style="width:24pt; border:none; vertical-align:top; padding:4pt 6pt; font-size:14pt;">
          ${chk(isIdoneo)}
        </td>
        <td style="border:none; vertical-align:top; padding:4pt 0; font-size:10pt;">
          <strong>idoneo</strong> il Piano Operativo di Sicurezza dell'impresa
          <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong>
        </td>
      </tr>

      <!-- SPAZIO -->
      <tr><td colspan="2" style="height:8pt; border:none;"></td></tr>

      <!-- OPZIONE 2: IDONEO CON INTEGRAZIONI -->
      <tr>
        <td style="width:24pt; border:none; vertical-align:top; padding:4pt 6pt; font-size:14pt;">
          ${chk(isConInt)}
        </td>
        <td style="border:none; vertical-align:top; padding:4pt 0; font-size:10pt;">
          <strong>idoneo</strong> il Piano Operativo di Sicurezza dell'impresa
          <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong>
          con la richiesta delle seguenti integrazioni:
        </td>
      </tr>
      ${isConInt && integrazioni ? `
      <tr>
        <td style="border:none;"></td>
        <td style="border:none; padding:4pt 0 4pt 8pt; font-size:10pt; font-style:italic;">
          ${escapeHtml(integrazioni).replace(/\n/g,'<br>')}
        </td>
      </tr>` : `
      <tr>
        <td style="border:none;"></td>
        <td style="border:none; padding:4pt 0 4pt 8pt;">
          <div style="border-bottom:1px solid #ccc; height:16pt; margin:3pt 0;"></div>
          <div style="border-bottom:1px solid #ccc; height:16pt; margin:3pt 0;"></div>
        </td>
      </tr>`}

      <!-- SPAZIO -->
      <tr><td colspan="2" style="height:8pt; border:none;"></td></tr>

      <!-- OPZIONE 3: NON IDONEO -->
      <tr>
        <td style="width:24pt; border:none; vertical-align:top; padding:4pt 6pt; font-size:14pt;">
          ${chk(isNonId)}
        </td>
        <td style="border:none; vertical-align:top; padding:4pt 0; font-size:10pt;">
          <strong>NON idoneo</strong> il Piano Operativo di Sicurezza dell'impresa
          <strong>${escapeHtml(nomeImpresa || '___________________________')}</strong>
          in quanto non conforme con quanto previsto dall'Allegato XV del D.Lgs. 81/2008,
          con la richiesta di ripresentare il Piano Operativo di Sicurezza conformemente
          a quanto previsto dal citato Decreto.
        </td>
      </tr>

    </table>

    <!-- FIRME -->
    <table style="width:100%; border-collapse:collapse; margin-top:24pt;">
      <tr>
        <td style="width:33%; border:none; text-align:center; vertical-align:top; padding:0 8pt;">
          <div style="font-size:10pt; font-weight:bold;">Il Coordinatore per l'Esecuzione</div>
          <div style="width:180pt; height:50pt; border:1px solid #94a3b8;
                      margin:6pt auto 0; border-radius:3pt;"></div>
          <div style="font-size:10pt; margin-top:4pt;">(${escapeHtml(cse)})</div>
        </td>
        <td style="width:33%; border:none; text-align:center; vertical-align:top; padding:0 8pt;">
          <div style="font-size:10pt; font-weight:bold;">Visto:</div>
          <div style="font-size:10pt; font-weight:bold;">Il Responsabile dei Lavori</div>
          <div style="width:180pt; height:50pt; border:1px solid #94a3b8;
                      margin:6pt auto 0; border-radius:3pt;"></div>
          <div style="font-size:10pt; margin-top:4pt;">(${escapeHtml(imp.rup || '_______________________')})</div>
        </td>
        <td style="width:34%; border:none; text-align:center; vertical-align:top; padding:0 8pt;">
          <div style="font-size:10pt; font-weight:bold;">Visto:</div>
          <div style="font-size:10pt; font-weight:bold; font-style:italic;">
            Il Responsabile della Struttura Territoriale/
          </div>
          <div style="font-size:9pt; color:#64748b;">(se figura diversa da RL)</div>
          <div style="width:180pt; height:50pt; border:1px solid #94a3b8;
                      margin:6pt auto 0; border-radius:3pt;"></div>
          <div style="font-size:10pt; margin-top:4pt;">(______________________)</div>
        </td>
      </tr>
    </table>
  `;

  const nomeSafe = (nomeImpresa || 'impresa').replace(/[^a-z0-9_\-]/gi,'_');
  const dataSafe = data.replace(/\//g,'-');
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
  await exportPOSWord(posId);
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
