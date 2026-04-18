// verbali.js - Gestione Verbali di Sopralluogo ANAS SafeHub

// ─────────────────────────────────────────────
// 1. ID univoco
// ─────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// ─────────────────────────────────────────────
// 2. Salvataggio verbale
// ─────────────────────────────────────────────
async function salvaVerbale(event) {
  if (event) event.preventDefault();

  if (!window.appState?.currentProject) {
    showToast('Errore: nessun cantiere selezionato.', 'error');
    return;
  }

  // Validazione: oggetto obbligatorio (data ha fallback automatico)
  const dataVal = (document.getElementById('verbale-data')?.value || '').trim();
  if (!dataVal) {
    // usa data odierna silenziosamente — già gestito sotto
  }

  // Validazione minima: oggetto del sopralluogo
  const oggettoVal = (document.getElementById('verbale-oggetto')?.value || '').trim();
  if (!oggettoVal) {
    showToast("Inserisci almeno l'oggetto del sopralluogo.", 'warning');
    document.getElementById('verbale-oggetto')?.focus();
    return;
  }

  // Recupera imprese presenti (select multiple)
  const impreseSelect = document.getElementById('verbale-imprese');
  const impresePresenti = impreseSelect
    ? Array.from(impreseSelect.selectedOptions).map(o => o.value)
    : [];

  // Recupera firma (se presente)
  const firmaData = window._firmaCorrente || null;

  const verbale = {
    id:              generateId('verb'),
    tipo:            'sopralluogo',
    projectId:       window.appState.currentProject,
    data:            document.getElementById('verbale-data')?.value        || new Date().toISOString().slice(0, 10),
    km:              document.getElementById('verbale-km')?.value          || '',
    meteo:           document.getElementById('verbale-meteo')?.value       || '',
    impresePresenti,
    referenti:       document.getElementById('verbale-referenti')?.value   || '',
    statoLuoghi:     document.getElementById('verbale-stato-luoghi')?.value || '',
    note:            document.getElementById('verbale-note')?.value        || '',
    oggetto:         document.getElementById('verbale-oggetto')?.value     || '',
    firma:           firmaData ? firmaData.png       : null,
    firmaTimestamp:  firmaData ? firmaData.timestamp : null,
    firmante:        firmaData ? firmaData.firmante  : 'Geom. Dogano Casella — CSE',
    createdAt:       new Date().toISOString()
  };

  await saveItem('verbali', verbale);

  // Genera NC automatica se selezionato livello
  const livelloNC    = document.getElementById('livello-nc')?.value      || '';
  const descrizioneNC = document.getElementById('descrizione-nc')?.value || '';

  if (livelloNC && livelloNC !== '') {
    await generaNCdaVerbale(verbale.projectId, livelloNC, descrizioneNC, verbale);
  }

  showToast('Verbale salvato correttamente ✓', 'success');
  if (typeof showCheckmark === 'function') showCheckmark();
  document.getElementById('form-verbale')?.reset();

  // Resetta la firma dopo il salvataggio — il prossimo verbale
  // deve avere una firma fresca, non ereditare quella precedente
  window._firmaCorrente = null;
  // Se la firma canvas è presente, la ripristina visivamente
  if (typeof renderFirmaCanvas === 'function') {
    const container = document.getElementById('firma-verbale-container');
    if (container) {
      renderFirmaCanvas('firma-verbale-container', (firmaData) => {
        window._firmaCorrente = firmaData;
      });
    }
  }

  // Aggiorna badge e lista se siamo nella dashboard
  if (typeof aggiornaBadgeDashboard === 'function') aggiornaBadgeDashboard();
}

// ─────────────────────────────────────────────
// 3. Genera NC automatica dal verbale
// ─────────────────────────────────────────────
async function generaNCdaVerbale(projectId, livello, descrizione, verbale) {
  const nc = {
    id:           generateId('nc'),
    projectId,
    titolo:       `NC da Verbale del ${verbale.data}`,
    livello,
    descrizione,
    stato:        'aperta',
    dataApertura: verbale.data ? new Date(verbale.data).toISOString() : new Date().toISOString(),
    dataScadenza: calcolaScadenzaNC(livello, verbale.data || new Date().toISOString()),
    verbaleId:    verbale.id,
    createdAt:    new Date().toISOString()
  };

  await saveItem('nc', nc);
  showToast(`NC ${livello.toUpperCase()} generata automaticamente ✓`, 'warning');
  console.info('NC generata automaticamente:', nc);
}

// ─────────────────────────────────────────────
// 4. calcolaScadenzaNC (se non già definita da nc.js)
//    Usa var per evitare SyntaxError in strict mode
//    con function declaration dentro if() block
// ─────────────────────────────────────────────
if (typeof calcolaScadenzaNC === 'undefined') {
  var calcolaScadenzaNC = function(livello, dataApertura) {
    const apertura = new Date(dataApertura || new Date());
    switch (livello) {
      case 'gravissima': apertura.setHours(apertura.getHours() + 24); break;
      case 'grave':      apertura.setDate(apertura.getDate() + 3);    break;
      default:           apertura.setDate(apertura.getDate() + 7);    break;
    }
    return apertura.toISOString();
  };
}

// ─────────────────────────────────────────────
// 5. Selezione livello NC nella UI verbale
// ─────────────────────────────────────────────
function selezionaNC(livello) {
  const bottoni = document.querySelectorAll('.nc-btn');

  bottoni.forEach(btn => {
    btn.classList.remove(
      'bg-blue-200', 'text-blue-800',
      'bg-orange-200', 'text-orange-800',
      'bg-red-200', 'text-red-800',
      'ring-2'
    );
  });

  const btnAttivo = document.getElementById(`btn-nc-${livello}`);
  if (!btnAttivo) return;

  const colori = {
    lieve:     ['bg-blue-200',   'text-blue-800'],
    grave:     ['bg-orange-200', 'text-orange-800'],
    gravissima:['bg-red-200',    'text-red-800']
  };
  (colori[livello] || []).forEach(cls => btnAttivo.classList.add(cls));
  btnAttivo.classList.add('ring-2');

  const livellaEl = document.getElementById('livello-nc');
  if (livellaEl) livellaEl.value = livello;

  // Template automatico descrizione
  const textArea = document.getElementById('descrizione-nc');
  if (!textArea) return;

  const templates = {
    lieve:      'Non conformità lieve riscontrata. Si richiede adeguamento entro 7 giorni.',
    grave:      'Non conformità grave riscontrata. Adeguamento obbligatorio entro 72 ore.',
    gravissima: 'Pericolo grave e imminente. Si richiede sospensione immediata delle lavorazioni e messa in sicurezza entro 24 ore.'
  };
  textArea.value = templates[livello] || '';
}

// ─────────────────────────────────────────────
// 6. Hook DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-verbale');
  if (form) {
    form.addEventListener('submit', salvaVerbale);
  }
});
