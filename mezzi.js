// ─────────────────────────────────────────────
// MODULO MEZZI E ATTREZZATURE (MOD-10)
// ─────────────────────────────────────────────

const TIPOLOGIE_MEZZI = [
  // 1. Sollevamento materiali (Allegato VII categoria SC)
  { id: 'gru-torre',          nome: 'Gru a torre',                      cat: 'SC', verifica: 12 },  // mesi
  { id: 'autogru',            nome: 'Autogru',                          cat: 'SC', verifica: 12 },
  { id: 'gru-mobile',         nome: 'Gru mobile',                       cat: 'SC', verifica: 12 },
  { id: 'gru-autocarro',      nome: 'Gru su autocarro',                 cat: 'SC', verifica: 12 },
  { id: 'argano-paranco',     nome: 'Argano / Paranco',                 cat: 'SC', verifica: 12 },
  { id: 'carrello-telescopico', nome: 'Carrello telescopico',           cat: 'SC', verifica: 12 },
  { id: 'carrello-elevatore', nome: 'Carrello elevatore (muletto)',     cat: 'SC', verifica: 12 },

  // 2. Sollevamento persone (Allegato VII categoria SP)
  { id: 'ple',                nome: 'Piattaforma di lavoro elevabile (PLE)', cat: 'SP', verifica: 12 },
  { id: 'ponte-sviluppabile', nome: 'Ponte sviluppabile su carro',       cat: 'SP', verifica: 12 },
  { id: 'ponte-sospeso',      nome: 'Ponte sospeso',                    cat: 'SP', verifica: 24 },
  { id: 'montacarichi-cantiere', nome: 'Montacarichi da cantiere',      cat: 'SP', verifica: 12 },
  { id: 'piattaforma-autosollevante', nome: 'Piattaforma autosollevante su colonne', cat: 'SP', verifica: 12 },

  // 3. Movimento terra
  { id: 'escavatore-cingoli', nome: 'Escavatore cingolato',             cat: 'MT', verifica: null },
  { id: 'escavatore-gomme',   nome: 'Escavatore gommato',               cat: 'MT', verifica: null },
  { id: 'pala-meccanica',     nome: 'Pala meccanica',                   cat: 'MT', verifica: null },
  { id: 'bulldozer',          nome: 'Bulldozer',                        cat: 'MT', verifica: null },
  { id: 'rullo-compressore',  nome: 'Rullo compressore',                cat: 'MT', verifica: null },
  { id: 'autobetoniera',      nome: 'Autobetoniera',                    cat: 'MT', verifica: null },
  { id: 'autocarro',          nome: 'Autocarro',                        cat: 'MT', verifica: null },

  // 4. Ponteggi e opere provvisionali
  { id: 'ponteggio-fisso',    nome: 'Ponteggio fisso',                  cat: 'OP', verifica: null },
  { id: 'ponteggio-tubogiunto', nome: 'Ponteggio tubo-giunto',          cat: 'OP', verifica: null },
  { id: 'trabattello',        nome: 'Trabattello',                      cat: 'OP', verifica: null },

  // 5. Attrezzature varie
  { id: 'compressore',        nome: 'Compressore d\'aria',              cat: 'AT', verifica: null },
  { id: 'gruppo-elettrogeno', nome: 'Gruppo elettrogeno',               cat: 'AT', verifica: null },
  { id: 'martello-demolitore', nome: 'Martello demolitore',             cat: 'AT', verifica: null },
  { id: 'sega-circolare',     nome: 'Sega circolare',                   cat: 'AT', verifica: null },
  { id: 'altro',              nome: 'Altro (specificare)',              cat: 'AT', verifica: null }
];

// ─────────────────────────────────────────────
// 1. API CRUD Base
// ─────────────────────────────────────────────

