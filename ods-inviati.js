// ods-inviati.js — Ordini di Servizio emessi dal CSE verso le imprese
//
// DIFFERENZE con NC:
//   NC: procedura formale, livelli (lieve→gravissima), scadenza automatica,
//       può scalare a sospensione art. 92
//   ODS: comunicazione operativa diretta, "fai questo entro",
//        no livelli, stato binario eseguito/non-eseguito
//
// LOGICA DI STORAGE:
//   Gli ODS INVIATI vengono salvati nello stesso store 'nc' (per riutilizzare
//   le funzioni già esistenti di lista, allegati, documenti collegati),
//   MA con campo discriminante tipoAtto = 'ods-inviato' invece di 'nc'.

// ─────────────────────────────────────────────
// 1. Crea nuovo ODS inviato
// ─────────────────────────────────────────────
async function nuovoODSInviato() {
  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }
  _apriModalNuovoODS();
}

// ─────────────────────────────────────────────
// 2. Modal raccolta dati ODS
// ─────────────────────────────────────────────
async function _apriModalNuovoODS() {
  const projectId = window.appState.currentProject;
  const imprese   = await _getImpreseCantiere(projectId);

  const existing = document.getElementById('modal-nuovo-ods');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-nuovo-ods';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Nuovo Ordine di Servizio');

  const dataOggi = new Date().toISOString().slice(0, 10);
  // Scadenza default: +3 giorni lavorativi
  const tra3gg = new Date();
  tra3gg.setDate(tra3gg.getDate() + 3);
  const scadenzaDefault = tra3gg.toISOString().slice(0, 10);

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
      <div class="bg-blue-800 text-white px-5 py-4 flex justify-between items-center">
        <div>
          <h2 class="font-bold text-base">📝 Nuovo Ordine di Servizio</h2>
          <div class="text-xs opacity-90">Comunicazione operativa all'Impresa</div>
        </div>
        <button onclick="document.getElementById('modal-nuovo-ods').remove()"
                class="text-blue-200 hover:text-white text-2xl leading-none"
                aria-label="Chiudi">✕</button>
      </div>

      <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
          <strong>Quando usare un ODS invece di una NC?</strong><br/>
          L'ODS è la forma di comunicazione diretta verso l'Impresa per interventi
          operativi (es. "rimuovere macerie", "completare segnaletica oggi stesso").
          Usa <strong>NC</strong> invece per non conformità procedurali/strutturali
          (DPI mancanti, ponteggio fuori norma, ecc.).
        </div>

        <div class="space-y-3">
          <!-- Impresa destinataria -->
          <div>
            <label for="ods-impresa" class="text-xs font-semibold text-slate-700 block mb-1">
              Impresa destinataria <span class="text-red-500">*</span>
            </label>
            ${imprese.length > 0 ? `
              <select id="ods-impresa"
                      class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white
                             focus:ring-2 focus:ring-blue-400 focus:outline-none">
                <option value="">— Seleziona impresa del cantiere —</option>
                ${imprese.map(i => `
                  <option value="${escapeHtml(i.id)}" data-nome="${escapeHtml(i.nome)}"
                          data-pec="${escapeHtml(i.contatto || '')}"
                          data-referente="${escapeHtml(i.referente || '')}">
                    ${escapeHtml(i.nome)} ${i.ruolo ? '(' + escapeHtml(i.ruolo) + ')' : ''}
                  </option>`).join('')}
              </select>
            ` : `
              <div class="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                ⚠️ Nessuna impresa assegnata a questo cantiere.
                <button onclick="apriSuiteCSE('anagrafica')" class="underline font-semibold">
                  Aggiungi imprese in Anagrafica
                </button>
              </div>
            `}
            <div class="text-xs text-slate-400 mt-1">
              Oppure digita manualmente se l'impresa non è in anagrafica
            </div>
            <input id="ods-impresa-manuale" type="text"
                   placeholder="Nome impresa (se non in anagrafica)"
                   class="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>

          <!-- Oggetto -->
          <div>
            <label for="ods-oggetto" class="text-xs font-semibold text-slate-700 block mb-1">
              Oggetto dell'ordine <span class="text-red-500">*</span>
            </label>
            <input id="ods-oggetto" type="text"
                   placeholder="Es. Ripristino segnaletica mancante al KM 42+000"
                   class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>

          <!-- Descrizione dettagliata -->
          <div>
            <label for="ods-descrizione" class="text-xs font-semibold text-slate-700 block mb-1">
              Descrizione dettagliata dell'intervento richiesto <span class="text-red-500">*</span>
            </label>
            <textarea id="ods-descrizione" rows="5"
                      placeholder="Descrivi cosa deve fare l'impresa, dove e come. Sii specifico: l'ODS è un atto formale."
                      class="w-full border border-slate-300 rounded-lg p-2.5 text-sm resize-y
                             focus:ring-2 focus:ring-blue-400 focus:outline-none"></textarea>
          </div>

          <!-- Data + scadenza -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="ods-data" class="text-xs font-semibold text-slate-700 block mb-1">
                Data emissione
              </label>
              <input id="ods-data" type="date" value="${dataOggi}"
                     class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                            focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label for="ods-scadenza" class="text-xs font-semibold text-slate-700 block mb-1">
                Scadenza adempimento <span class="text-red-500">*</span>
              </label>
              <input id="ods-scadenza" type="date" value="${scadenzaDefault}"
                     class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                            focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
          </div>

          <!-- Modalità consegna -->
          <div>
            <label class="text-xs font-semibold text-slate-700 block mb-1">
              Modalità di consegna
            </label>
            <div class="flex flex-wrap gap-3 text-sm">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ods-consegna" value="pec" checked />
                <span>PEC</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ods-consegna" value="mano" />
                <span>Consegna a mano in cantiere</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ods-consegna" value="raccomandata" />
                <span>Raccomandata A/R</span>
              </label>
            </div>
          </div>

          <!-- Riferimenti -->
          <div>
            <label for="ods-riferimenti" class="text-xs font-semibold text-slate-700 block mb-1">
              Riferimenti normativi / tecnici (opzionale)
            </label>
            <input id="ods-riferimenti" type="text"
                   placeholder="Es. Art. 26 D.Lgs 81/08, PSC §5.3, Rif. verbale del 12/04/2026"
                   class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
        </div>
      </div>

      <div class="bg-slate-50 px-5 py-3 flex justify-end gap-2 border-t border-slate-200">
        <button onclick="document.getElementById('modal-nuovo-ods').remove()"
                class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-100">
          Annulla
        </button>
        <button onclick="salvaODSInviato()"
                class="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold
                       hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400">
          📄 Salva + Genera Word
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  setTimeout(() => document.getElementById('ods-oggetto')?.focus(), 50);
}

