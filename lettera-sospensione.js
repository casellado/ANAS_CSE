// lettera-sospensione.js — Proposta Sospensione Lavori ex art. 92 c.1 lett. f
// D.Lgs 81/2008 — Coordinatore Sicurezza in Esecuzione (CSE)
//
// Genera una lettera Word formale da inviare a RUP, D.L. e Impresa Affidataria
// quando una NC gravissima non viene risolta entro le 24h previste dalla
// procedura ANAS, oppure in presenza di pericolo grave e imminente.

// ─────────────────────────────────────────────
// 1. Triggera il pannello dall'ID della NC gravissima
// ─────────────────────────────────────────────
async function apriPannelloSospensione(ncId) {
  const list = await getAll('nc').catch(() => []);
  const nc   = list.find(n => n.id === ncId);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  if (nc.livello !== 'gravissima') {
    if (!confirm(`Questa NC è di livello "${nc.livello || 'non specificato'}".\n\n` +
                  `La proposta di sospensione è prevista solo per NC gravissime.\n` +
                  `Vuoi procedere ugualmente?`)) return;
  }

  // Carica dati cantiere + impostazioni CSE
  const [projects, impostazioni] = await Promise.all([
    getAll('projects').catch(() => []),
    typeof caricaImpostazioni === 'function' ? caricaImpostazioni() : Promise.resolve({})
  ]);
  const cantiere = projects.find(p => p.id === nc.projectId) || {};

  _renderModalSospensione(nc, cantiere, impostazioni || {});
}

// ─────────────────────────────────────────────
// 2. Modal di raccolta dati aggiuntivi per la lettera
// ─────────────────────────────────────────────
function _renderModalSospensione(nc, cantiere, imp) {
  const existing = document.getElementById('modal-sospensione');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-sospensione';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Proposta Sospensione Lavori');

  const dataOggi    = new Date().toISOString().slice(0, 10);
  const aperturaNC  = nc.dataApertura
    ? new Date(nc.dataApertura).toLocaleString('it-IT')
    : '—';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
      <div class="bg-red-700 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h2 class="font-bold text-base">🚨 Proposta Sospensione Lavori</h2>
          <div class="text-xs opacity-90">Art. 92 c.1 lett. f — D.Lgs 81/2008</div>
        </div>
        <button onclick="document.getElementById('modal-sospensione').remove()"
                class="text-red-100 hover:text-white text-2xl leading-none"
                aria-label="Chiudi">✕</button>
      </div>

      <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

        <!-- Riepilogo NC -->
        <div class="bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="text-xs font-bold text-red-700 uppercase mb-2">NC di riferimento</div>
          <div class="text-sm text-slate-800">
            <div><strong>Cantiere:</strong> ${escapeHtml(cantiere.id || nc.projectId || '—')} — ${escapeHtml(cantiere.nome || '')}</div>
            <div><strong>Livello:</strong> ${escapeHtml((nc.livello || '').toUpperCase())}</div>
            <div><strong>Titolo:</strong> ${escapeHtml(nc.titolo || nc.descrizione?.substring(0, 80) || '—')}</div>
            <div><strong>Aperta:</strong> ${aperturaNC}</div>
          </div>
        </div>

        <!-- Dati aggiuntivi richiesti dalla lettera -->
        <div class="space-y-3">
          <div>
            <label for="sosp-protocollo" class="text-xs font-semibold text-slate-700 block mb-1">
              Numero Protocollo <span class="text-slate-400">(opzionale — lasciare vuoto per protocollo manuale)</span>
            </label>
            <input id="sosp-protocollo" type="text"
                   placeholder="Es. Prot. CSE n. 2026/048"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-red-400 focus:outline-none" />
          </div>

          <div>
            <label for="sosp-data" class="text-xs font-semibold text-slate-700 block mb-1">
              Data Lettera
            </label>
            <input id="sosp-data" type="date" value="${dataOggi}"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-red-400 focus:outline-none" />
          </div>

          <div>
            <label for="sosp-lavorazioni" class="text-xs font-semibold text-slate-700 block mb-1">
              Lavorazioni da sospendere <span class="text-red-500">*</span>
            </label>
            <textarea id="sosp-lavorazioni" rows="3"
                      placeholder="Es. Lavorazioni in quota sul viadotto alla progressiva KM 42+000 — armatura pilastri lato sud"
                      class="w-full border border-slate-300 rounded-lg p-2 text-sm
                             focus:ring-2 focus:ring-red-400 focus:outline-none resize-y"></textarea>
          </div>

          <div>
            <label for="sosp-motivazione" class="text-xs font-semibold text-slate-700 block mb-1">
              Motivazione dettagliata <span class="text-red-500">*</span>
            </label>
            <textarea id="sosp-motivazione" rows="4"
                      class="w-full border border-slate-300 rounded-lg p-2 text-sm
                             focus:ring-2 focus:ring-red-400 focus:outline-none resize-y">${escapeHtml(nc.descrizione || '')}

