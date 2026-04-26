// firma.js — Firma Canvas con Timestamp per ANAS SafeHub CSE
// Geom. Dogano Casella — Coordinatore Sicurezza in Esecuzione

// ─────────────────────────────────────────────
// 1. Render componente firma in un container
//    Uso: renderFirmaCanvas('id-container', onSaveCallback)
// ─────────────────────────────────────────────
function renderFirmaCanvas(containerId, onSave) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const firmaId = containerId + '-canvas';
  const timestampNow = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  container.innerHTML = `
    <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-slate-50
                  border-b border-slate-200">
        <div>
          <span class="text-xs font-bold text-slate-700 uppercase tracking-wide">
            ✍️ Firma CSE
          </span>
          <span class="text-xs text-slate-400 ml-2">Geom. Dogano Casella</span>
        </div>
        <div class="flex items-center gap-2">
          <span id="${firmaId}-ts"
                class="text-xs text-slate-500 font-mono"
                aria-label="Timestamp firma">
            ${timestampNow}
          </span>
        </div>
      </div>

      <!-- Canvas area -->
      <div class="relative bg-white">
        <canvas id="${firmaId}"
                width="600"
                height="140"
                class="w-full touch-none cursor-crosshair block"
                role="img"
                aria-label="Area firma digitale — firma qui con il dito o il mouse"
                style="max-height: 140px;">
        </canvas>
        <!-- Linea guida firma -->
        <div class="absolute bottom-8 left-8 right-8 h-px bg-slate-200 pointer-events-none"></div>
        <div class="absolute bottom-2 left-8 text-[10px] text-slate-300 pointer-events-none select-none">
          Firma qui
        </div>
      </div>

      <!-- Footer azioni -->
      <div class="flex items-center justify-between px-4 py-2 bg-slate-50
                  border-t border-slate-200">
        <div class="flex gap-2">
          <button type="button"
                  onclick="_firmaUndo('${firmaId}')"
                  class="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700
                         hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  aria-label="Annulla ultimo tratto">
            ↩ Annulla
          </button>
          <button type="button"
                  onclick="_firmaClear('${firmaId}')"
                  class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700
                         hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                  aria-label="Cancella firma">
            🗑 Cancella
          </button>
        </div>
        <button type="button"
                onclick="_firmaConferma('${firmaId}', '${containerId}')"
                class="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Conferma e salva firma">
          ✅ Conferma Firma
        </button>
      </div>

    </div>

    <!-- Preview firma confermata -->
    <div id="${firmaId}-preview" class="hidden mt-3">
      <div class="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
        <span class="text-green-600 text-lg">✅</span>
        <div>
          <div class="text-xs font-bold text-green-800">Firma acquisita</div>
          <div class="text-xs text-green-600" id="${firmaId}-preview-ts"></div>
        </div>
        <img id="${firmaId}-preview-img"
             class="ml-auto h-12 rounded border border-green-200 bg-white"
             alt="Anteprima firma" />
        <button type="button"
                onclick="_firmaReset('${firmaId}', '${containerId}')"
                class="text-xs text-slate-500 hover:text-slate-800 underline ml-2">
          Rifirma
        </button>
      </div>
    </div>
  `;

  _initFirmaCanvas(firmaId, onSave);
}

// ─────────────────────────────────────────────
// 2. Inizializza eventi canvas (mouse + touch)
// ─────────────────────────────────────────────
function _initFirmaCanvas(firmaId, onSave) {
  const canvas = document.getElementById(firmaId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // MOD-23: High-DPI / Retina Support
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Imposta risoluzione interna elevata
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  // Mantieni dimensioni CSS costanti
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  ctx.scale(ratio, ratio);

  let drawing = false;
  let strokes = []; // array di ImageData per undo
  let hasStroke = false;

  // Stile penna migliorato (MOD-23)
  ctx.strokeStyle = '#0f172a'; // Slate 900
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Salva onSave callback nel dataset
  canvas._firmaOnSave = onSave;

  // Helper coordinate normalizzate (ora tengono conto del ratio via rect)
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: src.clientX - r.left,
      y: src.clientY - r.top
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    // Salva snapshot per undo
    strokes.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    hasStroke = true;
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    ctx.beginPath();
  }

  // Mouse
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  // Touch (mobile / tablet)
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  // Salva strokes e hasStroke in canvas per accesso globale
  canvas._strokes = strokes;
  canvas._hasStroke = () => hasStroke;
  canvas._ctx = ctx;
}

