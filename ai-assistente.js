// ai-assistente.js — AI Browser Built-in per ANAS SafeHub
// Usa Gemini Nano (Chrome LanguageModel API) se disponibile.
// Se non disponibile: degradazione silenziosa, app funziona normalmente.
// Geom. Dogano Casella — CSE · ANAS SpA

// ─────────────────────────────────────────────
// 1. Stato AI globale
// ─────────────────────────────────────────────
window.SAFEHUB_AI = {
  disponibile:  false,  // true solo se LanguageModel è pronto
  stato:        'verifica', // 'verifica' | 'pronto' | 'download' | 'non-supportato'
  sessione:     null,   // sessione LanguageModel attiva
  _onReadyCbs:  []
};

// ─────────────────────────────────────────────
// 2. Inizializzazione — rileva e scarica il modello
// ─────────────────────────────────────────────
async function inizializzaAI() {
  const ai = window.SAFEHUB_AI;

  // LanguageModel è l'API Chrome 138+ (non window.ai che è deprecato)
  if (typeof LanguageModel === 'undefined') {
    ai.stato = 'non-supportato';
    _aggiornaIndicatoreAI();
    return;
  }

  try {
    const status = await LanguageModel.availability();

    if (status === 'unavailable') {
      ai.stato = 'non-supportato';
      _aggiornaIndicatoreAI();
      return;
    }

    if (status === 'downloading' || status === 'downloadable') {
      ai.stato = 'download';
      _aggiornaIndicatoreAI();
      showToast('🤖 AI in download — disponibile tra qualche minuto.', 'info');

      // Aspetta che il download finisca (polling ogni 10s)
      await _aspettaDownload();
    }

    // Crea sessione con system prompt specifico per CSE ANAS
    ai.sessione = await LanguageModel.create({
      systemPrompt: `Sei un assistente esperto di sicurezza nei cantieri stradali ANAS SpA.
Conosci perfettamente:
- D.Lgs 81/2008 (Testo Unico Sicurezza)
- D.I. 22/01/2019 (Segnaletica cantieri stradali)
- Procedure ANAS per Non Conformità (gravissima = sospensione 24h, grave = 72h, media = 7gg)
- Ruolo del CSE (Coordinatore Sicurezza in Esecuzione)

Rispondi sempre in italiano, in modo conciso e tecnico.
Usa termini normativi corretti (DPI, preposto, PSC, POS, DVR).
Non inventare riferimenti normativi non esistenti.
Quando descrivi NC, indica sempre il livello e la scadenza.`,
      temperature: 0.4,  // bassa temperatura = risposte più precise e meno creative
      topK: 32
    });

    ai.disponibile = true;
    ai.stato       = 'pronto';
    _aggiornaIndicatoreAI();

    // Notifica tutti i callback in attesa
    ai._onReadyCbs.forEach(cb => cb());
    ai._onReadyCbs = [];

    console.info('[SafeHub AI] Gemini Nano pronto.');

  } catch (err) {
    console.warn('[SafeHub AI] Impossibile inizializzare:', err.message);
    ai.stato = 'non-supportato';
    _aggiornaIndicatoreAI();
  }
}

// ─────────────────────────────────────────────
// 3. Polling download modello
// ─────────────────────────────────────────────
function _aspettaDownload(maxTentativi = 36) { // max 6 minuti
  return new Promise((resolve) => {
    let tentativi = 0;
    const check = setInterval(async () => {
      tentativi++;
      const s = await LanguageModel.availability().catch(() => 'unavailable');
      if (s === 'available' || s === 'readily' || tentativi >= maxTentativi) {
        clearInterval(check);
        resolve();
      }
    }, 10000);
  });
}

