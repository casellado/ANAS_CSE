// app.js - Bootstrap principale ANAS SafeHub (USB-first / GitHub Pages)

window.appState = {
  currentProject: null,
  projectName:    null
};

(async function startApp() {
  try {
    await initDB();

    // Prova a caricare automaticamente data/database.json
    const autoLoaded = await tryLoadDatabaseJsonFromDataFolder();

    if (!autoLoaded) {
      const existing = await getAll('projects');

      if (!existing || existing.length === 0) {
        // Dati di esempio per avvio immediato
        const seedProjects = [
          {
            id:        'CZ399',
            nome:      'Manutenzione Viadotto S. Giorgio',
            loc:       'S.S. 106 Jonica · KM 42+000',
            status:    'warning',
            createdAt: new Date().toISOString()
          },
          {
            id:        'AN202',
            nome:      'Galleria San Francesco',
            loc:       'A2 Autostrada del Mediterraneo · KM 88+500',
            status:    'ok',
            createdAt: new Date().toISOString()
          }
        ];
        for (const p of seedProjects) {
          await saveItem('projects', p);
        }
      }
    }

    wireUI();
    await refreshProjectsGrid();

  } catch (err) {
    console.error('Errore durante l\'inizializzazione:', err);
    showToast('Errore durante l\'avvio: ' + err, 'error');
  }
})();
