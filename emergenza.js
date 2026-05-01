// emergenza.js — Numeri di Emergenza Cantiere
// ANAS SafeHub v2.0 — Geom. Dogano Casella · CSE ANAS SpA Calabria
//
// Mostra un modale con i numeri di emergenza essenziali per il cantiere.
// I numeri sono cliccabili (tel:) per chiamata diretta da smartphone.

// ─────────────────────────────────────────────────────────────────────────────
// RUBRICA NUMERI DI EMERGENZA
// ─────────────────────────────────────────────────────────────────────────────

var NUMERI_EMERGENZA = [
  // ── Soccorso Pubblico ──
  { categoria: 'Soccorso Pubblico', icona: '🚑', numeri: [
    { nome: 'Numero Unico Emergenze (NUE)', telefono: '112', descrizione: 'Emergenze generali — Carabinieri, Polizia, Vigili del Fuoco, Soccorso sanitario' },
    { nome: 'Pronto Soccorso / Emergenza Sanitaria', telefono: '118', descrizione: 'Ambulanza e soccorso sanitario urgente' },
    { nome: 'Vigili del Fuoco', telefono: '115', descrizione: 'Incendi, crolli, soccorso tecnico urgente' },
    { nome: 'Polizia di Stato', telefono: '113', descrizione: 'Ordine pubblico e sicurezza' },
    { nome: 'Carabinieri', telefono: '112', descrizione: 'Emergenze e pronto intervento' },
  ]},
  // ── Sicurezza Cantiere ──
  { categoria: 'Sicurezza Cantiere', icona: '⚠️', numeri: [
    { nome: 'ASL / SPRESAL (Servizio Prevenzione)', telefono: '', descrizione: 'Inserire il numero della ASL territoriale competente' },
    { nome: 'Ispettorato del Lavoro', telefono: '', descrizione: 'Inserire il numero dell\'Ispettorato territoriale' },
    { nome: 'INAIL — Sede territoriale', telefono: '', descrizione: 'Infortuni sul lavoro e malattie professionali' },
  ]},
  // ── Riferimenti ANAS ──
  { categoria: 'Riferimenti ANAS', icona: '🏗️', numeri: [
    { nome: 'Sala Operativa ANAS', telefono: '800841148', descrizione: 'Sala operativa ANAS — attiva H24' },
    { nome: 'Responsabile dei Lavori (R.U.P.)', telefono: '', descrizione: 'Inserire il numero del R.U.P. del cantiere' },
    { nome: 'Direttore dei Lavori (D.L.)', telefono: '', descrizione: 'Inserire il numero del D.L. del cantiere' },
    { nome: 'CSE — Coordinatore Sicurezza Esecuzione', telefono: '', descrizione: 'Inserire il proprio numero o del CSE incaricato' },
  ]},
  // ── Utenze / Servizi Tecnici ──
  { categoria: 'Utenze e Servizi Tecnici', icona: '⚡', numeri: [
    { nome: 'Guasti Rete Elettrica (e-distribuzione)', telefono: '803500', descrizione: 'Guasti e emergenze rete elettrica' },
    { nome: 'Guasti Gas (Italgas)', telefono: '800900999', descrizione: 'Fughe di gas e emergenze rete gas' },
    { nome: 'Guasti Rete Idrica', telefono: '', descrizione: 'Inserire il numero del gestore idrico locale' },
    { nome: 'Centro Antiveleni', telefono: '0266101029', descrizione: 'Ospedale Niguarda Milano — Centro Antiveleni H24' },
  ]},
];

// Chiave IndexedDB per numeri personalizzati
var EMERGENZA_DB_KEY = 'numeri_emergenza_custom';

// ─────────────────────────────────────────────────────────────────────────────
// MODALE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

