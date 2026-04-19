// ui.js - Interfaccia utente ANAS SafeHub

// ─────────────────────────────────────────────
// Utility DOM
// ─────────────────────────────────────────────
function el(q)  { return document.querySelector(q);  }
function els(q) { return Array.from(document.querySelectorAll(q)); }

// ─────────────────────────────────────────────
// Sanitizzazione XSS — usare su tutti i dati
// inseriti dall'utente che finiscono in innerHTML
// ─────────────────────────────────────────────
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────
// TOAST (sostituisce tutti gli alert())
// ─────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const config = {
    success: { bg: 'bg-green-600',   icon: '✓', barColor: 'bg-green-300' },
    error:   { bg: 'bg-red-600',     icon: '✕', barColor: 'bg-red-300' },
    warning: { bg: 'bg-yellow-500',  icon: '⚠', barColor: 'bg-yellow-200' },
    info:    { bg: 'bg-slate-700',   icon: 'ℹ', barColor: 'bg-slate-400' }
  };
  const cfg = config[type] || config.info;
  const duration = 3500;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.className = `fixed bottom-5 right-5 z-[9999] rounded-xl text-white shadow-xl
                     ${cfg.bg} overflow-hidden min-w-[260px] max-w-sm
                     translate-x-full opacity-0 transition-all duration-300 ease-out`;

  toast.innerHTML = `
    <div class="flex items-center gap-3 px-5 py-3">
      <span class="text-lg shrink-0" aria-hidden="true">${cfg.icon}</span>
      <span class="text-sm font-semibold flex-1">${escapeHtml(msg)}</span>
    </div>
    <div class="h-1 ${cfg.barColor} origin-left" style="animation: toastProgress ${duration}ms linear forwards"></div>
  `;

  document.body.appendChild(toast);

  // Trigger slide-in nel frame successivo (force layout)
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });

  // Hover per pausare il progress bar
  toast.addEventListener('mouseenter', () => {
    const bar = toast.querySelector('div.h-1');
    if (bar) bar.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    const bar = toast.querySelector('div.h-1');
    if (bar) bar.style.animationPlayState = 'running';
  });

  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─────────────────────────────────────────────
