# Come integrare ai-assistente.js nei file esistenti
# Da applicare con Cursor DOPO il deploy base funzionante

## STEP 1 — Aggiungi lo script in ANAS_CSE_html.html (nell'<head>)
# Dopo impostazioni.js:
<script defer src="./ai-assistente.js"></script>

## STEP 2 — Aggiungi il badge AI nella top bar (in ANAS_CSE_html.html)
# Cerca: <button onclick="exportDatabaseToFile()"
# PRIMA di quel bottone aggiungi:

<span id="ai-status-badge"
      class="text-xs px-2 py-1 rounded-full border font-semibold
             bg-slate-100 text-slate-400 border-slate-200"
      aria-label="Stato AI locale">
  — AI N/D
</span>

## STEP 3 — Pulsanti AI nel form verbale (in ANAS_CSE_html.html)
# Nel campo "verbale-stato-luoghi", DOPO il <textarea>, aggiungi:

<button type="button"
        class="ai-btn hidden items-center gap-1 text-xs bg-violet-600 text-white
               px-3 py-1.5 rounded-lg hover:bg-violet-700
               focus:outline-none focus:ring-2 focus:ring-violet-400"
        onclick="attivaAI('verbale-stato-luoghi', 'stato-luoghi')"
        aria-label="Genera testo con AI">
  🤖 Genera con AI
</button>

# Nel campo "verbale-note" (prescrizioni), DOPO il <textarea>:

<button type="button"
        class="ai-btn hidden items-center gap-1 text-xs bg-violet-600 text-white
               px-3 py-1.5 rounded-lg hover:bg-violet-700
               focus:outline-none focus:ring-2 focus:ring-violet-400"
        onclick="attivaAI('verbale-note', 'prescrizioni', {problema: document.getElementById('verbale-stato-luoghi').value})"
        aria-label="Genera prescrizioni CSE con AI">
  🤖 Prescrizioni AI
</button>

## STEP 4 — Pulsante AI nella form NC (in ANAS_CSE_html.html)
# Nel campo "nc-descrizione", DOPO il <textarea>:

<button type="button"
        class="ai-btn hidden items-center gap-1 text-xs bg-violet-600 text-white
               px-3 py-1.5 rounded-lg hover:bg-violet-700
               focus:outline-none focus:ring-2 focus:ring-violet-400"
        onclick="attivaAI('nc-descrizione', 'nc', {livello: document.getElementById('nc-stato').value})"
        aria-label="Genera descrizione NC con AI">
  🤖 Descrizione AI
</button>

## STEP 5 — sw.js: aggiungi ai-assistente.js alla cache
# Nella CACHE_STATIC array, aggiungi:
'./ai-assistente.js',

## IMPORTANTE — Requisiti per il collega che usa l'AI
# 1. Chrome 138+ su Windows 10/11 o macOS 13+
# 2. ~22GB spazio libero (per il modello Gemini Nano)
# 3. GPU > 4GB VRAM OPPURE CPU 16GB RAM + 4 core
# 4. Prima volta: il modello si scarica in ~5 minuti (solo la prima volta)
# 5. Da quel momento funziona OFFLINE, gratis, senza API key
#
# Se il collega usa Chrome su Android/iOS o Firefox/Safari:
# I pulsanti AI non appaiono — l'app funziona normalmente senza AI
