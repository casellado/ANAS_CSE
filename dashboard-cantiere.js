// dashboard-cantiere.js - KPI e logiche cantiere ANAS SafeHub

// ─────────────────────────────────────────────
// 1. Recupera NC del cantiere corrente
// ─────────────────────────────────────────────
async function getNCForCurrentProject() {
  if (!window.appState?.currentProject) return [];
  return await getByIndex('nc', 'projectId', window.appState.currentProject);
}

// ─────────────────────────────────────────────
// 2. Calcolo KPI principali
// ─────────────────────────────────────────────
async function calcolaKPI() {
  const ncList = await getNCForCurrentProject();

  if (!ncList || ncList.length === 0) {
    return { aperte: 0, gravissime: 0, scadute: 0, tempoMedio: 0, score: 100 };
  }

  const aperte      = ncList.filter(n => n.stato !== 'chiusa');
  const gravissime  = aperte.filter(n => n.livello === 'gravissima');
  const scadute     = aperte.filter(n => n.dataScadenza && new Date(n.dataScadenza) < new Date());
  const chiuse      = ncList.filter(n => n.stato === 'chiusa');

  let tempoMedio = 0;
  if (chiuse.length > 0) {
    const totMs  = chiuse.reduce((acc, n) => {
      if (!n.dataApertura || !n.dataChiusura) return acc;
      return acc + (new Date(n.dataChiusura) - new Date(n.dataApertura));
    }, 0);
    tempoMedio = Math.round(totMs / chiuse.length / (1000 * 60 * 60)); // ore
  }

  const score = Math.max(0, 100 - (aperte.length * 10 + gravissime.length * 20));

  return {
    aperte:     aperte.length,
    gravissime: gravissime.length,
    scadute:    scadute.length,
    tempoMedio,
    score
  };
}

// ─────────────────────────────────────────────
// 3. Rendering KPI nella dashboard
// ─────────────────────────────────────────────
async function renderKPI() {
  const kpi = await calcolaKPI();

  const map = {
    'kpi-nc-aperte': kpi.aperte,
    'kpi-gravissime': kpi.gravissime,
    'kpi-scadute':    kpi.scadute,
    'kpi-tempo':      kpi.tempoMedio + 'h',
    'kpi-score':      kpi.score + '%'
  };

  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // Mostra alert ANAS per gravissime (con animazione pulse)
  const alertEl = document.getElementById('alert-gravissime');
  if (alertEl) {
    const hasGravissime = kpi.gravissime > 0;
    alertEl.classList.toggle('hidden', !hasGravissime);
    alertEl.classList.toggle('alert-pulse', hasGravissime);
  }
}

// ─────────────────────────────────────────────
// NOTA: enterProject NON viene sovrascritto qui.
// Su dashboard-cantiere.html non ha senso — l'utente
// è già dentro il cantiere. La navigazione è gestita
// solo da navigation.js su index.html.
// ─────────────────────────────────────────────
