// email.js — Integrazione Email / Outlook ANAS SafeHub
// Usa protocollo mailto: (universale, funziona con Outlook, Gmail, Thunderbird)
// Geom. Dogano Casella — CSE

// ─────────────────────────────────────────────
// 1. Apri Outlook con verbale precompilato
// ─────────────────────────────────────────────
async function inviaVerbaleEmail(verbaleId) {
  const verbali = await getAll('verbali').catch(() => []);
  const v       = verbali.find(x => x.id === verbaleId);
  if (!v) { showToast('Verbale non trovato.', 'error'); return; }

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  const dataLabel = v.data
    ? new Date(v.data).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '–';

  const cantiere = window.appState?.currentProject || v.projectId || '–';
  const nome     = window.appState?.projectName    || cantiere;

  // P4: Destinatari dal cantiere corrente (priorità), fallback su impostazioni globali
  let projectRec = null;
  try {
    const projects = await getAll('projects');
    projectRec = projects.find(p => p.id === cantiere);
  } catch(_) {}

  const destinatariCantiere = projectRec
    ? [projectRec.emailRup, projectRec.emailDl, projectRec.emailImpresa]
        .filter(s => s && s.includes('@'))
    : [];

  const to = destinatariCantiere.length > 0
    ? destinatariCantiere.join(';')
    : [imp.dl, imp.rup].filter(s => s && s.includes('@')).join(';');

  const oggetto = encodeURIComponent(
    `Verbale di Sopralluogo CSE — Cantiere ${cantiere} — ${dataLabel}`
  );

  const corpo = encodeURIComponent(
`Gentili,

si trasmette in allegato il Verbale di Sopralluogo del CSE relativo a:

Cantiere: ${cantiere} — ${nome}
Data sopralluogo: ${dataLabel}
Progressiva: ${v.km || '–'}
Oggetto: ${v.oggetto || '–'}

${v.note ? `Prescrizioni CSE:\n${v.note}\n` : ''}
Si prega di firmare il documento e restituirlo al CSE.

Cordiali saluti,
${imp.firmaNome || 'Geom. Dogano Casella'}
${imp.firmaQualifica || 'Coordinatore Sicurezza in Esecuzione (CSE)'}
${imp.studioNome || ''}
${imp.studioPEC ? 'PEC: ' + imp.studioPEC : ''}
${imp.studioTel ? 'Tel: ' + imp.studioTel : ''}

---
NOTA: allegare il PDF/Word generato dall'app prima di inviare.
      Usare "Salva come PDF" dalla finestra di stampa.
`);

  // Apre il client email predefinito (Outlook, Gmail web, Thunderbird...)
  const mailtoUrl = `mailto:${to}?subject=${oggetto}&body=${corpo}`;

  // Prova ad aprire — se URL troppo lungo usa solo soggetto
  try {
    if (mailtoUrl.length < 2000) {
      window.location.href = mailtoUrl;
    } else {
      // URL troppo lungo: solo soggetto + testo ridotto
      const cortoUrl = `mailto:${to}?subject=${oggetto}&body=${encodeURIComponent('Verbale di Sopralluogo CSE in allegato.')}`;
      window.location.href = cortoUrl;
      showToast('Email aperta. Copia il testo dal pannello e incollalo manualmente.', 'info');
      _mostraTestoEmail(v, imp, dataLabel, cantiere, nome);
    }
  } catch (_) {
    showToast('Impossibile aprire il client email. Copia i dati manualmente.', 'warning');
    _mostraTestoEmail(v, imp, dataLabel, cantiere, nome);
  }
}

