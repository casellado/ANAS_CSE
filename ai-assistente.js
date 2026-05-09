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
  progresso:    0,      // percentuale download (0-100)
  scaricatiMB:  0,      // MB scaricati effettivamente
  attesaGesto:  false,  // true se Chrome richiede un click per avviare download
  sessione:     null,   // sessione LanguageModel attiva
  _onReadyCbs:  []
};

// ─────────────────────────────────────────────
// 2. Inizializzazione — rileva e scarica il modello
// ─────────────────────────────────────────────
async function inizializzaAI(options = {}) {
  const { forzaDownload = false } = options;
  const ai = window.SAFEHUB_AI;

  if (typeof LanguageModel === 'undefined') {
    ai.stato = 'non-supportato';
    _aggiornaIndicatoreAI();
    return;
  }

  const aiOptions = {
    expectedInputs:  [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }] // Solo [en, es, ja] sono supportati attualmente
  };

  try {
    const status = await LanguageModel.availability(aiOptions);

    if (status === 'unavailable') {
      ai.stato = 'non-supportato';
      _aggiornaIndicatoreAI();
      return;
    }

    // Se il modello va scaricato e non abbiamo un gesto utente (forzaDownload è false), 
    // ci fermiamo e chiediamo il click.
    if ((status === 'downloading' || status === 'downloadable') && !forzaDownload) {
      console.info('[SafeHub AI] Modello da scaricare. In attesa di interazione utente per avviare.');
      ai.stato = 'download';
      ai.attesaGesto = true;
      _aggiornaIndicatoreAI();
      return;
    }

    // Se siamo qui, o il modello è pronto ('available') o abbiamo il permesso di scaricare (forzaDownload)
    if (status === 'downloading' || status === 'downloadable') {
      ai.stato = 'download';
      ai.attesaGesto = false;
      _aggiornaIndicatoreAI();
      
      console.info('[SafeHub AI] Avvio download assistito...');

      // Creiamo la sessione (che innesca il download) e agganciamo il monitor
      // Usiamo una promessa per gestire il completamento del download
      try {
        ai.sessione = await LanguageModel.create({
          ...aiOptions,
          systemPrompt: `Sei un assistente esperto ANAS. RISPONDI RIGOROSAMENTE IN ITALIANO.`,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              ai.scaricatiMB = Math.round(e.loaded / 1024 / 1024);
              if (e.total > 0) {
                ai.progresso = Math.round((e.loaded / e.total) * 100);
              }
              console.debug(`[SafeHub AI] Progress: ${ai.scaricatiMB}MB (${ai.progresso}%)`);
              _aggiornaIndicatoreAI();
            });
          }
        });
      } catch (err) {
        console.warn('[SafeHub AI] Download in corso, attesa polling...');
        await _aspettaDownload();
      }
    }

    // Se la sessione non è stata creata sopra (es. eravamo già available), la creiamo ora
    if (!ai.sessione) {
      ai.sessione = await LanguageModel.create({
        ...aiOptions,
        systemPrompt: `Sei un assistente esperto di sicurezza nei cantieri stradali ANAS SpA.
Conosci perfettamente:
- D.Lgs 81/2008 (Testo Unico Sicurezza)
- D.I. 22/01/2019 (Segnaletica cantieri stradali)
- Procedure ANAS per Non Conformità: 24h (Gravissima), 7gg (Grave), 15gg (Media), 30gg (Lieve).
- Ruolo del CSE (Coordinatore Sicurezza in Esecuzione)
RISPONDI RIGOROSAMENTE SOLO IN LINGUA ITALIANA, in modo tecnico e conciso.`,
        temperature: 0.4,
        topK: 32
      });
    }

    ai.disponibile = true;
    ai.stato       = 'pronto';
    ai.attesaGesto = false;
    _aggiornaIndicatoreAI();

    ai._onReadyCbs.forEach(cb => cb());
    ai._onReadyCbs = [];
    console.info('[SafeHub AI] Gemini Nano pronto.');

  } catch (err) {
    if (err.message.includes('user gesture')) {
      ai.attesaGesto = true;
      ai.stato = 'download';
      _aggiornaIndicatoreAI();
    } else {
      console.error('[SafeHub AI] Errore critico:', err.message);
      ai.stato = 'non-supportato';
      _aggiornaIndicatoreAI();
    }
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
      const aiOptions = { expectedOutputs: [{ type: 'text', languages: ['en'] }] };
      const s = await LanguageModel.availability(aiOptions).catch(() => 'unavailable');
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
    'download':       { 
      testo: window.SAFEHUB_AI.attesaGesto 
        ? '🤖 Clicca per attivare AI'
        : (window.SAFEHUB_AI.progresso > 0 
            ? `⏳ AI Download ${window.SAFEHUB_AI.progresso}%` 
            : (window.SAFEHUB_AI.scaricatiMB > 0 
                ? `⏳ AI Download ${window.SAFEHUB_AI.scaricatiMB} MB…` 
                : '⏳ AI Avvio Download…')),  
      cls: window.SAFEHUB_AI.attesaGesto 
        ? 'bg-violet-100 text-violet-800 border-violet-300 animate-pulse cursor-pointer'
        : 'bg-yellow-100 text-yellow-800 border-yellow-300' 
    },
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

// Funzione di sblocco manuale chiamata dal modal o dal badge
window.sbloccaAI = function() {
  if (window.SAFEHUB_AI.attesaGesto) {
    console.info('[SafeHub AI] Gesto rilevato. Avvio download...');
    window.SAFEHUB_AI.attesaGesto = false;
    inizializzaAI({ forzaDownload: true }).catch(() => {});
  }
};

// 13. Init automatico + cleanup
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  inizializzaAI().catch(() => {});
});

