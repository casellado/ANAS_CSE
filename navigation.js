// navigation.js - Routing inter-pagina ANAS SafeHub v2.0

// ─────────────────────────────────────────────
// 1. Naviga alla Dashboard del cantiere
// ─────────────────────────────────────────────
function apriDashboardCantiere(projectId, projectName) {
  sessionStorage.setItem('currentProjectId',   projectId);
  sessionStorage.setItem('currentProjectName', projectName);
  window.location.href = 'dashboard-cantiere.html';
}

// ─────────────────────────────────────────────
// 2. Naviga alla Suite CSE (ANAS_CSE_html.html)
//    mantenendo il cantiere e aprendo la view giusta
// ─────────────────────────────────────────────
function apriSuiteCSE(viewId) {
  if (viewId) sessionStorage.setItem('cse_open_view', viewId);
  window.location.href = 'ANAS_CSE_html.html';
}

function nuovoVerbaleDaDashboard() { apriSuiteCSE('nuovo-verbale'); }
function nuovaNcDaDashboard()      { apriSuiteCSE('nc');            }

// ─────────────────────────────────────────────
// 3. Override enterProject (unico punto)
//    MOD-4: invalida cache OneDrive al cambio lotto
// ─────────────────────────────────────────────
window.enterProject = function (id, nome) {
  window.appState = window.appState || {};
  window.appState.currentProject = id;
  window.appState.projectName    = nome;

  // MOD-4: invalida cache del lotto e riavvia il polling
  if (typeof invalidaCacheLotto === 'function') invalidaCacheLotto(id);
  _avviaPollingModifiche(id);

  apriDashboardCantiere(id, nome);
};

// ─────────────────────────────────────────────
// 4. Ripristino stato Dashboard
// ─────────────────────────────────────────────
function ripristinaStatoDashboard() {
  const id   = sessionStorage.getItem('currentProjectId');
  const nome = sessionStorage.getItem('currentProjectName');

  if (!id) { window.location.href = 'index.html'; return false; }

  window.appState = { currentProject: id, projectName: nome || id };

  const subtitle = document.querySelector('.cantiere-nome');
  if (subtitle) subtitle.textContent = `Cantiere ${id} · ${nome || ''}`;

  // MOD-4: avvia polling sul lotto corrente
  _avviaPollingModifiche(id);

  return true;
}

// ─────────────────────────────────────────────
// 5. Ripristino stato Suite CSE
//    Ritorna la viewId da aprire (se presente)
// ─────────────────────────────────────────────
function ripristinaStatoSuiteCSE() {
  const projectId   = sessionStorage.getItem('currentProjectId');
  const projectName = sessionStorage.getItem('currentProjectName');
  const openView    = sessionStorage.getItem('cse_open_view');

  if (projectId) {
    window.appState = window.appState || {};
    window.appState.currentProject = projectId;
    window.appState.projectName    = projectName || projectId;

    // MOD-4: avvia polling sul lotto ripristinato
    _avviaPollingModifiche(projectId);
  }

  if (openView) {
    sessionStorage.removeItem('cse_open_view');
    return openView;
  }
  return null;
}

// ─────────────────────────────────────────────
// MOD-4: Polling modifiche esterne
//   Ogni 3 minuti controlla se il JSON del lotto
//   è cambiato rispetto all'ultima lettura.
//   Se sì, mostra toast non bloccante "Ricarica".
// ─────────────────────────────────────────────

const _POLLING_INTERVAL_MS = 60 * 1000; // 1 minuto (MOD-4)
let   _pollingTimer        = null;
let   _pollingLottoId      = null;
let   _pollingLastMtime    = null;

function _avviaPollingModifiche(lottoId) {
  _fermaPolling();

  if (!lottoId) return;

  // Avvia solo se OneDrive è attivo
  _verificaEAvviaPolling(lottoId);
}

async function _verificaEAvviaPolling(lottoId) {
  if (typeof isArchivioOneDriveAttivo !== 'function') return;
  const attivo = await isArchivioOneDriveAttivo();
  if (!attivo) return;

  _pollingLottoId   = lottoId;
  _pollingLastMtime = await _leggiMtime(lottoId);

  // Polling ogni 3 minuti, ma solo quando la tab è visibile
  _pollingTimer = setInterval(async () => {
    // Sospendi se la tab non è in primo piano (risparmia risorse)
    if (document.hidden) return;

    const mtimeCorrente = await _leggiMtime(lottoId);
    if (mtimeCorrente === null) return;

    if (_pollingLastMtime !== null && mtimeCorrente !== _pollingLastMtime) {
      // Rilevata modifica esterna!
      _pollingLastMtime = mtimeCorrente; // evita toast ripetuti

      if (typeof mostraToastModificheEsterne === 'function') {
        mostraToastModificheEsterne(() => {
          // Callback "Ricarica"
          if (typeof invalidaCacheLotto === 'function') invalidaCacheLotto(lottoId);
          // Ricarica la view corrente
          const view = Array.from(document.querySelectorAll('section.page-transition') || [])
            .find(el => !el.classList.contains('page-hidden'))?.id;
          if (typeof switchView === 'function') {
            switchView(view?.replace('view-', '') || 'hub');
          }
        });
      }
    } else {
      _pollingLastMtime = mtimeCorrente;
    }
  }, _POLLING_INTERVAL_MS);
}

async function _leggiMtime(lottoId) {
  if (typeof getLastModifiedLotto !== 'function') return null;
  try {
    return await getLastModifiedLotto(lottoId);
  } catch (_) {
    return null;
  }
}

function _fermaPolling() {
  if (_pollingTimer) {
    clearInterval(_pollingTimer);
    _pollingTimer     = null;
    _pollingLottoId   = null;
    _pollingLastMtime = null;
  }
}

// Ferma il polling quando si cambia pagina
window.addEventListener('beforeunload', _fermaPolling);
// Sospendi/riprendi in base alla visibilità della tab
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  // Tab tornata in focus: controlla subito (senza aspettare il prossimo tick)
  if (_pollingLottoId) {
    _leggiMtime(_pollingLottoId).then(mtime => {
      if (mtime !== null && _pollingLastMtime !== null && mtime !== _pollingLastMtime) {
        _pollingLastMtime = mtime;
        if (typeof mostraToastModificheEsterne === 'function') {
          mostraToastModificheEsterne(() => {
            if (typeof invalidaCacheLotto === 'function') invalidaCacheLotto(_pollingLottoId);
            if (typeof switchView === 'function') switchView('hub');
          });
        }
      }
    });
  }
});