// Checkmark animato centrato (conferma salvataggio)
// Usage: showCheckmark() dopo saveItem() + showToast
// ─────────────────────────────────────────────
function showCheckmark() {
  const existing = document.querySelector('.checkmark-icon');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'checkmark-icon';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `
    <svg viewBox="0 0 52 52">
      <path d="M14 27 l8 8 l16 -18" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.remove(), 1000);
}

// ─────────────────────────────────────────────
// Flash verde su un bottone (conferma interna)
// Usage: showSuccessFlash(document.getElementById('btn-save'))
// ─────────────────────────────────────────────
function showSuccessFlash(btn) {
  if (!btn) return;
  btn.classList.add('btn-flash-success');
  setTimeout(() => btn.classList.remove('btn-flash-success'), 550);
}

// ─────────────────────────────────────────────
// UX-E: Focus Trapping per Modals (Accessibilità)
// Intrappola il focus del tasto Tab all'interno del modal
// ─────────────────────────────────────────────
function trapFocus(modal) {
  if (!modal) return;
  const focusableEls = modal.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
  );
  if (focusableEls.length === 0) return;

  const firstFocusableEl = focusableEls[0];
  const lastFocusableEl = focusableEls[focusableEls.length - 1];

  modal.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab' && e.keyCode !== 9) return;

    if (e.shiftKey) { // Shift + Tab
      if (document.activeElement === firstFocusableEl) {
        lastFocusableEl.focus();
        e.preventDefault();
      }
    } else { // Tab
      if (document.activeElement === lastFocusableEl) {
        firstFocusableEl.focus();
        e.preventDefault();
      }
    }
  });

  // Focus sul primo elemento (spesso il modal stesso o il primo input)
  // Per i form, è meglio mettere il focus sul primo input
  const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
  if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
  } else {
      setTimeout(() => firstFocusableEl.focus(), 50);
  }
}

// Inizializza un MutationObserver per applicare automaticamente il focus trap
// a tutti i modal aggiunti al DOM senza dover chiamare trapFocus ovunque
if (typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const isModal = node.getAttribute('role') === 'dialog' ||
                            node.id?.includes('modal') ||
                            node.id?.includes('pannello') ||
                            (typeof node.className === 'string' && node.className.includes('fixed inset-0'));
            if (isModal) {
              trapFocus(node);
              // History API per Android Back Button (su mobile/tablet)
              if (window.innerWidth < 1024) {
                history.pushState({ isModalElement: true, modalId: node.id || 'unnamed' }, '', '#modal');
              }
            }
          }
        });
        
        m.removedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const isModal = node.getAttribute('role') === 'dialog' ||
                            node.id?.includes('modal') ||
                            node.id?.includes('pannello') ||
                            (typeof node.className === 'string' && node.className.includes('fixed inset-0'));
            // Se chiuso da pulsante (non tasto indietro) rimuoviamo lo stato
            if (isModal && window.innerWidth < 1024 && !window._isPoppingState) {
              if (history.state && history.state.isModalElement) {
                history.back();
              }
            }
          }
        });
      }
    }
  });
  
  // Avvia l'osservatore
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: false });
  });

  // Intercetta Tasto Indietro per i modali dinamici
  window.addEventListener('popstate', (e) => {
    window._isPoppingState = true;
    
    // Trova l'ultimo modale nel DOM
    const modals = Array.from(document.body.children).filter(node => 
      node.nodeType === 1 && (
        node.getAttribute('role') === 'dialog' ||
        node.id?.includes('modal') ||
        node.id?.includes('pannello') ||
        (typeof node.className === 'string' && node.className.includes('fixed inset-0'))
      )
    );
    
    // Rimuovi l'ultimo (il più in alto)
    if (modals.length > 0) {
      modals[modals.length - 1].remove();
    }
    
    setTimeout(() => { window._isPoppingState = false; }, 50);
  });
}

// ─────────────────────────────────────────────
// Cambio vista (Hub / Anagrafica / Sync)
// ─────────────────────────────────────────────
function show(viewId) {
  const views = ['hub-view', 'anagrafica-view', 'sync-view'];
  views.forEach(id => {
    const section = document.getElementById(id);
    if (!section) return;
    if (id === viewId) {
      section.classList.remove('hidden', 'page-hidden');
      section.removeAttribute('aria-hidden');
    } else {
      section.classList.add('hidden', 'page-hidden');
      section.setAttribute('aria-hidden', 'true');
    }
  });

  // Aggiorna aria-pressed sui bottoni sidebar
  els('[data-view-btn]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.viewBtn === viewId ? 'true' : 'false');
  });
}

// ─────────────────────────────────────────────
// Inizializza layout masonry
// ─────────────────────────────────────────────
function inizializzaMasonry(containerId) {
  // Lasciamo la gestione a CSS grid o flexbox per semplicità
}

// ─────────────────────────────────────────────
// PULL-TO-REFRESH ELASTICO
// ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const scrollArea = document.querySelector('.flex-1.overflow-y-auto.p-5');
    if (!scrollArea) return;
    
    const ptrIndicator = document.createElement('div');
    ptrIndicator.id = 'ptr-indicator';
    ptrIndicator.className = 'absolute top-0 left-0 w-full flex justify-center items-center pointer-events-none z-50 transition-transform duration-200';
    ptrIndicator.style.transform = 'translateY(-60px)';
    ptrIndicator.innerHTML = `
      <div class="bg-white rounded-full shadow-lg p-2 flex items-center justify-center w-10 h-10 border border-slate-100">
        <svg class="w-5 h-5 text-blue-600 ptr-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      </div>`;
    scrollArea.appendChild(ptrIndicator);

    let startY = 0, isPulling = false, ptrDistance = 0;
    const spinner = ptrIndicator.querySelector('.ptr-spinner');

    scrollArea.addEventListener('touchstart', (e) => {
      if (scrollArea.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
        ptrIndicator.style.transition = 'none';
        spinner.classList.remove('animate-spin');
      }
    }, { passive: true });

    scrollArea.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0 && scrollArea.scrollTop <= 0) {
        ptrDistance = Math.min(diff * 0.45, 80);
        ptrIndicator.style.transform = `translateY(${ptrDistance - 60}px)`;
        spinner.style.transform = `rotate(${ptrDistance * 4}deg)`;
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    scrollArea.addEventListener('touchend', () => {
      if (!isPulling) return;
      isPulling = false;
      
      if (ptrDistance >= 60) {
        ptrIndicator.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        ptrIndicator.style.transform = 'translateY(16px)';
        spinner.classList.add('animate-spin');
        
        setTimeout(async () => {
          const currentView = Array.from(document.querySelectorAll('section.page-transition'))
            .find(el => !el.classList.contains('page-hidden'))?.id;
            
          if (currentView === 'view-hub' && typeof caricaProgetti === 'function') await caricaProgetti();
          else if (currentView === 'view-nc' && typeof renderNc === 'function') await renderNc();
          else if (currentView === 'view-documenti' && typeof renderDocumenti === 'function') await renderDocumenti();
          
          ptrIndicator.style.transform = 'translateY(-60px)';
          setTimeout(() => spinner.classList.remove('animate-spin'), 300);
        }, 800);
      } else {
        ptrIndicator.style.transition = 'transform 0.3s ease-out';
        ptrIndicator.style.transform = 'translateY(-60px)';
      }
      ptrDistance = 0;
    });
  });
}