window.addEventListener('beforeunload', distruggiSessioneAI);

// ─────────────────────────────────────────────
// 14. Guida all'Attivazione AI locale
// ─────────────────────────────────────────────
async function verificaSupportoAI() {
  try {
    if (typeof LanguageModel === 'undefined') {
      alert('LanguageModel API non disponibile. Verifica che i flag siano impostati e Chrome riavviato.');
      return;
    }
    const aiOptions = { expectedOutputs: [{ type: 'text', languages: ['en'] }] };
    const status = await LanguageModel.availability(aiOptions);
    const messages = {
      'available':    '✅ AI pronta all\'uso',
      'downloadable': '⏳ Modello da scaricare al primo uso',
      'downloading':  '📥 Download del modello in corso',
      'unavailable':  '❌ AI non disponibile su questo dispositivo'
    };
    alert(messages[status] || 'Stato AI: ' + status);
  } catch (err) {
    alert('Errore verifica AI: ' + err.message);
  }
}

function mostraGuidaAttivazioneAI() {
  // Se siamo in attesa di gesto, questo click è il gesto stesso! Sblocchiamo subito.
  if (window.SAFEHUB_AI.attesaGesto) {
    window.sbloccaAI();
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|webOS/i.test(navigator.userAgent);
  const existing = document.getElementById('modal-guida-ai');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-guida-ai';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  if (isMobile) {
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="bg-slate-800 text-white px-6 py-4 flex items-center gap-3">
          <span class="text-xl">📱</span>
          <h2 class="font-bold text-base text-white">AI non disponibile su mobile</h2>
        </div>
        <div class="p-6 space-y-4">
          <p class="text-sm text-slate-600 leading-relaxed">
            Gemini Nano richiede Chrome desktop su Windows, macOS o Linux. Su tablet e telefoni l'API non è ancora supportata da Google.
          </p>
          <p class="text-sm text-slate-600 leading-relaxed">
            Per usare l'assistente AI, apri SafeHub da PC con Chrome o Edge desktop (versione 138 o sup.)
          </p>
          <p class="text-xs text-slate-400 italic">
            Le altre funzionalità di SafeHub continuano a funzionare normalmente sul tuo dispositivo.
          </p>
          <button onclick="document.getElementById('modal-guida-ai').remove()"
                  class="w-full bg-slate-800 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-slate-900 transition">
            Ho capito
          </button>
        </div>
      </div>
    `;
  } else {
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-violet-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 class="font-bold text-lg text-white">🤖 Attivazione AI Locale</h2>
          <button onclick="document.getElementById('modal-guida-ai').remove()" class="text-violet-100 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <p class="text-sm text-slate-600 leading-relaxed">
            SafeHub integra <strong>Gemini Nano</strong>, l'intelligenza artificiale locale di Google. Segui i passaggi per abilitarla nel tuo browser Chrome (v138+).
          </p>

          <!-- Sezione PREREQUISITI -->
          <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-amber-600">⚠️</span>
              <span class="text-xs font-bold text-amber-800 uppercase tracking-wide">Prima di attivare l'AI verifica i requisiti:</span>
            </div>
            <ul class="text-[11px] text-amber-900 space-y-1 list-disc ml-4">
              <li><strong>Sistema operativo:</strong> Windows 10/11, macOS 13+ (Ventura), Linux o ChromeOS Plus (su desktop)</li>
              <li><strong>Spazio disco libero:</strong> almeno 22 GB sul disco contenente il profilo Chrome</li>
              <li><strong>Hardware:</strong> GPU dedicata con > 4 GB VRAM, OPPURE CPU con 16+ GB RAM e 4+ core processore</li>
              <li><strong>Connessione internet illimitata:</strong> (no piano dati mobile)</li>
            </ul>
            <p class="text-[10px] text-amber-700 mt-2 italic">Se il tuo PC non rispetta questi requisiti, l'AI non si attiverà anche se i flag sono impostati correttamente.</p>
          </div>

          <div class="space-y-4 pt-2">
            <div class="flex gap-3">
              <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">1</div>
              <div class="text-xs">Apri una nuova scheda e incolla: <br><code class="bg-slate-100 px-1 py-0.5 rounded border">chrome://flags/#prompt-api-for-gemini-nano</code> <br>Imposta su <strong>Enabled</strong>.</div>
            </div>
            <div class="flex gap-3">
              <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">2</div>
              <div class="text-xs">Incolla anche: <br><code class="bg-slate-100 px-1 py-0.5 rounded border">chrome://flags/#optimization-guide-on-device-model</code> <br>Imposta su <strong>Enabled BypassPerfRequirement</strong>.</div>
            </div>
            <div class="flex gap-3">
              <div class="bg-violet-100 text-violet-700 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">3</div>
              <div class="text-xs">Riavvia Chrome. L'app inizierà a scaricare il modello locale (<strong>circa 2-2.5 GB</strong>) e il badge diventerà verde.</div>
            </div>
          </div>

          <div class="pt-4 space-y-3">
            <button onclick="verificaSupportoAI()"
                    class="w-full bg-white border-2 border-violet-700 text-violet-700 py-2 rounded-xl font-bold text-sm hover:bg-violet-50 transition flex items-center justify-center gap-2">
              🔍 Verifica supporto AI sul tuo dispositivo
            </button>

            <!-- Sezione RISOLUZIONE PROBLEMI -->
            <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <p class="text-[11px] font-bold text-slate-700 mb-1">🆘 Il download è bloccato allo 0%?</p>
              <p class="text-[10px] text-slate-600 leading-tight">
                A volte Chrome ha bisogno di una spinta: vai su <code>chrome://components</code>, cerca <strong>"Optimization Guide On Device Model"</strong> e clicca su <strong>"Check for update"</strong>.
              </p>
            </div>
            
            <button onclick="document.getElementById('modal-guida-ai').remove()"
                    class="w-full bg-violet-700 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-violet-800 transition">
              Ho capito
            </button>
          </div>

          <div class="text-center pt-2 border-t border-slate-100">
            <p class="text-[10px] text-slate-400">
              ℹ️ Procedura ufficiale Google. Se hai dubbi consulta la documentazione:<br>
              <a href="https://developer.chrome.com/docs/ai/get-started" target="_blank" class="text-violet-500 hover:underline">developer.chrome.com/docs/ai/get-started</a>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  if (typeof trapFocus === 'function') trapFocus(modal);
}