// ─────────────────────────────────────────────
// 4. Aggiorna badge AI nell'interfaccia
// ─────────────────────────────────────────────
function _aggiornaIndicatoreAI() {
  const badge = document.getElementById('ai-status-badge');
  if (!badge) return;

  const stati = {
    'pronto':         { testo: '🤖 AI Pronta',     cls: 'bg-green-100 text-green-800 border-green-300' },
    'download':       { testo: '⏳ AI Download…',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'verifica':       { testo: '🔍 AI Verifica…',  cls: 'bg-slate-100 text-slate-500 border-slate-300' },
    'non-supportato': { testo: '— AI N/D',          cls: 'bg-slate-100 text-slate-400 border-slate-200' }
  };

  const info = stati[window.SAFEHUB_AI.stato] || stati['non-supportato'];
  badge.textContent = info.testo;
  badge.className   = `text-xs px-2 py-1 rounded-full border font-semibold ${info.cls}`;
  badge.setAttribute('aria-label', `Stato AI: ${info.testo}`);

  // Mostra/nascondi i pulsanti AI in tutta la pagina
  document.querySelectorAll('.ai-btn').forEach(btn => {
    btn.style.display = window.SAFEHUB_AI.disponibile ? 'inline-flex' : 'none';
  });
}

// ─────────────────────────────────────────────
// 5. Prompt generico — chiama Gemini Nano
// ─────────────────────────────────────────────
async function promptAI(testo, opzioni = {}) {
  const ai = window.SAFEHUB_AI;
  if (!ai.disponibile || !ai.sessione) return null;

  const { streaming = false, onChunk = null } = opzioni;

  try {
    if (streaming && onChunk) {
      const stream = ai.sessione.promptStreaming(testo);
      let risposta = '';
      for await (const chunk of stream) {
        risposta = chunk; // promptStreaming restituisce il testo cumulativo
        onChunk(chunk);
      }
      return risposta;
    }
    return await ai.sessione.prompt(testo);
  } catch (err) {
    console.warn('[SafeHub AI] Errore prompt:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 6. USE CASE 1 — Suggerisci descrizione Non Conformità
// ─────────────────────────────────────────────
async function aiSuggerisciNC(livello, contestoCantiere = '') {
  if (!window.SAFEHUB_AI.disponibile) return null;

  const contesto = contestoCantiere
    ? `Cantiere: ${contestoCantiere}. `
    : '';

  const prompt = `${contesto}Scrivi una descrizione formale per una Non Conformità di livello "${livello}" 
riscontrata durante un sopralluogo CSE in un cantiere ANAS stradale.
Includi: cosa è stato riscontrato, riferimento normativo violato, prescrizione al responsabile.
Massimo 4 righe. Tono tecnico-formale.`;

  return await promptAI(prompt);
}

// ─────────────────────────────────────────────
// 7. USE CASE 2 — Suggerisci stato dei luoghi per verbale
// ─────────────────────────────────────────────
async function aiSuggerisciStatoLuoghi(lavorazione, km, meteo) {
  if (!window.SAFEHUB_AI.disponibile) return null;

  const prompt = `Scrivi la sezione "Stato dei luoghi" per un verbale di sopralluogo CSE.
Lavorazione in corso: ${lavorazione || 'manutenzione stradale'}.
Progressiva: ${km || 'non specificata'}.
Condizioni meteo: ${meteo || 'non specificate'}.
Massimo 3 righe. Usa terminologia tecnica ANAS. Includi riferimento al D.I. 22/01/2019 se pertinente.`;

  return await promptAI(prompt);
}

// ─────────────────────────────────────────────
// 8. USE CASE 3 — Suggerisci prescrizioni CSE
// ─────────────────────────────────────────────
async function aiSuggerisciPrescrizioni(problema) {
  if (!window.SAFEHUB_AI.disponibile) return null;

  const prompt = `Come CSE ANAS, scrivi le prescrizioni formali per questo problema riscontrato:
"${problema}"
Indica: cosa deve fare l'impresa, entro quando, con quale riferimento normativo.
Massimo 3 righe. Tono prescrittivo e formale.`;

  return await promptAI(prompt);
}

// ─────────────────────────────────────────────
// 9. USE CASE 4 — Riassumi un verbale esistente
// ─────────────────────────────────────────────
async function aiRiassuntiVerbale(verbale) {
  if (!window.SAFEHUB_AI.disponibile) return null;

  // Usa Summarizer API se disponibile (più efficiente del Prompt API per testi)
  if (typeof Summarizer !== 'undefined') {
    try {
      const cap = await Summarizer.availability();
      if (cap !== 'unavailable') {
        const summarizer = await Summarizer.create({
          type: 'key-points',
          length: 'short'
        });
        const testo = `Data: ${verbale.data}. 
Oggetto: ${verbale.oggetto}. 
Stato luoghi: ${verbale.statoLuoghi}. 
Note: ${verbale.note}`;
        return await summarizer.summarize(testo);
      }
    } catch (_) {}
  }

  // Fallback: Prompt API
  const prompt = `Riassumi in 2-3 punti questo verbale di sopralluogo CSE:
Data: ${verbale.data}
Oggetto: ${verbale.oggetto}
Stato dei luoghi: ${verbale.statoLuoghi}
Note CSE: ${verbale.note}
Indica solo i punti critici e le azioni richieste.`;

  return await promptAI(prompt);
}

// ─────────────────────────────────────────────
// 10. USE CASE 5 — Verifica testo verbale (Proofreader)
// ─────────────────────────────────────────────
async function aiVerificaTesto(testo) {
  if (!window.SAFEHUB_AI.disponibile) return null;

  if (typeof Proofreader !== 'undefined') {
    try {
      const cap = await Proofreader.availability();
      if (cap !== 'unavailable') {
        const proofreader = await Proofreader.create();
        return await proofreader.proofread(testo);
      }
    } catch (_) {}
  }

  return null; // Proofreader non disponibile — nessun fallback necessario
}

// ─────────────────────────────────────────────
// 11. UI — Bottone AI generico con streaming
//     Uso: <button onclick="attivaAI('nc-descrizione', 'nc', {livello:'grave'})">
// ─────────────────────────────────────────────
async function attivaAI(targetId, tipo, contesto = {}) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!window.SAFEHUB_AI.disponibile) {
    showToast('AI non disponibile su questo browser/dispositivo.', 'warning');
    return;
  }

  // Feedback visivo
  const valoreOriginale = target.value || target.textContent;
  target.value = '⏳ AI in elaborazione…';
  target.disabled = true;

  try {
    let risposta = null;

    switch (tipo) {
      case 'nc':
        risposta = await aiSuggerisciNC(
          contesto.livello || 'media',
          contesto.cantiere || window.appState?.projectName || ''
        );
        break;

      case 'stato-luoghi':
        risposta = await aiSuggerisciStatoLuoghi(
          contesto.lavorazione || document.getElementById('verbale-oggetto')?.value || '',
          contesto.km          || document.getElementById('verbale-km')?.value || '',
          contesto.meteo       || document.getElementById('verbale-meteo')?.value || ''
        );
        break;

      case 'prescrizioni':
        risposta = await aiSuggerisciPrescrizioni(
          contesto.problema || valoreOriginale || ''
        );
        break;

      default:
        risposta = await promptAI(contesto.prompt || '');
    }

    if (risposta) {
      target.value = risposta;
      showToast('✅ Testo generato dall\'AI — verifica e adatta.', 'success');
    } else {
      target.value = valoreOriginale;
      showToast('AI non ha prodotto una risposta. Riprova.', 'warning');
    }

  } catch (err) {
    target.value = valoreOriginale;
    showToast('Errore AI: ' + err.message, 'error');
  } finally {
    target.disabled = false;
  }
}

// ─────────────────────────────────────────────
// 12. Cleanup sessione (chiamare quando si chiude la pagina)
// ─────────────────────────────────────────────
function distruggiSessioneAI() {
  if (window.SAFEHUB_AI.sessione) {
    window.SAFEHUB_AI.sessione.destroy();
    window.SAFEHUB_AI.sessione     = null;
    window.SAFEHUB_AI.disponibile  = false;
  }
}

// ─────────────────────────────────────────────
// 13. Init automatico + cleanup
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Avvia in background — non blocca il caricamento dell'app
  inizializzaAI().catch(() => {});
});