// ─────────────────────────────────────────────
// Card cantiere
// ─────────────────────────────────────────────
function projectCard(project, ncStat) {
  const isWarning   = project.status === 'warning';
  const statusIcon  = isWarning ? '⚠️' : '✅';
  const statusLabel = isWarning ? 'Attenzione richiesta' : 'Regolare';
  const badgeClass  = isWarning
    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
    : 'bg-green-100 text-green-800 border border-green-300';

  // Dati utente → sempre sanificati
  const id   = escapeHtml(project.id);
  const nome = escapeHtml(project.nome);
  const loc  = escapeHtml(project.loc || 'Posizione non specificata');

  // P5: badge NC scadenza
  const stat = ncStat || { aperte: 0, gravissime: 0, scadeOggi: 0, scadute: 0 };
  const hasCritico = stat.gravissime > 0 || stat.scadute > 0;
  const hasWarning = stat.scadeOggi > 0;

  // Bordo card: rosso pulsante se critico, arancione se warning, slate normale
  const borderClass = hasCritico
    ? 'border-2 border-red-400 alert-pulse'
    : hasWarning
      ? 'border-2 border-orange-400'
      : 'border border-slate-200';

  const ncBadges = [];
  if (stat.gravissime > 0) {
    ncBadges.push(`<span class="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200"
                        title="NC gravissime aperte">
                     🔴 ${stat.gravissime}
                   </span>`);
  }
  if (stat.scadute > 0) {
    ncBadges.push(`<span class="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200"
                        title="NC scadute non chiuse">
                     ⏰ ${stat.scadute}
                   </span>`);
  }
  if (stat.scadeOggi > 0) {
    ncBadges.push(`<span class="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-bold border border-orange-200"
                        title="NC in scadenza oggi">
                     ⚠️ ${stat.scadeOggi}
                   </span>`);
  }
  if (ncBadges.length === 0 && stat.aperte > 0) {
    ncBadges.push(`<span class="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold border border-slate-200"
                        title="NC aperte nei termini">
                     ${stat.aperte} NC aperte
                   </span>`);
  }

  return `
    <article class="bg-white p-4 rounded-xl shadow-sm ${borderClass}
                    hover:shadow-md transition-all card-hover"
             aria-label="Cantiere ${nome}, codice ${id}">

      <div class="flex justify-between items-start">
        <div class="text-xs text-slate-400 font-mono">
          <span aria-label="Codice cantiere">${id}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs px-2 py-0.5 rounded-full ${badgeClass}" aria-label="${statusLabel}">
            ${statusIcon} ${statusLabel}
          </span>
          <button onclick="apriModalModificaCantiere('${escapeHtml(project.id)}')"
                  class="text-slate-400 hover:text-slate-700 p-1 rounded
                         focus:outline-none focus:ring-1 focus:ring-slate-400"
                  aria-label="Modifica cantiere ${nome}" title="Modifica">
            ✏️
          </button>
          <button onclick="eliminaCantiere('${escapeHtml(project.id)}', '${escapeSingleQuotes(project.nome)}')"
                  class="text-slate-400 hover:text-red-600 p-1 rounded
                         focus:outline-none focus:ring-1 focus:ring-red-400"
                  aria-label="Elimina cantiere ${nome}" title="Elimina">
            🗑️
          </button>
        </div>
      </div>

      <div class="font-bold text-base mt-2 text-slate-800">${nome}</div>
      <div class="text-sm text-slate-500 mt-1">${loc}</div>

      ${ncBadges.length > 0 ? `
        <div class="flex flex-wrap gap-1.5 mt-3" aria-label="Stato NC cantiere">
          ${ncBadges.join('')}
        </div>` : ''}

      <div class="mt-4 flex justify-between items-center">
        <div class="text-xs text-slate-400">
          ${project.createdAt ? 'Creato: ' + new Date(project.createdAt).toLocaleDateString('it-IT') : ''}
        </div>
        <button onclick="enterProject('${escapeHtml(project.id)}', '${escapeSingleQuotes(project.nome)}')"
                class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                aria-label="Entra nel cantiere ${nome}">
          Entra →
        </button>
      </div>
    </article>
  `;
}

