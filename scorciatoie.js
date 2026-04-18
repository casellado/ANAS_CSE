// scorciatoie.js — Keyboard shortcuts per CSE
//
// Velocizza il lavoro di formalizzazione serale in ufficio.
// Funziona solo se NON si sta digitando in un input/textarea/contenteditable
// (tranne alcune eccezioni tipo Ctrl+S).
//
// Attivo solo nella SPA (ANAS_CSE_html.html).

(function(){
  // Se non è la SPA, non fare nulla
  if (!window.location.pathname.includes('ANAS_CSE_html.html') &&
      !window.location.pathname.endsWith('/') &&
      !window.location.pathname.endsWith('index.html')) {
    // Dashboard e pagine dettaglio: solo Esc per chiudere modal
  }

  // ─────────────────────────────────────────────
  // Definizione scorciatoie
  // ─────────────────────────────────────────────
  const shortcuts = [
    // Navigazione principale (Alt + numero)
    { key: '1',       ctrl: false, alt: true,  action: () => switchViewSafe('hub'),                  desc: 'Hub Cantieri' },
    { key: '2',       ctrl: false, alt: true,  action: () => switchViewSafe('dashboard-cantiere'),   desc: 'Dashboard Cantiere' },
    { key: '3',       ctrl: false, alt: true,  action: () => switchViewSafe('nc'),                   desc: 'Non Conformità' },
    { key: '4',       ctrl: false, alt: true,  action: () => switchViewSafe('documenti'),            desc: 'Documenti' },

    // Creazione rapida — preventDefault obbligatorio (Ctrl+N apre nuova finestra nel browser)
    { key: 'n',       ctrl: true,  alt: false, action: () => nuovoVerbaleShortcut(),                 desc: 'Nuovo Verbale Sopralluogo', allowInInputs: false, preventDefault: true },
    { key: 'r',       ctrl: true,  shift: true, action: () => switchViewSafe('riunione-coordinamento'), desc: 'Nuova Riunione', allowInInputs: false, preventDefault: true },
    { key: 'p',       ctrl: true,  shift: true, action: () => switchViewSafe('verifica-pos'),        desc: 'Nuova Verifica POS', allowInInputs: false, preventDefault: true },

    // Salvataggio (Ctrl+S intercetta il salvataggio del browser)
    { key: 's',       ctrl: true,  alt: false, action: () => salvaContestoCorrente(),                desc: 'Salva', allowInInputs: true, preventDefault: true },

    // Utility
    { key: '/',       ctrl: false, alt: false, action: () => focusRicerca(),                         desc: 'Focus ricerca', allowInInputs: false, preventDefault: true },
    { key: 'Escape',  ctrl: false, alt: false, action: () => chiudiModalAperti(),                    desc: 'Chiudi modal',  allowInInputs: true },

    // Oggi / diario
    { key: 'o',       ctrl: true,  shift: true, action: () => apriReportGiornalieroShortcut(),       desc: 'Diario giornaliero', allowInInputs: false, preventDefault: true },

    // Aiuto
    { key: '?',       ctrl: false, alt: false, shift: true, action: () => mostraAiutoShortcuts(),    desc: 'Mostra aiuto scorciatoie', allowInInputs: false },
  ];

  // ─────────────────────────────────────────────
  // Wrapper sicuri (la funzione target potrebbe non esistere)
  // ─────────────────────────────────────────────
  function switchViewSafe(viewId) {
    if (typeof switchView === 'function') switchView(viewId);
  }

  function nuovoVerbaleShortcut() {
    if (typeof switchView === 'function') switchView('nuovo-verbale');
    // Se non siamo nella SPA, redirigi
    else if (!window.location.pathname.includes('ANAS_CSE_html.html')) {
      if (typeof apriSuiteCSE === 'function') apriSuiteCSE('nuovo-verbale');
    }
  }

  function salvaContestoCorrente() {
    // Se un form è attivo nella SPA, trova il bottone submit più prominente
    const submitBtn = document.querySelector(
      'form button[type="submit"]:not([disabled]), ' +
      'button[onclick*="salvaVerbale"]:not([disabled]), ' +
      'button[onclick*="salvaRiunione"]:not([disabled]), ' +
      'button[onclick*="salvaVerificaPOS"]:not([disabled]), ' +
      'button[onclick*="salvaImpostazioniUI"]:not([disabled])'
    );
    if (submitBtn) {
      submitBtn.click();
      if (typeof showSuccessFlash === 'function') showSuccessFlash(submitBtn);
      return;
    }

    // Fallback: salva database su USB
    if (typeof exportDatabaseToFile === 'function') {
      exportDatabaseToFile();
    }
  }

  function focusRicerca() {
    // Cerca il primo input di ricerca visibile (documenti, normativa, ecc.)
    const selectors = [
      '#doc-ricerca',
      '#ricerca-docs',
      'input[type="search"]:not([hidden])',
      'input[placeholder*="erca" i]:not([hidden])'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) { // visibile
        el.focus();
        el.select?.();
        return;
      }
    }
    if (typeof showToast === 'function') {
      showToast('Nessun campo di ricerca disponibile nella view corrente.', 'info');
    }
  }

  function chiudiModalAperti() {
    // Chiude modal/pannelli in ordine di priorità (LIFO)
    const modalIds = [
      'modal-sospensione',
      'modal-report-giornaliero',
      'modal-crea-firma',
      'modal-nuovo-cantiere',
      'modal-modifica-cantiere',
      'modal-modifica-impresa',
      'modal-elimina-cantiere',
      'modal-aiuto-shortcuts',
      'modal-testo-email',
      'pannello-email',
      'pannello-salvataggio',
      'pannello-ricerca-normativa'
    ];
    for (const id of modalIds) {
      const m = document.getElementById(id);
      if (m) { m.remove(); return; }
    }
  }

  function apriReportGiornalieroShortcut() {
    if (typeof apriReportGiornaliero === 'function') apriReportGiornaliero();
  }

  // ─────────────────────────────────────────────
  // Handler principale
  // ─────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const inInput = target.matches('input, textarea, [contenteditable="true"], select');

    for (const s of shortcuts) {
      if (e.key !== s.key) continue;
      if (!!e.ctrlKey !== !!s.ctrl && !!e.metaKey !== !!s.ctrl) continue;
      if (!!e.altKey  !== !!s.alt) continue;
      if (s.shift !== undefined && !!e.shiftKey !== !!s.shift) continue;

      // Se siamo in un input e la shortcut non lo consente, skip
      if (inInput && !s.allowInInputs) continue;

      if (s.preventDefault) e.preventDefault();
      try {
        s.action();
      } catch (err) {
        console.warn('Shortcut error:', err);
      }
      return;
    }
  });

  // ─────────────────────────────────────────────
  // Modal aiuto: mostra elenco shortcuts con ?
  // ─────────────────────────────────────────────
  function mostraAiutoShortcuts() {
    const existing = document.getElementById('modal-aiuto-shortcuts');
    if (existing) { existing.remove(); return; }

    const gruppi = [
      {
        titolo: 'Navigazione',
        voci: [
          { tasti: 'Alt + 1',  desc: 'Hub Cantieri' },
          { tasti: 'Alt + 2',  desc: 'Dashboard cantiere' },
          { tasti: 'Alt + 3',  desc: 'Non Conformità' },
          { tasti: 'Alt + 4',  desc: 'Documenti' },
        ]
      },
      {
        titolo: 'Creazione rapida',
        voci: [
          { tasti: 'Ctrl + N',         desc: 'Nuovo Verbale di Sopralluogo' },
          { tasti: 'Ctrl + Shift + R', desc: 'Nuova Riunione di Coordinamento' },
          { tasti: 'Ctrl + Shift + P', desc: 'Nuova Verifica POS' },
          { tasti: 'Ctrl + Shift + O', desc: 'Diario giornaliero (Oggi)' },
        ]
      },
      {
        titolo: 'Azioni',
        voci: [
          { tasti: 'Ctrl + S', desc: 'Salva il contesto corrente' },
          { tasti: '/',        desc: 'Focus sulla ricerca' },
          { tasti: 'Esc',      desc: 'Chiudi modal/pannello aperto' },
          { tasti: 'Shift + ?',desc: 'Mostra questa guida' },
        ]
      }
    ];

    const modal = document.createElement('div');
    modal.id = 'modal-aiuto-shortcuts';
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Scorciatoie tastiera');

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
          <h2 class="font-bold text-sm">⌨️ Scorciatoie Tastiera</h2>
          <button onclick="document.getElementById('modal-aiuto-shortcuts').remove()"
                  class="text-slate-400 hover:text-white text-xl leading-none"
                  aria-label="Chiudi">✕</button>
        </div>
        <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          ${gruppi.map(g => `
            <div>
              <h3 class="text-xs font-bold text-slate-500 uppercase mb-2">${g.titolo}</h3>
              <table class="w-full text-sm">
                ${g.voci.map(v => `
                  <tr class="border-b border-slate-100 last:border-0">
                    <td class="py-1.5 font-mono text-xs bg-slate-100 px-2 rounded mr-2 inline-block">${v.tasti}</td>
                    <td class="py-1.5 text-slate-700">${v.desc}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
          `).join('')}
          <div class="text-xs text-slate-400 pt-2 border-t border-slate-200">
            Su Mac usa ⌘ invece di Ctrl. Le scorciatoie di creazione rapida
            funzionano solo se non stai digitando in un campo.
          </div>
        </div>
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // Espongo al global per debug / uso programmatico
  window._shortcuts = { mostraAiutoShortcuts, shortcuts };
})();
