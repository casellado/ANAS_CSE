// lettera-segnalazione-rup.js — Segnalazione Inosservanze ex art. 92 c.1 lett. e
// D.Lgs 81/2008 — Coordinatore Sicurezza in Esecuzione (CSE)
//
// Genera una lettera Word formale da inviare a RUP e D.L. per inosservanze gravi
// che non determinano una sospensione immediata dell'intero cantiere.

async function apriPannelloSegnalazione(ncId) {
  const list = await getAll('nc').catch(() => []);
  const nc   = list.find(n => n.id === ncId);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  const [projects, impostazioni] = await Promise.all([
    getAll('projects').catch(() => []),
    typeof caricaImpostazioni === 'function' ? caricaImpostazioni() : Promise.resolve({})
  ]);
  const cantiere = projects.find(p => p.id === nc.projectId) || {};

  _renderModalSegnalazione(nc, cantiere, impostazioni || {});
}

function _renderModalSegnalazione(nc, cantiere, imp) {
  const existing = document.getElementById('modal-segnalazione');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-segnalazione';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Segnalazione Inosservanza al RUP');

  const dataOggi    = new Date().toISOString().slice(0, 10);
  const aperturaNC  = nc.dataApertura
    ? new Date(nc.dataApertura).toLocaleString('it-IT')
    : '—';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
      <div class="bg-orange-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h2 class="font-bold text-base">✉️ Segnalazione Inosservanza al RUP</h2>
          <div class="text-xs opacity-90">Art. 92 c.1 lett. e — D.Lgs 81/2008</div>
        </div>
        <button onclick="document.getElementById('modal-segnalazione').remove()"
                class="text-orange-100 hover:text-white text-2xl leading-none"
                aria-label="Chiudi">✕</button>
      </div>

      <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

        <!-- Riepilogo NC -->
        <div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div class="text-xs font-bold text-orange-700 uppercase mb-2">NC di riferimento</div>
          <div class="text-sm text-slate-800">
            <div><strong>Cantiere:</strong> ${escapeHtml(cantiere.id || nc.projectId || '—')} — ${escapeHtml(cantiere.nome || '')}</div>
            <div><strong>Livello:</strong> ${escapeHtml((nc.livello || '').toUpperCase())}</div>
            <div><strong>Titolo:</strong> ${escapeHtml(nc.titolo || nc.descrizione?.substring(0, 80) || '—')}</div>
            <div><strong>Aperta:</strong> ${aperturaNC}</div>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label for="segn-protocollo" class="text-xs font-semibold text-slate-700 block mb-1">
              Numero Protocollo <span class="text-slate-400">(opzionale)</span>
            </label>
            <input id="segn-protocollo" type="text"
                   placeholder="Es. Prot. CSE n. 2026/049"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-orange-400 focus:outline-none" />
          </div>

          <div>
            <label for="segn-data" class="text-xs font-semibold text-slate-700 block mb-1">
              Data Lettera
            </label>
            <input id="segn-data" type="date" value="${dataOggi}"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-orange-400 focus:outline-none" />
          </div>

          <div>
            <label for="segn-motivazione" class="text-xs font-semibold text-slate-700 block mb-1">
              Testo della segnalazione (Dettaglio Inadempienza) <span class="text-orange-600">*</span>
            </label>
            <textarea id="segn-motivazione" rows="5"
                      class="w-full border border-slate-300 rounded-lg p-2 text-sm
                             focus:ring-2 focus:ring-orange-400 focus:outline-none resize-y">In data ${new Date().toLocaleDateString('it-IT')} si rileva la seguente grave inosservanza: ${escapeHtml(nc.descrizione || '')}.

Essendo trascorso il termine prescritto senza che l'Impresa Affidataria abbia adottato misure adeguate, si procede formale segnalazione ai sensi dell'art. 92 c.1 lett. e del D.Lgs 81/08.</textarea>
          </div>

          <!-- Destinatari precompilati dal cantiere -->
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
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
        <button onclick="document.getElementById('modal-segnalazione').remove()"
                class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
          Annulla
        </button>
        <button onclick="generaLetteraSegnalazione('${escapeHtml(nc.id)}')"
                class="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold
                       hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
          📄 Genera Lettera Word
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function generaLetteraSegnalazione(ncId) {
  const list = await getAll('nc').catch(() => []);
  const nc   = list.find(n => n.id === ncId);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  const projects = await getAll('projects').catch(() => []);
  const cantiere = projects.find(p => p.id === nc.projectId) || {};
  const imp      = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni() : {};

  const protocollo   = (document.getElementById('segn-protocollo')?.value  || '').trim();
  const dataLettera  = (document.getElementById('segn-data')?.value        || new Date().toISOString().slice(0,10));
  const motivazione  = (document.getElementById('segn-motivazione')?.value || '').trim();

  if (!motivazione) {
    showToast('Inserire il testo della segnalazione.', 'warning');
    return;
  }

  const dataLabel = new Date(dataLettera).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = _buildLetteraSegnalazioneHtml({
    protocollo:    protocollo || '[PROTOCOLLO]',
    dataLabel,
    cantiere,
    nc,
    motivazione,
    imp
  });

  _scaricaLetteraSegnalazioneWord(html, cantiere.id || 'cantiere', dataLettera, cantiere.nome);

  document.getElementById('modal-segnalazione')?.remove();
  showToast('Lettera di segnalazione generata ✓', 'success');

  try {
    nc.segnalazioneGenerata = { data: new Date().toISOString(), protocollo };
    await saveItem('nc', nc);
  } catch(_) {}
}

