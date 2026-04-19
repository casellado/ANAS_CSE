// ui-dashboard.js - UI avanzata dashboard cantiere ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Gestione Tabs Dashboard (accessibilità)
// ─────────────────────────────────────────────
function initDashboardTabs() {
  const tabs   = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-panel]');

  // Mostra il primo tab di default
  if (tabs.length > 0) {
    const firstTab = tabs[0];
    activateTab(firstTab.dataset.tab, tabs, panels);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateTab(tab.dataset.tab, tabs, panels);
    });
    // Accessibilità: navigazione con tastiera
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateTab(tab.dataset.tab, tabs, panels);
      }
    });
  });
}

const loadedPanels = new Set(['kpi']); // Il KPI è pre-caricato al boot della dashboard

async function activateTab(target, tabs, panels) {
  tabs.forEach(t => {
    const isActive = t.dataset.tab === target;
    t.classList.toggle('tab-active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    t.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  panels.forEach(p => {
    const isTarget = p.dataset.panel === target;
    p.classList.toggle('hidden', !isTarget);
    p.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
  });

  // UX-H: Lazy Loading dei pannelli
  if (!loadedPanels.has(target)) {
    loadedPanels.add(target);
    try {
      if (target === 'nc' && typeof renderNCListWithFoto === 'function') {
        await renderNCListWithFoto('nc-list');
      }
      else if (target === 'verbali' && typeof renderVerbaliList === 'function') {
        await renderVerbaliList('verbali-list');
      }
      else if (target === 'imprese' && typeof renderImpreseList === 'function') {
        await renderImpreseList('imprese-list');
      }
    } catch (err) {
      console.error(`Errore lazy loading tab ${target}:`, err);
    }
  }
}

// ─────────────────────────────────────────────
// 2. Badge dinamici (NC aperte, verbali)
// ─────────────────────────────────────────────
async function aggiornaBadgeDashboard() {
  try {
    const nc      = await getNCList();
    const verbali = await getVerbaliForCurrentProject();

    const aperte     = nc.filter(n => n.stato === 'aperta');
    const gravissime = nc.filter(n => n.livello === 'gravissima' && n.stato === 'aperta');

    const badgeNC         = document.getElementById('badge-nc');
    const badgeGravissime = document.getElementById('badge-gravissime');
    const badgeVerbali    = document.getElementById('badge-verbali');

    if (badgeNC)         { badgeNC.textContent         = aperte.length;     badgeNC.setAttribute('aria-label',         `${aperte.length} NC aperte`); }
    if (badgeGravissime) { badgeGravissime.textContent  = gravissime.length; badgeGravissime.setAttribute('aria-label', `${gravissime.length} NC gravissime`); }
    if (badgeVerbali)    { badgeVerbali.textContent     = verbali.length;    badgeVerbali.setAttribute('aria-label',    `${verbali.length} verbali`); }
  } catch (err) {
    console.warn('aggiornaBadgeDashboard:', err);
  }
}

// ─────────────────────────────────────────────
// 3. Filtri NC
// ─────────────────────────────────────────────
async function filtraNC(tipo) {
  const container = document.getElementById('nc-list');
  if (!container) return;

  let list = await getNCList();

  switch (tipo) {
    case 'aperte':     list = list.filter(n => n.stato === 'aperta');                            break;
    case 'chiuse':     list = list.filter(n => n.stato === 'chiusa');                            break;
    case 'gravissime': list = list.filter(n => (n.livello || '') === 'gravissima');               break;
    // 'tutte' → no filter
  }

  if (list.length === 0) {
    container.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">
      Nessuna NC corrisponde al filtro selezionato.
    </p>`;
    return;
  }

  container.innerHTML = list.map(nc => renderNCCard(nc)).join('');

  for (const nc of list) {
    try { await renderFotoNC(`foto-${nc.id}`, nc.id); } catch (_) {}
  }
}

// ─────────────────────────────────────────────
// 4. Inizializzazione UI Dashboard
//    NOTA: initDashboardTabs(), aggiornaBadgeDashboard()
//    e i filtri NC vengono attivati dal DOMContentLoaded
//    inline di dashboard-cantiere.html (unico punto).
//    Questo file espone solo le funzioni.
// ─────────────────────────────────────────────
