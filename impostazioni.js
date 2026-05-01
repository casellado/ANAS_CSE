// impostazioni.js — Personalizzazione intestazione verbale ANAS SafeHub
// Geom. Dogano Casella — CSE

// ─────────────────────────────────────────────
// Chiave IndexedDB per le impostazioni
// ─────────────────────────────────────────────
const IMPOSTAZIONI_KEY = 'impostazioni_verbale';

// Valori di default
const IMPOSTAZIONI_DEFAULT = {
  // Intestazione destra (committente)
  committenteNome: 'ANAS SpA',
  committenteContrat: '',   // es. "Contratto rep. n. 1234/2024"

  // Dati cantiere (pre-compilazione suggerita)
  cantiereDescrizione: '',  // es. "Manutenzione programmata SS 106"
  rup: '',  // es. "Ing. Mario Verdi"
  dl: '',  // es. "Ing. Lucia Bianchi"

  // Riferimenti normativi da citare nel footer del PDF
  normativa: 'D.Lgs 81/2008 · D.I. 22/01/2019',

  // Footer PDF
  footerSinistro: 'Geom. Dogano Casella — Coordinatore Sicurezza in Esecuzione (CSE)',
  footerDestro: 'Documento riservato — uso interno ANAS SpA',

  // Loghi (base64 PNG/JPG) — null se non caricati
  logoSinistro: null,   // logo studio / CSE
  logoDestro: null,   // logo ANAS o committente

  // Firma pre-impostata (nome stampato sotto la firma canvas)
  firmaNome: 'Geom. Dogano Casella',
  firmaQualifica: 'Coordinatore per la Sicurezza in Esecuzione (CSE)',
  firmaAlbo: '',

  // P2: Firma persistente (base64 PNG) — se presente, precompila automaticamente
  // il canvas firma in ogni verbale, evitando di ri-firmare ogni volta.
  // Il CSE è sempre lo stesso, la firma è sempre la stessa.
  firmaImmagine: null,

  // Modello Qualità ANAS Mod. RE. 01-5 (Verifica POS)
  posTecnicoNome: '',
  posTecnicoQualifica: '',
  posTecnicoAlbo: '',
  posRup: '',
  posDl: '',
  posCUP: '',
  posCIG: '',
  posCommessa: '',
  posStruttura: '',
  posCodicePpm: '',

  // Modello Qualità ANAS Mod. RE. 01-10 (Riunione di Coordinamento)
  riuTecnicoNome: '',
  riuTecnicoQualifica: '',
  riuRup: '',
  riuDl: ''
};

// ─────────────────────────────────────────────
// 1. Carica impostazioni da IndexedDB
// ─────────────────────────────────────────────
async function caricaImpostazioni() {
  try {
    const item = await getItem('impostazioni', IMPOSTAZIONI_KEY);
    if (item && item.data) {
      return { ...IMPOSTAZIONI_DEFAULT, ...item.data };
    }
  } catch (_) { }
  return { ...IMPOSTAZIONI_DEFAULT };
}

// ─────────────────────────────────────────────
// 2. Salva impostazioni in IndexedDB
// ─────────────────────────────────────────────
async function salvaImpostazioni(dati) {
  await saveItem('impostazioni', { id: IMPOSTAZIONI_KEY, data: dati });
}