// ─────────────────────────────────────────────
// 2. Apri Outlook con NC precompilata
// ─────────────────────────────────────────────
async function inviaNcEmail(ncId) {
  const list = await getAll('nc').catch(() => []);
  const n    = list.find(x => x.id === ncId);
  if (!n) { showToast('NC non trovata.', 'error'); return; }

  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  const cantiere = n.projectId || '–';
  const scadenza = n.dataScadenza
    ? new Date(n.dataScadenza).toLocaleString('it-IT')
    : '–';

  const urgenza = n.livello === 'gravissima'
    ? '🔴 URGENTE — PERICOLO GRAVE E IMMINENTE'
    : n.livello === 'grave'
      ? '🟠 URGENTE — Non Conformità GRAVE'
      : '📋 Non Conformità';

  const oggetto = encodeURIComponent(
    `${urgenza} — Cantiere ${cantiere} — ${(n.livello || '').toUpperCase()}`
  );

  // P4: Destinatari dal cantiere corrente (priorità), fallback su impostazioni
  let projectRec = null;
  try {
    const projects = await getAll('projects');
    projectRec = projects.find(p => p.id === cantiere);
  } catch(_) {}

  const destinatariCantiere = projectRec
    ? [projectRec.emailRup, projectRec.emailDl, projectRec.emailImpresa]
        .filter(s => s && s.includes('@'))
    : [];

  const to = destinatariCantiere.length > 0
    ? destinatariCantiere.join(';')
    : [imp.dl, imp.rup].filter(s => s && s.includes('@')).join(';');

  const corpo = encodeURIComponent(
`${urgenza}

Cantiere: ${cantiere}
Livello: ${(n.livello || '').toUpperCase()}
${n.titolo ? 'Titolo: ' + n.titolo : ''}
Scadenza adeguamento: ${scadenza}

DESCRIZIONE:
${n.descrizione || '–'}

${n.livello === 'gravissima' ? `
⚠️ ATTENZIONE: La presente non conformità rientra nel campo di applicazione
dell'art. 92 c.1 lett. f del D.Lgs 81/08.
Si richiede sospensione immediata delle lavorazioni interessate.
` : ''}
Si richiede immediato adeguamento entro i termini indicati.

${imp.firmaNome || 'Geom. Dogano Casella'}
${imp.firmaQualifica || 'CSE'}
${imp.studioPEC ? 'PEC: ' + imp.studioPEC : ''}
`);

  window.location.href = `mailto:${to}?subject=${oggetto}&body=${corpo}`;
  showToast('Email aperta nel client predefinito ✓', 'success');
}

