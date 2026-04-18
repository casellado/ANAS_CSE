// documenti-preview.js - Preview PDF e immagini ANAS SafeHub

// Registry blob URL attivi — per revoca controllata
const _blobUrlRegistry = new Map();

function _registraBlobUrl(key, url) {
  // Revoca eventuale URL precedente per la stessa chiave
  if (_blobUrlRegistry.has(key)) {
    URL.revokeObjectURL(_blobUrlRegistry.get(key));
  }
  _blobUrlRegistry.set(key, url);
  return url;
}

function _revocaBlobUrl(key) {
  if (_blobUrlRegistry.has(key)) {
    URL.revokeObjectURL(_blobUrlRegistry.get(key));
    _blobUrlRegistry.delete(key);
  }
}

// ─────────────────────────────────────────────
// 1. Mostra anteprima documento
// ─────────────────────────────────────────────
async function mostraPreviewDocumento(id) {
  const docs = await getDocumenti();
  const doc  = docs.find(d => d.id === id);
  if (!doc) { showToast('Documento non trovato.', 'error'); return; }
  if (!doc.blob) { showToast('Il file non è disponibile in cache.', 'warning'); return; }

  // Crea URL con registry per revoca garantita
  const url     = _registraBlobUrl('preview:' + id, URL.createObjectURL(doc.blob));
  const isPDF   = doc.tipo === 'application/pdf';
  const isImage = (doc.tipo || '').startsWith('image/');
  const nomeSafe = escapeHtml(doc.nome);
  const tagsSafe = (doc.tags || []).map(t => escapeHtml(t)).join(' · ');

  const existing = document.getElementById('preview-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id        = 'preview-modal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `Anteprima: ${nomeSafe}`);

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[92vh]
                overflow-hidden flex flex-col">

      <div class="flex justify-between items-center p-4 border-b border-slate-200 shrink-0">
        <div>
          <h3 class="font-bold text-slate-800 text-base">${nomeSafe}</h3>
          <div class="text-xs text-slate-400">${tagsSafe}</div>
        </div>
        <button onclick="chiudiPreview()"
                class="text-slate-400 hover:text-slate-800 text-2xl leading-none
                       focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                aria-label="Chiudi anteprima">
          ✕
        </button>
      </div>

      <div class="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center items-start">
        ${isPDF
          ? `<embed src="${url}"
                    type="application/pdf"
                    class="w-full rounded border border-slate-300"
                    style="min-height:70vh"
                    aria-label="Anteprima PDF: ${nomeSafe}">`
          : isImage
            ? `<img src="${url}"
                    class="max-h-[75vh] rounded-lg shadow border border-slate-200"
                    alt="Anteprima: ${nomeSafe}">`
            : `<div class="text-center text-slate-500 py-12">
                 <div class="text-5xl mb-4">📄</div>
                 <p class="mb-4 font-medium">Anteprima non disponibile per questo tipo di file.</p>
                 <button onclick="scaricaDocumento('${doc.id}')"
                         class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold
                                hover:bg-blue-700">
                   Scarica il file
                 </button>
               </div>`
        }
      </div>

    </div>
  `;

  const escFn = (e) => { if (e.key === 'Escape') { chiudiPreview(); document.removeEventListener('keydown', escFn); } };
  modal.addEventListener('click', (e) => { if (e.target === modal) chiudiPreview(); });
  document.addEventListener('keydown', escFn);

  // Revoca il blob URL quando il modal viene rimosso (MutationObserver)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('preview-modal')) {
      _revocaBlobUrl('preview:' + id);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  document.body.appendChild(modal);
}

// ─────────────────────────────────────────────
// 2. Chiudi modal preview
// ─────────────────────────────────────────────
function chiudiPreview() {
  const modal = document.getElementById('preview-modal');
  if (modal) modal.remove();
  // La revoca avviene tramite MutationObserver registrato in mostraPreviewDocumento
}

// ─────────────────────────────────────────────
// 3. Icona / miniatura documento
//    BUG-L FIX: usa _registraBlobUrl per evitare memory leak
//    sulle miniature generate ad ogni render lista
// ─────────────────────────────────────────────
function renderAnteprimaIcona(doc) {
  if (!doc) return '<div class="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">📄</div>';

  const isPDF   = doc.tipo === 'application/pdf';
  const isImage = (doc.tipo || '').startsWith('image/');
  const nomeSafe = escapeHtml(doc.nome);

  if (isImage && doc.blob) {
    // Riusa URL esistente se già registrato per questa miniatura (evita leak)
    const cacheKey = 'thumb:' + doc.id;
    const url = _blobUrlRegistry.has(cacheKey)
      ? _blobUrlRegistry.get(cacheKey)
      : _registraBlobUrl(cacheKey, URL.createObjectURL(doc.blob));

    return `<img src="${url}"
                 class="w-10 h-10 object-cover rounded border border-slate-200 cursor-pointer
                        shrink-0 hover:opacity-80 transition"
                 alt="${nomeSafe}"
                 onclick="mostraPreviewDocumento('${doc.id}')" />`;
  }

  if (isPDF) {
    return `<div onclick="mostraPreviewDocumento('${doc.id}')"
                 class="w-10 h-10 bg-red-100 border border-red-300 text-red-600 rounded
                        flex items-center justify-center cursor-pointer font-bold text-xs
                        shrink-0 hover:bg-red-200 transition"
                 role="button"
                 aria-label="Apri anteprima PDF: ${nomeSafe}">
              PDF
            </div>`;
  }

  return `<div class="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-500 rounded
                       flex items-center justify-center text-lg shrink-0"
               aria-label="Documento: ${nomeSafe}">
            📄
          </div>`;
}

// ─────────────────────────────────────────────
// 4. Pulizia globale blob URL (da chiamare on unload)
//    Evita leak quando si naviga via
// ─────────────────────────────────────────────
window.addEventListener('pagehide', () => {
  _blobUrlRegistry.forEach((url) => URL.revokeObjectURL(url));
  _blobUrlRegistry.clear();
});