// ─────────────────────────────────────────────
// 3. Helper: leggi logo come base64
// ─────────────────────────────────────────────
function leggiLogoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/...;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
// 4. Render VIEW impostazioni
// ─────────────────────────────────────────────
async function renderViewImpostazioni(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const imp = await caricaImpostazioni();

  container.innerHTML = `
    <div class="max-w-3xl space-y-6">

      <!-- Tabs Selector -->
      <div class="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-2 overflow-x-auto select-none" role="tablist">
        <button onclick="switchImpostazioniTab('mod-pos')" id="tab-btn-mod-pos"
                class="tab-btn-active flex-1 py-2 text-xs font-bold text-center rounded-lg transition px-3 select-none outline-none focus:outline-none">
          📋 Mod. RE. 01-5 (POS)
        </button>
        <button onclick="switchImpostazioniTab('mod-riu')" id="tab-btn-mod-riu"
                class="tab-btn-inactive flex-1 py-2 text-xs font-bold text-center rounded-lg transition px-3 select-none outline-none focus:outline-none">
          📋 Mod. RE. 01-10 (Riunioni)
        </button>
        <button onclick="switchImpostazioniTab('dati-anas')" id="tab-btn-dati-anas"
                class="tab-btn-inactive flex-1 py-2 text-xs font-bold text-center rounded-lg transition px-3 select-none outline-none focus:outline-none">
          🏢 Logo e Dati di Base
        </button>
      </div>

      <style>
        .tab-btn-active {
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
        }
        .tab-btn-inactive {
          background: transparent;
          color: #64748b;
        }
        .tab-btn-inactive:hover {
          background: #f8fafc;
          color: #1e293b;
        }
      </style>

      <!-- ── CONTENUTI TABS ── -->

      <!-- TAB 1: MODELLO POS (01-5) -->
      <div id="tab-content-mod-pos" class="space-y-4">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
              📂 Configurazione Modello Qualità ANAS Mod. RE. 01-5 (Verifica POS)
            </h4>
            <button onclick="exportPOSWord(null, 'anteprima')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs focus:outline-none transition">
              👁️ Anteprima di Stampa
            </button>
          </div>
          <p class="text-xs text-slate-500">
            Imposta i parametri esatti per i tecnici incaricati e i riferimenti che cambiano da un cantiere ad un altro per questo specifico modello di verbale.
          </p>

          <div class="space-y-3 pt-2">
            <h5 class="text-xs font-bold text-slate-600 uppercase border-b pb-1">Tecnici Firmatari</h5>
            ${_campo('posTecnicoNome', 'Nome CSE / Tecnico Firmatario', imp.posTecnicoNome, 'Es. Geom. Dogano Casella')}
            ${_campo('posTecnicoQualifica', 'Qualifica Tecnico', imp.posTecnicoQualifica, 'Es. Coordinatore per l\'Esecuzione')}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${_campo('posRup', 'Responsabile dei Lavori / R.U.P.', imp.posRup, 'Es. Ing. Mario Verdi')}
              ${_campo('posDl', 'Direttore Lavori (D.L.)', imp.posDl, 'Es. Ing. Lucia Bianchi')}
            </div>
          </div>

          <div class="space-y-3 pt-3">
            <h5 class="text-xs font-bold text-slate-600 uppercase border-b pb-1">Metadati di Commessa</h5>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              ${_campo('posCUP', 'CUP', imp.posCUP, 'Es. C123456789')}
              ${_campo('posCIG', 'CIG', imp.posCIG, 'Es. Z123456789')}
              ${_campo('posCommessa', 'Commessa', imp.posCommessa, 'Es. COMM_01')}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${_campo('posStruttura', 'Struttura Territoriale', imp.posStruttura, 'Es. Struttura Territoriale Calabria')}
              ${_campo('posCodicePpm', 'Codice PPM/SIL/OdA', imp.posCodicePpm, 'Es. OdA n. 123/2024')}
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: MODELLO RIUNIONE (01-10) -->
      <div id="tab-content-mod-riu" class="space-y-4 hidden">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
              📂 Configurazione Modello Qualità ANAS Mod. RE. 01-10 (Riunioni di Coordinamento)
            </h4>
            <button onclick="exportRiunioneWord(null, 'anteprima')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs focus:outline-none transition">
              👁️ Anteprima di Stampa
            </button>
          </div>
          <p class="text-xs text-slate-500">
            Imposta i tecnici, i responsabili e i relativi incarichi da riportare automaticamente nel Mod. RE. 01-10.
          </p>

          <div class="space-y-3 pt-2">
            ${_campo('riuTecnicoNome', 'Nome CSE / Tecnico Firmatario', imp.riuTecnicoNome, 'Es. Geom. Dogano Casella')}
            ${_campo('riuTecnicoQualifica', 'Qualifica Tecnico', imp.riuTecnicoQualifica, 'Es. Coordinatore della Sicurezza')}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${_campo('riuRup', 'R.U.P.', imp.riuRup, 'Es. Ing. Mario Verdi')}
              ${_campo('riuDl', 'D.L.', imp.riuDl, 'Es. Ing. Lucia Bianchi')}
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: DATI DI BASE ANAS -->
      <div id="tab-content-dati-anas" class="space-y-4 hidden">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
            🏢 Logo e Dati Generali ANAS
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <!-- Logo Destro (ANAS / Committente) -->
            <div>
              <div class="text-xs font-semibold text-slate-600 mb-2">
                Logo Ufficiale ANAS
              </div>
              <div id="preview-logo-dx"
                   class="w-full h-20 border-2 border-dashed border-slate-300 rounded-xl
                          flex items-center justify-center bg-slate-50 mb-2 overflow-hidden">
                ${imp.logoDestro
        ? `<img src="${imp.logoDestro}" class="max-h-16 max-w-full object-contain" alt="Logo ANAS">`
        : `<span class="text-xs text-slate-400">Nessun logo caricato</span>`}
              </div>
              <div class="flex gap-2">
                <label class="cursor-pointer flex-1">
                  <input type="file" accept="image/*" id="input-logo-dx" class="hidden"
                         onchange="aggiornaLogo('dx', this)" />
                  <div class="text-xs text-center bg-slate-800 text-white px-3 py-1.5 rounded-lg
                              hover:bg-slate-700 transition cursor-pointer">
                    📁 Carica logo
                  </div>
                </label>
                <button onclick="rimuoviLogo('dx')"
                        class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700
                               hover:bg-red-200 focus:outline-none">
                  Rimuovi
                </button>
              </div>
              <div class="text-xs text-slate-400 mt-1">PNG, JPG · max 2MB</div>
            </div>

            <!-- Metadati Generali -->
            <div class="space-y-3">
              ${_campo('committenteNome', 'Nome Committente', imp.committenteNome || 'ANAS SpA', 'Es. ANAS SpA')}
              ${_campo('committenteContrat', 'Contratto / Rep.', imp.committenteContrat, 'Es. Contratto rep. n. 1234/2024')}
              ${_campo('cantiereDescrizione', 'Oggetto Lavori', imp.cantiereDescrizione, 'Es. Manutenzione programmata SS 106')}
            </div>
          </div>

          <div class="border-t border-slate-200 pt-3 space-y-3">
            <h5 class="text-xs font-bold text-slate-600 uppercase border-b pb-1">Firma del Tecnico & Footer</h5>
            ${_campo('firmaNome', 'Nome Tecnico Principale', imp.firmaNome, 'Es. Geom. Dogano Casella')}
            ${_campo('firmaQualifica', 'Qualifica Tecnico Principale', imp.firmaQualifica, 'Es. Coordinatore della Sicurezza')}

            <!-- ── Firma persistente (P2) ── -->
            <div class="border-t border-slate-200 pt-3 mt-2">
              <label class="text-xs font-semibold text-slate-600 block mb-2">
                Firma digitale persistente
              </label>
              <div class="text-xs text-slate-500 mb-2">
                Carica la tua firma una volta sola. Verrà applicata automaticamente a ogni verbale
                (puoi sempre sostituirla nel singolo verbale se necessario).
              </div>
              <div class="flex items-start gap-3 flex-wrap">
                <div id="firma-persistente-preview"
                     class="w-48 h-20 border-2 border-dashed border-slate-300 rounded-lg
                            flex items-center justify-center bg-slate-50 shrink-0">
                  ${imp.firmaImmagine
          ? `<img src="${imp.firmaImmagine}" class="max-h-16 max-w-full object-contain" alt="Firma persistente" />`
          : `<span class="text-xs text-slate-400">Nessuna firma</span>`}
                </div>
                <div class="flex flex-col gap-2">
                  <button onclick="apriPannelloCreaFirma()"
                          class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg
                                 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          aria-label="Crea o aggiorna la firma persistente">
                    ✍️ Crea/Aggiorna firma
                  </button>
                  ${imp.firmaImmagine ? `
                    <button onclick="rimuoviFirmaPersistente()"
                            class="text-xs bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded-lg
                                   hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                            aria-label="Rimuovi firma persistente">
                      🗑️ Rimuovi firma
                    </button>` : ''}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${_campo('footerSinistro', 'Piè di pagina sinistro PDF', imp.footerSinistro, 'Es. Coordinatore Sicurezza — CSE')}
              ${_campo('footerDestro', 'Piè di pagina destro PDF', imp.footerDestro, 'Es. Uso interno ANAS SpA')}
            </div>
            ${_campo('normativa', 'Riferimenti normativi', imp.normativa, 'Es. D.Lgs 81/2008 · D.I. 22/01/2019')}
          </div>
        </div>
      </div>

      <!-- ── AZIONI UNIFICATE ── -->
      <div class="flex flex-wrap gap-3">
        <button id="btn-salva-imp" onclick="salvaImpostazioniUI()"
                class="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold
                       hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                aria-label="Salva tutte le impostazioni">
          ✅ Salva Impostazioni
        </button>
        <button id="btn-ripristina-imp" onclick="ripristinaDefault()"
                class="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold
                       hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400">
          ↩ Ripristina default
        </button>
      </div>

    </div>
  `;
}

