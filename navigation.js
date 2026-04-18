// navigation.js - Routing inter-pagina ANAS SafeHub v1.3

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
// ─────────────────────────────────────────────
window.enterProject = function (id, nome) {
  window.appState = window.appState || {};
  window.appState.currentProject = id;
  window.appState.projectName    = nome;
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
  }

  if (openView) {
    sessionStorage.removeItem('cse_open_view');
    return openView;
  }
  return null;
}
