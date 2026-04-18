// report-giornaliero.js — Diario CSE giornaliero (art. 92 c.1 lett. a D.Lgs 81/08)
//
// Aggrega in automatico tutta l'attività del CSE nel giorno corrente:
// cantieri visitati, verbali emessi (sopralluogo/riunione/POS), NC aperte/chiuse,
// e lo esporta come documento formale firmato.

// ─────────────────────────────────────────────
// 1. Apri pannello riepilogo giornata
// ─────────────────────────────────────────────
async function apriReportGiornaliero(dataTarget = null) {
  // Default: oggi. Accetta anche data specifica per rigenerare report passati.
  const data = dataTarget ? new Date(dataTarget) : new Date();
  const dataYMD = data.toISOString().slice(0, 10);
  const dataLabel = data.toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  // Carica dati in parallelo
  const [verbali, ncList, projects, imprese] = await Promise.all([
    getAll('verbali').catch(() => []),
    getAll('nc').catch(() => []),
    getAll('projects').catch(() => []),
    getAll('imprese').catch(() => [])
  ]);

  // Filtra per giorno target
  const isOnDay = (iso) => {
    if (!iso) return false;
    return new Date(iso).toISOString().slice(0, 10) === dataYMD;
  };

  const verbaliOggi = verbali.filter(v => isOnDay(v.data) || isOnDay(v.createdAt));
  const ncAperteOggi = ncList.filter(n => isOnDay(n.dataApertura));
  const ncChiuseOggi = ncList.filter(n => n.stato === 'chiusa' && isOnDay(n.dataChiusura));

  // Cantieri effettivamente toccati oggi (dedotti dai verbali/NC)
  const cantiereIds = new Set();
  [...verbaliOggi, ...ncAperteOggi, ...ncChiuseOggi].forEach(x => {
    if (x.projectId) cantiereIds.add(x.projectId);
  });
  const cantieriVisitati = projects.filter(p => cantiereIds.has(p.id));

  _renderModalReport({
    data, dataYMD, dataLabel,
    verbaliOggi, ncAperteOggi, ncChiuseOggi,
    cantieriVisitati, imprese
  });
}

