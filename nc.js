// nc.js - Gestione Non Conformità ANAS SafeHub

let currentNcId = null;

// ─────────────────────────────────────────────
// MOD-5: Helper tempo relativo (usato in card NC e verbali)
// ─────────────────────────────────────────────
function formatTempoRelativo(isoString) {
  if (!isoString) return null;
  const delta = Date.now() - new Date(isoString).getTime();
  if (isNaN(delta)) return null;

  const minuti = Math.floor(delta / 60000);
  if (minuti < 1)   return 'ora';
  if (minuti < 60)  return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24)     return `${ore} ${ore > 1 ? 'ore' : 'ora'} fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 7)   return `${giorni} giorno${giorni > 1 ? 'i' : ''} fa`;
  return new Date(isoString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

// ─────────────────────────────────────────────
// 1. Recupera NC del cantiere corrente
// ─────────────────────────────────────────────
async function getNCList() {
  if (!window.appState?.currentProject) return [];
  return await getByIndex('nc', 'projectId', window.appState.currentProject);
}

// ─────────────────────────────────────────────
// 2. Recupera una NC specifica
// ─────────────────────────────────────────────
async function getNC(id) {
  const list = await getNCList();
  return list.find(n => n.id === id) || null;
}

// ─────────────────────────────────────────────
// 3. Crea una nuova NC
// ─────────────────────────────────────────────
async function nuovaNC(tipoEmissione = 'nc') {
  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  // Valida il tipo: 'nc' (non conformità) o 'ods' (ordine di servizio inviato all'impresa)
  if (!['nc', 'ods'].includes(tipoEmissione)) tipoEmissione = 'nc';

  const projectId = window.appState.currentProject;
  currentNcId     = (tipoEmissione === 'ods' ? 'ods_' : 'nc_') + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const now       = new Date().toISOString();

  const nc = {
    id:            currentNcId,
    projectId,
    tipoEmissione,                        // 'nc' o 'ods'
    titolo:        '',
    descrizione:   '',
    stato:         'aperta',
    livello:       tipoEmissione === 'ods' ? null : 'media',  // ODS non hanno livello
    dataApertura:  now,
    dataScadenza:  tipoEmissione === 'nc' ? calcolaScadenzaNC('media', now) : null,
    createdAt:     now
  };

  await saveItem('nc', nc);

  // Reset campi UI
  const titolEl = document.getElementById('nc-titolo');
  const descEl  = document.getElementById('nc-descrizione');
  const statoEl = document.getElementById('nc-stato');
  const tipoBadge = document.getElementById('nc-tipo-badge');

  if (titolEl)  titolEl.value  = '';
  if (descEl)   descEl.value   = '';
  if (statoEl)  statoEl.value  = 'aperta';
  if (tipoBadge) {
    tipoBadge.textContent = tipoEmissione === 'ods'
      ? '📋 ODS inviato all\'Impresa'
      : '⚠️ Non Conformità';
    tipoBadge.className = tipoEmissione === 'ods'
      ? 'inline-block px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold'
      : 'inline-block px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold';
  }

  if (typeof switchView === 'function') switchView('nc');
  if (typeof renderDocumentiCollegati === 'function') {
    renderDocumentiCollegati('documenti-nc', 'nc', currentNcId);
  }

  return nc;
}

// ─────────────────────────────────────────────
// 4. Apri NC esistente
// ─────────────────────────────────────────────
async function apriNC(id) {
  const nc = await getNC(id);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  currentNcId = id;

  const titolEl   = document.getElementById('nc-titolo');
  const descEl    = document.getElementById('nc-descrizione');
  const statoEl   = document.getElementById('nc-stato');
  const livelloEl = document.getElementById('nc-livello');

  if (titolEl)   titolEl.value   = nc.titolo     || '';
  if (descEl)    descEl.value    = nc.descrizione || '';
  if (statoEl)   statoEl.value   = nc.stato       || 'aperta';
  if (livelloEl) livelloEl.value = nc.livello     || 'media';

  if (typeof switchView === 'function') switchView('nc');
  if (typeof renderDocumentiCollegati === 'function') {
    renderDocumentiCollegati('documenti-nc', 'nc', currentNcId);
  }
}

// ─────────────────────────────────────────────
// 5. Salva modifiche NC
// ─────────────────────────────────────────────
async function salvaNC() {
  if (!currentNcId) { showToast('Nessuna NC aperta.', 'error'); return; }

  const titolo      = (document.getElementById('nc-titolo')?.value     || '').trim();
  const descrizione = (document.getElementById('nc-descrizione')?.value || '').trim();
  const stato       = document.getElementById('nc-stato')?.value        || 'aperta';
  const livello     = document.getElementById('nc-livello')?.value      || null;

  const nc = await getNC(currentNcId);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  // Se il livello è cambiato, ricalcola la scadenza
  const nuovoLivello   = livello || nc.livello;
  const nuovaScadenza  = (livello && livello !== nc.livello)
    ? calcolaScadenzaNC(livello, nc.dataApertura)
    : nc.dataScadenza;

  const updated = {
    ...nc,
    titolo,
    descrizione,
    stato,
    livello:      nuovoLivello,
    dataScadenza: nuovaScadenza,
    updatedAt:    new Date().toISOString()
  };
  await saveItem('nc', updated);
  showToast('NC salvata correttamente ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  return updated;
}

// ─────────────────────────────────────────────
// 6. Chiudi NC
// ─────────────────────────────────────────────
async function chiudiNC(id) {
  const nc = await getNC(id);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  const updated = { ...nc, stato: 'chiusa', dataChiusura: new Date().toISOString() };
  await saveItem('nc', updated);
  showToast('NC chiusa correttamente ✓', 'success');

  setTimeout(() => {
    if (typeof renderKPI === 'function')             renderKPI();
    if (typeof renderNCListWithFoto === 'function')  renderNCListWithFoto('nc-list');
    if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
  }, 150);

  return updated;
}

// ─────────────────────────────────────────────
// 7. Riapri NC
// ─────────────────────────────────────────────
async function riapriNC(id) {
  const nc = await getNC(id);
  if (!nc) { showToast('NC non trovata.', 'error'); return; }

  const updated = { ...nc, stato: 'aperta', dataChiusura: null };
  await saveItem('nc', updated);
  showToast('NC riaperta ✓', 'success');

  setTimeout(() => {
    if (typeof renderKPI === 'function')             renderKPI();
    if (typeof renderNCListWithFoto === 'function')  renderNCListWithFoto('nc-list');
    if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
  }, 150);

  return updated;
}

// ─────────────────────────────────────────────
// 8. Calcolo scadenza NC per livello
// ─────────────────────────────────────────────
function calcolaScadenzaNC(livello, dataApertura) {
  const apertura = new Date(dataApertura || new Date());

  switch (livello) {
    case 'gravissima': apertura.setHours(apertura.getHours() + 24); break; // 24h
    case 'grave':      apertura.setDate(apertura.getDate() + 3);    break; // 3gg
    default:           apertura.setDate(apertura.getDate() + 7);    break; // 7gg (media/lieve)
  }

  return apertura.toISOString();
}

// ─────────────────────────────────────────────
// 9. Rendering lista NC (dashboard)
// ─────────────────────────────────────────────
async function renderNCList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = await getNCList();

  if (!list || list.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500 py-4 text-center">Nessuna NC presente.</p>';
    return;
  }

  container.innerHTML = list.map(nc => renderNCCard(nc)).join('');
}

// ─────────────────────────────────────────────
// 10. Render singola card NC
// ─────────────────────────────────────────────
function renderNCCard(nc) {
  const livello       = nc.livello || 'media';
  const isAperta      = nc.stato !== 'chiusa';
  const tipoEmissione = nc.tipoEmissione || 'nc';
  const isODS         = tipoEmissione === 'ods';
  const isScaduta     = isAperta && nc.dataScadenza && new Date(nc.dataScadenza) < new Date();

  const coloriLivello = {
    gravissima: 'bg-red-100 text-red-800 border-red-300',
    grave:      'bg-orange-100 text-orange-800 border-orange-300',
    media:      'bg-yellow-100 text-yellow-800 border-yellow-300',
    lieve:      'bg-blue-100 text-blue-800 border-blue-300'
  };

  // Per ODS colore arancione uniforme
  const badgeClass = isODS
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : (coloriLivello[livello] || coloriLivello.media);
  const cardBorder = isScaduta ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white';

  // P6: bottone sospensione SOLO per NC gravissime aperte da oltre 20h
  const ore = nc.dataApertura
    ? (Date.now() - new Date(nc.dataApertura).getTime()) / (1000 * 60 * 60)
    : 0;
  const richiedeSospensione = !isODS && isAperta && livello === 'gravissima' && ore >= 20;
  const richiedeSegnalazione = !isODS && isAperta && (livello === 'gravissima' || livello === 'grave');
  const giaProposta         = !!nc.sospensioneGenerata;

  // Dati utente → sanificati
  const titolo      = escapeHtml(nc.titolo);
  const descrizione = escapeHtml(nc.descrizione);
  const livelloSafe = escapeHtml(livello).toUpperCase();

  // Icona e titolo riga
  const iconaTipo = isODS ? '📋' : '⚠️';
  const tipoLabel = isODS ? 'ORDINE DI SERVIZIO' : 'NON CONFORMITÀ';

  return `
    <div class="p-4 rounded-xl shadow-sm border ${cardBorder} ${richiedeSospensione && !giaProposta ? 'alert-pulse border-red-500' : ''} mb-3"
         role="article"
         aria-label="${tipoLabel} ${livello.toUpperCase()}, stato: ${nc.stato}">

      <div class="flex justify-between items-start gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-xs font-bold px-2 py-0.5 rounded border ${badgeClass}">
              ${iconaTipo} ${isODS ? 'ODS ALL\'IMPRESA' : livelloSafe}
            </span>
            ${isScaduta ? '<span class="text-xs text-red-600 font-bold">⚠️ SCADUTA</span>' : ''}
            ${richiedeSospensione && !giaProposta
              ? `<span class="text-xs text-red-700 font-bold bg-red-100 border border-red-400 px-2 py-0.5 rounded">
                   🚨 Art. 92 c.1 lett. f — SOSPENSIONE
                 </span>`
              : ''}
            ${giaProposta
              ? `<span class="text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded"
                       title="Proposta di sospensione generata il ${new Date(nc.sospensioneGenerata.data).toLocaleDateString('it-IT')}">
                   📄 Sospensione già proposta
                 </span>`
              : ''}
            ${nc.segnalazioneGenerata
              ? `<span class="text-xs text-orange-700 bg-orange-50 border border-orange-300 px-2 py-0.5 rounded"
                       title="Segnalazione al RUP inviata il ${new Date(nc.segnalazioneGenerata.data).toLocaleDateString('it-IT')}">
                   ✉️ Segnalata al RUP
                 </span>`
              : ''}
          </div>

          ${titolo ? `<div class="font-semibold text-slate-800 mb-1">${titolo}</div>` : ''}
          <div class="text-xs text-slate-500">
            Emessa: ${nc.dataApertura ? new Date(nc.dataApertura).toLocaleString('it-IT') : '–'}
          </div>
          ${nc.dataScadenza ? `
            <div class="text-xs text-slate-500">
              Scadenza adempimento: ${new Date(nc.dataScadenza).toLocaleString('it-IT')}
            </div>
          ` : ''}
          <p class="text-sm mt-2 text-slate-700">${descrizione}</p>
        </div>

        <div class="flex flex-col gap-2 shrink-0 items-end">
          ${isAperta
            ? `<button onclick="chiudiNC('${nc.id}')"
                       class="bg-green-600 text-white text-xs px-4 py-2 rounded-lg font-bold
                              hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                       aria-label="Chiudi ${isODS ? 'ODS' : 'NC'}">
                 Chiudi
               </button>`
            : `<button onclick="riapriNC('${nc.id}')"
                       class="bg-yellow-500 text-white text-xs px-4 py-2 rounded-lg font-bold
                              hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                       aria-label="Riapri ${isODS ? 'ODS' : 'NC'}">
                 Riapri
               </button>`
          }

          <details class="relative group">
            <summary class="list-none cursor-pointer bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-200 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 select-none">
              ⋯ Opzioni
            </summary>
            <div class="absolute right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-2 flex flex-col gap-2 z-10 min-w-[160px]">
              ${richiedeSospensione ? `
                <button onclick="apriPannelloSospensione('${nc.id}')"
                        class="text-left w-full bg-red-50 text-red-700 text-xs px-3 py-2 rounded-md
                               hover:bg-red-100 focus:outline-none font-bold"
                        aria-label="Genera proposta di sospensione lavori ex art. 92">
                  🚨 Sospensione
                </button>` : ''}
              ${richiedeSegnalazione ? `
                <button onclick="apriPannelloSegnalazione('${nc.id}')"
                        class="text-left w-full bg-orange-50 text-orange-700 text-xs px-3 py-2 rounded-md
                               hover:bg-orange-100 focus:outline-none font-bold"
                        aria-label="Genera segnalazione RUP ex art. 92 c.1 lett. e">
                  ✉️ Segnalazione RUP
                </button>` : ''}
              <button onclick="aggiungiFotoANC('${nc.id}', 'foto-${nc.id}')"
                      class="text-left w-full text-slate-700 text-xs px-3 py-2 rounded-md hover:bg-slate-100 focus:outline-none"
                      aria-label="Aggiungi foto">
                📸 Aggiungi Foto
              </button>
              <button onclick="apriSalvataggioNC('${nc.id}', '${escapeHtml(livello)}')"
                      class="text-left w-full text-slate-700 text-xs px-3 py-2 rounded-md hover:bg-slate-100 focus:outline-none"
                      aria-label="Salva o invia">
                💾 Esporta / Invia
              </button>
            </div>
          </details>
        </div>
      </div>

      <div id="foto-${nc.id}" class="mt-3 flex flex-wrap gap-2"></div>

      ${(nc.modifiedBy || nc.modifiedAt) && typeof isArchivioOneDriveAttivo !== 'undefined'
        ? (() => {
            // Mostra il badge solo se OneDrive è attivo (check sincrono tramite flag globale)
            // isArchivioOneDriveAttivo è async — usiamo _odConfigured come flag rapido
            const attivo = typeof _odConfigured !== 'undefined' && _odConfigured;
            if (!attivo) return '';
            const tempo = typeof formatTempoRelativo === 'function' ? formatTempoRelativo(nc.modifiedAt) : null;
            const autore = escapeHtml(nc.modifiedBy || '');
            return `<div class="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
              <span aria-hidden="true">☁️</span>
              <span>${autore ? `<strong>${autore}</strong> · ` : ''}${tempo ? tempo : ''}</span>
            </div>`;
          })()
        : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Helper salvataggio NC — chiamato dall'onclick card
// Evita template literal complessi negli attributi HTML
// ─────────────────────────────────────────────
function apriSalvataggioNC(ncId, livello) {
  const titolo = 'NC ' + (livello || '').toUpperCase();
  if (typeof mostraPannelloSalvataggio === 'function') {
    mostraPannelloSalvataggio({
      titolo,
      nascondJSON: true,
      onPDF:   function() { if (typeof exportNCPDF  === 'function') exportNCPDF(ncId);  },
      onWord:  function() { if (typeof exportNCWord === 'function') exportNCWord(ncId); },
      onEmail: function() {
        if (typeof mostraPannelloEmail === 'function')
          mostraPannelloEmail({ tipo: 'nc', id: ncId });
        else if (typeof inviaNcEmail === 'function')
          inviaNcEmail(ncId);
      }
    });
  } else if (typeof exportNCPDF === 'function') {
    exportNCPDF(ncId);
  }
}
