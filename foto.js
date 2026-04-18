// foto.js - Gestione Foto NC/Verbali ANAS SafeHub
// NOTA: lo store "foto" è ora definito in db.js (non più qui con DB_VERSION+1)

// ─────────────────────────────────────────────
// 1. Selettore file / fotocamera
// ─────────────────────────────────────────────
function selezionaFoto(callback) {
  // Su mobile offri scelta: scatta vs galleria
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  if (isMobile) {
    _mostraMenuFotoMobile(callback);
    return;
  }

  // Desktop: solo file picker
  _apriSelettoreFoto(callback, false);
}

function _mostraMenuFotoMobile(callback) {
  const existing = document.getElementById('menu-foto-mobile');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'menu-foto-mobile';
  menu.className = 'fixed inset-0 bg-black/50 flex items-end justify-center z-[9999]';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Scegli origine foto');

  menu.innerHTML = `
    <div class="bg-white w-full rounded-t-2xl p-4 space-y-2 pb-safe"
         style="padding-bottom: calc(16px + env(safe-area-inset-bottom, 0))">
      <div class="text-center text-xs text-slate-500 pb-2 border-b border-slate-200">
        Allega foto alla NC
      </div>
      <button id="foto-camera-btn"
              class="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 hover:bg-blue-100
                     border border-blue-200 text-left transition"
              aria-label="Scatta foto con fotocamera">
        <div class="text-3xl">📷</div>
        <div>
          <div class="font-bold text-blue-900 text-sm">Scatta foto</div>
          <div class="text-xs text-blue-700">Apre la fotocamera posteriore</div>
        </div>
      </button>
      <button id="foto-galleria-btn"
              class="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 hover:bg-slate-100
                     border border-slate-200 text-left transition"
              aria-label="Seleziona foto dalla galleria">
        <div class="text-3xl">🖼️</div>
        <div>
          <div class="font-bold text-slate-900 text-sm">Dalla galleria</div>
          <div class="text-xs text-slate-600">Scegli una foto esistente</div>
        </div>
      </button>
      <button onclick="document.getElementById('menu-foto-mobile').remove()"
              class="w-full mt-2 p-3 text-sm text-slate-600 font-semibold">
        Annulla
      </button>
    </div>
  `;

  menu.addEventListener('click', e => {
    if (e.target === menu) menu.remove();
  });
  document.body.appendChild(menu);

  document.getElementById('foto-camera-btn').onclick = () => {
    menu.remove();
    _apriSelettoreFoto(callback, true);
  };
  document.getElementById('foto-galleria-btn').onclick = () => {
    menu.remove();
    _apriSelettoreFoto(callback, false);
  };
}

function _apriSelettoreFoto(callback, preferirCamera) {
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = 'image/*';
  if (preferirCamera) {
    // 'environment' apre la fotocamera posteriore su mobile
    input.setAttribute('capture', 'environment');
  }

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await comprimiImmagine(file);
    callback(compressed);
  };

  input.click();
}

// ─────────────────────────────────────────────
// 2. Compressione immagine (canvas)
// ─────────────────────────────────────────────
function comprimiImmagine(file, maxWidth = 1600, quality = 0.75) {
  return new Promise((resolve) => {
    const reader    = new FileReader();
    reader.onload   = (event) => {
      const img     = new Image();
      img.onload    = () => {
        const scale  = maxWidth / img.width;
        const width  = img.width > maxWidth ? maxWidth : img.width;
        const height = img.width > maxWidth ? Math.round(img.height * scale) : img.height;

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
// 3. Salvataggio foto in IndexedDB (store "foto")
// ─────────────────────────────────────────────
async function salvaFotoNC(ncId, blob) {
  const foto = {
    id:   'foto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    ncId,
    data: new Date().toISOString(),
    blob
  };
  await saveItem('foto', foto);
  return foto;
}

// ─────────────────────────────────────────────
// 4. Recupero foto per NC
// ─────────────────────────────────────────────
async function getFotoByNC(ncId) {
  try {
    return await getByIndex('foto', 'ncId', ncId);
  } catch (_) {
    // Fallback se l'indice non è ancora disponibile
    const tutte = await getAll('foto');
    return tutte.filter(f => f.ncId === ncId);
  }
}

// ─────────────────────────────────────────────
// 5. Rendering galleria foto NC
// ─────────────────────────────────────────────
async function renderFotoNC(containerId, ncId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let foto = [];
  try {
    foto = await getFotoByNC(ncId);
  } catch (_) {
    container.innerHTML = '<p class="text-xs text-slate-400">Impossibile caricare le foto.</p>';
    return;
  }

  if (foto.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic">Nessuna foto allegata.</p>';
    return;
  }

  // Revoca gli URL precedenti prima di crearne di nuovi (evita memory leak)
  if (container._blobUrls && Array.isArray(container._blobUrls)) {
    container._blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch(_){} });
  }
  container._blobUrls = [];

  container.innerHTML = foto.map(f => {
    const url = URL.createObjectURL(f.blob);
    container._blobUrls.push(url);
    return `
      <div class="inline-block">
        <img src="${url}"
             class="w-28 h-28 object-cover rounded-lg shadow border border-slate-200 cursor-pointer
                    hover:opacity-90 transition"
             alt="Foto NC del ${new Date(f.data).toLocaleDateString('it-IT')}"
             loading="lazy"
             onclick="apriLightbox('${url}')" />
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// 6. Lightbox semplice per visualizzare foto a schermo intero
// ─────────────────────────────────────────────
function apriLightbox(url) {
  const lb = document.createElement('div');
  lb.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] cursor-pointer';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Anteprima foto');
  lb.innerHTML = `<img src="${url}" class="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl" alt="Anteprima foto">`;
  lb.addEventListener('click', () => lb.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(lb);
}

// ─────────────────────────────────────────────
// 7. Salvataggio foto su USB (File System Access API)
// ─────────────────────────────────────────────
async function salvaFotoSuUSB(blob, nome = 'foto.jpg') {
  if (!window.showSaveFilePicker) {
    showToast('Il browser non supporta la scrittura diretta su USB.', 'warning');
    return;
  }
  try {
    const handle   = await window.showSaveFilePicker({
      suggestedName: nome,
      types: [{ description: 'Immagine JPEG', accept: { 'image/jpeg': ['.jpg'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    showToast('Foto salvata sulla chiavetta USB ✓', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Errore salvataggio: ' + err.message, 'error');
  }
}

// ─────────────────────────────────────────────
// 8. Aggiungi foto a una NC (chiamata dalla UI)
// ─────────────────────────────────────────────
function aggiungiFotoANC(ncId, containerId) {
  selezionaFoto(async (blob) => {
    await salvaFotoNC(ncId, blob);
    await renderFotoNC(containerId, ncId);
    showToast('Foto allegata correttamente ✓', 'success');
  });
}

// ─────────────────────────────────────────────
// RIMOSSO: il vecchio DOMContentLoaded che apriva
// IndexedDB con DB_VERSION+1 causando crash del DB.
// Lo store "foto" è ora definito correttamente in db.js
// ─────────────────────────────────────────────