// ─────────────────────────────────────────────
// 3. Helper: imprese assegnate al cantiere
// ─────────────────────────────────────────────
async function _getImpreseCantiere(projectId) {
  try {
    const [imprese, assegnazioni] = await Promise.all([
      getAll('imprese').catch(() => []),
      getAll('imprese_cantieri').catch(() => [])
    ]);
    const ids = new Set(
      assegnazioni.filter(a => a.projectId === projectId).map(a => a.impresaId)
    );
    return imprese.filter(i => ids.has(i.id));
  } catch (_) {
    return [];
  }
}

// ─────────────────────────────────────────────
// 4. Salva ODS + genera Word
// ─────────────────────────────────────────────
async function salvaODSInviato() {
  // Validazione
  const oggetto     = (document.getElementById('ods-oggetto')?.value     || '').trim();
  const descrizione = (document.getElementById('ods-descrizione')?.value || '').trim();
  const dataEmiss   = document.getElementById('ods-data')?.value         || new Date().toISOString().slice(0, 10);
  const scadenza    = document.getElementById('ods-scadenza')?.value     || '';
  const riferimenti = (document.getElementById('ods-riferimenti')?.value || '').trim();
  const consegna    = document.querySelector('input[name="ods-consegna"]:checked')?.value || 'pec';

  // Impresa: da select o manuale
  const sel = document.getElementById('ods-impresa');
  const selectedOpt = sel && sel.selectedOptions[0];
  let impresaId = sel?.value || null;
  let impresaNome, impresaPec, impresaRef;

  if (impresaId && selectedOpt) {
    impresaNome = selectedOpt.dataset.nome;
    impresaPec  = selectedOpt.dataset.pec;
    impresaRef  = selectedOpt.dataset.referente;
  } else {
    impresaNome = (document.getElementById('ods-impresa-manuale')?.value || '').trim();
    impresaPec  = '';
    impresaRef  = '';
  }

  if (!impresaNome) {
    showToast('Seleziona o digita l\'impresa destinataria.', 'warning');
    return;
  }
  if (!oggetto) {
    showToast('L\'oggetto è obbligatorio.', 'warning');
    document.getElementById('ods-oggetto')?.focus();
    return;
  }
  if (!descrizione) {
    showToast('La descrizione dell\'intervento è obbligatoria.', 'warning');
    document.getElementById('ods-descrizione')?.focus();
    return;
  }
  if (!scadenza) {
    showToast('Indica una scadenza per l\'adempimento.', 'warning');
    document.getElementById('ods-scadenza')?.focus();
    return;
  }

  // Calcola numero progressivo ODS del cantiere/anno
  const numero = await _prossimoNumeroODS(window.appState.currentProject);
  const anno   = new Date(dataEmiss).getFullYear();
  const protocollo = `ODS-${window.appState.currentProject}-${anno}-${String(numero).padStart(3, '0')}`;

  const ods = {
    id:            'ods_' + Date.now(),
    tipoAtto:      'ods-inviato',           // discriminante vs NC
    projectId:     window.appState.currentProject,
    protocollo,
    numero,
    anno,
    stato:         'emesso',                // emesso | eseguito | non-eseguito | annullato
    titolo:        oggetto,
    descrizione,
    impresaId,
    impresaNome,
    impresaPec,
    impresaRef,
    dataApertura:  dataEmiss,
    dataScadenza:  scadenza,
    riferimenti,
    consegna,
    createdAt:     new Date().toISOString()
  };

  // Usa lo stesso store 'nc' per coerenza con il resto del sistema
  await saveItem('nc', ods);

  // Genera la lettera Word formale
  const cantiere = await _getCantiere(window.appState.currentProject);
  const imp      = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni() : {};
  const html     = _buildODSHtml(ods, cantiere, imp);

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const filename = `${protocollo}.doc`;

  if (typeof salvaDocumento === 'function') {
    await salvaDocumento({
      filename,
      blob,
      cantiereId:    cantiere.id,
      cantiereNome:  cantiere.nome,
      tipoDoc:       'ods-inviato',
      titoloCondivisione: `ODS ${protocollo} — ${impresaNome}`
    });
  }

  document.getElementById('modal-nuovo-ods')?.remove();
  showToast(`ODS ${protocollo} creato ✓`, 'success');
  if (typeof showCheckmark === 'function') showCheckmark();

  // Ricarica la lista NC/ODS
  if (typeof renderNCList === 'function') renderNCList('nc-list-spa');
}