// ─────────────────────────────────────────────
// 3. Undo (un tratto alla volta)
// ─────────────────────────────────────────────
function _firmaUndo(firmaId) {
  const canvas = document.getElementById(firmaId);
  if (!canvas) return;
  const strokes = canvas._strokes;
  if (!strokes || strokes.length === 0) return;
  const prev = strokes.pop();
  canvas._ctx.putImageData(prev, 0, 0);
}

// ─────────────────────────────────────────────
// 4. Cancella tutto
// ─────────────────────────────────────────────
function _firmaClear(firmaId) {
  const canvas = document.getElementById(firmaId);
  if (!canvas) return;
  canvas._ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas._strokes) canvas._strokes.length = 0;
}

// ─────────────────────────────────────────────
// 5. Conferma firma → genera PNG + timestamp
// ─────────────────────────────────────────────
function _firmaConferma(firmaId, containerId) {
  const canvas = document.getElementById(firmaId);
  if (!canvas) return;

  // Controlla se il canvas è vuoto
  const data = canvas._ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const isEmpty = !data.some(v => v !== 0);
  if (isEmpty) {
    if (typeof showToast === 'function') showToast('Firma il campo prima di confermare.', 'warning');
    return;
  }

  // Aggiunge il timestamp dentro il canvas (bordo in basso a destra)
  const now = new Date();
  const tsLabel = now.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const tsISO = now.toISOString();

  const ctx = canvas._ctx;
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText('CSE: Geom. Dogano Casella — ' + tsLabel, canvas.width - 8, canvas.height - 6);
  ctx.restore();

  // Genera PNG
  const dataURL = canvas.toDataURL('image/png');

  // Mostra preview
  const preview = document.getElementById(firmaId + '-preview');
  const previewImg = document.getElementById(firmaId + '-preview-img');
  const previewTs = document.getElementById(firmaId + '-preview-ts');

  if (preview) preview.classList.remove('hidden');
  if (previewImg) previewImg.src = dataURL;
  if (previewTs) previewTs.textContent = 'Firmato il ' + tsLabel;

  // Nascondi canvas principale
  const canvasWrapper = canvas.closest('.border');
  if (canvasWrapper) canvasWrapper.classList.add('hidden');

  // Aggiorna timestamp header
  const tsEl = document.getElementById(firmaId + '-ts');
  if (tsEl) tsEl.textContent = tsLabel;

  // Callback con i dati firma
  const firmaData = {
    png: dataURL,
    timestamp: tsISO,
    label: tsLabel,
    firmante: 'Geom. Dogano Casella — CSE'
  };

  if (typeof canvas._firmaOnSave === 'function') {
    canvas._firmaOnSave(firmaData);
  }

  // Salva su window per accesso da verbali.js
  window._firmaCorrente = firmaData;

  if (typeof showToast === 'function') showToast('Firma acquisita correttamente ✓', 'success');
}

// ─────────────────────────────────────────────
// 6. Reset → permette di rifirmare
// ─────────────────────────────────────────────
function _firmaReset(firmaId, containerId) {
  const canvas = document.getElementById(firmaId);
  if (!canvas) return;

  _firmaClear(firmaId);
  window._firmaCorrente = null;

  // Rivisualizza canvas
  const canvasWrapper = canvas.closest('.border');
  if (canvasWrapper) canvasWrapper.classList.remove('hidden');

  const preview = document.getElementById(firmaId + '-preview');
  if (preview) preview.classList.add('hidden');
}

// ─────────────────────────────────────────────
// 7. Helper per stampa PDF verbale con firma
//    Restituisce l'img tag con la firma o stringa vuota
// ─────────────────────────────────────────────
function getFirmaPNG() {
  return window._firmaCorrente?.png || null;
}

function getFirmaTimestamp() {
  return window._firmaCorrente?.timestamp || null;
}

// ─────────────────────────────────────────────
// 8. Carica firma persistente (base64 PNG) sul canvas
//    Usata da verbali, riunioni, POS per pre-compilare
// ─────────────────────────────────────────────
function caricaFirmaSuCanvas(containerId, base64PNG) {
  const container = document.getElementById(containerId);
  if (!container || !base64PNG) return false;

  const canvas = container.querySelector('canvas');
  if (!canvas) return false;

  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    // Pulisce e ridisegna la firma centrata
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Scala per adattare
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    // Marca che c'è una firma valida (usata da _firmaConferma)
    canvas.dataset.hasSignature = 'true';
  };
  img.onerror = () => { /* ignora */ };
  img.src = base64PNG;
  return true;
}