// ─────────────────────────────────────────────
// Modal MODIFICA cantiere
// ─────────────────────────────────────────────
async function apriModalModificaCantiere(projectId) {
  const projects = await getAll('projects');
  const p        = projects.find(x => x.id === projectId);
  if (!p) { showToast('Cantiere non trovato.', 'error'); return; }

  const existing = document.getElementById('modal-modifica-cantiere');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id        = 'modal-modifica-cantiere';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-mod-title');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
      <h2 id="modal-mod-title" class="text-lg font-bold text-slate-800">
        ✏️ Modifica Cantiere
      </h2>
      <div class="text-xs text-slate-400 font-mono">Codice: ${escapeHtml(p.id)}</div>

      <div>
        <label for="mod-nome" class="text-xs font-semibold text-slate-600 block mb-1">
          Nome Opera / Intervento <span class="text-red-500">*</span>
        </label>
        <input id="mod-nome" type="text"
               value="${escapeHtml(p.nome)}"
               class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none" />
      </div>
      <div>
        <label for="mod-loc" class="text-xs font-semibold text-slate-600 block mb-1">
          Localizzazione
        </label>
        <input id="mod-loc" type="text"
               value="${escapeHtml(p.loc || '')}"
               placeholder="Es. S.S. 106 Jonica · KM 42+000"
               class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                      focus:ring-2 focus:ring-blue-400 focus:outline-none" />
      </div>
      <div>
        <label for="mod-status" class="text-xs font-semibold text-slate-600 block mb-1">
          Stato
        </label>
        <select id="mod-status"
                class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                       focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="ok"      ${p.status === 'ok'      ? 'selected' : ''}>✅ Regolare</option>
          <option value="warning" ${p.status === 'warning' ? 'selected' : ''}>⚠️ Attenzione richiesta</option>
        </select>
      </div>

      <!-- P4: Destinatari email -->
      <details class="border border-slate-200 rounded-lg" ${p.emailRup || p.emailDl || p.emailImpresa ? 'open' : ''}>
        <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700
                        hover:bg-slate-50 rounded-lg">
          ✉️ Destinatari email predefiniti
        </summary>
        <div class="p-3 space-y-3 border-t border-slate-200">
          <div>
            <label for="mod-email-rup" class="text-xs font-semibold text-slate-600 block mb-1">
              R.U.P.
            </label>
            <input id="mod-email-rup" type="text"
                   value="${escapeHtml(p.emailRup || '')}"
                   placeholder="Es. mario.verdi@anas.it"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
          <div>
            <label for="mod-email-dl" class="text-xs font-semibold text-slate-600 block mb-1">
              Direttore Lavori
            </label>
            <input id="mod-email-dl" type="text"
                   value="${escapeHtml(p.emailDl || '')}"
                   placeholder="Es. lucia.bianchi@anas.it"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
          <div>
            <label for="mod-email-impresa" class="text-xs font-semibold text-slate-600 block mb-1">
              PEC Impresa Affidataria
            </label>
            <input id="mod-email-impresa" type="text"
                   value="${escapeHtml(p.emailImpresa || '')}"
                   placeholder="Es. costruzionirossi@pec.it"
                   class="w-full border border-slate-300 rounded-lg p-2 text-sm
                          focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
        </div>
      </details>

      <div class="flex justify-end gap-3 pt-2">
        <button onclick="document.getElementById('modal-modifica-cantiere').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaModificaCantiere('${escapeHtml(p.id)}')"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          ✅ Salva Modifiche
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);
  if (typeof trapFocus === 'function') trapFocus(modal);
  modal.querySelector('#mod-nome').focus();
}