// Helper render campo input
function _campo(id, label, value, placeholder) {
  return `
    <div>
      <label for="imp-${id}" class="text-xs font-semibold text-slate-600 block mb-1">
        ${label}
      </label>
      <input id="imp-${id}"
             type="text"
             value="${(value || '').replace(/"/g, '&quot;')}"
             placeholder="${placeholder}"
             class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                    focus:ring-2 focus:ring-blue-400 focus:outline-none" />
    </div>
  `;
}

// ─────────────────────────────────────────────
// 5. Aggiorna logo da file input
// ─────────────────────────────────────────────
async function aggiornaLogo(lato, input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Il logo è troppo grande. Max 2MB.', 'warning');
    return;
  }

  const base64 = await leggiLogoBase64(file);
  const preview = document.getElementById(`preview-logo-${lato}`);
  if (preview) {
    preview.innerHTML = `<img src="${base64}" class="max-h-16 max-w-full object-contain" alt="Logo ${lato}">`;
  }

  // Salva subito
  const imp = await caricaImpostazioni();
  if (lato === 'sx') imp.logoSinistro = base64;
  else imp.logoDestro = base64;
  await salvaImpostazioni(imp);
  showToast('Logo aggiornato ✓', 'success');
}

function switchImpostazioniTab(tab) {
  const tabs = ['mod-pos', 'mod-riu', 'dati-anas'];
  tabs.forEach(t => {
    const btn = document.getElementById('tab-btn-' + t);
    const content = document.getElementById('tab-content-' + t);
    if (btn) {
      btn.classList.toggle('tab-btn-active', t === tab);
      btn.classList.toggle('tab-btn-inactive', t !== tab);
    }
    if (content) {
      content.classList.toggle('hidden', t !== tab);
    }
  });
}


