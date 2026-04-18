// documenti-imprese-lavoratori.js - Documenti collegati a Imprese e Lavoratori

async function collegaDocumentoAImpresa(docId, impresaId) {
  return await collegaDocumentoARiferimento(docId, 'impresa', impresaId);
}

async function collegaDocumentoALavoratore(docId, lavoratoreId) {
  return await collegaDocumentoARiferimento(docId, 'lavoratore', lavoratoreId);
}

async function getDocumentiImpresa(impresaId) {
  return await getDocumentiCollegati('impresa', impresaId);
}

async function getDocumentiLavoratore(lavoratoreId) {
  return await getDocumentiCollegati('lavoratore', lavoratoreId);
}

async function renderDocumentiImpresa(containerId, impresaId) {
  return await renderDocumentiCollegati(containerId, 'impresa', impresaId);
}

async function renderDocumentiLavoratore(containerId, lavoratoreId) {
  return await renderDocumentiCollegati(containerId, 'lavoratore', lavoratoreId);
}

function collegaDocumentoAImpresaDaPopup(impresaId) {
  if (!impresaId) { showToast('Errore: nessuna impresa selezionata.', 'error'); return; }
  apriPopupCollegamento('impresa', impresaId);
}

function collegaDocumentoALavoratoreDaPopup(lavoratoreId) {
  if (!lavoratoreId) { showToast('Errore: nessun lavoratore selezionato.', 'error'); return; }
  apriPopupCollegamento('lavoratore', lavoratoreId);
}