async function apriNumeriEmergenza() {
  var existing = document.getElementById('modal-emergenza');
  if (existing) existing.remove();

  // Carica numeri personalizzati da IndexedDB
  var custom = await _caricaNumeriCustom();

  var modal = document.createElement('div');
  modal.id = 'modal-emergenza';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'emergenza-title');

  var contenuto = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">';

  // Header
  contenuto += '<div class="bg-red-700 text-white px-6 py-4 flex items-center justify-between shrink-0">';
  contenuto += '  <div class="flex items-center gap-3">';
  contenuto += '    <span class="text-2xl">🚨</span>';
  contenuto += '    <div>';
  contenuto += '      <h2 id="emergenza-title" class="text-lg font-bold">Numeri di Emergenza</h2>';
  contenuto += '      <p class="text-xs text-red-200 mt-0.5">Tocca un numero per chiamare direttamente</p>';
  contenuto += '    </div>';
  contenuto += '  </div>';
  contenuto += '  <button onclick="document.getElementById(\'modal-emergenza\').remove()"';
  contenuto += '          class="text-white/70 hover:text-white text-xl focus:outline-none p-1"';
  contenuto += '          aria-label="Chiudi">✕</button>';
  contenuto += '</div>';

  // Corpo scrollabile
  contenuto += '<div class="flex-1 overflow-y-auto p-4 space-y-4">';

  for (var c = 0; c < NUMERI_EMERGENZA.length; c++) {
    var cat = NUMERI_EMERGENZA[c];
    contenuto += _renderCategoria(cat, custom);
  }

  // Sezione numeri personalizzati
  var customNums = (custom && custom.numeri) ? custom.numeri : [];
  if (customNums.length > 0) {
    contenuto += _renderCategoriaCustom(customNums);
  }

  contenuto += '</div>'; // fine corpo

  // Footer con bottone aggiungi
  contenuto += '<div class="border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 bg-slate-50">';
  contenuto += '  <button onclick="_apriFormAggiungiNumero()"';
  contenuto += '          class="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none">';
  contenuto += '    <span>➕</span> Aggiungi numero personalizzato';
  contenuto += '  </button>';
  contenuto += '  <span class="text-[10px] text-slate-400">I numeri personalizzati<br>sono salvati nel dispositivo</span>';
  contenuto += '</div>';

  contenuto += '</div>'; // fine card

  modal.innerHTML = contenuto;

  // Chiudi cliccando fuori
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.remove(); });

  document.body.appendChild(modal);
  modal.focus();
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER CATEGORIE
// ─────────────────────────────────────────────────────────────────────────────

function _renderCategoria(cat, custom) {
  var html = '';
  html += '<div>';
  html += '  <div class="flex items-center gap-2 mb-2">';
  html += '    <span class="text-lg">' + cat.icona + '</span>';
  html += '    <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide">' + cat.categoria + '</h3>';
  html += '  </div>';
  html += '  <div class="space-y-1">';

  for (var i = 0; i < cat.numeri.length; i++) {
    var n = cat.numeri[i];
    // Controlla se c'è un override personalizzato
    var telOverride = _getOverride(custom, cat.categoria, n.nome);
    var tel = telOverride || n.telefono;

    html += _renderRigaNumero(n.nome, tel, n.descrizione, !tel);
  }

  html += '  </div>';
  html += '</div>';
  return html;
}

function _renderCategoriaCustom(customNums) {
  var html = '';
  html += '<div>';
  html += '  <div class="flex items-center gap-2 mb-2">';
  html += '    <span class="text-lg">📌</span>';
  html += '    <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide">Numeri Personalizzati</h3>';
  html += '  </div>';
  html += '  <div class="space-y-1">';

  for (var i = 0; i < customNums.length; i++) {
    var n = customNums[i];
    html += _renderRigaNumero(n.nome, n.telefono, n.descrizione || '', false, n.id);
  }

  html += '  </div>';
  html += '</div>';
  return html;
}

function _renderRigaNumero(nome, telefono, descrizione, vuoto, customId) {
  var html = '';
  var telPulito = (telefono || '').replace(/\s/g, '');

  if (vuoto || !telPulito) {
    // Numero non configurato
    html += '<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-300">';
    html += '  <div class="flex-1 min-w-0">';
    html += '    <div class="text-sm font-medium text-slate-500">' + _escHtml(nome) + '</div>';
    html += '    <div class="text-[11px] text-slate-400 truncate">' + _escHtml(descrizione) + '</div>';
    html += '  </div>';
    html += '  <button onclick="_apriFormModificaNumero(\'' + _escAttr(nome) + '\')"';
    html += '          class="text-xs text-blue-600 font-semibold hover:text-blue-800 focus:outline-none shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50">';
    html += '    ✏️ Imposta</button>';
    html += '</div>';
  } else {
    // Numero configurato — cliccabile
    html += '<a href="tel:' + telPulito + '"';
    html += '   class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 active:bg-red-100 transition group border border-transparent hover:border-red-200">';
    html += '  <div class="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0 text-lg group-hover:bg-red-200 transition">📞</div>';
    html += '  <div class="flex-1 min-w-0">';
    html += '    <div class="text-sm font-semibold text-slate-800">' + _escHtml(nome) + '</div>';
    html += '    <div class="text-xs text-red-700 font-bold tracking-wider">' + _formatTelefono(telPulito) + '</div>';
    if (descrizione) {
      html += '    <div class="text-[11px] text-slate-400 truncate mt-0.5">' + _escHtml(descrizione) + '</div>';
    }
    html += '  </div>';
    html += '  <div class="shrink-0 text-green-600 text-xl group-hover:scale-110 transition-transform">📱</div>';
    html += '</a>';
  }

  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM AGGIUNGI / MODIFICA NUMERO
// ─────────────────────────────────────────────────────────────────────────────

function _apriFormAggiungiNumero() {
  _apriFormModificaNumero('', '', '', true);
}

function _apriFormModificaNumero(nomeDefault, telDefault, descDefault, isNuovo) {
  var existing = document.getElementById('modal-emergenza-form');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-emergenza-form';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  var titolo = isNuovo ? 'Aggiungi numero di emergenza' : 'Modifica: ' + (nomeDefault || '');

  modal.innerHTML = ''
    + '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">'
    + '  <h3 class="text-base font-bold text-slate-800">' + _escHtml(titolo) + '</h3>'
    + '  <div>'
    + '    <label class="text-xs font-semibold text-slate-600 block mb-1">Nome contatto</label>'
    + '    <input id="emerg-nome" type="text" value="' + _escAttr(nomeDefault || '') + '"'
    + '           placeholder="Es. Medico Competente"'
    + '           class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"'
    + '           ' + (isNuovo ? '' : 'readonly') + ' />'
    + '  </div>'
    + '  <div>'
    + '    <label class="text-xs font-semibold text-slate-600 block mb-1">Numero di telefono</label>'
    + '    <input id="emerg-telefono" type="tel" value="' + _escAttr(telDefault || '') + '"'
    + '           placeholder="Es. 0961 123456"'
    + '           class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none" />'
    + '  </div>'
    + '  <div>'
    + '    <label class="text-xs font-semibold text-slate-600 block mb-1">Descrizione (facoltativa)</label>'
    + '    <input id="emerg-desc" type="text" value="' + _escAttr(descDefault || '') + '"'
    + '           placeholder="Es. Dr. Rossi — reperibile lun-ven"'
    + '           class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />'
    + '  </div>'
    + '  <div class="flex gap-2">'
    + '    <button onclick="document.getElementById(\'modal-emergenza-form\').remove()"'
    + '            class="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200 focus:outline-none">Annulla</button>'
    + '    <button onclick="_salvaNumeroEmergenza(' + (isNuovo ? 'true' : 'false') + ')"'
    + '            class="flex-1 bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400">Salva</button>'
    + '  </div>'
    + '</div>';

  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.remove(); });

  document.body.appendChild(modal);
  // Focus sul campo telefono (il nome potrebbe essere readonly)
  setTimeout(function() {
    var campo = document.getElementById('emerg-telefono');
    if (campo) campo.focus();
  }, 50);
}