async function getMezziByProject(projectId) {
  const allMezzi = await getByIndex('mezzi', 'projectId', projectId);
  return allMezzi.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getMezziByImpresa(impresaId) {
  const allMezzi = await getByIndex('mezzi', 'impresaId', impresaId);
  return allMezzi.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getMezzo(mezzoId) {
  return await getItem('mezzi', mezzoId);
}

async function creaMezzo(projectId, dati) {
  const id = 'mezzo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const now = new Date().toISOString();
  
  const nomeAutore = await _getNomeTecnico();
  
  const nuovoMezzo = {
    id: id,
    projectId: projectId,
    impresaId: dati.impresaId || '',
    tipologia: dati.tipologia || 'altro',
    marca: dati.marca || '',
    modello: dati.modello || '',
    matricola: dati.matricola || '',
    numeroSerie: dati.numeroSerie || '',
    targa: dati.targa || '',
    annoFabbricazione: dati.annoFabbricazione || null,
    
    scadenzaVerificaPeriodica: dati.scadenzaVerificaPeriodica || '',
    enteVerificatore: dati.enteVerificatore || '',
    esitoUltimaVerifica: dati.esitoUltimaVerifica || '', // 'idoneo', 'con-prescrizioni', 'non-idoneo', 'non-comunicato'
    
    documentazioneConsegnata: {
      libretto: false,
      dichiarazioneCE: false,
      ultimaVerificaPeriodica: false,
      polizzaAssicurazione: false,
      nominaConducente: false,
      ...dati.documentazioneConsegnata
    },
    
    presenteInCantiere: dati.presenteInCantiere !== undefined ? dati.presenteInCantiere : true,
    dataPrimoIngresso: dati.dataPrimoIngresso || now.split('T')[0],
    dataUscita: dati.dataUscita || null,
    
    noteCSE: dati.noteCSE || '',
    
    createdAt: now,
    modifiedAt: now,
    modifiedBy: nomeAutore
  };

  await saveItem('mezzi', nuovoMezzo);
  return nuovoMezzo;
}

async function aggiornaMezzo(mezzoId, modifiche) {
  const mezzo = await getMezzo(mezzoId);
  if (!mezzo) throw new Error('Mezzo non trovato');
  
  const nomeAutore = await _getNomeTecnico();
  
  const aggiornato = {
    ...mezzo,
    ...modifiche,
    modifiedAt: new Date().toISOString(),
    modifiedBy: nomeAutore
  };
  
  // Assicurati che i campi nidificati (come documentazioneConsegnata) vengano mergiati correttamente se forniti parzialmente
  if (modifiche.documentazioneConsegnata) {
    aggiornato.documentazioneConsegnata = {
      ...mezzo.documentazioneConsegnata,
      ...modifiche.documentazioneConsegnata
    };
  }

  await saveItem('mezzi', aggiornato);
  return aggiornato;
}

async function rimuoviMezzo(mezzoId, projectId) {
  if (confirm('Sei sicuro di voler eliminare definitivamente questo mezzo? Questa operazione non eliminerà le foto e i documenti associati.')) {
    await deleteItem('mezzi', mezzoId);
    showToast('Mezzo eliminato.', 'success');
    if (typeof renderMezziCantiere === 'function') {
      renderMezziCantiere('mezzi-list-spa', projectId);
    }
  }
}

// ─────────────────────────────────────────────
// 2. Logica di Business
// ─────────────────────────────────────────────

function valutaConformitaDocumentale(mezzo) {
  const tipologia = TIPOLOGIE_MEZZI.find(t => t.id === mezzo.tipologia);
  const richiesti = [];
  const mancanze = [];

  // Tutti i mezzi devono avere libretto e CE
  richiesti.push('libretto', 'dichiarazioneCE');

  // Mezzi soggetti a verifica periodica devono avere ultima verifica
  if (tipologia && tipologia.verifica !== null) {
    richiesti.push('ultimaVerificaPeriodica');
  }

  // Veicoli su strada devono avere assicurazione
  if (['autogru', 'autocarro', 'autobetoniera', 'gru-autocarro'].includes(mezzo.tipologia)) {
    richiesti.push('polizzaAssicurazione');
  }

  // Mezzi che richiedono patentino (movimento terra, gru, PLE)
  if (['gru-torre', 'autogru', 'gru-mobile', 'ple', 'escavatore-cingoli',
       'escavatore-gomme', 'pala-meccanica', 'bulldozer', 'carrello-elevatore',
       'carrello-telescopico'].includes(mezzo.tipologia)) {
    richiesti.push('nominaConducente');
  }

  for (const req of richiesti) {
    if (!mezzo.documentazioneConsegnata || !mezzo.documentazioneConsegnata[req]) {
      mancanze.push(req);
    }
  }

  // Verifica scadenza
  if (mezzo.scadenzaVerificaPeriodica) {
    const oggi = new Date();
    // Azzera ore/minuti per confronto pulito sulla data
    oggi.setHours(0,0,0,0);
    const scadenza = new Date(mezzo.scadenzaVerificaPeriodica);
    scadenza.setHours(0,0,0,0);
    
    if (scadenza < oggi) {
      mancanze.push('verifica-periodica-scaduta');
    }
  } else if (tipologia && tipologia.verifica !== null) {
    // Se è richiesta ma non inserita
    if (!mancanze.includes('ultimaVerificaPeriodica')) {
      mancanze.push('ultimaVerificaPeriodica');
    }
  }

  return {
    conforme: mancanze.length === 0,
    mancanze,
    livello: mancanze.length === 0 ? 'ok' :
             mancanze.length <= 2 ? 'attenzione' : 'critico'
  };
}

function _descrivilManacanza(mancanza) {
  const map = {
    'libretto': 'Libretto d\'uso assente',
    'dichiarazioneCE': 'Dichiarazione CE assente',
    'ultimaVerificaPeriodica': 'Verbale verifica periodica assente',
    'polizzaAssicurazione': 'Polizza assicurativa assente',
    'nominaConducente': 'Nomina/Patentino conducente assente',
    'verifica-periodica-scaduta': 'Verifica periodica scaduta'
  };
  return map[mancanza] || mancanza;
}

async function generaNCdaMezzoNonConforme(mezzoId, projectId) {
  const mezzo = await getMezzo(mezzoId);
  const conformita = valutaConformitaDocumentale(mezzo);
  
  if (conformita.conforme) {
    showToast('Il mezzo è conforme, nessuna NC necessaria.', 'info');
    return;
  }

  const tipologia = TIPOLOGIE_MEZZI.find(t => t.id === mezzo.tipologia) || { nome: 'Altro' };
  const impresa = await getItem('imprese', mezzo.impresaId);

  const livelloNC = conformita.mancanze.includes('verifica-periodica-scaduta')
    ? 'gravissima'
    : conformita.mancanze.length >= 3 ? 'grave' : 'media';

  if (typeof nuovaNC !== 'function') {
    showToast('Errore: modulo NC non caricato', 'error');
    return;
  }

  // Chiamata fittizia a nuovaNC() pre-esistente nel sistema o si istanzia a mano?
  // Normalmente nuovaNC(tipo) restituisce un oggetto vuoto preformattato.
  let nc;
  try {
    nc = await nuovaNC('nc'); // da nc.js
  } catch(e) {
    // Fallback se nuovaNC è asincrona in modo diverso
    const now = new Date().toISOString();
    nc = {
      id: 'nc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      projectId: projectId,
      tipoEmissione: 'nc',
      createdAt: now,
      modifiedAt: now
    };
  }
  
  nc.projectId = projectId;
  nc.titolo = `Documentazione mezzo ${tipologia.nome} non conforme`;
  
  const strMancanze = conformita.mancanze.map(m => '- ' + _descrivilManacanza(m)).join('\n');
  
  nc.descrizione = `In sopralluogo è stato riscontrato il seguente mezzo:
  
- Tipologia: ${tipologia.nome}
- Marca/Modello: ${mezzo.marca} ${mezzo.modello}
- Matricola/Serie: ${mezzo.matricola || mezzo.numeroSerie || 'non riportata'}
- Impresa proprietaria: ${impresa?.ragioneSociale || 'sconosciuta'}

Documentazione mancante o non conforme:
${strMancanze}

Si richiede all'impresa ${impresa?.ragioneSociale || ''} di produrre la documentazione 
mancante entro i termini previsti dalla normativa. Il presente mezzo non è idoneo all'uso fino a regolarizzazione.`;

  nc.livello = livelloNC;
  nc.stato = 'aperta';
  nc.mezzoId = mezzoId; // collegamento bidirezionale
  nc.assegnatario = mezzo.impresaId; // FK per filtro in dashboard
  nc.dataApertura = new Date().toISOString().split('T')[0];
  
  await saveItem('nc', nc);
  showToast(`NC ${livelloNC} generata automaticamente`, 'success');
  
  if (typeof renderNC === 'function') {
    // Opzionale: rimanda alla vista NC per confermarla/inviarla
    switchView('nc');
  }
}

// ─────────────────────────────────────────────
// 3. Funzioni di Render UI
// ─────────────────────────────────────────────

async function renderMezziCantiere(containerId, projectId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '<div class="text-center p-4"><div class="spinner border-t-blue-600 border-4 rounded-full w-8 h-8 mx-auto animate-spin"></div></div>';
  
  try {
    const mezzi = await getMezziByProject(projectId);
    
    // Filtri
    const filterButtons = document.querySelectorAll('.filter-mezzo');
    let currentFilter = 'tutti';
    filterButtons.forEach(btn => {
      if (btn.classList.contains('active')) {
        currentFilter = btn.getAttribute('data-filter');
      }
    });
    
    const oggi = new Date();
    oggi.setHours(0,0,0,0);
    const tra30Giorni = new Date(oggi);
    tra30Giorni.setDate(tra30Giorni.getDate() + 30);
    
    let conformiCount = 0;
    
    const mezziFiltrati = mezzi.filter(m => {
      const conf = valutaConformitaDocumentale(m);
      if (conf.conforme) conformiCount++;
      
      if (currentFilter === 'non-conformi' && conf.conforme) return false;
      if (currentFilter === 'presenti' && !m.presenteInCantiere) return false;
      if (currentFilter === 'scadenza-vicina') {
        if (!m.scadenzaVerificaPeriodica) return false;
        const scadenza = new Date(m.scadenzaVerificaPeriodica);
        if (scadenza > tra30Giorni) return false;
      }
      return true;
    });
    
    // Aggiorna Banner Conformità
    const banner = document.getElementById('mezzi-banner-conformita');
    if (banner) {
      if (mezzi.length === 0) {
        banner.innerHTML = `
          <div class="bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-200 text-sm">
            Nessun mezzo registrato in questo cantiere.
          </div>`;
      } else if (conformiCount === mezzi.length) {
        banner.innerHTML = `
          <div class="bg-green-50 text-green-800 p-3 rounded-xl border border-green-200 text-sm flex items-center gap-2">
            <span>✅</span> Tutti i ${mezzi.length} mezzi riscontrati sono conformi.
          </div>`;
      } else {
        banner.innerHTML = `
          <div class="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-sm flex items-center gap-2">
            <span>⚠️</span> Attenzione: ${mezzi.length - conformiCount} mezzi su ${mezzi.length} non risultano conformi (documentazione mancante o scaduta).
          </div>`;
      }
    }
    
    if (mezziFiltrati.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div class="text-4xl mb-2">🚜</div>
          <p>Nessun mezzo corrisponde ai filtri selezionati.</p>
        </div>`;
      return;
    }
    
    // Fetch anagrafica imprese per i nomi
    const impreseMap = {};
    const tutteImprese = await getAll('imprese');
    tutteImprese.forEach(i => impreseMap[i.id] = i.ragioneSociale);
    
    let html = '';
    for (const m of mezziFiltrati) {
      const tipologia = TIPOLOGIE_MEZZI.find(t => t.id === m.tipologia) || { nome: 'Altro' };
      const conf = valutaConformitaDocumentale(m);
      
      let badgeStato = '';
      if (!m.presenteInCantiere) {
        badgeStato = '<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">Non in cantiere</span>';
      } else if (conf.conforme) {
        badgeStato = '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold border border-emerald-200">✅ Conforme</span>';
      } else if (conf.livello === 'critico' || conf.mancanze.includes('verifica-periodica-scaduta')) {
        badgeStato = '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold border border-red-200">🔴 Non Conforme (Critico)</span>';
      } else {
        badgeStato = '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold border border-amber-200">⚠️ Incompleto</span>';
      }
      
      html += `
        <div class="bg-white rounded-2xl p-4 shadow-sm border ${conf.conforme ? 'border-slate-200' : 'border-amber-300'} hover:shadow-md transition cursor-pointer"
             onclick="mostraModalDettaglioMezzo('${m.id}')" role="button" tabindex="0">
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="text-xs text-slate-500 font-medium mb-1">${escapeHtml(impreseMap[m.impresaId] || 'Impresa sconosciuta')}</div>
              <h4 class="font-bold text-slate-800 text-lg leading-tight">
                ${escapeHtml(tipologia.nome)}
              </h4>
              <div class="text-sm text-slate-600">
                ${escapeHtml(m.marca)} ${escapeHtml(m.modello)}
              </div>
            </div>
            <div>${badgeStato}</div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div class="bg-slate-50 p-2 rounded border border-slate-100">
              <span class="text-slate-400 block mb-0.5">Matricola / Serie</span>
              <span class="font-medium text-slate-700">${escapeHtml(m.matricola || m.numeroSerie || 'N/D')}</span>
            </div>
            <div class="bg-slate-50 p-2 rounded border border-slate-100">
              <span class="text-slate-400 block mb-0.5">Prossima Verifica</span>
              <span class="font-medium text-slate-700">${m.scadenzaVerificaPeriodica ? formattaData(m.scadenzaVerificaPeriodica) : (tipologia.verifica === null ? 'N/A' : 'Mancante')}</span>
            </div>
          </div>
          
          ${!conf.conforme ? `
            <div class="mt-3 p-2 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
              <strong>Mancanze:</strong> ${conf.mancanze.map(x => _descrivilManacanza(x)).join(', ')}
            </div>
            <div class="mt-2 flex gap-2 justify-end" onclick="event.stopPropagation()">
              <button onclick="generaNCdaMezzoNonConforme('${m.id}', '${m.projectId}')" 
                      class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                🚨 Genera NC
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    container.innerHTML = html;
    
  } catch (err) {
    console.error('Errore render mezzi:', err);
    container.innerHTML = '<div class="text-red-500 p-4">Errore caricamento mezzi.</div>';
  }
}

// Gestione filtri view
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-mezzo')) {
      const container = e.target.closest('.flex');
      if (container) {
        container.querySelectorAll('.filter-mezzo').forEach(btn => btn.classList.remove('active', 'bg-slate-800', 'text-white'));
        container.querySelectorAll('.filter-mezzo').forEach(btn => btn.classList.add('bg-slate-100', 'text-slate-700'));
        
        e.target.classList.add('active', 'bg-slate-800', 'text-white');
        e.target.classList.remove('bg-slate-100', 'text-slate-700');
        
        if (window.appState && window.appState.currentProject) {
          renderMezziCantiere('mezzi-list-spa', window.appState.currentProject);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────
// 4. Modal Nuovo / Modifica
// ─────────────────────────────────────────────

async function mostraModalNuovoMezzo(projectId) {
  if (!projectId) {
    showToast('Seleziona prima un cantiere', 'warning');
    return;
  }
  
  // Ottieni imprese del cantiere
  const impreseAssegnate = await getByIndex('imprese_cantieri', 'projectId', projectId);
  const selectImpreseHtml = await Promise.all(impreseAssegnate.map(async (assoc) => {
    const imp = await getItem('imprese', assoc.impresaId);
    return `<option value="${imp ? imp.id : ''}">${escapeHtml(imp ? imp.ragioneSociale : 'Sconosciuta')}</option>`;
  })).then(opts => opts.join(''));
  
  const selectTipologieHtml = TIPOLOGIE_MEZZI.map(t => 
    `<option value="${t.id}">${escapeHtml(t.nome)} (Cat. ${t.cat})</option>`
  ).join('');
  
  const modalHtml = `
    <div id="modal-nuovo-mezzo" class="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 opacity-0 transition-opacity">
      <div class="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl transform translate-y-full sm:translate-y-0 transition-transform duration-300">
        <div class="p-4 border-b flex justify-between items-center bg-slate-50 sm:rounded-t-2xl rounded-t-2xl">
          <h3 class="text-lg font-bold text-slate-800">🚜 Nuovo Mezzo Riscontrato</h3>
          <button onclick="document.getElementById('modal-nuovo-mezzo').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300">✕</button>
        </div>
        
        <div class="p-4 overflow-y-auto flex-1 space-y-4">
          <p class="text-xs text-slate-500">Inserimento rapido dati identificativi. La documentazione completa potrà essere compilata in seguito.</p>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Tipologia Mezzo *</label>
            <select id="nm-tipologia" class="w-full border-slate-300 rounded-xl bg-slate-50" required>
              <option value="" disabled selected>-- Seleziona --</option>
              ${selectTipologieHtml}
            </select>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Impresa Proprietaria *</label>
            <select id="nm-impresa" class="w-full border-slate-300 rounded-xl bg-slate-50" required>
              <option value="" disabled selected>-- Seleziona impresa in cantiere --</option>
              ${selectImpreseHtml}
            </select>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Marca</label>
              <input type="text" id="nm-marca" class="w-full border-slate-300 rounded-xl" placeholder="Es. Liebherr">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Modello</label>
              <input type="text" id="nm-modello" class="w-full border-slate-300 rounded-xl" placeholder="Es. 110 EC-B">
            </div>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Matricola / INAIL</label>
            <input type="text" id="nm-matricola" class="w-full border-slate-300 rounded-xl" placeholder="Matricola per verbali/gru">
          </div>
          
          <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
            <div class="text-2xl">📸</div>
            <div class="flex-1">
              <div class="font-bold text-sm text-blue-900">Foto mezzo</div>
              <div class="text-xs text-blue-700">Potrai scattare foto dopo il salvataggio iniziale.</div>
            </div>
          </div>
        </div>
        
        <div class="p-4 border-t bg-white sm:rounded-b-2xl">
          <button id="nm-save-btn" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
            Salva e vai al Dettaglio →
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Animation
  requestAnimationFrame(() => {
    const m = document.getElementById('modal-nuovo-mezzo');
    m.classList.remove('opacity-0');
    m.children[0].classList.remove('translate-y-full');
  });
  
  document.getElementById('nm-save-btn').addEventListener('click', async () => {
    const tipologia = document.getElementById('nm-tipologia').value;
    const impresaId = document.getElementById('nm-impresa').value;
    
    if (!tipologia || !impresaId) {
      showToast('Compila tipologia e impresa.', 'warning');
      return;
    }
    
    const dati = {
      tipologia,
      impresaId,
      marca: document.getElementById('nm-marca').value.trim(),
      modello: document.getElementById('nm-modello').value.trim(),
      matricola: document.getElementById('nm-matricola').value.trim(),
      presenteInCantiere: true
    };
    
    document.getElementById('nm-save-btn').disabled = true;
    document.getElementById('nm-save-btn').innerText = 'Salvataggio...';
    
    try {
      const nuovoMezzo = await creaMezzo(projectId, dati);
      document.getElementById('modal-nuovo-mezzo').remove();
      showToast('Mezzo salvato in bozza.', 'success');
      
      // Aggiorna lista in background
      renderMezziCantiere('mezzi-list-spa', projectId);
      
      // Apri modale dettaglio per compilare il resto
      mostraModalDettaglioMezzo(nuovoMezzo.id);
    } catch (err) {
      console.error(err);
      showToast('Errore salvataggio: ' + err.message, 'error');
      document.getElementById('nm-save-btn').disabled = false;
      document.getElementById('nm-save-btn').innerText = 'Salva e vai al Dettaglio →';
    }
  });
}

// ─────────────────────────────────────────────
// 5. Modal Dettaglio / Edit Completo (Step 2)
// ─────────────────────────────────────────────

async function mostraModalDettaglioMezzo(mezzoId) {
  const mezzo = await getMezzo(mezzoId);
  if (!mezzo) return;
  
  const tipologia = TIPOLOGIE_MEZZI.find(t => t.id === mezzo.tipologia) || { nome: 'Altro' };
  const conf = valutaConformitaDocumentale(mezzo);
  
  // Imprese select html per poterla cambiare
  const impreseAssegnate = await getByIndex('imprese_cantieri', 'projectId', mezzo.projectId);
  const selectImpreseHtml = await Promise.all(impreseAssegnate.map(async (assoc) => {
    const imp = await getItem('imprese', assoc.impresaId);
    return `<option value="${imp ? imp.id : ''}" ${mezzo.impresaId === imp?.id ? 'selected' : ''}>${escapeHtml(imp ? imp.ragioneSociale : 'Sconosciuta')}</option>`;
  })).then(opts => opts.join(''));
  
  const docHtml = (id, label, icon) => `
    <label class="flex items-center gap-2 p-2 border rounded-lg ${mezzo.documentazioneConsegnata[id] ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-600'} cursor-pointer hover:bg-slate-100 transition">
      <input type="checkbox" id="doc-${id}" class="rounded text-blue-600" ${mezzo.documentazioneConsegnata[id] ? 'checked' : ''}>
      <span class="text-sm font-medium">${icon} ${label}</span>
    </label>
  `;
  
  const modalHtml = `
    <div id="modal-dettaglio-mezzo" class="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-2 sm:p-4 opacity-0 transition-opacity">
      <div class="bg-white w-full max-w-3xl h-[95vh] sm:h-[85vh] rounded-2xl flex flex-col shadow-2xl transform scale-95 transition-transform duration-300">
        
        <!-- Header -->
        <div class="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <div>
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              🚜 Scheda Mezzo
            </h3>
            <div class="text-xs text-slate-500">ID: ${mezzo.id.split('_')[2]} · Inserito il ${formattaDataOra(mezzo.createdAt)}</div>
          </div>
          <button onclick="document.getElementById('modal-dettaglio-mezzo').remove(); renderMezziCantiere('mezzi-list-spa', '${mezzo.projectId}');" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300">✕</button>
        </div>
        
        <!-- Body scrollabile -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          
          <!-- Banner conformità interno -->
          ${conf.conforme 
            ? `<div class="bg-green-100 text-green-800 p-3 rounded-xl border border-green-200 flex items-center gap-2 font-medium">✅ Documentazione conforme ai requisiti minimi.</div>`
            : `<div class="bg-amber-100 text-amber-800 p-3 rounded-xl border border-amber-200 flex flex-col gap-1">
                 <div class="font-bold flex items-center gap-2">⚠️ Documentazione incompleta o scaduta</div>
                 <ul class="text-sm ml-6 list-disc">${conf.mancanze.map(m => `<li>${_descrivilManacanza(m)}</li>`).join('')}</ul>
               </div>`
          }

          <!-- Grid Anagrafica -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h4 class="font-bold border-b pb-2 text-slate-700">Dati Identificativi</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Tipologia</label>
                <div class="px-3 py-2 bg-slate-100 rounded-lg text-sm border text-slate-600">${escapeHtml(tipologia.nome)}</div>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Impresa Proprietaria</label>
                <select id="edit-impresa" class="w-full border-slate-300 rounded-lg text-sm bg-slate-50">
                  ${selectImpreseHtml}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Marca</label>
                <input type="text" id="edit-marca" value="${escapeHtml(mezzo.marca)}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Modello</label>
                <input type="text" id="edit-modello" value="${escapeHtml(mezzo.modello)}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Matricola / INAIL</label>
                <input type="text" id="edit-matricola" value="${escapeHtml(mezzo.matricola)}" class="w-full border-slate-300 rounded-lg text-sm font-mono">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Numero di Serie (Fabbricante)</label>
                <input type="text" id="edit-serie" value="${escapeHtml(mezzo.numeroSerie)}" class="w-full border-slate-300 rounded-lg text-sm font-mono">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Anno Fabbricazione</label>
                <input type="number" id="edit-anno" value="${mezzo.annoFabbricazione || ''}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Targa (se veicolo)</label>
                <input type="text" id="edit-targa" value="${escapeHtml(mezzo.targa)}" class="w-full border-slate-300 rounded-lg text-sm font-mono uppercase">
              </div>
            </div>
          </div>
          
          <!-- Verifiche Periodiche -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h4 class="font-bold border-b pb-2 text-slate-700 flex justify-between">
              <span>Verifiche Periodiche</span>
              <span class="text-xs font-normal bg-slate-100 px-2 py-0.5 rounded">${tipologia.verifica ? 'Richiesta ogni ' + tipologia.verifica + ' mesi' : 'Non soggetta a verifiche Allegato VII'}</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Scadenza Prossima Verifica</label>
                <input type="date" id="edit-scadenza" value="${mezzo.scadenzaVerificaPeriodica}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Esito Ultima Verifica</label>
                <select id="edit-esito" class="w-full border-slate-300 rounded-lg text-sm bg-slate-50">
                  <option value="" ${!mezzo.esitoUltimaVerifica ? 'selected' : ''}>-- Non comunicato --</option>
                  <option value="idoneo" ${mezzo.esitoUltimaVerifica === 'idoneo' ? 'selected' : ''}>Idoneo all'uso</option>
                  <option value="con-prescrizioni" ${mezzo.esitoUltimaVerifica === 'con-prescrizioni' ? 'selected' : ''}>Idoneo con prescrizioni</option>
                  <option value="non-idoneo" ${mezzo.esitoUltimaVerifica === 'non-idoneo' ? 'selected' : ''}>Non idoneo / Sospeso</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-slate-700 mb-1">Ente Verificatore (es. ASL, INAIL, Soggetto Privato)</label>
                <input type="text" id="edit-ente" value="${escapeHtml(mezzo.enteVerificatore)}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
            </div>
          </div>

          <!-- Check Documentazione -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h4 class="font-bold border-b pb-2 text-slate-700">Documentazione Fornita</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${docHtml('libretto', 'Libretto Uso e Manutenzione', '📘')}
              ${docHtml('dichiarazioneCE', 'Dichiarazione CE', '🇪🇺')}
              ${docHtml('ultimaVerificaPeriodica', 'Verbale Ultima Verifica', '📝')}
              ${docHtml('polizzaAssicurazione', 'Polizza RC / Assicurazione', '🛡️')}
              ${docHtml('nominaConducente', 'Nomina / Patentino Conduttore', '🧑‍✈️')}
            </div>
          </div>
          
          <!-- Presenza e Note -->
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div class="flex items-center justify-between border-b pb-2">
              <h4 class="font-bold text-slate-700">Presenza in Cantiere</h4>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="edit-presente" class="sr-only peer" ${mezzo.presenteInCantiere ? 'checked' : ''}>
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                <span class="ml-3 text-sm font-medium text-slate-900" id="label-presente">${mezzo.presenteInCantiere ? 'Attualmente Operativo' : 'Uscito dal Cantiere'}</span>
              </label>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Data Ingresso</label>
                <input type="date" id="edit-ingresso" value="${mezzo.dataPrimoIngresso || ''}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Data Uscita (opzionale)</label>
                <input type="date" id="edit-uscita" value="${mezzo.dataUscita || ''}" class="w-full border-slate-300 rounded-lg text-sm">
              </div>
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Note del CSE (Rilievi visivi, stato conservazione)</label>
              <textarea id="edit-note" rows="3" class="w-full border-slate-300 rounded-lg text-sm">${escapeHtml(mezzo.noteCSE)}</textarea>
            </div>
          </div>
          
          <!-- Integrazione Foto/File (Riferimenti UI, la logica usa i moduli esistenti) -->
          <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div class="flex-1">
              <div class="font-bold text-blue-900">Allegati e Foto</div>
              <div class="text-xs text-blue-800">Scatta foto o allega PDF. Verranno salvati in <code>07_Mezzi_Attrezzature</code>.</div>
            </div>
            <div class="flex gap-2">
              <button class="bg-white text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50 transition"
                      onclick="if(typeof _mostraMenuFotoMobile === 'function') _mostraMenuFotoMobile('${mezzo.id}')">
                📸 Aggiungi Foto
              </button>
              <!-- Il bottone Allega PDF usa il gestore documenti esistente -->
              <button class="bg-white text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50 transition"
                      onclick="alert('Funzione Caricamento PDF (MOD-9) disponibile tramite la scheda Documenti del Cantiere.')">
                📎 Allega PDF
              </button>
            </div>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div class="p-4 border-t flex justify-between bg-white rounded-b-2xl shrink-0">
          <button class="text-red-600 hover:text-red-800 font-medium px-3 py-2 text-sm rounded-lg hover:bg-red-50 transition"
                  onclick="rimuoviMezzo('${mezzo.id}', '${mezzo.projectId}'); document.getElementById('modal-dettaglio-mezzo').remove();">
            Elimina
          </button>
          <div class="flex gap-2">
            <button class="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                    onclick="document.getElementById('modal-dettaglio-mezzo').remove(); renderMezziCantiere('mezzi-list-spa', '${mezzo.projectId}');">
              Annulla
            </button>
            <button id="btn-save-edit-mezzo" class="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition">
              Salva Modifiche
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Animation
  requestAnimationFrame(() => {
    const m = document.getElementById('modal-dettaglio-mezzo');
    m.classList.remove('opacity-0');
    m.children[0].classList.remove('scale-95');
  });
  
  // Gestione toggle label switch
  const switchPres = document.getElementById('edit-presente');
  switchPres.addEventListener('change', (e) => {
    document.getElementById('label-presente').innerText = e.target.checked ? 'Attualmente Operativo' : 'Uscito dal Cantiere';
  });
  
  document.getElementById('btn-save-edit-mezzo').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-edit-mezzo');
    btn.disabled = true;
    btn.innerText = 'Salvataggio...';
    
    try {
      const doc = {
        libretto: document.getElementById('doc-libretto').checked,
        dichiarazioneCE: document.getElementById('doc-dichiarazioneCE').checked,
        ultimaVerificaPeriodica: document.getElementById('doc-ultimaVerificaPeriodica').checked,
        polizzaAssicurazione: document.getElementById('doc-polizzaAssicurazione').checked,
        nominaConducente: document.getElementById('doc-nominaConducente').checked
      };
      
      const modifiche = {
        impresaId: document.getElementById('edit-impresa').value,
        marca: document.getElementById('edit-marca').value.trim(),
        modello: document.getElementById('edit-modello').value.trim(),
        matricola: document.getElementById('edit-matricola').value.trim(),
        numeroSerie: document.getElementById('edit-serie').value.trim(),
        annoFabbricazione: document.getElementById('edit-anno').value,
        targa: document.getElementById('edit-targa').value.trim(),
        
        scadenzaVerificaPeriodica: document.getElementById('edit-scadenza').value,
        esitoUltimaVerifica: document.getElementById('edit-esito').value,
        enteVerificatore: document.getElementById('edit-ente').value.trim(),
        
        documentazioneConsegnata: doc,
        
        presenteInCantiere: document.getElementById('edit-presente').checked,
        dataPrimoIngresso: document.getElementById('edit-ingresso').value,
        dataUscita: document.getElementById('edit-uscita').value,
        noteCSE: document.getElementById('edit-note').value.trim()
      };
      
      await aggiornaMezzo(mezzo.id, modifiche);
      showToast('Modifiche salvate correttamente', 'success');
      
      document.getElementById('modal-dettaglio-mezzo').remove();
      renderMezziCantiere('mezzi-list-spa', mezzo.projectId);
      
    } catch (err) {
      console.error(err);
      showToast('Errore durante il salvataggio.', 'error');
      btn.disabled = false;
      btn.innerText = 'Riprova';
    }
  });
}

// Fine modulo mezzi.js
