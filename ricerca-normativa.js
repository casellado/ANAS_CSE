// ricerca-normativa.js — Assistente Ricerca Normativa CSE
// Usa Gemini API (gratuita) — solo ricerca, non scrive documenti
// Geom. Dogano Casella — ANAS SafeHub

// ─────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────
const GEMINI_API_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_KEY_ID   = 'gemini_api_key';
const CHAT_HISTORY_ID = 'ricerca_history';
const MAX_HISTORY     = 20; // messaggi conservati

// Prompt di sistema — focalizzato su normativa cantieri italiani
const SYSTEM_PROMPT = `Sei un assistente specializzato in normativa tecnica per cantieri stradali italiani, 
con expertise in:
- D.Lgs 81/2008 (Testo Unico Sicurezza sul Lavoro) e s.m.i.
- D.I. 22/01/2019 (Segnaletica cantieri stradali)
- Norme ANAS SpA (capitolati, istruzioni tecniche, procedure operative)
- D.Lgs 50/2016 e D.Lgs 36/2023 (Codice Appalti)
- UNI EN ISO norme tecniche applicabili ai cantieri stradali
- Ruoli CSE, CSP, DL, RUP — competenze e responsabilità
- DPI obbligatori per mansione (D.Lgs 81/08 Titolo III)
- Ponteggi, scavi, demolizioni — normativa specifica
- Piani PSC, POS, PiMUS — contenuti obbligatori

Rispondi SEMPRE in italiano.
Sii preciso: cita articolo, comma e lettera delle norme.
Sii conciso: risposte dirette, senza fronzoli.
Se non sei certo di un articolo specifico, dillo esplicitamente.
NON scrivere documenti al posto dell'utente.
NON dare consigli legali — solo informazioni normative.`;

// ─────────────────────────────────────────────
// 1. Gestione API Key (salvata in IndexedDB)
// ─────────────────────────────────────────────
async function getGeminiKey() {
  try {
    const item = await getItem('impostazioni', GEMINI_KEY_ID);
    return item?.data || null;
  } catch (_) { return null; }
}

async function setGeminiKey(key) {
  await saveItem('impostazioni', { id: GEMINI_KEY_ID, data: key.trim() });
}

// ─────────────────────────────────────────────
// 2. Chiamata API Gemini
// ─────────────────────────────────────────────
async function cercaNormativa(domanda, history = []) {
  const apiKey = await getGeminiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  // Costruisce la conversazione con history
  const contents = [];

  // Aggiungi history precedente
  history.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });

  // Aggiungi domanda corrente
  contents.push({
    role: 'user',
    parts: [{ text: domanda }]
  });

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents,
    generationConfig: {
      temperature:     0.2,   // bassa — risposte fattuali, non creative
      maxOutputTokens: 8192,  // gemini-2.5-flash usa token per thinking interno
      topP:            0.8
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;

    if (response.status === 400) throw new Error('API_KEY_INVALID');
    if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
    if (response.status === 404) throw new Error('MODEL_NOT_FOUND');
    throw new Error(msg);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = '';
  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
  }

  if (!text) throw new Error('EMPTY_RESPONSE');
  return text;
}

