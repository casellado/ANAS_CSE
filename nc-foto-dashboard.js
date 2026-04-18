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
      <div class="text-center py-10 text-slate-400">
        <div class="text-4xl mb-2">✅</div>
        <p class="text-sm font-medium">Nessuna Non Conformità presente.</p>
        <p class="text-xs mt-1">Il cantiere è in regola.</p>
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