async function confermaModificaCantiere(projectId) {
  const nome   = (document.getElementById('mod-nome')?.value   || '').trim();
  const loc    = (document.getElementById('mod-loc')?.value    || '').trim();
  const status = document.getElementById('mod-status')?.value || 'ok';

  // P4: email destinatari
  const emailRup     = (document.getElementById('mod-email-rup')?.value     || '').trim();
  const emailDl      = (document.getElementById('mod-email-dl')?.value      || '').trim();
  const emailImpresa = (document.getElementById('mod-email-impresa')?.value || '').trim();

  if (!nome) { showToast('Il nome è obbligatorio.', 'warning'); return; }

  const projects = await getAll('projects');
  const p        = projects.find(x => x.id === projectId);
  if (!p) { showToast('Cantiere non trovato.', 'error'); return; }

  const updated = {
    ...p,
    nome, loc, status,
    emailRup, emailDl, emailImpresa,
    updatedAt: new Date().toISOString()
  };
  await saveItem('projects', updated);

  document.getElementById('modal-modifica-cantiere')?.remove();
  await refreshProjectsGrid();
  showToast(`Cantiere "${nome}" aggiornato ✓`, 'success');
}

// ─────────────────────────────────────────────
// Elimina cantiere con conferma
// ─────────────────────────────────────────────
async function eliminaCantiere(projectId, nomeProgetto) {
  const modal = document.createElement('div');
  modal.id        = 'modal-elimina-cantiere';
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 text-center">
      <div class="text-4xl">⚠️</div>
      <h2 class="text-lg font-bold text-slate-800">Elimina Cantiere</h2>
      <p class="text-sm text-slate-600">
        Vuoi eliminare <strong>${escapeHtml(nomeProgetto)}</strong>?<br>
        <span class="text-red-600 font-semibold">Questa azione non è reversibile.</span>
      </p>
      <div class="flex justify-center gap-3 pt-2">
        <button onclick="document.getElementById('modal-elimina-cantiere').remove()"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none">
          Annulla
        </button>
        <button onclick="confermaEliminaCantiere('${escapeHtml(projectId)}')"
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
          🗑️ Elimina
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.remove(); });
  document.body.appendChild(modal);
  if (typeof trapFocus === 'function') trapFocus(modal);
}

async function confermaEliminaCantiere(projectId) {
  try {
    // Cascading delete: rimuovi tutti i dati collegati al cantiere

    // 1. Verbali del cantiere
    const verbali = await getByIndex('verbali', 'projectId', projectId).catch(() => []);
    for (const v of verbali) await deleteItem('verbali', v.id);

    // 2. NC del cantiere e foto collegate
    const ncs = await getByIndex('nc', 'projectId', projectId).catch(() => []);
    for (const nc of ncs) {
      // Foto collegate alla NC
      if (typeof getByIndex === 'function') {
        const foto = await getByIndex('foto', 'ncId', nc.id).catch(() => []);
        for (const f of foto) await deleteItem('foto', f.id);
      }
      await deleteItem('nc', nc.id);
    }

    // 3. Assegnazioni imprese-cantiere
    const assegnazioni = await getByIndex('imprese_cantieri', 'projectId', projectId).catch(() => []);
    for (const a of assegnazioni) await deleteItem('imprese_cantieri', a.id);

    // 4. Infine elimina il cantiere stesso
    await deleteItem('projects', projectId);

    document.getElementById('modal-elimina-cantiere')?.remove();
    await refreshProjectsGrid();
    showToast('Cantiere e dati collegati eliminati.', 'info');
  } catch (err) {
    console.error('Errore eliminazione cascata:', err);
    showToast('Errore durante l\'eliminazione: ' + err, 'error');
  }
}