// ─────────────────────────────────────────────
// 6. Rimuovi logo
// ─────────────────────────────────────────────
async function rimuoviLogo(lato) {
  const preview = document.getElementById(`preview-logo-${lato}`);
  if (preview) preview.innerHTML = `<span class="text-xs text-slate-400">Nessun logo caricato</span>`;

  const imp = await caricaImpostazioni();
  if (lato === 'sx') imp.logoSinistro = null;
  else imp.logoDestro = null;
  await salvaImpostazioni(imp);
  showToast('Logo rimosso.', 'info');
}

// ─────────────────────────────────────────────
// 7. Salva tutte le impostazioni dalla UI
// ─────────────────────────────────────────────
async function salvaImpostazioniUI() {
  const imp = await caricaImpostazioni(); // mantieni loghi

  const campi = [
    'committenteNome', 'committenteContrat',
    'cantiereDescrizione', 'rup', 'dl',
    'firmaNome', 'firmaQualifica', 'firmaAlbo',
    'footerSinistro', 'footerDestro', 'normativa',
    'posTecnicoNome', 'posTecnicoQualifica', 'posTecnicoAlbo', 'posRup', 'posDl', 'posCUP', 'posCIG', 'posCommessa', 'posStruttura', 'posCodicePpm',
    'riuTecnicoNome', 'riuTecnicoQualifica', 'riuRup', 'riuDl'
  ];

  try {
    campi.forEach(id => {
      const el = document.getElementById(`imp-${id}`);
      if (el) imp[id] = el.value.trim();
    });

    await salvaImpostazioni(imp);
    showToast('Impostazioni salvate correttamente ✓', 'success');
    if (typeof showCheckmark === 'function') showCheckmark();
  } catch (err) {
    console.error("Errore salvaImpostazioniUI:", err);
    showToast('Errore durante il salvataggio impostazioni', 'error');
  }
}

// ─────────────────────────────────────────────
// 8. Ripristina valori di default
// ─────────────────────────────────────────────
async function ripristinaDefault() {
  await salvaImpostazioni({ ...IMPOSTAZIONI_DEFAULT });
  showToast('Impostazioni ripristinate ai valori predefiniti.', 'info');
  renderViewImpostazioni('view-impostazioni-inner');
}

// ─────────────────────────────────────────────
// 9. Anteprima verbale PDF con impostazioni correnti
// ─────────────────────────────────────────────
async function anteprimaVerbale() {
  const imp = await caricaImpostazioni();

  const verbaleEsempio = {
    id: 'ESEMPIO',
    projectId: 'CZ399',
    data: new Date().toISOString().slice(0, 10),
    km: 'KM 42+350 — KM 42+800',
    meteo: 'Soleggiato',
    oggetto: 'Verifica DPI lavoratori e segnaletica cantiere',
    impresePresenti: ['Costruzioni Rossi S.r.l.', 'Elettrica Bianchi S.r.l.'],
    referenti: 'Geom. Bianchi (Preposto) · Ing. Verdi (D.L.)',
    statoLuoghi: 'Fresatura manto bituminoso in corso tra KM 42+350 e KM 42+800.\nSegnaletica conforme al D.I. 22/01/2019.',
    note: 'Si prescrive integrazione segnaletica verticale entro 48h.\nNessuna NC rilevata.',
    firma: null,
    firmaTimestamp: null,
    firmante: imp.firmaNome + ' — ' + imp.firmaQualifica
  };

  apriStampaVerbaleConImpostazioni(verbaleEsempio, imp);
}