// ─────────────────────────────────────────────
// 2. Modal anteprima + export
// ─────────────────────────────────────────────
function _renderModalReport(d) {
  const { dataYMD, dataLabel, verbaliOggi, ncAperteOggi,
          ncChiuseOggi, cantieriVisitati } = d;

  const existing = document.getElementById('modal-report-giornaliero');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-report-giornaliero';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  // Raggruppa verbali per tipo
  const sopralluoghi = verbaliOggi.filter(v => (v.tipo || 'sopralluogo') === 'sopralluogo');
  const riunioni     = verbaliOggi.filter(v => v.tipo === 'riunione-coordinamento');
  const verifichePOS = verbaliOggi.filter(v => v.tipo === 'verifica-pos');

  // NC gravissime ancora aperte oggi
  const gravissimeAperte = ncAperteOggi.filter(n => n.livello === 'gravissima' && n.stato !== 'chiusa');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
      <div class="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h2 class="font-bold text-base">📋 Report Giornaliero CSE</h2>
          <div class="text-xs opacity-90">${escapeHtml(dataLabel)}</div>
        </div>
        <button onclick="document.getElementById('modal-report-giornaliero').remove()"
                class="text-slate-400 hover:text-white text-2xl leading-none"
                aria-label="Chiudi">✕</button>
      </div>

      <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

        <!-- KPI riassuntivi -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-blue-700">${cantieriVisitati.length}</div>
            <div class="text-xs text-blue-800 font-semibold">Cantieri</div>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-green-700">${verbaliOggi.length}</div>
            <div class="text-xs text-green-800 font-semibold">Verbali</div>
          </div>
          <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-orange-700">${ncAperteOggi.length}</div>
            <div class="text-xs text-orange-800 font-semibold">NC aperte</div>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-slate-700">${ncChiuseOggi.length}</div>
            <div class="text-xs text-slate-800 font-semibold">NC chiuse</div>
          </div>
        </div>

        ${gravissimeAperte.length > 0 ? `
          <div class="bg-red-50 border-l-4 border-red-600 p-3 rounded-r-xl alert-pulse">
            <div class="font-bold text-red-800 text-sm">
              ⚠️ ${gravissimeAperte.length} NC gravissime ancora aperte
            </div>
            <div class="text-xs text-red-700 mt-1">
              Ricorda di monitorare per attivare art. 92 c.1 lett. f se non risolte entro 24h.
            </div>
          </div>` : ''}

        <!-- Sezione cantieri -->
        ${cantieriVisitati.length > 0 ? `
          <div>
            <h3 class="text-sm font-bold text-slate-700 uppercase mb-2">Cantieri presidiati</h3>
            <div class="space-y-1">
              ${cantieriVisitati.map(c => `
                <div class="flex justify-between items-center text-sm bg-slate-50 px-3 py-1.5 rounded">
                  <span class="font-mono text-slate-600">${escapeHtml(c.id)}</span>
                  <span class="text-slate-800 text-xs truncate ml-2">${escapeHtml(c.nome || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

        <!-- Sezione verbali -->
        ${verbaliOggi.length > 0 ? `
          <div>
            <h3 class="text-sm font-bold text-slate-700 uppercase mb-2">Verbali emessi</h3>
            <div class="space-y-2">
              ${sopralluoghi.length > 0 ? `
                <div class="text-xs">
                  <strong class="text-blue-700">📋 Sopralluoghi (${sopralluoghi.length}):</strong>
                  ${sopralluoghi.map(v => `<div class="ml-4 text-slate-600">• ${escapeHtml(v.projectId || '')} — ${escapeHtml(v.oggetto || 'senza oggetto')}</div>`).join('')}
                </div>` : ''}
              ${riunioni.length > 0 ? `
                <div class="text-xs">
                  <strong class="text-indigo-700">📅 Riunioni Coordinamento (${riunioni.length}):</strong>
                  ${riunioni.map(v => `<div class="ml-4 text-slate-600">• ${escapeHtml(v.projectId || '')}</div>`).join('')}
                </div>` : ''}
              ${verifichePOS.length > 0 ? `
                <div class="text-xs">
                  <strong class="text-green-700">✅ Verifiche POS (${verifichePOS.length}):</strong>
                  ${verifichePOS.map(v => `<div class="ml-4 text-slate-600">• ${escapeHtml(v.nomeImpresa || '')} — esito: ${escapeHtml(v.esito || '')}</div>`).join('')}
                </div>` : ''}
            </div>
          </div>` : ''}

        <!-- Sezione NC -->
        ${ncAperteOggi.length > 0 ? `
          <div>
            <h3 class="text-sm font-bold text-slate-700 uppercase mb-2">Non Conformità aperte oggi</h3>
            <div class="space-y-1 text-xs">
              ${ncAperteOggi.map(n => `
                <div class="flex justify-between items-start bg-orange-50 px-3 py-1.5 rounded border border-orange-100">
                  <div class="flex-1 min-w-0">
                    <span class="font-mono text-xs">${escapeHtml(n.projectId || '')}</span> ·
                    <span class="font-bold">${escapeHtml((n.livello || '').toUpperCase())}</span>
                    <span class="text-slate-700">— ${escapeHtml((n.titolo || n.descrizione || '').substring(0, 80))}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

        ${verbaliOggi.length === 0 && ncAperteOggi.length === 0 && ncChiuseOggi.length === 0 ? `
          <div class="text-center py-8 text-slate-400">
            <div class="text-4xl mb-2">📭</div>
            <div class="text-sm">Nessuna attività registrata per questa data.</div>
          </div>` : ''}
      </div>

      <div class="bg-slate-50 px-6 py-3 flex flex-wrap justify-between items-center gap-2 border-t border-slate-200">
        <div class="text-xs text-slate-500">
          Diario CSE ex art. 92 c.1 lett. a D.Lgs 81/08
        </div>
        <div class="flex gap-2">
          <button onclick="document.getElementById('modal-report-giornaliero').remove()"
                  class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold
                         hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
            Chiudi
          </button>
          <button onclick="stampaReportGiornaliero('${dataYMD}')"
                  class="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold
                         hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400">
            🖨️ Stampa PDF
          </button>
          <button onclick="scaricaReportGiornalieroWord('${dataYMD}')"
                  class="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold
                         hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400">
            📄 Word
          </button>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ─────────────────────────────────────────────
// 3. Stampa PDF (via finestra stampa browser)
// ─────────────────────────────────────────────
async function stampaReportGiornaliero(dataYMD) {
  const html = await _buildReportHtml(dataYMD);
  const win  = window.open('', '_blank');
  if (!win) { showToast('Pop-up bloccato dal browser.', 'warning'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ─────────────────────────────────────────────
// 4. Scarica Word
// ─────────────────────────────────────────────
async function scaricaReportGiornalieroWord(dataYMD) {
  const html = await _buildReportHtml(dataYMD);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const filename = `Diario_CSE_${dataYMD}.doc`;

  // Salvataggio intelligente
  if (typeof salvaIntelligente === 'function') {
    const result = await salvaIntelligente({
      filename,
      blob,
      tipoDoc: 'report-giornaliero',
      titoloCondivisione: `Diario CSE — ${dataYMD}`
    });
    if (result.method === 'fsapi')    showToast(`Diario salvato in: ${result.path}`, 'success');
    if (result.method === 'share')    showToast('Diario condiviso ✓', 'success');
    if (result.method === 'download') showToast('Diario scaricato in Download ✓', 'success');
    if (typeof showCheckmark === 'function') showCheckmark();
    return;
  }

  // Fallback estremo
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Diario giornaliero generato ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
}

// ─────────────────────────────────────────────
// 5. Costruisce HTML stampabile del diario
// ─────────────────────────────────────────────
async function _buildReportHtml(dataYMD) {
  const data      = new Date(dataYMD);
  const dataLabel = data.toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const [verbali, ncList, projects, imp] = await Promise.all([
    getAll('verbali').catch(() => []),
    getAll('nc').catch(() => []),
    getAll('projects').catch(() => []),
    typeof caricaImpostazioni === 'function' ? caricaImpostazioni() : Promise.resolve({})
  ]);

  const isOnDay = (iso) => iso && new Date(iso).toISOString().slice(0, 10) === dataYMD;

  const verbaliOggi = verbali.filter(v => isOnDay(v.data) || isOnDay(v.createdAt));
  const ncAperteOggi = ncList.filter(n => isOnDay(n.dataApertura));
  const ncChiuseOggi = ncList.filter(n => n.stato === 'chiusa' && isOnDay(n.dataChiusura));

  const cantiereIds = new Set();
  [...verbaliOggi, ...ncAperteOggi, ...ncChiuseOggi].forEach(x => {
    if (x.projectId) cantiereIds.add(x.projectId);
  });
  const cantieriVisitati = projects.filter(p => cantiereIds.has(p.id));

  const sopralluoghi = verbaliOggi.filter(v => (v.tipo || 'sopralluogo') === 'sopralluogo');
  const riunioni     = verbaliOggi.filter(v => v.tipo === 'riunione-coordinamento');
  const verifichePOS = verbaliOggi.filter(v => v.tipo === 'verifica-pos');

  const cseNome      = imp.firmaNome      || 'Geom. Dogano Casella';
  const cseQualifica = imp.firmaQualifica || 'Coordinatore per la Sicurezza in Esecuzione (CSE)';
  const cseAlbo      = imp.firmaAlbo      || '';
  const firmaImg     = imp.firmaImmagine
    ? `<img src="${imp.firmaImmagine}" style="max-height:50px; max-width:180px" alt="Firma CSE" />`
    : '';

  return `
<html><head><meta charset="utf-8"><title>Diario CSE — ${dataLabel}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; line-height: 1.4; }
  h1 { text-align: center; font-size: 14pt; text-transform: uppercase;
       border-top: 2pt solid #000; border-bottom: 2pt solid #000;
       padding: 10pt 0; margin: 14pt 0; }
  h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1pt solid #444;
       padding-bottom: 2pt; margin-top: 14pt; margin-bottom: 6pt; }
  .riepilogo { display: table; width: 100%; border-collapse: collapse; margin: 10pt 0; }
  .riepilogo > div { display: table-cell; text-align: center; padding: 8pt;
                     border: 1pt solid #999; }
  .riepilogo .num { font-size: 18pt; font-weight: bold; }
  .item { padding: 4pt 10pt; border-left: 2pt solid #666; margin: 3pt 0; }
  .item-critico { border-left-color: #b91c1c; background: #fee; }
  .firma-box { margin-top: 50pt; text-align: right; page-break-inside: avoid; }
  .footer { margin-top: 30pt; border-top: 1pt solid #999; padding-top: 6pt;
            font-size: 9pt; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  @media print { .no-print { display: none; } }
</style></head><body>

  <!-- Intestazione -->
  <table style="width:100%; border-bottom: 2pt solid #000; padding-bottom: 8pt;">
    <tr>
      <td style="width:60%; vertical-align: top;">
        <strong>${escapeHtml(imp.studioNome || 'Studio Tecnico CSE')}</strong><br/>
        ${escapeHtml(imp.studioIndirizzo || '')}<br/>
        ${imp.studioPEC ? 'PEC: ' + escapeHtml(imp.studioPEC) : ''}
      </td>
      <td style="width:40%; vertical-align: top; text-align: right; font-size: 10pt;">
        <strong>${escapeHtml(dataLabel)}</strong>
      </td>
    </tr>
  </table>

  <h1>Diario Giornaliero — CSE</h1>
  <div style="text-align:center; font-size: 9pt; color: #666; margin-bottom: 14pt;">
    Documento redatto ai sensi dell'art. 92 c.1 lett. a) del D.Lgs 81/2008
  </div>

  <!-- Riepilogo KPI -->
  <div class="riepilogo">
    <div><div class="num">${cantieriVisitati.length}</div><div>Cantieri</div></div>
    <div><div class="num">${verbaliOggi.length}</div><div>Verbali</div></div>
    <div><div class="num">${ncAperteOggi.length}</div><div>NC aperte</div></div>
    <div><div class="num">${ncChiuseOggi.length}</div><div>NC chiuse</div></div>
  </div>

  ${cantieriVisitati.length > 0 ? `
    <h2>Cantieri Presidiati</h2>
    ${cantieriVisitati.map(c => `
      <div class="item">
        <strong>${escapeHtml(c.id)}</strong> — ${escapeHtml(c.nome || '')}<br/>
        <span style="font-size: 10pt; color: #555;">${escapeHtml(c.loc || '')}</span>
      </div>
    `).join('')}
  ` : '<p><em>Nessun cantiere presidiato nella giornata.</em></p>'}

  ${sopralluoghi.length > 0 ? `
    <h2>Verbali di Sopralluogo (${sopralluoghi.length})</h2>
    ${sopralluoghi.map(v => `
      <div class="item">
        <strong>${escapeHtml(v.projectId || '')}</strong> — ${escapeHtml(v.oggetto || 'senza oggetto')}<br/>
        <span style="font-size: 10pt; color: #555;">
          ${v.km ? 'KM: ' + escapeHtml(v.km) : ''}
          ${v.meteo ? ' · Meteo: ' + escapeHtml(v.meteo) : ''}
        </span>
      </div>
    `).join('')}
  ` : ''}

  ${riunioni.length > 0 ? `
    <h2>Riunioni di Coordinamento (${riunioni.length})</h2>
    ${riunioni.map(v => `
      <div class="item">
        <strong>${escapeHtml(v.projectId || '')}</strong><br/>
        <span style="font-size: 10pt;">
          Tipo: ${escapeHtml((v.tipoRiunione || []).join(', ') || '—')}<br/>
          Decisioni: ${escapeHtml((v.decisioni || '').substring(0, 150))}${(v.decisioni || '').length > 150 ? '...' : ''}
        </span>
      </div>
    `).join('')}
  ` : ''}

  ${verifichePOS.length > 0 ? `
    <h2>Verifiche POS (${verifichePOS.length})</h2>
    ${verifichePOS.map(v => `
      <div class="item">
        <strong>${escapeHtml(v.nomeImpresa || '')}</strong>
        — Esito: <strong>${escapeHtml((v.esito || '').toUpperCase())}</strong>
      </div>
    `).join('')}
  ` : ''}

  ${ncAperteOggi.length > 0 ? `
    <h2>Non Conformità Rilevate</h2>
    ${ncAperteOggi.map(n => `
      <div class="item ${n.livello === 'gravissima' ? 'item-critico' : ''}">
        <strong>[${escapeHtml((n.livello || '').toUpperCase())}]</strong>
        ${escapeHtml(n.projectId || '')} —
        ${escapeHtml(n.titolo || (n.descrizione || '').substring(0, 100))}
        <br/>
        <span style="font-size: 10pt; color: #555;">
          Scadenza adeguamento: ${n.dataScadenza ? new Date(n.dataScadenza).toLocaleString('it-IT') : '—'}
        </span>
      </div>
    `).join('')}
  ` : ''}

  ${ncChiuseOggi.length > 0 ? `
    <h2>Non Conformità Chiuse</h2>
    ${ncChiuseOggi.map(n => `
      <div class="item">
        ${escapeHtml(n.projectId || '')} —
        ${escapeHtml(n.titolo || (n.descrizione || '').substring(0, 100))}
      </div>
    `).join('')}
  ` : ''}

  ${verbaliOggi.length === 0 && ncAperteOggi.length === 0 && ncChiuseOggi.length === 0 ? `
    <h2>Annotazioni</h2>
    <p><em>Nessuna attività di cantiere registrata nella giornata odierna.
    Eventuali attività di ufficio (elaborazione documenti, ricerca normativa, formazione)
    non sono tracciate automaticamente e vanno annotate separatamente.</em></p>
  ` : ''}

  <!-- Firma CSE -->
  <div class="firma-box">
    ${firmaImg}
    <div style="border-top: 1pt solid #000; padding-top: 4pt; display: inline-block; min-width: 220pt;">
      <strong>${escapeHtml(cseNome)}</strong><br/>
      <span style="font-size: 10pt;">${escapeHtml(cseQualifica)}</span><br/>
      ${cseAlbo ? '<span style="font-size: 9pt; color: #555;">' + escapeHtml(cseAlbo) + '</span>' : ''}
    </div>
  </div>

  <div class="footer">
    Diario generato automaticamente da ANAS SafeHub v1.5 il ${new Date().toLocaleString('it-IT')} —
    Documento riservato · uso interno ANAS SpA
  </div>

</body></html>`;
}