// ─────────────────────────────────────────────
// 3. Modal con testo email da copiare
//    (fallback quando mailto è troppo lungo)
// ─────────────────────────────────────────────
function _mostraTestoEmail(v, imp, dataLabel, cantiere, nome) {
  const existing = document.getElementById('modal-testo-email');
  if (existing) existing.remove();

  const testo = `A: ${[imp.dl, imp.rup].filter(Boolean).join('; ') || '(inserire destinatari)'}
Oggetto: Verbale di Sopralluogo CSE — Cantiere ${cantiere} — ${dataLabel}

Gentili,

si trasmette in allegato il Verbale di Sopralluogo del CSE relativo a:

Cantiere: ${cantiere} — ${nome}
Data sopralluogo: ${dataLabel}
Progressiva: ${v.km || '–'}
Oggetto: ${v.oggetto || '–'}
${v.note ? '\nPrescrizioni CSE:\n' + v.note : ''}

Si prega di firmare il documento e restituirlo al CSE.

${imp.firmaNome || 'Geom. Dogano Casella'}
${imp.firmaQualifica || 'CSE'}`;

  const modal = document.createElement('div');
  modal.id        = 'modal-testo-email';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <div class="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
        <span class="font-bold text-sm">✉️ Testo Email da copiare</span>
        <button onclick="this.closest('#modal-testo-email').remove()"
                class="text-slate-400 hover:text-white text-xl">✕</button>
      </div>
      <div class="p-4">
        <textarea class="w-full h-64 border border-slate-200 rounded-lg p-3 text-xs font-mono
                         resize-none focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  readonly aria-label="Testo email da copiare">${testo}</textarea>
        <button onclick="navigator.clipboard.writeText(document.querySelector('#modal-testo-email textarea').value).then(()=>showToast('Testo copiato ✓','success'))"
                class="mt-3 w-full bg-blue-600 text-white text-sm py-2 rounded-lg
                       hover:bg-blue-700 focus:outline-none font-semibold">
          📋 Copia testo
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ─────────────────────────────────────────────
// 4. Mostra pannello email completo (con scelta destinatari)
// ─────────────────────────────────────────────
async function mostraPannelloEmail(opzioni = {}) {
  /*
    opzioni = {
      tipo:       'verbale' | 'nc' | 'generico'
      id:         string — ID del documento
      onInvia:    function — callback per inviare
    }
  */
  let imp = {};
  if (typeof caricaImpostazioni === 'function') imp = await caricaImpostazioni();

  // P4: carica destinatari predefiniti dal cantiere corrente
  let cantiere = null;
  if (window.appState?.currentProject) {
    try {
      const projects = await getAll('projects');
      cantiere = projects.find(p => p.id === window.appState.currentProject);
    } catch(_) {}
  }

  // Priorità: destinatari cantiere > impostazioni globali (imp.rup/imp.dl sono nomi, non email)
  const emailsTo = [
    cantiere?.emailRup,
    cantiere?.emailDl,
    cantiere?.emailImpresa
  ].filter(e => e && e.includes('@'));

  // Fallback: se il cantiere non ha email, prova con le impostazioni globali
  if (emailsTo.length === 0) {
    const fallback = [imp.dl, imp.rup].filter(s => s && s.includes('@'));
    emailsTo.push(...fallback);
  }

  const existing = document.getElementById('pannello-email');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id        = 'pannello-email';
  panel.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  // Mostra un badge se i destinatari sono arrivati dal cantiere
  const badgeCantiere = emailsTo.length > 0 && cantiere
    ? `<div class="bg-green-50 border border-green-200 rounded-xl p-2.5 text-xs text-green-800">
         ✅ Destinatari precompilati dal cantiere <strong>${escapeHtml(cantiere.id)}</strong>
       </div>`
    : '';

  panel.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
      <div class="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
        <h2 class="font-bold text-sm">✉️ Invia via Email / Outlook</h2>
        <button onclick="document.getElementById('pannello-email').remove()"
                class="text-slate-400 hover:text-white text-xl">✕</button>
      </div>
      <div class="p-5 space-y-4">

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
          <strong>Come funziona:</strong> cliccando "Apri Outlook" si aprirà il client email
          predefinito con i campi pre-compilati. Allega manualmente il PDF prima di inviare.
        </div>

        ${badgeCantiere}

        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">
            Destinatari (A:)
          </label>
          <input id="email-to"
                 type="email"
                 multiple
                 value="${emailsTo.join('; ')}"
                 placeholder="impresa@pec.it; rup@anas.it"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-600 block mb-1">CC:</label>
          <input id="email-cc" type="email" multiple
                 placeholder="copia@anas.it"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none" />
        </div>

        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
          💡 <strong>Suggerimento firma:</strong> salva prima il PDF, poi allegalo manualmente
          all'email. L'impresa può stampare, firmare a mano, scansionare e rinviare.
          In alternativa usa la firma elettronica qualificata (Namirial/Aruba Sign).
        </div>

        <div class="flex gap-3">
          <button onclick="_inviaEmailConfermata('${opzioni.tipo || 'generico'}', '${opzioni.id || ''}')"
                  class="flex-1 bg-indigo-700 text-white text-sm py-2.5 rounded-xl font-bold
                         hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            ✉️ Apri Outlook
          </button>
          <button onclick="document.getElementById('pannello-email').remove()"
                  class="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm rounded-xl
                         hover:bg-slate-200 focus:outline-none">
            Annulla
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(panel);
}

async function _inviaEmailConfermata(tipo, id) {
  document.getElementById('pannello-email')?.remove();
  if (tipo === 'verbale' && id) { await inviaVerbaleEmail(id); }
  else if (tipo === 'nc' && id) { await inviaNcEmail(id);      }
}
