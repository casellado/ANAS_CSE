// impostazioni.js — Personalizzazione intestazione verbale ANAS SafeHub
// Geom. Dogano Casella — CSE

// ─────────────────────────────────────────────
// Chiave IndexedDB per le impostazioni
// ─────────────────────────────────────────────
const IMPOSTAZIONI_KEY = 'impostazioni_verbale';

// Valori di default
const IMPOSTAZIONI_DEFAULT = {
  // Intestazione sinistra (studio / ufficio CSE)
  studioNome:      'Studio Tecnico Geom. Dogano Casella',
  studioIndirizzo: 'Via Roma, 1 — 00100 Roma (RM)',
  studioTel:       '+39 06 0000000',
  studioPEC:       'dogano.casella@pec.it',
  studioEmail:     'info@studiocasella.it',

  // Intestazione destra (committente)
  committenteNome:    'ANAS SpA',
  committenteContrat: '',   // es. "Contratto rep. n. 1234/2024"

  // Dati cantiere (pre-compilazione suggerita)
  cantiereDescrizione: '',  // es. "Manutenzione programmata SS 106"
  rup:                 '',  // es. "Ing. Mario Verdi"
  dl:                  '',  // es. "Ing. Lucia Bianchi"

  // Riferimenti normativi da citare nel footer del PDF
  normativa:   'D.Lgs 81/2008 · D.I. 22/01/2019 · Contratto ANAS',

  // Footer PDF
  footerSinistro: 'Geom. Dogano Casella — Coordinatore Sicurezza in Esecuzione (CSE)',
  footerDestro:   'Documento riservato — uso interno ANAS SpA',

  // Loghi (base64 PNG/JPG) — null se non caricati
  logoSinistro: null,   // logo studio / CSE
  logoDestro:   null,   // logo ANAS o committente

  // Firma pre-impostata (nome stampato sotto la firma canvas)
  firmaNome:    'Geom. Dogano Casella',
  firmaQualifica: 'Coordinatore per la Sicurezza in Esecuzione (CSE)',
  firmaAlbo:    'Albo Geometri — n. ____',

  // P2: Firma persistente (base64 PNG) — se presente, precompila automaticamente
  // il canvas firma in ogni verbale, evitando di ri-firmare ogni volta.
  // Il CSE è sempre lo stesso, la firma è sempre la stessa.
  firmaImmagine: null,
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
  } catch (_) {}
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
    reader.onload  = () => resolve(reader.result); // data:image/...;base64,...
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

      <!-- ── LOGHI ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          🖼️ Loghi (intestazione verbale PDF)
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <!-- Logo Sinistro (Studio / CSE) -->
          <div>
            <div class="text-xs font-semibold text-slate-600 mb-2">
              Logo Sinistro — Studio / CSE
            </div>
            <div id="preview-logo-sx"
                 class="w-full h-20 border-2 border-dashed border-slate-300 rounded-xl
                        flex items-center justify-center bg-slate-50 mb-2 overflow-hidden">
              ${imp.logoSinistro
                ? `<img src="${imp.logoSinistro}" class="max-h-16 max-w-full object-contain" alt="Logo sinistro">`
                : `<span class="text-xs text-slate-400">Nessun logo caricato</span>`}
            </div>
            <div class="flex gap-2">
              <label class="cursor-pointer flex-1">
                <input type="file" accept="image/*" id="input-logo-sx" class="hidden"
                       onchange="aggiornaLogo('sx', this)" />
                <div class="text-xs text-center bg-slate-800 text-white px-3 py-1.5 rounded-lg
                            hover:bg-slate-700 transition cursor-pointer">
                  📁 Carica logo
                </div>
              </label>
              <button onclick="rimuoviLogo('sx')"
                      class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700
                             hover:bg-red-200 focus:outline-none">
                Rimuovi
              </button>
            </div>
            <div class="text-xs text-slate-400 mt-1">PNG, JPG · max 2MB</div>
          </div>

          <!-- Logo Destro (ANAS / Committente) -->
          <div>
            <div class="text-xs font-semibold text-slate-600 mb-2">
              Logo Destro — ANAS / Committente
            </div>
            <div id="preview-logo-dx"
                 class="w-full h-20 border-2 border-dashed border-slate-300 rounded-xl
                        flex items-center justify-center bg-slate-50 mb-2 overflow-hidden">
              ${imp.logoDestro
                ? `<img src="${imp.logoDestro}" class="max-h-16 max-w-full object-contain" alt="Logo destro">`
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

        </div>
      </div>

      <!-- ── DATI STUDIO / CSE ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          🏢 Dati Studio / CSE (intestazione sinistra)
        </h4>

        ${_campo('studioNome',      'Studio / Ragione Sociale',   imp.studioNome,      'Es. Studio Tecnico Geom. Dogano Casella')}
        ${_campo('studioIndirizzo', 'Indirizzo',                   imp.studioIndirizzo, 'Es. Via Roma, 1 — 00100 Roma (RM)')}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${_campo('studioTel',   'Telefono',   imp.studioTel,   'Es. +39 06 0000000')}
          ${_campo('studioEmail', 'Email',       imp.studioEmail, 'Es. info@studiocasella.it')}
        </div>
        ${_campo('studioPEC', 'PEC', imp.studioPEC, 'Es. dogano.casella@pec.it')}
      </div>

      <!-- ── COMMITTENTE ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          🏛️ Committente (intestazione destra)
        </h4>

        ${_campo('committenteNome',    'Nome Committente', imp.committenteNome,    'Es. ANAS SpA')}
        ${_campo('committenteContrat', 'Contratto / Rep.', imp.committenteContrat, 'Es. Contratto rep. n. 1234/2024')}
      </div>

      <!-- ── CANTIERE CORRENTE ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          🚧 Dati Cantiere (pre-compilazione)
        </h4>

        ${_campo('cantiereDescrizione', 'Oggetto Lavori',       imp.cantiereDescrizione, 'Es. Manutenzione programmata SS 106 Jonica')}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${_campo('rup', 'R.U.P.',              imp.rup, 'Es. Ing. Mario Verdi')}
          ${_campo('dl',  'Direttore Lavori (D.L.)', imp.dl,  'Es. Ing. Lucia Bianchi')}
        </div>
      </div>

      <!-- ── FIRMA ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          ✍️ Dati Firma CSE
        </h4>

        ${_campo('firmaNome',      'Nome Completo',  imp.firmaNome,      'Es. Geom. Dogano Casella')}
        ${_campo('firmaQualifica', 'Qualifica',       imp.firmaQualifica, 'Es. Coordinatore per la Sicurezza in Esecuzione (CSE)')}
        ${_campo('firmaAlbo',      'Iscrizione Albo', imp.firmaAlbo,      'Es. Albo Geometri Prov. RM — n. 12345')}

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
      </div>

      <!-- ── FOOTER PDF ── -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
          📄 Footer del Verbale PDF
        </h4>

        ${_campo('footerSinistro', 'Testo piè di pagina sinistro', imp.footerSinistro, 'Es. Geom. Dogano Casella — CSE')}
        ${_campo('footerDestro',   'Testo piè di pagina destro',   imp.footerDestro,   'Es. Documento riservato — uso interno ANAS SpA')}
        ${_campo('normativa',      'Riferimenti normativi',         imp.normativa,      'Es. D.Lgs 81/2008 · D.I. 22/01/2019')}
      </div>

      <!-- ── AZIONI ── -->
      <div class="flex flex-wrap gap-3">
        <button onclick="salvaImpostazioniUI()"
                class="bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold
                       hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                aria-label="Salva tutte le impostazioni">
          ✅ Salva Impostazioni
        </button>
        <button onclick="anteprimaVerbale()"
                class="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Apri anteprima verbale PDF con le impostazioni correnti">
          👁️ Anteprima Verbale
        </button>
        <button onclick="ripristinaDefault()"
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
  else               imp.logoDestro   = base64;
  await salvaImpostazioni(imp);
  showToast('Logo aggiornato ✓', 'success');
}