function escapeSingleQuotes(str) {
  return (str || '').replace(/'/g, "\\'");
}

// ─────────────────────────────────────────────
// Aggiorna griglia cantieri
// ─────────────────────────────────────────────
async function refreshProjectsGrid() {
  const grid  = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');
  if (!grid) return;

  const projects = await getAll('projects');

  if (!projects || projects.length === 0) {
    if (empty) empty.style.display = 'block';
    grid.innerHTML = '';
    return;
  }

  if (empty) empty.style.display = 'none';

  // P5: calcola NC in scadenza per cantiere (una sola query + aggregazione)
  let ncStats = {};
  try {
    const tutteNC = await getAll('nc');
    const ora     = new Date();
    const fineOggi = new Date(); fineOggi.setHours(23, 59, 59, 999);

    tutteNC.forEach(n => {
      if (!n.projectId || n.stato === 'chiusa') return;
      ncStats[n.projectId] = ncStats[n.projectId] || {
        aperte: 0, gravissime: 0, scadeOggi: 0, scadute: 0
      };
      ncStats[n.projectId].aperte++;
      if (n.livello === 'gravissima') ncStats[n.projectId].gravissime++;
      if (n.dataScadenza) {
        const scad = new Date(n.dataScadenza);
        if (scad < ora) {
          ncStats[n.projectId].scadute++;
        } else if (scad <= fineOggi) {
          ncStats[n.projectId].scadeOggi++;
        }
      }
    });
  } catch (_) { /* fallback: grid senza badge */ }

  // Riepilogo aggregato sopra la griglia (alert globale mattina)
  renderAlertNCGlobale(ncStats);

  grid.innerHTML = projects.map(p => projectCard(p, ncStats[p.id])).join('');
}

// ─────────────────────────────────────────────
// P5: Alert globale NC in scadenza — visibile dal primo sguardo al mattino
// ─────────────────────────────────────────────
function renderAlertNCGlobale(ncStats) {
  const container = document.getElementById('hub-nc-alert');
  if (!container) return;

  const totScadute    = Object.values(ncStats).reduce((s, x) => s + x.scadute,    0);
  const totScadeOggi  = Object.values(ncStats).reduce((s, x) => s + x.scadeOggi,  0);
  const totGravissime = Object.values(ncStats).reduce((s, x) => s + x.gravissime, 0);

  if (totScadute === 0 && totScadeOggi === 0 && totGravissime === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  const blocchi = [];
  if (totGravissime > 0) {
    blocchi.push(`<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-bold">
                    🔴 ${totGravissime} gravissime
                  </span>`);
  }
  if (totScadute > 0) {
    blocchi.push(`<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-bold">
                    ⏰ ${totScadute} scadute
                  </span>`);
  }
  if (totScadeOggi > 0) {
    blocchi.push(`<span class="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full text-xs font-bold">
                    ⚠️ ${totScadeOggi} in scadenza oggi
                  </span>`);
  }

  container.innerHTML = `
    <div class="bg-white border-l-4 ${totGravissime > 0 ? 'border-red-600 alert-pulse' : 'border-orange-500'}
                rounded-r-xl p-4 shadow-sm mb-5" role="alert">
      <div class="flex items-start gap-3">
        <div class="text-2xl shrink-0" aria-hidden="true">${totGravissime > 0 ? '🚨' : '⚠️'}</div>
        <div class="flex-1">
          <div class="font-bold text-slate-800 text-sm">
            Attenzione immediata richiesta
          </div>
          <div class="flex flex-wrap gap-2 mt-2">${blocchi.join('')}</div>
          <div class="text-xs text-slate-500 mt-2">
            Controlla i cantieri evidenziati in rosso/arancione nella griglia sotto.
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Modal nuovo cantiere (sostituisce prompt())
// ─────────────────────────────────────────────
function apriModalNuovoCantiere() {
  const existing = document.getElementById('modal-nuovo-cantiere');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-nuovo-cantiere';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">

      <h2 id="modal-title" class="text-xl font-bold text-slate-800">
        🚧 Nuovo Cantiere
      </h2>

      <div class="space-y-3">
        <div>
          <label for="nc-id" class="text-sm font-semibold text-slate-700 block mb-1">
            Codice Cantiere <span class="text-red-500">*</span>
          </label>
          <input id="nc-id"
                 type="text"
                 placeholder="Es. CZ401, AN203, RA010"
                 autocomplete="off"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none"
                 aria-required="true"
                 aria-describedby="nc-id-hint" />
          <div id="nc-id-hint" class="text-xs text-slate-400 mt-1">
            Codice alfanumerico univoco assegnato da ANAS (es. CZ399)
          </div>
        </div>

        <div>
          <label for="nc-nome" class="text-sm font-semibold text-slate-700 block mb-1">
            Nome Opera / Intervento <span class="text-red-500">*</span>
          </label>
          <input id="nc-nome"
                 type="text"
                 placeholder="Es. Manutenzione Viadotto S. Giorgio"
                 autocomplete="off"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none"
                 aria-required="true" />
        </div>

        <div>
          <label for="nc-loc" class="text-sm font-semibold text-slate-700 block mb-1">
            Localizzazione
          </label>
          <input id="nc-loc"
                 type="text"
                 placeholder="Es. S.S. 106 Jonica · KM 42+000"
                 class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                        focus:ring-2 focus:ring-blue-400 focus:outline-none"
                 aria-describedby="nc-loc-hint" />
          <div id="nc-loc-hint" class="text-xs text-slate-400 mt-1">
            Strada statale, autostrada e progressiva chilometrica
          </div>
        </div>

        <div>
          <label for="nc-status" class="text-sm font-semibold text-slate-700 block mb-1">
            Stato iniziale
          </label>
          <select id="nc-status"
                  class="w-full border border-slate-300 rounded-lg p-2.5 text-sm
                         focus:ring-2 focus:ring-blue-400 focus:outline-none">
            <option value="ok">✅ Regolare</option>
            <option value="warning">⚠️ Attenzione richiesta</option>
          </select>
        </div>

        <!-- P4: Destinatari email predefiniti per questo cantiere -->
        <details class="border border-slate-200 rounded-lg">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700
                          hover:bg-slate-50 rounded-lg">
            ✉️ Destinatari email (opzionale)
          </summary>
          <div class="p-3 space-y-3 border-t border-slate-200">
            <div>
              <label for="nc-email-rup" class="text-xs font-semibold text-slate-600 block mb-1">
                R.U.P. — Email / PEC
              </label>
              <input id="nc-email-rup" type="text"
                     placeholder="Es. mario.verdi@anas.it"
                     autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg p-2 text-sm
                            focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label for="nc-email-dl" class="text-xs font-semibold text-slate-600 block mb-1">
                Direttore Lavori — Email / PEC
              </label>
              <input id="nc-email-dl" type="text"
                     placeholder="Es. lucia.bianchi@anas.it"
                     autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg p-2 text-sm
                            focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div>
              <label for="nc-email-impresa" class="text-xs font-semibold text-slate-600 block mb-1">
                PEC Impresa Affidataria
              </label>
              <input id="nc-email-impresa" type="text"
                     placeholder="Es. costruzionirossi@pec.it"
                     autocomplete="off"
                     class="w-full border border-slate-300 rounded-lg p-2 text-sm
                            focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div class="text-xs text-slate-500 italic">
              Questi indirizzi verranno pre-compilati automaticamente quando invii verbali/NC via email.
            </div>
          </div>
        </details>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <button id="btn-modal-cancel"
                type="button"
                class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold
                       hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
          Annulla
        </button>
        <button id="btn-modal-confirm"
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          ✅ Crea Cantiere
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  if (typeof trapFocus === 'function') trapFocus(modal);

  // Focus primo campo
  modal.querySelector('#nc-id').focus();

  // Chiudi su Escape
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') chiudiModalNuovoCantiere();
  });

  // Chiudi cliccando fuori
  modal.addEventListener('click', (e) => {
    if (e.target === modal) chiudiModalNuovoCantiere();
  });

  modal.querySelector('#btn-modal-cancel').addEventListener('click', chiudiModalNuovoCantiere);
  modal.querySelector('#btn-modal-confirm').addEventListener('click', confermaNuovoCantiere);
}

function chiudiModalNuovoCantiere() {
  const modal = document.getElementById('modal-nuovo-cantiere');
  if (modal) modal.remove();
}

async function confermaNuovoCantiere() {
  const id     = (document.getElementById('nc-id').value     || '').trim();
  const nome   = (document.getElementById('nc-nome').value   || '').trim();
  const loc    = (document.getElementById('nc-loc').value    || '').trim();
  const status = document.getElementById('nc-status').value  || 'ok';

  // P4: destinatari email
  const emailRup     = (document.getElementById('nc-email-rup')?.value     || '').trim();
  const emailDl      = (document.getElementById('nc-email-dl')?.value      || '').trim();
  const emailImpresa = (document.getElementById('nc-email-impresa')?.value || '').trim();

  if (!id || !nome) {
    showToast('Codice e Nome sono obbligatori.', 'warning');
    return;
  }

  // Controlla ID duplicato — saveItem farebbe put() sovrascrivendo i dati esistenti
  try {
    const existing = await getAll('projects');
    if (existing.some(p => p.id === id)) {
      showToast(`Il codice "${id}" è già in uso. Scegli un codice diverso.`, 'warning');
      document.getElementById('nc-id')?.focus();
      return;
    }
  } catch (_) { /* se getAll fallisce, prosegui comunque */ }

  const project = {
    id,
    nome,
    loc,
    status,
    emailRup,
    emailDl,
    emailImpresa,
    createdAt: new Date().toISOString()
  };

  try {
    await saveItem('projects', project);
    chiudiModalNuovoCantiere();
    await refreshProjectsGrid();
    showToast(`Cantiere "${nome}" creato correttamente ✓`, 'success');
  } catch (err) {
    showToast('Errore nel salvataggio: ' + err, 'error');
  }
}

// ─────────────────────────────────────────────
// Wire UI — collega tutti gli event listener
// ─────────────────────────────────────────────
function wireUI() {

  // Navigazione sidebar
  el('#btn-hub')?.addEventListener('click', () => show('hub-view'));
  el('#btn-anagrafica')?.addEventListener('click', () => show('anagrafica-view'));
  el('#btn-sync')?.addEventListener('click', () => show('sync-view'));

  // Nuovo cantiere → modal (non prompt)
  el('#btn-new-project')?.addEventListener('click', apriModalNuovoCantiere);

  // Import / Export USB
  el('#btn-save-usb')?.addEventListener('click', () => exportDatabaseToFile());

  el('#btn-load-usb')?.addEventListener('click', () => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = 'application/json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await importDatabaseFromFile(file);
      if (ok) {
        await refreshProjectsGrid();
        showToast('Database importato correttamente ✓', 'success');
      }
    };
    input.click();
  });

  // ─────────────────────────────────────────────
  // Anagrafica — popola select cantieri al click sul tab
  // ─────────────────────────────────────────────
  el('#btn-anagrafica')?.addEventListener('click', async () => {
    show('anagrafica-view');
    await _popolaSelectCantieri();
  });

  // Salva anagrafica + assegnazione opzionale al cantiere
  el('#btn-save-anagrafica')?.addEventListener('click', async (ev) => {
    ev.preventDefault();

    const piva  = (document.getElementById('partita_iva')?.value    || '').trim();
    const nome  = (document.getElementById('ragione_sociale')?.value || '').trim();

    if (!nome) {
      showToast('La ragione sociale è obbligatoria.', 'warning');
      return;
    }

    const impresa = {
      id:         piva || ('IMP-' + Date.now()),
      nome,
      piva,
      ruolo:      document.getElementById('tipo_soggetto')?.value || '',
      referente:  document.getElementById('referente')?.value     || '',
      contatto:   document.getElementById('contatto')?.value      || '',
      createdAt:  new Date().toISOString()
    };

    try {
      await saveItem('imprese', impresa);

      // Assegnazione automatica al cantiere (se selezionato)
      const cantiereSel = document.getElementById('assegna-cantiere')?.value || '';
      if (cantiereSel) {
        const assegnazione = {
          id:        'ass_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          projectId: cantiereSel,
          impresaId: impresa.id,
          ruolo:     impresa.ruolo || 'esecutrice',
          createdAt: new Date().toISOString()
        };
        await saveItem('imprese_cantieri', assegnazione);
        showToast(`"${nome}" salvata e assegnata al cantiere ${cantiereSel} ✓`, 'success');
      } else {
        showToast(`"${nome}" salvata nel registro globale ✓`, 'success');
      }

      document.getElementById('form-anagrafica')?.reset();
      // Ripopola il select dopo il reset
      await _popolaSelectCantieri();

    } catch (err) {
      showToast('Errore nel salvataggio: ' + err, 'error');
    }
  });
}

// ─────────────────────────────────────────────
// Helper: popola select cantieri nel form anagrafica
// ─────────────────────────────────────────────
async function _popolaSelectCantieri() {
  const sel = document.getElementById('assegna-cantiere');
  if (!sel) return;
  try {
    if (typeof initDB === 'function' && typeof getAll !== 'function') await initDB();
    const projects = await getAll('projects');
    sel.innerHTML = '<option value="">— Solo registro globale (senza cantiere) —</option>';
    projects.forEach(p => {
      const opt   = document.createElement('option');
      opt.value   = p.id;
      opt.textContent = `${p.id} — ${p.nome}`;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

// ─────────────────────────────────────────────
// Entrata nel cantiere → naviga alla dashboard
// ─────────────────────────────────────────────
function enterProject(id, nome) {
  window.appState = window.appState || {};
  window.appState.currentProject = id;
  window.appState.projectName    = nome;

  // navigation.js sovrascriverà questa funzione per la navigazione reale
  // Non chiamiamo alert() qui: è navigation.js che naviga
}