async function _salvaNumeroEmergenza(isNuovo) {
  var nome = (document.getElementById('emerg-nome').value || '').trim();
  var telefono = (document.getElementById('emerg-telefono').value || '').trim();
  var desc = (document.getElementById('emerg-desc').value || '').trim();

  if (!nome) {
    if (typeof showToast === 'function') showToast('Inserisci il nome del contatto.', 'warning');
    return;
  }
  if (!telefono) {
    if (typeof showToast === 'function') showToast('Inserisci il numero di telefono.', 'warning');
    return;
  }

  var custom = await _caricaNumeriCustom() || { numeri: [], overrides: {} };

  if (isNuovo) {
    // Aggiunge un nuovo numero personalizzato
    if (!custom.numeri) custom.numeri = [];
    custom.numeri.push({
      id: 'cust_' + Date.now(),
      nome: nome,
      telefono: telefono,
      descrizione: desc
    });
  } else {
    // Override di un numero esistente (dalla rubrica standard)
    if (!custom.overrides) custom.overrides = {};
    custom.overrides[nome] = telefono;
  }

  await _salvaNumeriCustom(custom);

  // Chiudi il form
  var form = document.getElementById('modal-emergenza-form');
  if (form) form.remove();

  // Ricarica il modale principale
  var mainModal = document.getElementById('modal-emergenza');
  if (mainModal) mainModal.remove();
  apriNumeriEmergenza();

  if (typeof showToast === 'function') showToast('Numero salvato ✓', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENZA IndexedDB (store impostazioni)
// ─────────────────────────────────────────────────────────────────────────────

async function _caricaNumeriCustom() {
  try {
    if (typeof caricaImpostazioni === 'function') {
      var imp = await caricaImpostazioni();
      return (imp && imp[EMERGENZA_DB_KEY]) || { numeri: [], overrides: {} };
    }
  } catch (_) {}
  return { numeri: [], overrides: {} };
}

async function _salvaNumeriCustom(data) {
  try {
    if (typeof caricaImpostazioni === 'function' && typeof salvaImpostazioni === 'function') {
      var imp = await caricaImpostazioni();
      imp[EMERGENZA_DB_KEY] = data;
      await salvaImpostazioni(imp);
    }
  } catch (err) {
    console.error('[Emergenza] Errore salvataggio:', err);
  }
}

function _getOverride(custom, categoria, nome) {
  if (!custom || !custom.overrides) return null;
  return custom.overrides[nome] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _formatTelefono(tel) {
  // Formatta per leggibilità: 800841148 → 800 841 148
  if (!tel) return '';
  var s = tel.replace(/\D/g, '');
  if (s.length <= 3) return s;
  if (s.length <= 6) return s.slice(0, 3) + ' ' + s.slice(3);
  return s.slice(0, 3) + ' ' + s.slice(3, 6) + ' ' + s.slice(6);
}

function _escHtml(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function _escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