// ─────────────────────────────────────────────
// 6. Rimuovi logo
// ─────────────────────────────────────────────
async function rimuoviLogo(lato) {
  const preview = document.getElementById(`preview-logo-${lato}`);
  if (preview) preview.innerHTML = `<span class="text-xs text-slate-400">Nessun logo caricato</span>`;

  const imp = await caricaImpostazioni();
  if (lato === 'sx') imp.logoSinistro = null;
  else               imp.logoDestro   = null;
  await salvaImpostazioni(imp);
  showToast('Logo rimosso.', 'info');
}

// ─────────────────────────────────────────────
// 7. Salva tutte le impostazioni dalla UI
// ─────────────────────────────────────────────
async function salvaImpostazioniUI() {
  const imp = await caricaImpostazioni(); // mantieni loghi

  const campi = [
    'studioNome', 'studioIndirizzo', 'studioTel', 'studioPEC', 'studioEmail',
    'committenteNome', 'committenteContrat',
    'cantiereDescrizione', 'rup', 'dl',
    'firmaNome', 'firmaQualifica', 'firmaAlbo',
    'footerSinistro', 'footerDestro', 'normativa'
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
    id:              'ESEMPIO',
    projectId:       'CZ399',
    data:            new Date().toISOString().slice(0, 10),
    km:              'KM 42+350 — KM 42+800',
    meteo:           'Soleggiato',
    oggetto:         'Verifica DPI lavoratori e segnaletica cantiere',
    impresePresenti: ['Costruzioni Rossi S.r.l.', 'Elettrica Bianchi S.r.l.'],
    referenti:       'Geom. Bianchi (Preposto) · Ing. Verdi (D.L.)',
    statoLuoghi:     'Fresatura manto bituminoso in corso tra KM 42+350 e KM 42+800.\nSegnaletica conforme al D.I. 22/01/2019.',
    note:            'Si prescrive integrazione segnaletica verticale entro 48h.\nNessuna NC rilevata.',
    firma:           null,
    firmaTimestamp:  null,
    firmante:        imp.firmaNome + ' — ' + imp.firmaQualifica
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
            ${imp.studioTel      ? 'Tel: ' + imp.studioTel + '<br>' : ''}
            ${imp.studioPEC      ? 'PEC: ' + imp.studioPEC + '<br>' : ''}
            ${imp.studioEmail    ? 'Email: ' + imp.studioEmail : ''}
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
 * Apre un pannello modale con canvas per disegnare la firma.
 * La firma viene salvata nelle impostazioni IndexedDB come base64 PNG.
 */
async function apriPannelloCreaFirma() {
  const existing = document.getElementById('modal-crea-firma');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-crea-firma';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Crea firma persistente');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
      <div>
        <h3 class="text-lg font-bold text-slate-800">✍️ Firma persistente CSE</h3>
        <p class="text-xs text-slate-500 mt-1">
          Disegna la tua firma una sola volta. Verrà applicata in automatico a tutti i verbali futuri.
        </p>
      </div>

      <div id="firma-persistente-container" class="border border-slate-300 rounded-lg"></div>

      <div class="flex flex-wrap justify-end gap-2">
        <button onclick="document.getElementById('modal-crea-firma').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Annulla">
          Annulla
        </button>
        <button onclick="salvaFirmaPersistente()"
                class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                aria-label="Salva firma persistente">
          ✅ Salva come firma predefinita
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Monta il canvas firma (usa firma.js già caricato)
  if (typeof renderFirmaCanvas === 'function') {
    window._firmaPersistenteCorrente = null;
    renderFirmaCanvas('firma-persistente-container', (firmaData) => {
      window._firmaPersistenteCorrente = firmaData;
    });
  } else {
    document.getElementById('firma-persistente-container').innerHTML =
      '<div class="p-4 text-sm text-red-600">Errore: modulo firma non disponibile.</div>';
  }

  // Chiudi con ESC
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  // Chiudi cliccando fuori
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/**
 * Salva la firma corrente (dal canvas) nelle impostazioni IndexedDB.
 */
async function salvaFirmaPersistente() {
  const firma = window._firmaPersistenteCorrente;
  if (!firma || !firma.png) {
    showToast('Disegna una firma prima di salvarla.', 'warning');
    return;
  }

  try {
    const imp = await caricaImpostazioni();
    imp.firmaImmagine = firma.png; // base64 PNG
    await salvaImpostazioni(imp);

    document.getElementById('modal-crea-firma')?.remove();
    showToast('Firma persistente salvata ✓', 'success');
    // Ri-render la view impostazioni
    if (document.getElementById('view-impostazioni-inner')) {
      renderViewImpostazioni('view-impostazioni-inner');
    }
  } catch (err) {
    console.error('Errore salvataggio firma persistente:', err);
    showToast('Errore nel salvataggio della firma.', 'error');
  }
}

/**
 * Rimuove la firma persistente (chiederà conferma).
 */
async function rimuoviFirmaPersistente() {
  if (!confirm('Rimuovere la firma persistente?\n\nDovrai disegnare la firma manualmente in ogni nuovo verbale.')) return;

  try {
    const imp = await caricaImpostazioni();
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
    const imp = await caricaImpostazioni();
    return imp.firmaImmagine || null;
  } catch (_) {
    return null;
  }
}