// ─────────────────────────────────────────────
// 3. Render pannello ricerca
// ─────────────────────────────────────────────
async function apriPannelloRicerca() {
  // Evita duplicati
  if (document.getElementById('pannello-ricerca')) {
    document.getElementById('pannello-ricerca').classList.remove('translate-x-full');
    document.getElementById('ricerca-input')?.focus();
    return;
  }

  const apiKey = await getGeminiKey();

  const panel = document.createElement('div');
  panel.id    = 'pannello-ricerca';
  panel.className = [
    'fixed top-0 right-0 h-full z-[9998]',
    'w-full sm:w-[420px]',
    'bg-white shadow-2xl border-l border-slate-200',
    'flex flex-col',
    'transition-transform duration-300 ease-in-out',
    apiKey ? '' : ''
  ].join(' ');

  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Pannello ricerca normativa');

  panel.innerHTML = `

    <!-- HEADER -->
    <div class="flex items-center justify-between px-4 py-3
                bg-slate-900 text-white shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-lg" aria-hidden="true">📚</span>
        <div>
          <div class="font-bold text-sm">Ricerca Normativa</div>
          <div class="text-xs text-slate-400">D.Lgs 81/08 · ANAS · Codice Appalti</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-ricerca-settings"
                onclick="_toggleRicercaSettings()"
                class="text-slate-400 hover:text-white p-1 rounded
                       focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Impostazioni API key">
          ⚙️
        </button>
        <button onclick="chiudiPannelloRicerca()"
                class="text-slate-400 hover:text-white text-xl leading-none p-1 rounded
                       focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Chiudi pannello ricerca">
          ✕
        </button>
      </div>
    </div>

    <!-- SETUP API KEY (visibile se key mancante) -->
    <div id="ricerca-setup" class="${apiKey ? 'hidden' : ''} bg-blue-50 border-b border-blue-200 p-4">
      <div class="text-sm font-bold text-blue-800 mb-2">
        🔑 Configura API Key Gemini (gratuita)
      </div>
      <div class="text-xs text-blue-700 mb-3 space-y-1">
        <div>1. Vai su <a href="https://aistudio.google.com/apikey"
                          target="_blank" rel="noopener"
                          class="underline font-semibold">aistudio.google.com/apikey</a></div>
        <div>2. Clicca <strong>Create API key</strong></div>
        <div>3. Copia e incolla qui sotto</div>
        <div class="text-blue-500">✓ Gratis · 1500 ricerche/giorno · Nessuna installazione</div>
      </div>
      <div class="flex gap-2">
        <input id="input-api-key"
               type="password"
               placeholder="Incolla qui la tua API key…"
               class="flex-1 border border-blue-300 rounded-lg p-2 text-xs
                      focus:ring-2 focus:ring-blue-400 focus:outline-none"
               aria-label="Inserisci API key Gemini" />
        <button onclick="_salvaApiKey()"
                class="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-bold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          Salva
        </button>
      </div>
    </div>

    <!-- SETTINGS INLINE (nascosto, toggle da ⚙️) -->
    <div id="ricerca-settings-panel"
         class="hidden bg-slate-50 border-b border-slate-200 p-3">
      <div class="text-xs font-semibold text-slate-600 mb-2">API Key Gemini</div>
      <div class="flex gap-2">
        <input id="input-api-key-edit"
               type="password"
               placeholder="Incolla nuova API key…"
               class="flex-1 border border-slate-300 rounded-lg p-2 text-xs
                      focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        <button onclick="_salvaApiKey(true)"
                class="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg
                       hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
          Aggiorna
        </button>
      </div>
      <button onclick="_svuotaChat()"
              class="mt-2 text-xs text-red-600 hover:text-red-800 underline">
        🗑 Cancella cronologia chat
      </button>
    </div>

    <!-- QUICK SEARCH CHIPS -->
    <div class="px-3 py-2 border-b border-slate-100 shrink-0">
      <div class="text-xs text-slate-400 mb-2">Ricerche rapide:</div>
      <div class="flex flex-wrap gap-1.5">
        ${_quickChips().map(c => `
          <button onclick="_inserisciChip('${c.q}')"
                  class="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600
                         hover:bg-blue-100 hover:text-blue-800 transition border border-slate-200
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Cerca: ${c.label}">
            ${c.label}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- CHAT MESSAGES -->
    <div id="ricerca-chat"
         class="flex-1 overflow-y-auto p-4 space-y-4"
         role="log"
         aria-label="Conversazione ricerca normativa"
         aria-live="polite">

      <!-- Messaggio benvenuto -->
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center
                    text-white text-xs shrink-0 mt-0.5" aria-hidden="true">AI</div>
        <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none
                    p-3 text-sm text-slate-700 max-w-[85%]">
          Ciao! Sono il tuo assistente per la normativa CSE.
          Chiedimi qualsiasi cosa su <strong>D.Lgs 81/08, ANAS, DPI, PSC/POS,
          segnaletica</strong> o altri riferimenti normativi.
          <div class="text-xs text-slate-400 mt-1">Non scrivo documenti — solo ricerco.</div>
        </div>
      </div>

    </div>

    <!-- INPUT AREA -->
    <div class="border-t border-slate-200 p-3 shrink-0 bg-white">
      <div class="flex gap-2 items-end">
        <textarea id="ricerca-input"
                  rows="2"
                  placeholder="Es: Quali DPI sono obbligatori per un operatore su fresatrice stradale?"
                  class="flex-1 border border-slate-300 rounded-xl p-2.5 text-sm resize-none
                         focus:ring-2 focus:ring-blue-400 focus:outline-none
                         placeholder:text-slate-400"
                  aria-label="Inserisci domanda sulla normativa"
                  onkeydown="_ricercaKeydown(event)"></textarea>
        <button id="btn-ricerca-send"
                onclick="_inviaRicerca()"
                class="bg-blue-600 text-white p-2.5 rounded-xl
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400
                       transition shrink-0 self-end"
                aria-label="Invia ricerca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="text-[10px] text-slate-400 mt-1.5 text-right">
        Invio rapido: <kbd class="bg-slate-100 px-1 rounded">Ctrl+Invio</kbd>
      </div>
    </div>

  `;

  document.body.appendChild(panel);

  // Focus sull'input se key già presente
  if (apiKey) {
    setTimeout(() => document.getElementById('ricerca-input')?.focus(), 100);
  }

  // Carica history precedente
  _caricaHistory();
}

// ─────────────────────────────────────────────
// 4. Chiudi pannello
// ─────────────────────────────────────────────
function chiudiPannelloRicerca() {
  document.getElementById('pannello-ricerca')?.remove();
}

// ─────────────────────────────────────────────
// 5. Quick chips predefiniti
// ─────────────────────────────────────────────
function _quickChips() {
  return [
    { label: 'DPI art. 74-79',      q: 'Quali DPI sono obbligatori in un cantiere stradale? Cita gli articoli del D.Lgs 81/08' },
    { label: 'Segnaletica D.I. 2019', q: 'Requisiti segnaletica cantieri stradali secondo D.I. 22/01/2019: distanze, tipi di segnali obbligatori' },
    { label: 'PSC contenuti',       q: 'Quali sono i contenuti obbligatori del Piano di Sicurezza e Coordinamento (PSC) secondo D.Lgs 81/08?' },
    { label: 'NC gravissima ANAS',  q: 'Cosa deve fare il CSE in caso di non conformità gravissima secondo procedura ANAS? Tempi e obblighi' },
    { label: 'Compiti CSE',         q: 'Quali sono le competenze e gli obblighi del Coordinatore Sicurezza in Esecuzione secondo D.Lgs 81/08 art. 92?' },
    { label: 'Ponteggi',            q: 'Normativa ponteggi: autorizzazione, PiMUS, verifiche periodiche — riferimenti D.Lgs 81/08' },
    { label: 'Scavi e sbancamenti', q: 'Normativa sicurezza scavi e sbancamenti: armature, distanze, sorveglianza — art. D.Lgs 81/08' },
    { label: 'Verbale sopralluogo', q: 'Contenuto obbligatorio di un verbale di sopralluogo CSE: cosa deve essere documentato per legge?' }
  ];
}

function _inserisciChip(testo) {
  const input = document.getElementById('ricerca-input');
  if (input) {
    input.value = testo;
    input.focus();
  }
}

// ─────────────────────────────────────────────
// 6. Invia ricerca
// ─────────────────────────────────────────────
let _isRicercaLoading = false;

async function _inviaRicerca() {
  if (_isRicercaLoading) return;

  const input   = document.getElementById('ricerca-input');
  const domanda = (input?.value || '').trim();
  if (!domanda) return;

  const apiKey = await getGeminiKey();
  if (!apiKey) {
    _mostraSetup();
    showToast('Configura prima la API key Gemini (⚙️).', 'warning');
    return;
  }

  // Svuota input
  input.value = '';
  input.style.height = 'auto';

  // Aggiunge messaggio utente nella chat
  _aggiungiMessaggio('user', domanda);

  // Loading indicator
  _isRicercaLoading = true;
  const loadingId   = _aggiungiLoading();

  try {
    // Carica history per contesto
    const history = _getHistoryForAPI();

    // Chiama API
    const risposta = await cercaNormativa(domanda, history);

    // Rimuovi loading e mostra risposta
    _rimuoviLoading(loadingId);
    _aggiungiMessaggio('assistant', risposta);

    // Salva in history
    _salvaHistory(domanda, risposta);

  } catch (err) {
    _rimuoviLoading(loadingId);

    const errMsg = _tradErrore(err.message);
    _aggiungiMessaggio('error', errMsg);

    if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
      _mostraSetup();
    }
  } finally {
    _isRicercaLoading = false;
    input?.focus();
  }
}

function _ricercaKeydown(e) {
  // Ctrl+Invio o Cmd+Invio → invia
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    _inviaRicerca();
  }
}

// ─────────────────────────────────────────────
// 7. Rendering messaggi chat
// ─────────────────────────────────────────────
function _aggiungiMessaggio(ruolo, testo) {
  const chat = document.getElementById('ricerca-chat');
  if (!chat) return;

  const div = document.createElement('div');

  if (ruolo === 'user') {
    div.className = 'flex gap-3 justify-end';
    div.innerHTML = `
      <div class="bg-blue-600 text-white rounded-2xl rounded-tr-none
                  p-3 text-sm max-w-[85%] leading-relaxed">
        ${escapeHtml(testo)}
      </div>
      <div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center
                  text-blue-600 text-xs font-bold shrink-0 mt-0.5"
           aria-hidden="true">Tu</div>
    `;

  } else if (ruolo === 'assistant') {
    // Formatta il markdown semplice (grassetto, liste, codice)
    const html = _formatMarkdown(testo);
    div.className = 'flex gap-3';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center
                  text-white text-xs shrink-0 mt-0.5" aria-hidden="true">AI</div>
      <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none
                  p-3 text-sm text-slate-800 max-w-[85%] leading-relaxed space-y-2
                  prose-ricerca">
        ${html}
      </div>
    `;

  } else if (ruolo === 'error') {
    div.className = 'flex justify-center';
    div.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl
                  px-4 py-2 text-xs max-w-[90%] text-center">
        ⚠️ ${escapeHtml(testo)}
      </div>
    `;
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function _aggiungiLoading() {
  const chat = document.getElementById('ricerca-chat');
  if (!chat) return null;

  const id  = 'loading-' + Date.now();
  const div = document.createElement('div');
  div.id    = id;
  div.className = 'flex gap-3';
  div.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center
                text-white text-xs shrink-0 mt-0.5" aria-hidden="true">AI</div>
    <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none
                p-3 flex items-center gap-2">
      <div class="flex gap-1" aria-label="Ricerca in corso…">
        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
      </div>
      <span class="text-xs text-slate-400">Ricerca in corso…</span>
    </div>
  `;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

function _rimuoviLoading(id) {
  if (id) document.getElementById(id)?.remove();
}

// ─────────────────────────────────────────────
// 8. Formattazione markdown semplice → HTML
// ─────────────────────────────────────────────
function _formatMarkdown(testo) {
  return testo
    // Escape HTML prima
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // **grassetto**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // `codice inline`
    .replace(/`([^`]+)`/g, '<code class="bg-slate-200 px-1 rounded text-xs font-mono">$1</code>')
    // ### Titolo
    .replace(/^### (.+)$/gm, '<div class="font-bold text-slate-900 mt-2">$1</div>')
    // ## Titolo
    .replace(/^## (.+)$/gm, '<div class="font-bold text-slate-900 text-base mt-3 border-b border-slate-200 pb-1">$1</div>')
    // - lista
    .replace(/^[\-\*] (.+)$/gm, '<div class="flex gap-2 ml-2"><span class="text-blue-500 shrink-0">·</span><span>$1</span></div>')
    // Numerazione 1. 2. 3.
    .replace(/^\d+\. (.+)$/gm, '<div class="flex gap-2 ml-2"><span class="text-slate-400 shrink-0 font-mono text-xs">→</span><span>$1</span></div>')
    // Newline → paragrafi
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br>');
}

// ─────────────────────────────────────────────
// 9. History chat (sessionStorage — non IndexedDB,
//    non deve persistere tra sessioni diverse)
// ─────────────────────────────────────────────
function _salvaHistory(domanda, risposta) {
  try {
    const raw     = sessionStorage.getItem(CHAT_HISTORY_ID) || '[]';
    const history = JSON.parse(raw);
    history.push({ role: 'user',      text: domanda  });
    history.push({ role: 'assistant', text: risposta });
    // Mantieni solo gli ultimi MAX_HISTORY messaggi
    const trimmed = history.slice(-MAX_HISTORY);
    sessionStorage.setItem(CHAT_HISTORY_ID, JSON.stringify(trimmed));
  } catch (_) {}
}

function _getHistoryForAPI() {
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_ID) || '[]';
    return JSON.parse(raw);
  } catch (_) { return []; }
}

function _caricaHistory() {
  const history = _getHistoryForAPI();
  if (history.length === 0) return;

  // Mostra ultimi 6 messaggi (3 scambi) per non appesantire il pannello
  const ultimi = history.slice(-6);
  ultimi.forEach(msg => {
    _aggiungiMessaggio(msg.role, msg.text);
  });
}

function _svuotaChat() {
  sessionStorage.removeItem(CHAT_HISTORY_ID);
  const chat = document.getElementById('ricerca-chat');
  if (chat) {
    chat.innerHTML = `
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center
                    text-white text-xs shrink-0 mt-0.5">AI</div>
        <div class="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none
                    p-3 text-sm text-slate-700 max-w-[85%]">
          Cronologia cancellata. Sono pronto per nuove ricerche.
        </div>
      </div>`;
  }
  document.getElementById('ricerca-settings-panel')?.classList.add('hidden');
  showToast('Cronologia cancellata.', 'info');
}

// ─────────────────────────────────────────────
// 10. Gestione API key dalla UI
// ─────────────────────────────────────────────
async function _salvaApiKey(isEdit = false) {
  const inputId = isEdit ? 'input-api-key-edit' : 'input-api-key';
  const key     = (document.getElementById(inputId)?.value || '').trim();

  if (!key || key.length < 20) {
    showToast('Inserisci una API key valida.', 'warning');
    return;
  }

  await setGeminiKey(key);
  document.getElementById(inputId).value = '';

  // Nascondi setup / settings
  document.getElementById('ricerca-setup')?.classList.add('hidden');
  document.getElementById('ricerca-settings-panel')?.classList.add('hidden');

  showToast('API key salvata ✓ — puoi iniziare a cercare!', 'success');
  document.getElementById('ricerca-input')?.focus();
}

function _mostraSetup() {
  document.getElementById('ricerca-setup')?.classList.remove('hidden');
}

function _toggleRicercaSettings() {
  const panel = document.getElementById('ricerca-settings-panel');
  if (panel) panel.classList.toggle('hidden');
}

// ─────────────────────────────────────────────
// 11. Traduzione errori API in messaggi utente
// ─────────────────────────────────────────────
function _tradErrore(code) {
  const messaggi = {
    'API_KEY_MISSING':  'API key non configurata. Clicca ⚙️ per inserirla.',
    'API_KEY_INVALID':  'API key non valida o scaduta. Clicca ⚙️ per aggiornarla.',
    'QUOTA_EXCEEDED':   'Limite giornaliero raggiunto (1500 richieste). Riprova domani.',
    'EMPTY_RESPONSE':   'Risposta vuota ricevuta. Riprova tra qualche secondo.',
    'MODEL_NOT_FOUND':  'Modello AI non disponibile. Aggiorna la pagina (Ctrl+Shift+R).',
    'Failed to fetch':  'Nessuna connessione internet. Controlla la rete e riprova.'
  };
  return messaggi[code] || `Errore: ${code}`;
}

// ─────────────────────────────────────────────
// 12. Helper escapeHtml (se non già definita in ui.js)
// ─────────────────────────────────────────────
if (typeof escapeHtml === 'undefined') {
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