// ─────────────────────────────────────────────
// 5. Helper: prossimo numero ODS dell'anno per cantiere
// ─────────────────────────────────────────────
async function _prossimoNumeroODS(projectId) {
  try {
    const tutti = await getByIndex('nc', 'projectId', projectId);
    const annoOggi = new Date().getFullYear();
    const odsAnno = tutti.filter(x =>
      x.tipoAtto === 'ods-inviato' && x.anno === annoOggi
    );
    return odsAnno.length + 1;
  } catch (_) {
    return 1;
  }
}

async function _getCantiere(projectId) {
  try {
    const projects = await getAll('projects');
    return projects.find(p => p.id === projectId) || { id: projectId, nome: '' };
  } catch (_) {
    return { id: projectId, nome: '' };
  }
}

// ─────────────────────────────────────────────
// 6. Genera HTML formale ODS (template ANAS-style)
// ─────────────────────────────────────────────
function _buildODSHtml(ods, cantiere, imp) {
  const dataEmissLabel = new Date(ods.dataApertura).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const scadenzaLabel = new Date(ods.dataScadenza).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const cseNome      = imp.firmaNome      || 'Geom. Dogano Casella';
  const cseQualifica = imp.firmaQualifica || 'Coordinatore per la Sicurezza in Esecuzione (CSE)';
  const cseAlbo      = imp.firmaAlbo      || '';
  const firmaImg     = imp.firmaImmagine
    ? `<img src="${imp.firmaImmagine}" style="max-height:50px; max-width:180px" alt="Firma CSE" />`
    : '';

  const consegnaLabel = {
    'pec':          'Trasmissione via PEC',
    'mano':         'Consegna a mano in cantiere',
    'raccomandata': 'Raccomandata A/R'
  }[ods.consegna] || 'Trasmissione via PEC';

  return `
<html><head><meta charset="utf-8"><title>${ods.protocollo}</title><style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #000; }
  .intestazione { border-bottom: 2pt solid #000; padding-bottom: 8pt; margin-bottom: 16pt; }
  .titolo-atto { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase;
                 margin: 20pt 0; border: 1.5pt solid #000; padding: 10pt; }
  .blocco-dati { background: #f5f5f5; border: 1pt solid #999; padding: 10pt; margin: 10pt 0; }
  .scadenza-critica { background: #fff4e5; border: 2pt solid #e67e22; padding: 10pt;
                      margin: 10pt 0; font-weight: bold; text-align: center; }
  .firma-box { margin-top: 40pt; text-align: right; page-break-inside: avoid; }
  .footer { margin-top: 30pt; border-top: 1pt solid #999; padding-top: 8pt; font-size: 9pt; color: #555; }
  h4 { font-size: 11pt; text-transform: uppercase; border-bottom: 1pt solid #000;
       padding-bottom: 2pt; margin-top: 14pt; margin-bottom: 6pt; }
</style></head><body>

  <!-- INTESTAZIONE -->
  <table style="width:100%; border:none;" class="intestazione"><tr>
    <td style="text-align:left; width:60%; vertical-align:top;">
      <strong>${escapeHtml(imp.studioNome || 'Studio Tecnico CSE')}</strong><br/>
      ${escapeHtml(imp.studioIndirizzo || '')}<br/>
      ${imp.studioPEC ? 'PEC: ' + escapeHtml(imp.studioPEC) : ''}
    </td>
    <td style="text-align:right; width:40%; vertical-align:top;">
      <strong>Prot. n.</strong> ${escapeHtml(ods.protocollo)}<br/>
      <strong>Data:</strong> ${escapeHtml(dataEmissLabel)}<br/>
      <strong>Cantiere:</strong> ${escapeHtml(cantiere.id)}
    </td>
  </tr></table>

  <!-- DESTINATARIO -->
  <div style="margin-bottom: 14pt;">
    <strong>Spett.le:</strong><br/>
    <div style="margin-left: 20pt; margin-top: 4pt;">
      <strong>${escapeHtml(ods.impresaNome)}</strong><br/>
      ${ods.impresaRef ? 'C.A. ' + escapeHtml(ods.impresaRef) + '<br/>' : ''}
      ${ods.impresaPec ? 'PEC: ' + escapeHtml(ods.impresaPec) : ''}
    </div>
    <div style="font-size: 10pt; margin-top: 6pt; color: #444;">
      e p.c. — R.U.P. / Direttore Lavori / ANAS SpA Struttura Territoriale
    </div>
  </div>

  <!-- OGGETTO -->
  <div style="margin-bottom: 10pt;">
    <strong>OGGETTO:</strong> Ordine di Servizio n. ${escapeHtml(String(ods.numero))}/${escapeHtml(String(ods.anno))}
    — Cantiere <strong>${escapeHtml(cantiere.id)}</strong>
    ${cantiere.nome ? ' — ' + escapeHtml(cantiere.nome) : ''}.<br/>
    <em>${escapeHtml(ods.titolo)}</em>
  </div>

  <!-- TITOLO ATTO -->
  <div class="titolo-atto">
    Ordine di Servizio<br/>
    <span style="font-size: 10pt; font-weight: normal;">
      Art. 92 — D.Lgs 9 aprile 2008, n. 81
    </span>
  </div>

  <!-- PREMESSA -->
  <p>Il sottoscritto <strong>${escapeHtml(cseNome)}</strong>, in qualità di
  ${escapeHtml(cseQualifica)} del cantiere in oggetto, in applicazione dei
  compiti previsti dall'art. 92 del D.Lgs 81/2008,</p>

  <!-- DISPOSITIVO -->
  <h4>Dispone</h4>
  <p>nei confronti dell'Impresa destinataria l'esecuzione del seguente intervento:</p>

  <div class="blocco-dati">
    <strong>Intervento richiesto:</strong><br/>
    <div style="white-space: pre-wrap; margin-top: 6pt;">${escapeHtml(ods.descrizione)}</div>
  </div>

  <!-- SCADENZA -->
  <div class="scadenza-critica">
    ⏰ Termine di adempimento: entro e non oltre il <strong>${escapeHtml(scadenzaLabel)}</strong>
  </div>

  ${ods.riferimenti ? `
  <h4>Riferimenti</h4>
  <p>${escapeHtml(ods.riferimenti)}</p>
  ` : ''}

  <!-- OBBLIGHI DELL'IMPRESA -->
  <h4>Obblighi dell'Impresa</h4>
  <ol>
    <li>Eseguire l'intervento richiesto entro il termine indicato, con personale qualificato
        e nel rispetto delle procedure di sicurezza previste dal PSC e dal proprio POS.</li>
    <li>Comunicare al CSE l'avvenuto adempimento, fornendo documentazione fotografica
        e/o dichiarazione firmata del preposto.</li>
    <li>In caso di impossibilità motivata a rispettare il termine, comunicarlo tempestivamente
        al CSE via PEC con proposta di soluzione alternativa.</li>
  </ol>

  <!-- CONSEGUENZE INADEMPIMENTO -->
  <h4>Conseguenze in caso di inadempimento</h4>
  <p>Il mancato riscontro entro la scadenza comporterà:</p>
  <ul>
    <li>Apertura di Non Conformità formale con registrazione nel fascicolo di cantiere</li>
    <li>Eventuale proposta di sospensione dei lavori ex <strong>art. 92 c.1 lett. f</strong> D.Lgs 81/2008</li>
    <li>Segnalazione al R.U.P. per provvedimenti di competenza</li>
  </ul>

  <p style="margin-top: 14pt;">
    Il presente ordine viene trasmesso tramite <strong>${escapeHtml(consegnaLabel)}</strong>
    e si intende notificato alla data di ricezione.
  </p>

  <p>Distinti saluti.</p>

  <!-- FIRMA -->
  <div class="firma-box">
    ${firmaImg}
    <div style="border-top: 1pt solid #000; padding-top: 4pt; margin-top: 6pt; display: inline-block; min-width: 220pt;">
      <strong>${escapeHtml(cseNome)}</strong><br/>
      <span style="font-size: 10pt;">${escapeHtml(cseQualifica)}</span><br/>
      ${cseAlbo ? '<span style="font-size: 9pt;">' + escapeHtml(cseAlbo) + '</span>' : ''}
    </div>
  </div>

  <div class="footer">
    Atto emesso ai sensi dell'art. 92 D.Lgs 81/2008 —
    Generato da ANAS SafeHub il ${new Date().toLocaleString('it-IT')}
  </div>

</body></html>`;
}

// ─────────────────────────────────────────────
// 7. Marca ODS come eseguito (o non eseguito)
// ─────────────────────────────────────────────
async function marcaODSEseguito(odsId, eseguito = true) {
  const list = await getAll('nc').catch(() => []);
  const ods  = list.find(x => x.id === odsId);
  if (!ods) { showToast('ODS non trovato.', 'error'); return; }

  ods.stato = eseguito ? 'eseguito' : 'non-eseguito';
  ods.dataRiscontro = new Date().toISOString();
  ods.updatedAt     = new Date().toISOString();

  await saveItem('nc', ods);
  showToast(eseguito ? 'ODS marcato come eseguito ✓' : 'ODS marcato come NON eseguito', 'info');

  if (typeof renderNCList === 'function') renderNCList('nc-list-spa');
}

// ─────────────────────────────────────────────
// 8. Lista ODS del cantiere corrente
// ─────────────────────────────────────────────
async function getODSList() {
  if (!window.appState?.currentProject) return [];
  const tutti = await getByIndex('nc', 'projectId', window.appState.currentProject);
  return tutti.filter(x => x.tipoAtto === 'ods-inviato');
}