window.addEventListener('beforeunload', distruggiSessioneAI);

// ─────────────────────────────────────────────
// 14. Guida all'Attivazione AI locale
// ─────────────────────────────────────────────
function mostraGuidaAttivazioneAI() {
  const existing = document.getElementById('modal-guida-ai');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-guida-ai';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="bg-violet-700 text-white px-6 py-4 flex justify-between items-center">
        <h2 class="font-bold text-lg">🤖 Attivazione AI Locale</h2>
        <button onclick="document.getElementById('modal-guida-ai').remove()" class="text-violet-100 hover:text-white text-2xl leading-none">✕</button>
      </div>

      <div class="p-6 space-y-4">
        <p class="text-sm text-slate-600 leading-relaxed">
          SafeHub integra <strong>Gemini Nano</strong>, l'intelligenza artificiale locale di Google. Per motivi di sicurezza e privacy, l'AI deve essere abilitata manualmente nel tuo browser Chrome (v138+).
        </p>

        <div class="space-y-3">
          <div class="flex gap-3">
            <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">1</div>
            <div class="text-xs">Apri una nuova scheda e incolla: <br><code>chrome://flags/#prompt-api-for-gemini-nano</code> <br>Imposta su <strong>Enabled</strong>.</div>
          </div>
          <div class="flex gap-3">
            <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">2</div>
            <div class="text-xs">Incolla anche: <br><code>chrome://flags/#optimization-guide-on-device-model</code> <br>Imposta su <strong>Enabled BypassPerfRequirement</strong>.</div>
          </div>
          <div class="flex gap-3">
            <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">3</div>
            <div class="text-xs">Riavvia Chrome. L'app inizierà a scaricare il modello locale (circa 1.5GB) e il badge diventerà verde.</div>
          </div>
        </div>

        <div class="bg-amber-50 border border-amber-200 p-3 rounded-lg">
          <p class="text-[10px] text-amber-800 leading-tight">
            <strong>Nota:</strong> Questa procedura è necessaria solo una volta. L'AI locale garantisce che nessun dato sensibile del cantiere venga inviato a server esterni.
          </p>
        </div>

        <button onclick="document.getElementById('modal-guida-ai').remove()"
                class="w-full bg-violet-700 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-violet-800 transition">
          Ho capito
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  // Escape handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  if (typeof trapFocus === 'function') trapFocus(modal);
}
