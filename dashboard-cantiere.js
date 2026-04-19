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
// Animazione Count-Up per KPI (UX-I)
// ─────────────────────────────────────────────
function animateCountUp(el, targetStr, duration = 600) {
  // Estrai eventuale suffisso (es. "h", "%")
  const targetNum = parseInt(targetStr) || 0;
  const suffix = targetStr.toString().replace(/[0-9]/g, '');
  
  const startNum = parseInt(el.textContent) || 0;
  const range = targetNum - startNum;
  
  if (range === 0) {
    el.textContent = targetStr;
    return;
  }
  
  const startTime = performance.now();
  
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    
    el.textContent = Math.round(startNum + range * eased) + suffix;
    
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = targetStr; // fine
  }
  
  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────
// 3. Rendering KPI nella dashboard
// ─────────────────────────────────────────────
async function renderKPI() {
  const kpi = await calcolaKPI();

  const map = {
    'kpi-nc-aperte':  { val: kpi.aperte,       card: 'card-kpi-aperte',     severity: kpi.aperte > 0 ? 'warning' : 'ok' },
    'kpi-gravissime': { val: kpi.gravissime,   card: 'card-kpi-gravissime', severity: kpi.gravissime > 0 ? 'danger' : 'ok' },
    'kpi-scadute':    { val: kpi.scadute,      card: 'card-kpi-scadute',    severity: kpi.scadute > 0 ? 'danger' : 'ok' },
    'kpi-tempo':      { val: kpi.tempoMedio + 'h', card: 'card-kpi-tempo',  severity: 'info' },
    'kpi-score':      { val: kpi.score + '%',  card: 'card-kpi-score',      severity: kpi.score < 80 ? 'warning' : (kpi.score < 50 ? 'danger' : 'ok') }
  };

  for (const [id, data] of Object.entries(map)) {
    const el = document.getElementById(id);
    const cardEl = document.getElementById(data.card);
    
    if (el) {
      animateCountUp(el, data.val);
    }
    if (cardEl) {
      cardEl.setAttribute('data-severity', data.severity);
    }
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