// ─────────────────────────────────────────────
// 10. Genera HTML verbale con intestazione personalizzata
// ─────────────────────────────────────────────
function generaHTMLVerbale(v, imp) {
  const logoSx = imp.logoSinistro
    ? `<img src="${imp.logoSinistro}" style="max-height:60px; max-width:180px; object-fit:contain;" alt="Logo CSE">`
    : `<div style="font-size:11px;color:#64748b;">LOGO STUDIO</div>`;

  const logoDx = imp.logoDestro
    ? `<img src="${imp.logoDestro}" style="max-height:60px; max-width:180px; object-fit:contain;" alt="Logo ANAS">`
    : `<div style="font-size:11px;color:#64748b;">LOGO COMMITTENTE</div>`;

  const dataLabel = v.data
    ? new Date(v.data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '–';

  const firmaHtml = v.firma
    ? `<img src="${v.firma}"
            style="max-width:280px; max-height:90px; border:1px solid #e2e8f0;
                   border-radius:6px; display:block; margin-top:4px;"
            alt="Firma CSE">`
    : `<div style="width:280px; height:80px; border:1px solid #cbd5e1; border-radius:6px;
                   margin-top:4px;"></div>`;

  return `
    <!-- INTESTAZIONE -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr>
        <td style="width:50%; vertical-align:middle; padding-right:16px;">
          ${logoSx}
          <div style="margin-top:6px; font-size:12px; font-weight:700; color:#1e293b;">
            ${imp.studioNome || ''}
          </div>
          <div style="font-size:10px; color:#64748b; line-height:1.5;">
            ${imp.studioIndirizzo ? imp.studioIndirizzo + '<br>' : ''}
            ${imp.studioTel ? 'Tel: ' + imp.studioTel + '<br>' : ''}
            ${imp.studioPEC ? 'PEC: ' + imp.studioPEC + '<br>' : ''}
            ${imp.studioEmail ? 'Email: ' + imp.studioEmail : ''}
          </div>
        </td>
        <td style="width:50%; vertical-align:middle; text-align:right; padding-left:16px;">
          ${logoDx}
          <div style="margin-top:6px; font-size:12px; font-weight:700; color:#1e293b;">
            ${imp.committenteNome || ''}
          </div>
          <div style="font-size:10px; color:#64748b; line-height:1.5;">
            ${imp.committenteContrat || ''}
          </div>
        </td>
      </tr>
    </table>

    <!-- TITOLO -->
    <div style="background:#0f172a; color:white; padding:10px 14px; border-radius:6px;
                margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:14px; font-weight:800; letter-spacing:.02em;">
          VERBALE DI SOPRALLUOGO CSE
        </div>
        <div style="font-size:10px; opacity:.7; margin-top:2px;">
          ${imp.normativa || ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px; font-weight:700;">${dataLabel}</div>
        <div style="font-size:10px; opacity:.7;">ID: ${v.id}</div>
      </div>
    </div>

    <!-- DATI CANTIERE -->
    ${imp.cantiereDescrizione || imp.rup || imp.dl ? `
    <table style="width:100%; border-collapse:collapse; margin-bottom:12px;
                  border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; font-size:11px;">
      <tr style="background:#f8fafc;">
        ${imp.cantiereDescrizione ? `
        <td style="padding:6px 10px; border-right:1px solid #e2e8f0;">
          <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:600;">Oggetto Lavori</div>
          <div style="font-weight:600; color:#1e293b;">${imp.cantiereDescrizione}</div>
        </td>` : ''}
        ${imp.rup ? `
        <td style="padding:6px 10px; border-right:1px solid #e2e8f0; width:160px;">
          <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:600;">R.U.P.</div>
          <div style="font-weight:600; color:#1e293b;">${imp.rup}</div>
        </td>` : ''}
        ${imp.dl ? `
        <td style="padding:6px 10px; width:160px;">
          <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:600;">D.L.</div>
          <div style="font-weight:600; color:#1e293b;">${imp.dl}</div>
        </td>` : ''}
      </tr>
    </table>` : ''}

    <!-- CAMPI VERBALE -->
    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px;">

      <tr>
        <td class="c-label">Cantiere (ID)</td>
        <td class="c-val">${v.projectId || '–'}</td>
        <td class="c-label">Progressiva KM</td>
        <td class="c-val">${v.km || '–'}</td>
      </tr>
      <tr>
        <td class="c-label">Condizioni Meteo</td>
        <td class="c-val">${v.meteo || '–'}</td>
        <td class="c-label">Oggetto sopralluogo</td>
        <td class="c-val">${v.oggetto || '–'}</td>
      </tr>

      <tr>
        <td class="c-label" style="vertical-align:top; padding-top:8px;">Imprese Presenti</td>
        <td class="c-val" colspan="3">
          ${(v.impresePresenti || []).length > 0
      ? v.impresePresenti.map(i => `· ${i}`).join('<br>')
      : '–'}
        </td>
      </tr>

      <tr>
        <td class="c-label" style="vertical-align:top; padding-top:8px;">Referenti / Preposti</td>
        <td class="c-val" colspan="3" style="white-space:pre-wrap;">${v.referenti || '–'}</td>
      </tr>

      <tr>
        <td class="c-label" style="vertical-align:top; padding-top:8px;">Stato dei Luoghi</td>
        <td class="c-val" colspan="3" style="white-space:pre-wrap;">${v.statoLuoghi || '–'}</td>
      </tr>

      ${v.note ? `
      <tr>
        <td class="c-label" style="vertical-align:top; padding-top:8px; color:#92400e; background:#fffbeb;">
          Note / Prescrizioni CSE
        </td>
        <td class="c-val" colspan="3" style="white-space:pre-wrap; background:#fffbeb; color:#78350f;">
          ${v.note}
        </td>
      </tr>` : ''}

    </table>

    <!-- FIRMA -->
    <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:11px;">
      <tr>
        <td style="width:50%; padding-right:20px; vertical-align:top;">
          <div style="color:#64748b; font-size:10px; text-transform:uppercase;
                      font-weight:600; margin-bottom:6px;">
            Firma del CSE
          </div>
          ${firmaHtml}
          <div style="margin-top:8px; font-weight:700; color:#1e293b;">
            ${imp.firmaNome || v.firmante || '–'}
          </div>
          <div style="color:#64748b; font-size:10px;">
            ${imp.firmaQualifica || ''}
          </div>
          <div style="color:#94a3b8; font-size:10px;">
            ${imp.firmaAlbo || ''}
          </div>
          ${v.firmaTimestamp
      ? `<div style="color:#94a3b8; font-size:10px; margin-top:4px;">
                 Firmato il: ${new Date(v.firmaTimestamp).toLocaleString('it-IT')}
               </div>`
      : ''}
        </td>
        <td style="width:50%; padding-left:20px; vertical-align:top;">
          <div style="color:#64748b; font-size:10px; text-transform:uppercase;
                      font-weight:600; margin-bottom:6px;">
            Timbro / Ricevuto
          </div>
          <div style="width:100%; height:90px; border:1px solid #cbd5e1; border-radius:6px;"></div>
        </td>
      </tr>
    </table>
  `;
}

// ─────────────────────────────────────────────
// 11. Apri stampa verbale con intestazione personalizzata
// ─────────────────────────────────────────────
function apriStampaVerbaleConImpostazioni(v, imp) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Popup bloccato — abilita i popup per stampare.', 'warning');
    return;
  }

  const contenuto = generaHTMLVerbale(v, imp);

  win.document.write(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Verbale CSE — ${v.data || ''}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, sans-serif;
          color: #1e293b;
          padding: 24px;
          font-size: 12px;
        }
        .c-label {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 6px 10px;
          font-weight: 700;
          color: #475569;
          white-space: nowrap;
          width: 18%;
        }
        .c-val {
          border: 1px solid #e2e8f0;
          padding: 6px 10px;
          color: #1e293b;
        }
        .footer-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          display: flex;
          justify-content: space-between;
          padding: 6px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          font-size: 10px;
          color: #94a3b8;
        }
        @media print {
          .no-print { display: none; }
          @page { margin: 18mm 14mm; }
        }
      </style>
    </head>
    <body>
      ${contenuto}

      <div class="footer-bar">
        <span>${imp.footerSinistro || ''}</span>
        <span>Pag. <span class="page-num">1</span></span>
        <span>${imp.footerDestro || ''}</span>
      </div>

      <div class="no-print" style="margin-top:24px; text-align:center;">
        <button onclick="window.print()"
                style="background:#2563eb; color:white; border:none; padding:10px 24px;
                       border-radius:8px; font-size:13px; cursor:pointer; font-weight:700;">
          🖨️ Stampa / Salva PDF
        </button>
      </div>

      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// ─────────────────────────────────────────────
