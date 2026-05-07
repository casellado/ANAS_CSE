// settings-sync.js — Sincronizzazione impostazioni condivise ANAS SafeHub
// Geom. Dogano Casella · CSE ANAS SpA Calabria

/**
 * Avvia il monitoraggio delle impostazioni condivise su OneDrive.
 * Se rileva una modifica esterna, aggiorna la cache locale e notifica l'utente.
 */
let _lastSettingsMtime = null;
let _settingsPollingTimer = null;

async function avviaSyncImpostazioni() {
  if (typeof isArchivioOneDriveAttivo !== 'function') return;
  const attivo = await isArchivioOneDriveAttivo();
  if (!attivo) return;

  console.info('[SettingsSync] Avvio monitoraggio impostazioni condivise...');
  
  // Primo controllo
  _lastSettingsMtime = await _getSettingsMtime();

  if (_settingsPollingTimer) clearInterval(_settingsPollingTimer);
  _settingsPollingTimer = setInterval(async () => {
    if (document.hidden) return; // risparmia risorse se tab non attiva

    const currentMtime = await _getSettingsMtime();
    if (currentMtime && _lastSettingsMtime && currentMtime !== _lastSettingsMtime) {
      console.info('[SettingsSync] Rilevata modifica esterna alle impostazioni condivise.');
      _lastSettingsMtime = currentMtime;
      
      // Notifica l'utente (toast non bloccante)
      if (typeof mostraToast === 'function') {
        mostraToast('☁️ Impostazioni condivise aggiornate da un altro tecnico.', 'info');
      }
      
      // Invalida cache in memoria (se presente in ui.js o altri moduli)
      if (typeof window.invalidaCacheImpostazioni === 'function') {
        window.invalidaCacheImpostazioni();
      }
      
      // Se siamo nella pagina impostazioni, ricarica il form
      if (typeof renderFormImpostazioni === 'function' && document.getElementById('form-impostazioni')) {
        renderFormImpostazioni();
      }
    }
  }, 120000); // Ogni 2 minuti
}

async function _getSettingsMtime() {
  if (typeof getLastModifiedSettings !== 'function') return null;
  try {
    return await getLastModifiedSettings();
  } catch (_) {
    return null;
  }
}

/**
 * Salva le impostazioni locali e le propaga su OneDrive se attivo.
 */
async function salvaImpostazioniGlobali(nuoveImpostazioni) {
  // 1. Salva localmente in IndexedDB
  await salvaItem('impostazioni', { id: IMPOSTAZIONI_KEY, data: nuoveImpostazioni });

  // 2. Propaga su OneDrive se attivo
  if (typeof isArchivioOneDriveAttivo === 'function' && await isArchivioOneDriveAttivo()) {
    if (typeof salvaImpostazioniCondivise === 'function') {
      await salvaImpostazioniCondivise(nuoveImpostazioni);
    }
  }
  
  showToast('Impostazioni salvate e sincronizzate ✓', 'success');
}

// Esporta su window
window.avviaSyncImpostazioni = avviaSyncImpostazioni;
window.salvaImpostazioniGlobali = salvaImpostazioniGlobali;
