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

  // MOD-20: Rendering Grafico Circolare (Safety Score)
  const chartContainer = document.getElementById('score-chart-container');
  if (chartContainer) {
    const color = kpi.score > 80 ? '#10b981' : (kpi.score > 50 ? '#f59e0b' : '#ef4444');
    chartContainer.innerHTML = `
      <div class="relative w-32 h-32 flex items-center justify-center">
        <svg class="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" class="text-slate-100" />
          <circle cx="64" cy="64" r="58" stroke="${color}" stroke-width="8" fill="transparent" 
                  stroke-dasharray="364.4" 
                  stroke-dashoffset="${364.4 - (364.4 * kpi.score / 100)}" 
                  stroke-linecap="round"
                  class="transition-all duration-1000 ease-out" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-black text-slate-800">${kpi.score}%</span>
          <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Safety Score</span>
        </div>
      </div>
    `;
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
// 4. MOD-6: Attività Recente (Audit Collaboration)
// ─────────────────────────────────────────────
async function renderAttivitaRecente() {
  const container = document.getElementById('attivita-list');
  if (!container) return;

  const projectId = window.appState?.currentProject;
  if (!projectId) return;

  try {
    // Recupera tutto del cantiere (NC e Verbali)
    const ncList = await getNCForCurrentProject();
    const verList = await getVerbaliForCurrentProject();

    // Appiattisce in un unico stream cronologico
    const all = [
      ...ncList.map(x => ({ ...x, _tipo: 'nc' })),
      ...verList.map(x => ({ ...x, _tipo: 'verbale' }))
    ];

    // Ordina per data modifica (o creazione) discendente
    all.sort((a, b) => {
      const da = new Date(a.modifiedAt || a.updatedAt || a.createdAt || 0);
      const db = new Date(b.modifiedAt || b.updatedAt || b.createdAt || 0);
      return db - da;
    });

    const ultime = all.slice(0, 5);

    if (ultime.length === 0) {
      container.innerHTML = `<div class="py-2 text-slate-400 text-xs italic">Nessuna attività registrata.</div>`;
      return;
    }

    container.innerHTML = ultime.map(item => {
      const ts = item.modifiedAt || item.updatedAt || item.createdAt;
      const tempo = (typeof formatTempoRelativo === 'function') ? formatTempoRelativo(ts) : '';
      const autore = item.modifiedBy || 'Sistema';
      
      let icon = '📝';
      let desc = '';
      
      if (item._tipo === 'nc') {
        icon = '⚠️';
        desc = `NC: ${escapeHtml(item.oggetto || item.descrizione || 'Senza oggetto')}`;
      } else {
        icon = '📋';
        desc = `Verbale: ${escapeHtml(item.oggetto || 'Sopralluogo')}`;
      }

      return `
        <div class="py-2.5 flex items-start gap-3 group">
          <div class="mt-0.5 text-lg shrink-0">${icon}</div>
          <div class="flex-1 min-w-0">
            <div class="text-slate-700 font-medium truncate">${desc}</div>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span class="font-semibold text-slate-500">${escapeHtml(autore)}</span>
              <span>•</span>
              <span>${tempo}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn('[Dashboard] Errore attività:', err);
    container.innerHTML = `<div class="py-2 text-red-400 text-xs italic">Errore caricamento attività.</div>`;
  }
}

// ─────────────────────────────────────────────
// NOTA: enterProject NON viene sovrascritto qui.
// Su dashboard-cantiere.html non ha senso — l'utente
// è già dentro il cantiere. La navigazione è gestita
// solo da navigation.js su index.html.
// ─────────────────────────────────────────────