La Non Conformità, a oltre 24 ore dalla sua apertura, risulta ancora aperta e non è stata adottata alcuna misura di adeguamento efficace da parte dell'Impresa Affidataria, configurandosi la fattispecie di "inosservanza grave" prevista dall'art. 92 c.1 lett. f del D.Lgs 81/2008.</textarea>
          </div>

          <div>
            <label for="sosp-condizioni" class="text-xs font-semibold text-slate-700 block mb-1">
              Condizioni per la ripresa dei lavori
            </label>
            <textarea id="sosp-condizioni" rows="2"
                      placeholder="Es. Adeguamento del parapetto di protezione secondo norma UNI EN 13374 e dichiarazione conformità redatta dal preposto"
                      class="w-full border border-slate-300 rounded-lg p-2 text-sm
                             focus:ring-2 focus:ring-red-400 focus:outline-none resize-y">Previo ripristino delle condizioni di sicurezza come da prescrizioni del CSE, verifica in contraddittorio con l'Impresa Affidataria e rilascio di dichiarazione sostitutiva del preposto.</textarea>
          </div>

          <!-- Destinatari precompilati dal cantiere (P4) -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div class="text-xs font-semibold text-slate-600 uppercase mb-2">Destinatari</div>
            <div class="space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">R.U.P.:</span>
                <span class="font-mono text-slate-700">${escapeHtml(cantiere.emailRup || '— non configurato —')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">D.L.:</span>
                <span class="font-mono text-slate-700">${escapeHtml(cantiere.emailDl || '— non configurato —')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">PEC Impresa Affid.:</span>
                <span class="font-mono text-slate-700">${escapeHtml(cantiere.emailImpresa || '— non configurato —')}</span>
              </div>
            </div>
            ${(!cantiere.emailRup || !cantiere.emailDl) ? `
              <div class="text-xs text-orange-700 mt-2">
                ⚠️ Destinatari incompleti: configurali in <strong>Modifica Cantiere</strong>.
              </div>` : ''}
          </div>
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
        <button onclick="document.getElementById('modal-sospensione').remove()"
                class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
          Annulla
        </button>
        <button onclick="generaLetteraSospensione('${escapeHtml(nc.id)}')"
                class="px-5 py-2 bg-red-700 text-white rounded-lg text-sm font-bold
                       hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400">
          📄 Genera Lettera Word
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal.remove();
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);

  // Focus primo campo vuoto
  setTimeout(() => {
    document.getElementById('sosp-lavorazioni')?.focus();
  }, 50);
}