// P2 — Firma persistente CSE
// ─────────────────────────────────────────────

/**
 * Apre un pannello modale con 3 opzioni:
 *  1) Disegna firma a mano (canvas)
 *  2) Importa immagine firma (file JPG/PNG)
 *  3) Incolla firma dagli appunti (Ctrl+V)
 */
async function apriPannelloCreaFirma() {
  var existing = document.getElementById('modal-crea-firma');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-crea-firma';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4';
  modal.style.cssText = 'top:0;right:0;bottom:0;left:0;position:fixed;';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Crea firma persistente');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] overflow-y-auto">

      <!-- Header -->
      <div class="p-5 border-b border-slate-200">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold text-slate-800">✍️ Firma persistente CSE</h3>
          <button onclick="document.getElementById('modal-crea-firma').remove()"
                  class="text-slate-400 hover:text-slate-800 text-2xl leading-none"
                  aria-label="Chiudi">✕</button>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          La firma verrà applicata automaticamente a ogni verbale futuro.
        </p>
      </div>

      <!-- Tab selettore metodo -->
      <div class="flex border-b border-slate-200" role="tablist">
        <button id="tab-firma-disegna" onclick="_switchFirmaTab('disegna')"
                class="flex-1 py-2.5 text-xs font-bold text-blue-600 border-b-2 border-blue-600
                       focus:outline-none" role="tab" aria-selected="true">
          ✍️ Disegna a mano
        </button>
        <button id="tab-firma-importa" onclick="_switchFirmaTab('importa')"
                class="flex-1 py-2.5 text-xs font-bold text-slate-400 border-b-2 border-transparent
                       hover:text-slate-600 focus:outline-none" role="tab" aria-selected="false">
          📁 Importa file
        </button>
        <button id="tab-firma-incolla" onclick="_switchFirmaTab('incolla')"
                class="flex-1 py-2.5 text-xs font-bold text-slate-400 border-b-2 border-transparent
                       hover:text-slate-600 focus:outline-none" role="tab" aria-selected="false">
          📋 Incolla
        </button>
      </div>

      <!-- Pannello: DISEGNA -->
      <div id="panel-firma-disegna" class="p-4">
        <div id="firma-persistente-canvas-wrap"></div>
        <div class="text-[10px] text-slate-400 mt-2 text-center">
          Disegna con il mouse o il dito, poi premi "Salva firma"
        </div>
      </div>

      <!-- Pannello: IMPORTA FILE -->
      <div id="panel-firma-importa" class="p-4 hidden">
        <div class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center
                    hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
             onclick="document.getElementById('input-firma-file').click()">
          <div class="text-3xl mb-2">📁</div>
          <p class="text-sm font-semibold text-slate-600">Clicca per selezionare un'immagine</p>
          <p class="text-xs text-slate-400 mt-1">JPG, PNG · Sfondo bianco o trasparente</p>
          <input type="file" id="input-firma-file" accept="image/png,image/jpeg,image/jpg"
                 class="hidden" onchange="_importaFirmaFile(this)" />
        </div>
        <div id="firma-importata-preview" class="hidden mt-3 text-center">
          <img id="firma-importata-img" class="max-h-24 mx-auto border border-slate-200 rounded-lg bg-white p-2" alt="Anteprima firma importata" />
          <div class="text-xs text-green-600 font-semibold mt-2">✅ Firma caricata — premi "Salva firma" per confermare</div>
        </div>
      </div>

      <!-- Pannello: INCOLLA -->
      <div id="panel-firma-incolla" class="p-4 hidden">
        <div id="firma-incolla-area"
             tabindex="0"
             class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center
                    hover:border-indigo-400 hover:bg-indigo-50/50 transition cursor-pointer
                    focus:ring-2 focus:ring-indigo-400 focus:outline-none">
          <div class="text-3xl mb-2">📋</div>
          <p class="text-sm font-semibold text-slate-600">Clicca qui e premi Ctrl+V</p>
          <p class="text-xs text-slate-400 mt-1">
            Copia un'immagine della firma negli appunti, poi incollala qui
          </p>
        </div>
        <div id="firma-incollata-preview" class="hidden mt-3 text-center">
          <img id="firma-incollata-img" class="max-h-24 mx-auto border border-slate-200 rounded-lg bg-white p-2" alt="Anteprima firma incollata" />
          <div class="text-xs text-green-600 font-semibold mt-2">✅ Firma incollata — premi "Salva firma" per confermare</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-slate-200 flex justify-between items-center">
        <button onclick="document.getElementById('modal-crea-firma').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="_salvaFirmaDaModale()"
                class="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold
                       hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400">
          ✅ Salva firma
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  // Inizializza il canvas firma (Tab "Disegna")
  _initFirmaPersistenteCanvas();

  // Inizializza il listener paste (Tab "Incolla")
  _initFirmaPasteListener();

  // Chiudi con ESC
  modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.remove(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
}

// ── Tab switcher ──
function _switchFirmaTab(tab) {
  var tabs = ['disegna', 'importa', 'incolla'];
  tabs.forEach(function (t) {
    var panel = document.getElementById('panel-firma-' + t);
    var btn = document.getElementById('tab-firma-' + t);
    if (panel) panel.classList.toggle('hidden', t !== tab);
    if (btn) {
      btn.classList.toggle('text-blue-600', t === tab);
      btn.classList.toggle('border-blue-600', t === tab);
      btn.classList.toggle('text-slate-400', t !== tab);
      btn.classList.toggle('border-transparent', t !== tab);
      btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    }
  });
  // Reset sorgente attiva
  window._firmaPersistenteSorgente = tab;
}

// ── Canvas firma (metodo Disegna) ──
function _initFirmaPersistenteCanvas() {
  var container = document.getElementById('firma-persistente-canvas-wrap');
  if (!container) return;

  container.innerHTML = `
    <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div class="relative bg-white">
        <canvas id="firma-persist-canvas"
                width="500" height="130"
                class="w-full touch-none cursor-crosshair block"
                style="max-height:130px;"
                aria-label="Disegna la tua firma qui"></canvas>
        <div class="absolute bottom-6 left-6 right-6 h-px bg-slate-200 pointer-events-none"></div>
        <div class="absolute bottom-1 left-6 text-[10px] text-slate-300 pointer-events-none select-none">Firma qui</div>
      </div>
      <div class="flex justify-between px-3 py-2 bg-slate-50 border-t border-slate-200">
        <div class="flex gap-2">
          <button type="button" onclick="_firmaPersistUndo()"
                  class="text-xs px-3 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 focus:outline-none">
            ↩ Annulla
          </button>
          <button type="button" onclick="_firmaPersistClear()"
                  class="text-xs px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none">
            🗑 Pulisci
          </button>
        </div>
      </div>
    </div>
  `;

  // Init canvas drawing
  var canvas = document.getElementById('firma-persist-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });

  var ratio = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(ratio, ratio);

  var drawing = false;
  var strokes = [];

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  canvas._strokes = strokes;
  canvas._ctx = ctx;

  function getPos(e) {
    var r = canvas.getBoundingClientRect();
    var src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function start(e) { e.preventDefault(); drawing = true; strokes.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function stop(e) { if (!drawing) return; if (e) e.preventDefault(); drawing = false; ctx.beginPath(); }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);

  window._firmaPersistenteSorgente = 'disegna';
}

function _firmaPersistUndo() {
  var canvas = document.getElementById('firma-persist-canvas');
  if (!canvas || !canvas._strokes || canvas._strokes.length === 0) return;
  canvas._ctx.putImageData(canvas._strokes.pop(), 0, 0);
}

function _firmaPersistClear() {
  var canvas = document.getElementById('firma-persist-canvas');
  if (!canvas) return;
  canvas._ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas._strokes) canvas._strokes.length = 0;
}

// ── Import da file (metodo Importa) ──
function _importaFirmaFile(input) {
  var file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('File troppo grande. Max 5MB.', 'warning');
    return;
  }

  var reader = new FileReader();
  reader.onload = function () {
    var base64 = reader.result;
    window._firmaImportataBase64 = base64;

    var preview = document.getElementById('firma-importata-preview');
    var img = document.getElementById('firma-importata-img');
    if (preview) preview.classList.remove('hidden');
    if (img) img.src = base64;

    window._firmaPersistenteSorgente = 'importa';
  };
  reader.readAsDataURL(file);
}

// ── Incolla dagli appunti (metodo Incolla) ──
function _initFirmaPasteListener() {
  var area = document.getElementById('firma-incolla-area');
  if (!area) return;

  area.addEventListener('paste', function (e) {
    e.preventDefault();
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        var blob = items[i].getAsFile();
        var reader = new FileReader();
        reader.onload = function () {
          window._firmaIncollataBase64 = reader.result;

          var preview = document.getElementById('firma-incollata-preview');
          var img = document.getElementById('firma-incollata-img');
          if (preview) preview.classList.remove('hidden');
          if (img) img.src = reader.result;

          window._firmaPersistenteSorgente = 'incolla';
          if (typeof showToast === 'function') showToast('Firma incollata! Premi "Salva firma" per confermare.', 'info');
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    if (typeof showToast === 'function') showToast('Nessuna immagine trovata negli appunti.', 'warning');
  });

  // Gestisci anche click per focus (necessario per Ctrl+V)
  area.addEventListener('click', function () { area.focus(); });
}

// ── Salvataggio unificato (da qualsiasi sorgente) ──
async function _salvaFirmaDaModale() {
  var base64 = null;
  var sorgente = window._firmaPersistenteSorgente || 'disegna';

  if (sorgente === 'disegna') {
    // Prendi dal canvas
    var canvas = document.getElementById('firma-persist-canvas');
    if (!canvas) { showToast('Canvas non trovato.', 'error'); return; }
    var data = canvas._ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var isEmpty = !data.some(function (v) { return v !== 0; });
    if (isEmpty) {
      showToast('Disegna una firma prima di salvarla.', 'warning');
      return;
    }
    base64 = canvas.toDataURL('image/png');
  } else if (sorgente === 'importa') {
    base64 = window._firmaImportataBase64;
    if (!base64) { showToast('Seleziona prima un\'immagine.', 'warning'); return; }
  } else if (sorgente === 'incolla') {
    base64 = window._firmaIncollataBase64;
    if (!base64) { showToast('Incolla prima un\'immagine (Ctrl+V).', 'warning'); return; }
  }

  if (!base64) { showToast('Nessuna firma da salvare.', 'warning'); return; }

  try {
    var imp = await caricaImpostazioni();
    imp.firmaImmagine = base64;
    await salvaImpostazioni(imp);

    var m = document.getElementById('modal-crea-firma');
    if (m) m.remove();
    showToast('Firma persistente salvata ✓', 'success');

    // Ri-render la view impostazioni
    if (document.getElementById('view-impostazioni-inner')) {
      renderViewImpostazioni('view-impostazioni-inner');
    }

    // Cleanup
    window._firmaImportataBase64 = null;
    window._firmaIncollataBase64 = null;
  } catch (err) {
    console.error('Errore salvataggio firma persistente:', err);
    showToast('Errore nel salvataggio della firma.', 'error');
  }
}

// Mantieni salvaFirmaPersistente come alias per retrocompatibilità
async function salvaFirmaPersistente() {
  return _salvaFirmaDaModale();
}

/**
 * Rimuove la firma persistente (con conferma).
 */
async function rimuoviFirmaPersistente() {
  if (!confirm('Rimuovere la firma persistente?\n\nDovrai disegnare la firma manualmente in ogni nuovo verbale.')) return;

  try {
    var imp = await caricaImpostazioni();
    imp.firmaImmagine = null;
    await salvaImpostazioni(imp);
    showToast('Firma persistente rimossa.', 'info');
    if (document.getElementById('view-impostazioni-inner')) {
      renderViewImpostazioni('view-impostazioni-inner');
    }
  } catch (err) {
    showToast('Errore nella rimozione.', 'error');
  }
}

/**
 * Ritorna la firma persistente salvata (base64 PNG) o null se non presente.
 * Chiamata dai form verbale per pre-compilare il canvas.
 */
async function getFirmaPersistente() {
  try {
    var imp = await caricaImpostazioni();
    return imp.firmaImmagine || null;
  } catch (_) {
    return null;
  }
}