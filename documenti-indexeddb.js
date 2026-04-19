// documenti-indexeddb.js
// Lo store "documenti" è già definito in db.js (v6).
// Questo file espone solo le funzioni di accesso ai documenti.

async function salvaDocumentoInDB(doc) {
  return await saveItem('documenti', doc);
}
// Alias retrocompatibile — usato da documenti.js handleFiles()
// NOTA: se salva-file.js è caricato dopo, la sua salvaDocumento NON sovrascrive questa
//       perché abbiamo rinominato la funzione. Chi ha bisogno del salvataggio IndexedDB
//       dovrebbe usare salvaDocumentoInDB().

async function getDocumenti() {
  return await getAll('documenti');
}

async function cercaDocumenti(term) {
  const docs  = await getDocumenti();
  const lower = (term || '').toLowerCase();
  if (!lower) return docs;

  return docs.filter(d =>
    (d.nome || '').toLowerCase().includes(lower) ||
    (d.tags || []).some(t => t.toLowerCase().includes(lower))
  );
}

async function eliminaDocumento(id) {
  return await deleteItem('documenti', id);
}