// ─────────────────────────────────────────────
// 3. Genera lettera Word formale
// ─────────────────────────────────────────────
async function generaLetteraSospensione(ncId) {
  const list = await getAll('nc').catch(() => []);
  const nc   = list.find(n => n.id === ncId);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  const projects = await getAll('projects').catch(() => []);
  const cantiere = projects.find(p => p.id === nc.projectId) || {};
  const imp      = typeof caricaImpostazioni === 'function'
    ? await caricaImpostazioni()
    : {};

  // Raccoglie i dati dal form
  const protocollo   = (document.getElementById('sosp-protocollo')?.value  || '').trim();
  const dataLettera  = (document.getElementById('sosp-data')?.value        || new Date().toISOString().slice(0,10));
  const lavorazioni  = (document.getElementById('sosp-lavorazioni')?.value || '').trim();
  const motivazione  = (document.getElementById('sosp-motivazione')?.value || '').trim();
  const condizioni   = (document.getElementById('sosp-condizioni')?.value  || '').trim();

  // Validazione
  if (!lavorazioni) {
    showToast('Indica le lavorazioni da sospendere.', 'warning');
    document.getElementById('sosp-lavorazioni')?.focus();
    return;
  }
  if (!motivazione) {
    showToast('La motivazione è obbligatoria per atto formale.', 'warning');
    document.getElementById('sosp-motivazione')?.focus();
    return;
  }

  const dataLabel = new Date(dataLettera).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // HTML della lettera con struttura formale ANAS
  const html = _buildLetteraHtml({
    protocollo:    protocollo || '[PROTOCOLLO DA ASSEGNARE]',
    dataLabel,
    cantiere,
    nc,
    lavorazioni,
    motivazione,
    condizioni,
    imp
  });

  // Converti in Word
  _scaricaLetteraSospensioneWord(html, cantiere.id || 'cantiere', dataLettera, cantiere.nome);

  // Chiudi modal + feedback
  document.getElementById('modal-sospensione')?.remove();
  showToast('Lettera di sospensione generata ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();

  // Annota nella NC che è stata generata la proposta di sospensione
  try {
    nc.sospensioneGenerata = {
      data:        new Date().toISOString(),
      protocollo:  protocollo || null,
      lavorazioni
    };
    await saveItem('nc', nc);
  } catch(_) { /* non bloccante */ }
}

// ─────────────────────────────────────────────
// 4. Costruisce l'HTML della lettera (struttura ANAS ufficiale)
// ─────────────────────────────────────────────
function _buildLetteraHtml(d) {
  const { protocollo, dataLabel, cantiere, nc, lavorazioni,
          motivazione, condizioni, imp } = d;

  const cseNome      = imp.firmaNome      || 'Geom. Dogano Casella';
  const cseQualifica = imp.firmaQualifica || 'Coordinatore per la Sicurezza in Esecuzione (CSE)';
  const cseAlbo      = imp.firmaAlbo      || '';
  const firmaImg     = imp.firmaImmagine
    ? `<img src="${imp.firmaImmagine}" style="max-height:60px; max-width:200px" alt="Firma CSE" />`
    : '';

  return `
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; }
  .intestazione { border-bottom: 2pt solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
  .titolo-atto { text-align: center; font-weight: bold; font-size: 13pt; text-transform: uppercase;
                 margin: 16pt 0; border: 1.5pt solid #000; padding: 8pt; background: #f5f5f5; }
  .citazione { background: #fff8dc; border-left: 3pt solid #b58900; padding: 8pt 12pt; margin: 10pt 0; font-style: italic; }
  .sezione { margin: 10pt 0; }
  .sezione h4 { font-size: 11pt; text-transform: uppercase; border-bottom: 1pt solid #000;
                padding-bottom: 2pt; margin-bottom: 6pt; }
  .firma-box { margin-top: 40pt; text-align: right; }
  .footer { margin-top: 30pt; border-top: 1pt solid #999; padding-top: 8pt; font-size: 9pt; color: #666; }
  table.destinatari { margin-top: 6pt; border-collapse: collapse; }
  table.destinatari td { padding: 2pt 8pt; font-size: 10pt; }
</style></head><body>

  <!-- INTESTAZIONE -->
  <div class="intestazione">
    <table style="width:100%; border:none;"><tr>
      <td style="text-align:left; width:60%;">
        <strong>${escapeHtml(imp.studioNome || 'Studio Tecnico CSE')}</strong><br/>
        ${escapeHtml(imp.studioIndirizzo || '')}<br/>
        ${imp.studioTel ? 'Tel: ' + escapeHtml(imp.studioTel) : ''} ${imp.studioPEC ? ' · PEC: ' + escapeHtml(imp.studioPEC) : ''}
      </td>
      <td style="text-align:right; width:40%; vertical-align:top;">
        <strong>Prot.</strong> ${escapeHtml(protocollo)}<br/>
        <strong>Data:</strong> ${escapeHtml(dataLabel)}<br/>
        <strong>Cantiere:</strong> ${escapeHtml(cantiere.id || '')}
      </td>
    </tr></table>
  </div>

  <!-- DESTINATARI -->
  <div style="margin-bottom: 14pt;">
    <strong>Spett.li:</strong>
    <table class="destinatari">
      <tr><td><strong>R.U.P.</strong></td><td>${escapeHtml(cantiere.emailRup || '— destinatario da indicare —')}</td></tr>
      <tr><td><strong>Direttore Lavori</strong></td><td>${escapeHtml(cantiere.emailDl || '— destinatario da indicare —')}</td></tr>
      <tr><td><strong>Impresa Affidataria</strong></td><td>${escapeHtml(cantiere.emailImpresa || '— destinatario da indicare —')}</td></tr>
    </table>
    <div style="font-size: 10pt; margin-top: 4pt; color: #444;">
      e p.c. — ANAS SpA, Struttura Territoriale Calabria
    </div>
  </div>

  <!-- OGGETTO -->
  <div style="margin-bottom: 12pt;">
    <strong>OGGETTO:</strong> Proposta di sospensione dei lavori ai sensi dell'art. 92 c.1 lett. f
    del D.Lgs 81/2008 — Cantiere <strong>${escapeHtml(cantiere.id)}</strong>
    ${cantiere.nome ? ' — ' + escapeHtml(cantiere.nome) : ''}.
  </div>

  <!-- TITOLO ATTO -->
  <div class="titolo-atto">
    Proposta di Sospensione delle Lavorazioni<br/>
    <span style="font-size: 10pt; font-weight: normal;">
      Art. 92 comma 1 lettera f — D.Lgs 9 aprile 2008, n. 81
    </span>
  </div>

  <!-- PREMESSA NORMATIVA -->
  <div class="citazione">
    Art. 92 c.1 lett. f — D.Lgs 81/2008:<br/>
    <em>«Il coordinatore per l'esecuzione dei lavori [...] propone al committente
    o al responsabile dei lavori, in caso di gravi inosservanze delle norme
    [...] la sospensione dei lavori, l'allontanamento delle imprese o dei lavoratori
    autonomi dal cantiere, o la risoluzione del contratto [...].»</em>
  </div>

  <!-- CORPO -->
  <div class="sezione">
    <p>Il sottoscritto <strong>${escapeHtml(cseNome)}</strong>, in qualità di
    ${escapeHtml(cseQualifica)} del cantiere in oggetto,</p>

    <h4>Premesso che</h4>
    <ul>
      <li>In data ${nc.dataApertura ? new Date(nc.dataApertura).toLocaleDateString('it-IT') : '—'}
          è stata aperta Non Conformità di livello
          <strong>${escapeHtml((nc.livello || '').toUpperCase())}</strong>
          con riferimento a: <em>${escapeHtml(nc.titolo || nc.descrizione?.substring(0,100) || '—')}</em>.</li>
      <li>A oltre 24 ore dalla comunicazione formale, l'Impresa Affidataria non ha adottato
          le misure di adeguamento necessarie.</li>
      <li>Permane la situazione di rischio per la salute e la sicurezza dei lavoratori,
          come da sopralluoghi documentati.</li>
    </ul>

    <h4>Rilevato che</h4>
    <div style="white-space: pre-wrap; margin-left: 12pt;">${escapeHtml(motivazione)}</div>

    <h4>Propone</h4>
    <p style="font-weight: bold;">la sospensione immediata delle seguenti lavorazioni:</p>
    <div style="margin-left: 12pt; padding: 8pt; background: #ffebeb; border-left: 3pt solid #b91c1c;
                white-space: pre-wrap;">${escapeHtml(lavorazioni)}</div>

    <h4>Condizioni per la ripresa</h4>
    <div style="white-space: pre-wrap; margin-left: 12pt;">${escapeHtml(condizioni)}</div>

    <h4>Dispone</h4>
    <p>Il presente atto viene trasmesso al R.U.P. e al Direttore Lavori per i provvedimenti
    di competenza (ex art. 92 c.1 lett. f D.Lgs 81/2008) e all'Impresa Affidataria
    per doverosa conoscenza.</p>

    <p style="margin-top: 10pt;">Si resta a disposizione per ogni chiarimento.</p>

    <p style="margin-top: 8pt;">Distinti saluti.</p>
  </div>

  <!-- FIRMA -->
  <div class="firma-box">
    ${firmaImg}
    <div style="border-top: 1pt solid #000; padding-top: 4pt; margin-top: 6pt; display: inline-block; min-width: 220pt;">
      <strong>${escapeHtml(cseNome)}</strong><br/>
      ${escapeHtml(cseQualifica)}<br/>
      ${cseAlbo ? '<span style="font-size: 9pt;">' + escapeHtml(cseAlbo) + '</span>' : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    Atto emesso ai sensi dell'art. 92 c.1 lett. f D.Lgs 81/2008 —
    Documento generato il ${escapeHtml(dataLabel)} —
    ANAS SafeHub v1.5
  </div>

</body></html>`;
}

// ─────────────────────────────────────────────
// 5. Download come file Word (.doc compatibile)
//    Usa salvaIntelligente: FSAPI cartella + condivisione mobile + fallback
// ─────────────────────────────────────────────
async function _scaricaLetteraSospensioneWord(html, cantiereId, dataLettera, cantiereNome) {
  const blob = new Blob(
    ['\ufeff', html],
    { type: 'application/msword' }
  );
  const filename = `Sospensione_Lavori_${cantiereId}_${dataLettera}.doc`;

  // Salvataggio intelligente: archivio desktop / condivisione mobile / download
  if (typeof salvaIntelligente === 'function') {
    const result = await salvaIntelligente({
      filename,
      blob,
      cantiereId,
      cantiereNome,
      tipoDoc: 'sospensione',
      titoloCondivisione: `Proposta Sospensione — Cantiere ${cantiereId}`
    });
    if (result.method === 'fsapi') {
      showToast(`Salvata in: ${result.path}`, 'success');
    } else if (result.method === 'share') {
      showToast('Lettera condivisa ✓', 'success');
    } else if (result.method === 'download') {
      showToast('Lettera scaricata in Download ✓', 'success');
    }
    return;
  }

  // Fallback estremo (se il modulo archivio non è caricato)
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