function _buildLetteraSegnalazioneHtml(d) {
  const { protocollo, dataLabel, cantiere, nc, motivazione, imp } = d;

  const cseNome      = imp.firmaNome      || 'Geom. Dogano Casella';
  const cseQualifica = imp.firmaQualifica || 'Coordinatore Sicurezza in Esecuzione (CSE)';
  const cseAlbo      = imp.firmaAlbo      || '';
  const firmaImg     = imp.firmaImmagine
    ? '<img src="' + imp.firmaImmagine + '" style="max-height:60px; max-width:200px" />'
    : '';

  return `
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; }
  .intestazione { border-bottom: 2pt solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
  .titolo-atto { text-align: center; font-weight: bold; font-size: 13pt; text-transform: uppercase;
                 margin: 16pt 0; border: 1.5pt solid #000; padding: 8pt; background: #f5f5f5; }
  .citazione { background: #fff8dc; border-left: 3pt solid #b58900; padding: 8pt 12pt; margin: 10pt 0; font-style: italic; }
  .sezione { margin: 10pt 0; }
  .firma-box { margin-top: 40pt; text-align: right; }
  .footer { margin-top: 30pt; border-top: 1pt solid #999; padding-top: 8pt; font-size: 9pt; color: #666; }
</style></head><body>

  <div class="intestazione">
    <table style="width:100%; border:none;"><tr>
      <td style="text-align:left; width:60%;">
        <strong>\${escapeHtml(imp.studioNome || 'Studio Tecnico CSE')}</strong><br/>
        \${escapeHtml(imp.studioIndirizzo || '')}
      </td>
      <td style="text-align:right; width:40%;">
        <strong>Prot.</strong> \${escapeHtml(protocollo)}<br/>
        <strong>Data:</strong> \${escapeHtml(dataLabel)}<br/>
        <strong>Cantiere:</strong> \${escapeHtml(cantiere.id || '')}
      </td>
    </tr></table>
  </div>

  <div style="margin-bottom: 14pt;">
    <strong>Spett.li:</strong><br/>
    R.U.P.: \${escapeHtml(cantiere.emailRup || '—')}<br/>
    D.L.: \${escapeHtml(cantiere.emailDl || '—')}
  </div>

  <div style="margin-bottom: 12pt;">
    <strong>OGGETTO:</strong> Segnalazione formale inosservanze ai sensi dell'art. 92 c.1 lett. e
    del D.Lgs 81/2008 — Cantiere <strong>\${escapeHtml(cantiere.id)}</strong>.
  </div>

  <div class="titolo-atto">
    Segnalazione Inosservanze Norme di Sicurezza
  </div>

  <div class="citazione">
    Art. 92 c.1 lett. e — D.Lgs 81/2008:<br/>
    <em>«Il coordinatore per l'esecuzione dei lavori segnala al committente
    o al responsabile dei lavori, previa contestazione scritta alle imprese e ai
    lavoratori autonomi interessati, le inosservanze alle disposizioni degli articoli 94,
    95, 96 e 97...»</em>
  </div>

  <div class="sezione">
    <p>Il sottoscritto <strong>\${escapeHtml(cseNome)}</strong>, in qualità di CSE,</p>
    <p><strong>SEGNALA CHE:</strong></p>
    <div style="white-space: pre-wrap; margin-left: 12pt;">\${escapeHtml(motivazione)}</div>
    
    <p style="margin-top: 15pt;">
    Si rimette pertanto alle SS.VV. la valutazione dei provvedimenti di competenza, proponendo ove necessario
    la sospensione dei lavori o dei pagamenti in base alle vigenti previsioni contrattuali e normative.
    </p>
    <p style="margin-top: 15pt;">Distinti saluti.</p>
  </div>

  <div class="firma-box">
    \${firmaImg}
    <div style="border-top: 1pt solid #000; padding-top: 4pt; margin-top: 6pt; display: inline-block; min-width: 220pt;">
      <strong>\${escapeHtml(cseNome)}</strong><br/>
      \${escapeHtml(cseQualifica)}<br/>
${cseAlbo ? '<span style="font-size: 9pt;">' + escapeHtml(cseAlbo) + '</span>' : ''}
    </div>
  </div>

  <div class="footer">
    Atto emesso ai sensi dell'art. 92 c.1 lett. e D.Lgs 81/2008 —
    ANAS SafeHub
  </div>
</body></html>`;
}

async function _scaricaLetteraSegnalazioneWord(html, cantiereId, dataLettera, cantiereNome) {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const filename = `Segnalazione_RUP_${cantiereId}_${dataLettera}.doc`;

  if (typeof salvaIntelligente === 'function') {
    await salvaIntelligente({
      filename, blob, cantiereId, cantiereNome, tipoDoc: 'segnalazione-rup',
      titoloCondivisione: `Segnalazione RUP — Cantiere ${cantiereId}`
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
