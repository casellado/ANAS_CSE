// ai-assistente.js — AI Browser Built-in per ANAS SafeHub
// Usa Gemini Nano (Chrome LanguageModel API) se disponibile.
// Se non disponibile: degradazione silenziosa, app funziona normalmente.
// Geom. Dogano Casella — CSE · ANAS SpA

// ─────────────────────────────────────────────
// 1. Stato AI globale
// ─────────────────────────────────────────────
window.SAFEHUB_AI = {
  disponibile:  false,
  stato:        'spento', // 'spento' | 'verifica' | 'pronto' | 'download' | 'non-supportato'
  progresso:    0,
  scaricatiMB:  0,
  attesaGesto:  false,
  sessione:     null,
  _onReadyCbs:  []
};

// ─────────────────────────────────────────────
// 2. Inizializzazione — rileva e scarica il modello
// ─────────────────────────────────────────────
let _isInitializating = false;

async function inizializzaAI(options = {}) {
  const { forzaDownload = false } = options;
  const ai = window.SAFEHUB_AI;

  if (_isInitializating) return;
  _isInitializating = true;

  try {
    // 1. Verifica disponibilità API
    if (typeof LanguageModel === 'undefined') {
      ai.stato = 'non-supportato';
      _aggiornaIndicatoreAI();
      return;
    }

    // 2. Cleanup sessione orfana
    distruggiSessioneAI();

    const aiOptions = {
      expectedInputs:  [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }] 
    };

    // 3. Verifica stato modello
    const status = await LanguageModel.availability(aiOptions);

    if (status === 'unavailable') {
      ai.stato = 'non-supportato';
      _aggiornaIndicatoreAI();
      return;
    }

    // 4. Gestione Download
    if ((status === 'downloading' || status === 'downloadable') && !forzaDownload) {
      console.info('[SafeHub AI] Modello da scaricare. In attesa di interazione utente.');
      ai.stato = 'download';
      ai.attesaGesto = true;
      _aggiornaIndicatoreAI();
      return;
    }

    if (status === 'downloading' || status === 'downloadable') {
      ai.stato = 'download';
      ai.attesaGesto = false;
      _aggiornaIndicatoreAI();
      
      console.info('[SafeHub AI] Avvio download assistito...');

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
              _aggiornaIndicatoreAI();
            });
          }
        });
      } catch (err) {
        console.warn('[SafeHub AI] Download in corso, polling attivo...');
        await _aspettaDownload();
      }
    }

    // 5. Creazione sessione finale
    if (!ai.sessione) {
      ai.sessione = await LanguageModel.create({
        ...aiOptions,
        systemPrompt: `Sei un assistente esperto di sicurezza nei cantieri stradali ANAS SpA.
Conosci perfettamente il D.Lgs 81/2008 e le procedure ANAS.
RISPONDI RIGOROSAMENTE SOLO IN LINGUA ITALIANA, in modo tecnico e conciso.`,
        temperature: 0.4,
        topK: 32
      });
    }

    ai.disponibile = true;
    ai.stato       = 'pronto';
    ai.attesaGesto = false;
    _aggiornaIndicatoreAI();

    console.info('[SafeHub AI] Gemini Nano pronto.');

  } catch (err) {
    console.error('[SafeHub AI] Errore inizializzazione:', err.message);
    if (err.message.includes('user gesture')) {
      ai.attesaGesto = true;
      ai.stato = 'download';
    } else {
      ai.stato = 'non-supportato';
    }
    _aggiornaIndicatoreAI();
  } finally {
    _isInitializating = false;
  }
}
