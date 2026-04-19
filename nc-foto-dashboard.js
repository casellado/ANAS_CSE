// nc-foto-dashboard.js - Integrazione NC + Foto nella dashboard cantiere

// ─────────────────────────────────────────────
// 1. Rendering NC con foto (usa renderNCCard da nc.js)
// ─────────────────────────────────────────────
async function renderNCListWithFoto(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = await getNCList();

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <h3 class="empty-state-title">Nessuna Non Conformità</h3>
        <p class="empty-state-desc">Il cantiere è in regola. Ottimo lavoro!</p>
        <button onclick="if(typeof apriSuiteCSE === 'function') apriSuiteCSE('nuova-nc')" class="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none transition mt-2">
          + Apri Nuova NC
        </button>
      </div>`;
    return;
  }

  // Usa renderNCCard (definita in nc.js) per uniformità
  container.innerHTML = list.map(nc => renderNCCard(nc)).join('');

  // Carica foto per ogni NC
  for (const nc of list) {
    try {
      await renderFotoNC(`foto-${nc.id}`, nc.id);
    } catch (_) { /* continua anche se le foto falliscono */ }
  }
}

// ─────────────────────────────────────────────
// 2. Hook automatico
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.pathname.includes('dashboard-cantiere.html')) return;
  // Il rendering viene avviato da dashboard-cantiere.html dopo ripristinaStatoDashboard
});
