/**
 * verbali-sopralluogo.js
 * Modulo per la gestione completa dei verbali di sopralluogo (CRUD + UI).
 * Pattern FASE 5.1-bis - Chiusura GAP Audit
 */

let currentVerbaleId = null;
let currentPresenti = []; // Lista locale di {personaId, nome, qualifica, impresa, origine, firmato, firmaBase64, rifiuto, noteRifiuto}
let currentNCDrafts = []; // Lista locale di {livello, scadenza, descrizione, impresaId}
let signatureCanvases = {}; // Mappa idPresente -> istanza SignatureCanvas

// Cache per renderNCDrafts: evita 2 query IDB ad ogni keystroke (Issue #8)
let _cachedImpreseVS = [];
let _cachedIsFinalizzatoVS = false;
// AbortController per il listener paste firma CSE (Issue #6)
let _pasteFirmaAC = null;

/**
 * Renderizza la lista dei verbali del cantiere corrente.
 */
async function renderVerbali() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const container = document.getElementById('view-verbali');
    if (!container) return;

    const listHtml = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 class="text-2xl font-bold text-slate-800 flex items-center gap-2"><span>📝</span> Verbali di Sopralluogo</h3>
            <div class="flex gap-2">
                <button onclick="apriVerbale()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2">
                    <span>+</span> Nuovo Sopralluogo
                </button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                        <th class="px-4 py-3">Numero</th>
                        <th class="px-4 py-3">Data</th>
                        <th class="px-4 py-3">Oggetto</th>
                        <th class="px-4 py-3 text-center">Stato</th>
                        <th class="px-4 py-3 text-right">Azioni</th>
                    </tr>
                </thead>
                <tbody id="verbali-tbody">
                    <tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 italic">Caricamento...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = listHtml;
    
    const tbody = document.getElementById('verbali-tbody');
    const verbali = await getByIndex('verbali', 'projectId', projectId);
    // Ordinamento DESC per data sopralluogo (più recente in cima)
    verbali.sort((a, b) => (b.dataSopralluogo || '').localeCompare(a.dataSopralluogo || ''));

    if (verbali.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-400">Nessun verbale emesso per questo cantiere.</td></tr>`;
        return;
    }

    tbody.innerHTML = verbali.map(v => {
        const nFoto = v.allegatiFoto?.length || 0;
        const isDelegato = v.redattoreInfo?.isDelegato;
        const vistoApposto = isDelegato && v.vistoTitolareNome != null;
        const badgeVisto = isDelegato
            ? (vistoApposto
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">✅ Vistato</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">⚠ Visto mancante</span>')
            : '';
        const badgeFoto = nFoto > 0
            ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">📷 ${nFoto}</span>`
            : '';
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-xs font-bold">${v.numeroProgressivo || 'BOZZA'}</td>
            <td class="px-4 py-3 text-sm">${v.dataSopralluogo ? new Date(v.dataSopralluogo + 'T00:00:00').toLocaleDateString('it-IT') : '-'}</td>
            <td class="px-4 py-3 text-sm font-semibold truncate max-w-xs">
                ${escapeHtml(v.oggetto || 'Senza oggetto')}
                <div class="flex gap-1 mt-1">${badgeFoto}${badgeVisto}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${v.stato === 'finalizzato' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                    ${v.stato}
                </span>
            </td>
            <td class="px-4 py-3 text-right space-x-1">
                <button onclick="apriVerbale('${v.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="${v.stato === 'finalizzato' ? 'Visualizza' : 'Modifica'}">✏️</button>
                <button onclick="mostraAnteprimaVerbale('${v.id}')" class="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Anteprima stampa">👁</button>
                ${v.stato === 'finalizzato' ? `<button onclick="_scaricaWordVerbaleById('${v.id}')" class="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Scarica Word">📄</button>` : ''}
                ${nFoto > 0 ? `<button onclick="scaricaAllegatiFotoVerbale('${v.id}')" class="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Scarica foto ZIP">🗜️</button>` : ''}
                <button onclick="eliminaVerbale('${v.id}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Elimina">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

async function checkTemplateAndNewVerbale() {
    apriVerbale();
}

/**
 * Form Editor Verbale
 */
async function apriVerbale(id = null) {
    currentVerbaleId = id || 'VS_' + Date.now();
    let verbale = id ? await getItem('verbali', id) : null;
    const projectId = sessionStorage.getItem('currentProjectId');
    const project = await getItem('projects', projectId);
    const impGlobal = await caricaImpostazioni();

    if (!verbale) {
        verbale = {
            id: currentVerbaleId,
            projectId: projectId,
            tipo: 'sopralluogo',
            numeroProgressivo: '',
            stato: 'bozza',
            dataSopralluogo: new Date().toISOString().split('T')[0],
            oggetto: 'Sopralluogo di coordinamento e controllo',
            condizioniMeteo: 'soleggiato',
            progressivaChilometrica: { inizio: '', fine: '' },
            statoLuoghi: '',
            notePrescrizioni: '',
            impresePresentiIds: [],
            presenti: [],
            ncDrafts: [],
            ncCollegateIds: [],
            includiTabellaMezzi: false,
            redattoreInfo: {
                isDelegato: false,
                nomeRedattore: impGlobal.firmaNome || 'CSE',
                qualifica: impGlobal.firmaQualifica || 'CSE',
                firmaBase64: impGlobal.firmaImmagine || null,
                attoDelegaRiferimento: '',
                timestampFirma: null
            }
        };
    }

    currentPresenti = [...(verbale.presenti || [])];
    currentNCDrafts = [...(verbale.ncDrafts || [])];
    signatureCanvases = {};

    const isFinalizzato = verbale.stato === 'finalizzato';

    // Popola cache per renderNCDrafts (evita query IDB ad ogni keystroke)
    _cachedIsFinalizzatoVS = isFinalizzato;
    _cachedImpreseVS = await getByIndex('imprese', 'projectId', projectId);

    const existing = document.getElementById('modal-editor-verbale');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-editor-verbale';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex flex-col p-2 md:p-8';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
            <header class="bg-slate-800 text-white p-4 md:p-6 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-4">
                    <span class="text-3xl">📝</span>
                    <div>
                        <h3 class="text-xl font-bold">${id ? 'Modifica Verbale' : 'Nuovo Sopralluogo'}</h3>
                        <div class="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">
                            ${escapeHtml(project.nome)} · ID: ${escapeHtml(String(currentVerbaleId))} · ${verbale.stato}
                        </div>
                    </div>
                </div>
                <button onclick="_chiudiModalEditorVerbale()" class="text-2xl hover:text-red-400 transition">&times;</button>
            </header>

            <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50">
                
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 1. Dati Generali
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
                            <input type="date" id="v-data" value="${verbale.dataSopralluogo}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Oggetto</label>
                            <input type="text" id="v-oggetto" value="${escapeHtml(verbale.oggetto)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Meteo</label>
                            <select id="v-meteo" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm">
                                <option value="soleggiato" ${verbale.condizioniMeteo === 'soleggiato' ? 'selected' : ''}>Soleggiato</option>
                                <option value="nuvoloso" ${verbale.condizioniMeteo === 'nuvoloso' ? 'selected' : ''}>Nuvoloso</option>
                                <option value="pioggia" ${verbale.condizioniMeteo === 'pioggia' ? 'selected' : ''}>Pioggia</option>
                                <option value="neve" ${verbale.condizioniMeteo === 'neve' ? 'selected' : ''}>Neve</option>
                                <option value="vento" ${verbale.condizioniMeteo === 'vento' ? 'selected' : ''}>Vento</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Progr. Inizio</label>
                            <input type="text" id="v-prog-inizio" value="${escapeHtml(verbale.progressivaChilometrica.inizio)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm" placeholder="es. km 42+150">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Progr. Fine</label>
                            <input type="text" id="v-prog-fine" value="${escapeHtml(verbale.progressivaChilometrica.fine)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm" placeholder="es. km 42+850">
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 2. Esito Ispezione
                    </h4>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stato dei Luoghi e Verifiche</label>
                            <textarea id="v-stato-luoghi" rows="4" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-300" placeholder="Descrivi cosa hai verificato...">${escapeHtml(verbale.statoLuoghi)}</textarea>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Note e Prescrizioni</label>
                            <textarea id="v-note-prescrizioni" rows="3" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-300" placeholder="Inserisci eventuali prescrizioni...">${escapeHtml(verbale.notePrescrizioni)}</textarea>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div class="flex justify-between items-center mb-6">
                        <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                            <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 3. Presenti e Firme
                        </h4>
                        ${!isFinalizzato ? `
                        <button onclick="mostraModalAggiungiPresente()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition">
                            + AGGIUNGI PRESENTE
                        </button>` : ''}
                    </div>
                    <div id="presenti-container" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                </div>

                <!-- GAP 1: Sezione NC Dinamica -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                            <span class="w-2 h-2 bg-red-600 rounded-full"></span> 4. Non Conformità (NC)
                        </h4>
                        ${!isFinalizzato ? `
                        <button onclick="aggiungiNCAlVolo()" class="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-red-200 transition">
                            + NUOVA NC
                        </button>` : ''}
                    </div>
                    <div id="nc-drafts-container" class="space-y-4"></div>
                    ${!isFinalizzato ? `
                    <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                        <button data-verbale-id="${escapeHtml(String(currentVerbaleId))}" onclick="apriFormEventoDaVerbale(this.dataset.verbaleId)"
                                class="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-amber-200 transition">
                            + Registra Evento Incidentale
                        </button>
                    </div>` : ''}
                    <div id="ev-collegati-verbale-container" class="mt-4"></div>
                </div>

                <!-- GAP 4: Opzioni Allegati -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-slate-600 rounded-full"></span> 5. Allegati e Opzioni
                    </h4>
                    <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <input type="checkbox" id="v-opt-mezzi" ${verbale.includiTabellaMezzi ? 'checked' : ''} ${isFinalizzato ? 'disabled' : ''} class="w-5 h-5 rounded text-blue-600 focus:ring-blue-500">
                        <div>
                            <label for="v-opt-mezzi" class="text-sm font-bold text-slate-700">Includi Tabella Mezzi e Attrezzature</label>
                            <p class="text-[10px] text-slate-500">Compila il loop {#mezzi_attrezzature} nel template Word.</p>
                        </div>
                    </div>
                </div>

                <!-- GAP 8: Redattore e Delega -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 6. Redattore (CSE)
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Redattore</label>
                                <input type="text" id="v-cse-nome" value="${escapeHtml(verbale.redattoreInfo.nomeRedattore)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualifica</label>
                                <input type="text" id="v-cse-qualifica" value="${escapeHtml(verbale.redattoreInfo.qualifica)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm">
                            </div>
                            <div class="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                                <input type="checkbox" id="v-cse-delegato" ${verbale.redattoreInfo.isDelegato ? 'checked' : ''} ${isFinalizzato ? 'disabled' : ''} onchange="toggleDelegaUI(this.checked)" class="w-4 h-4 rounded text-orange-600">
                                <label for="v-cse-delegato" class="text-xs font-bold text-orange-700">Redatto da Delegato</label>
                            </div>
                            <div id="delega-ui" class="${verbale.redattoreInfo.isDelegato ? '' : 'hidden'}">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Atto delega di riferimento</label>
                                <input type="text" id="v-cse-atto" value="${escapeHtml(verbale.redattoreInfo.attoDelegaRiferimento || '')}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm" placeholder="es. Atto n. 123 del ...">
                            </div>
                        </div>
                        <div class="space-y-4">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-2 text-center">Firma Digitale</label>
                            <div id="cse-signature-box" class="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden">
                                ${verbale.redattoreInfo.firmaBase64 ? `<img src="${verbale.redattoreInfo.firmaBase64}" class="max-h-full">` : '<span class="text-[10px] text-slate-400">Nessuna firma</span>'}
                            </div>
                            ${!isFinalizzato ? `
                            <div class="flex flex-wrap gap-2 justify-center">
                                <button onclick="inizializzaFirmaCSE()" class="text-[10px] font-bold text-blue-600 hover:underline">✍️ Canvas</button>
                                <button onclick="abilitaPasteFirmaCSE()" class="text-[10px] font-bold text-indigo-600 hover:underline">📋 Incolla (GAP 7)</button>
                                <button onclick="usaFirmaPermanenteCSE()" class="text-[10px] font-bold text-green-600 hover:underline">🌟 Permanente</button>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

                <!-- FASE 5.1-bis: Sezione Allegati Foto -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-slate-600 rounded-full"></span> 7. Allegati Fotografici
                    </h4>
                    <p class="text-xs text-slate-400 mb-3">Le foto NON entrano nel Word — scaricabili come ZIP separato. Max 20 foto / 5 MB cad.</p>
                    ${!isFinalizzato ? `
                    <label class="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition mb-3"
                           ondragover="event.preventDefault()" ondrop="handleFotoDropVS(event)">
                        <input type="file" accept="image/*" multiple onchange="handleFotoUploadVS(this.files)" class="hidden">
                        <span class="text-slate-400 text-sm">📷 Trascina qui o clicca per selezionare</span>
                    </label>` : ''}
                    <div id="vs-lista-allegati-foto"></div>
                </div>

                <!-- FASE 5.1-bis: Visto CSE Titolare (solo se Delegato) -->
                <div id="vs-visto-titolare-section" class="${verbale.redattoreInfo?.isDelegato ? '' : 'hidden'} bg-white rounded-2xl border border-amber-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span class="w-2 h-2 bg-amber-500 rounded-full"></span> 8. Visto CSE Titolare (opzionale)
                    </h4>
                    <p class="text-xs text-slate-500 mb-4">ℹ Il visto è opzionale e può essere apposto in qualsiasi momento, anche dopo la finalizzazione.</p>
                    ${verbale.vistoTitolareNome ? `
                    <div class="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                        <span class="text-green-600 text-xl">✅</span>
                        <div>
                            <p class="font-bold text-green-700 text-sm">Visto apposto il ${new Date(verbale.vistoTitolareTimestamp).toLocaleString('it-IT')}</p>
                            <p class="text-slate-600 text-xs">${escapeHtml(verbale.vistoTitolareNome)}</p>
                        </div>
                        ${verbale.vistoTitolareFirma ? `<img src="${verbale.vistoTitolareFirma}" class="h-10 border border-slate-200 rounded p-0.5 bg-white ml-auto" alt="Visto">` : ''}
                    </div>` : `
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1">Nome CSE Titolare</label>
                            <input type="text" id="vs-visto-nome" placeholder="Nome e Cognome CSE Titolare"
                                   class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-2">Firma Titolare</label>
                            <div class="flex gap-2 mb-2 flex-wrap">
                                <button onclick="inizializzaFirmaVistoTitolare()" class="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-600">✏️ Disegna</button>
                                <button onclick="usaFirmaPermanenteVisto()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">✓ Permanente</button>
                                <button onclick="abilitaPasteFirmaVisto()" class="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300">📋 Incolla</button>
                            </div>
                            <div id="vs-visto-firma-canvas-container"></div>
                            <div id="vs-visto-firma-paste-area" class="hidden">
                                <textarea placeholder="Incolla qui l'immagine firma (Ctrl+V)…"
                                          class="w-full h-20 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                                          onpaste="handlePasteFirmaVisto(event)"></textarea>
                            </div>
                            <div id="vs-visto-firma-preview"></div>
                        </div>
                        <button onclick="confermaVistoTitolare()" class="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-600 transition">
                            ✅ Applica Visto
                        </button>
                    </div>`}
                </div>

            </div>

            <footer class="bg-slate-50 p-6 border-t flex justify-between items-center shrink-0">
                <button onclick="_chiudiModalEditorVerbale()" class="text-sm font-bold text-slate-500 hover:text-slate-700">Annulla</button>
                <div class="flex gap-3">
                    ${!isFinalizzato ? `<button onclick="salvaVerbale('bozza')" class="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition">Salva Bozza</button>` : ''}
                    <button onclick="mostraAnteprimaVerbale(${id ? `'${id}'` : 'null'})" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-indigo-700 transition">
                        👁 Anteprima
                    </button>
                    <button onclick="eseguiFinalizzazione()" class="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                        <span>💾</span> ${isFinalizzato ? 'Scarica Word' : 'Finalizza e Scarica'}
                    </button>
                </div>
            </footer>
        </div>
    `;

    document.body.appendChild(modal);
    // Inizializza stato allegati foto dal verbale salvato
    window._vsAllegatiFoto = verbale.allegatiFoto ? verbale.allegatiFoto.map(f => ({...f})) : [];
    window._vsVistoFirma = null;
    window._vsVistoCanvases = {};
    renderPresenti();
    renderNCDrafts();
    renderAllegatiFotoVS();
    if (typeof _renderEvCollegatiVerbale === 'function') _renderEvCollegatiVerbale(currentVerbaleId);
}

/**
 * Gestione UI
 */
function toggleDelegaUI(checked) {
    document.getElementById('delega-ui').classList.toggle('hidden', !checked);
    document.getElementById('vs-visto-titolare-section')?.classList.toggle('hidden', !checked);
}

// Visto Titolare — firma nel form
function inizializzaFirmaVistoTitolare() {
    const container = document.getElementById('vs-visto-firma-canvas-container');
    if (!container) return;
    container.innerHTML = `
    <div class="border border-slate-200 rounded-xl overflow-hidden mb-2">
        <div id="vs-visto-canvas-wrap"></div>
        <button onclick="confermaFirmaVistoCanvas()" class="w-full bg-blue-600 text-white py-2 text-xs font-bold hover:bg-blue-700">✓ Conferma</button>
    </div>`;
    window._vsVistoCanvases = window._vsVistoCanvases || {};
    window._vsVistoCanvases['visto'] = new SignatureCanvas('vs-visto-canvas-wrap', { width: 400, height: 120 });
}
function confermaFirmaVistoCanvas() {
    const sc = window._vsVistoCanvases?.['visto'];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast('Firma vuota.', 'warning'); return; }
    window._vsVistoFirma = b64;
    _aggiornaPreviewFirmaVisto(b64);
    showToast('Firma visto acquisita ✓', 'success');
}
async function usaFirmaPermanenteVisto() {
    const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => null) : null;
    const firma = imp?.firmaImmagine || null;
    if (!firma) { showToast('Nessuna firma permanente in Impostazioni.', 'warning'); return; }
    window._vsVistoFirma = firma;
    _aggiornaPreviewFirmaVisto(firma);
    showToast('Firma permanente caricata ✓', 'success');
}
function abilitaPasteFirmaVisto() {
    const area = document.getElementById('vs-visto-firma-paste-area');
    if (area) { area.classList.remove('hidden'); area.querySelector('textarea')?.focus(); }
}
function handlePasteFirmaVisto(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = e => {
                window._vsVistoFirma = e.target.result;
                _aggiornaPreviewFirmaVisto(e.target.result);
                document.getElementById('vs-visto-firma-paste-area')?.classList.add('hidden');
                showToast('Firma incollata ✓', 'success');
            };
            reader.readAsDataURL(file);
            break;
        }
    }
}
function _aggiornaPreviewFirmaVisto(dataUrl) {
    const p = document.getElementById('vs-visto-firma-preview');
    if (p) p.innerHTML = `<img src="${dataUrl}" class="h-14 border border-slate-200 rounded-lg p-1 mt-2" alt="Firma Visto">`;
}
async function confermaVistoTitolare() {
    const nome = document.getElementById('vs-visto-nome')?.value?.trim();
    if (!nome) { showToast('Inserisci il nome del CSE Titolare.', 'warning'); return; }
    if (!window._vsVistoFirma) { showToast('Apponi la firma del CSE Titolare.', 'warning'); return; }
    const verbaleId = currentVerbaleId;
    if (!verbaleId) { showToast('Salva prima il verbale.', 'warning'); return; }
    await applicaVistoTitolare(verbaleId, { nome, firmaBase64: window._vsVistoFirma });
    // Ricarica il form per mostrare il visto apposto
    apriVerbale(verbaleId);
}

window.toggleDelegaUI              = toggleDelegaUI;
window.inizializzaFirmaVistoTitolare = inizializzaFirmaVistoTitolare;
window.confermaFirmaVistoCanvas    = confermaFirmaVistoCanvas;
window.usaFirmaPermanenteVisto     = usaFirmaPermanenteVisto;
window.abilitaPasteFirmaVisto      = abilitaPasteFirmaVisto;
window.handlePasteFirmaVisto       = handlePasteFirmaVisto;
window.confermaVistoTitolare       = confermaVistoTitolare;

/**
 * GAP 1: Logica NC Dinamica
 */
async function aggiungiNCAlVolo() {
    currentNCDrafts.push({
        idDraft: 'NC_D_' + Date.now(),
        livello: 'media',
        descrizione: '',
        impresaId: '',
        scadenza: calcolaScadenzaNC(new Date().toISOString().split('T')[0], 'media')
    });
    renderNCDrafts();
}

function calcolaScadenzaNC(dataPartenza, livello) {
    const d = new Date(dataPartenza);
    if (livello === 'gravissima') d.setHours(d.getHours() + 24);
    else if (livello === 'grave') d.setDate(d.getDate() + 7);
    else if (livello === 'media') d.setDate(d.getDate() + 15);
    else if (livello === 'lieve') d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
}

async function renderNCDrafts() {
    const container = document.getElementById('nc-drafts-container');
    if (!container) return;

    // Usa cache popolata all'apertura del modal (evita 2 query IDB ad ogni keystroke)
    const imprese = _cachedImpreseVS;
    const isFinalizzato = _cachedIsFinalizzatoVS;

    container.innerHTML = currentNCDrafts.map((nc, idx) => `
        <div class="p-4 border border-red-100 rounded-xl bg-red-50/30 space-y-3 relative group">
            ${!isFinalizzato ? `<button onclick="rimuoviNCDraft(${idx})" class="absolute top-2 right-2 text-red-400 hover:text-red-600">&times;</button>` : ''}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-[9px] font-bold text-red-500 uppercase mb-1">Livello</label>
                    <select onchange="updateNCDraft(${idx}, 'livello', this.value)" ${isFinalizzato ? 'disabled' : ''} class="w-full border-red-100 rounded-lg p-2 text-xs">
                        <option value="gravissima" ${nc.livello === 'gravissima' ? 'selected' : ''}>GRAVISSIMA (+24h)</option>
                        <option value="grave" ${nc.livello === 'grave' ? 'selected' : ''}>GRAVE (+7gg)</option>
                        <option value="media" ${nc.livello === 'media' ? 'selected' : ''}>MEDIA (+15gg)</option>
                        <option value="lieve" ${nc.livello === 'lieve' ? 'selected' : ''}>LIEVE (+30gg)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[9px] font-bold text-red-500 uppercase mb-1">Impresa Responsabile</label>
                    <select onchange="updateNCDraft(${idx}, 'impresaId', this.value)" ${isFinalizzato ? 'disabled' : ''} class="w-full border-red-100 rounded-lg p-2 text-xs">
                        <option value="">-- Seleziona Impresa --</option>
                        ${imprese.map(i => `<option value="${i.id}" ${nc.impresaId === i.id ? 'selected' : ''}>${i.ragioneSociale}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-[9px] font-bold text-red-500 uppercase mb-1">Scadenza Prevista</label>
                    <div class="p-2 bg-white border border-red-100 rounded-lg text-xs font-bold text-red-700">${new Date(nc.scadenza).toLocaleDateString()}</div>
                </div>
            </div>
            <textarea placeholder="Descrizione della non conformità..." onchange="updateNCDraft(${idx}, 'descrizione', this.value)" ${isFinalizzato ? 'disabled' : ''} class="w-full border-red-100 rounded-lg p-2 text-xs h-16">${escapeHtml(nc.descrizione)}</textarea>
        </div>
    `).join('');
}

function updateNCDraft(idx, field, val) {
    currentNCDrafts[idx][field] = val;
    if (field === 'livello') {
        const dataVerbale = document.getElementById('v-data').value;
        currentNCDrafts[idx].scadenza = calcolaScadenzaNC(dataVerbale, val);
    }
    renderNCDrafts();
}

function rimuoviNCDraft(idx) {
    currentNCDrafts.splice(idx, 1);
    renderNCDrafts();
}

/**
 * GAP 7: Firma Paste
 */
function abilitaPasteFirmaCSE() {
    const box = document.getElementById('cse-signature-box');
    box.innerHTML = '<div class="text-[10px] text-indigo-500 animate-pulse">Premi Ctrl+V per incollare la firma...</div>';
    box.focus();

    // Annulla eventuale listener precedente orfano (Issue #6)
    if (_pasteFirmaAC) { _pasteFirmaAC.abort(); }
    _pasteFirmaAC = new AbortController();

    const onPaste = async (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    box.innerHTML = `<img src="${base64}" class="max-h-full">`;
                    window._lastPastedSignature = base64;
                    if (!window._verbaleEsistente) window._verbaleEsistente = {};
                    if (!window._verbaleEsistente.redattoreInfo) window._verbaleEsistente.redattoreInfo = {};
                    window._verbaleEsistente.redattoreInfo.firmaBase64 = base64;
                    showToast("Immagine incollata ✓", "success");
                    if (_pasteFirmaAC) { _pasteFirmaAC.abort(); _pasteFirmaAC = null; }
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    };

    document.addEventListener('paste', onPaste, { signal: _pasteFirmaAC.signal });
}

async function usaFirmaPermanenteCSE() {
    const imp = await caricaImpostazioni();
    if (imp.firmaImmagine) {
        document.getElementById('cse-signature-box').innerHTML = `<img src="${imp.firmaImmagine}" class="max-h-full">`;
        window._lastPastedSignature = imp.firmaImmagine;
        if (!window._verbaleEsistente) window._verbaleEsistente = {};
        if (!window._verbaleEsistente.redattoreInfo) window._verbaleEsistente.redattoreInfo = {};
        window._verbaleEsistente.redattoreInfo.firmaBase64 = imp.firmaImmagine;
        showToast("Firma permanente applicata", "info");
    } else {
        alert("Nessuna firma permanente trovata in Impostazioni.");
    }
}

/**
 * Finalizzazione (GAP 1, 5, 6)
 */
/**
 * Raccoglie i dati attuali dal form (senza salvare).
 */
function _raccogliDatiForm() {
    const verbaleEsistente_ref = window._verbaleEsistente || null;
    return {
        id: currentVerbaleId,
        projectId: sessionStorage.getItem('currentProjectId'),
        tipo: 'sopralluogo',
        dataSopralluogo: document.getElementById('v-data').value,
        oggetto: document.getElementById('v-oggetto').value,
        condizioniMeteo: document.getElementById('v-meteo').value,
        progressivaChilometrica: {
            inizio: document.getElementById('v-prog-inizio').value,
            fine: document.getElementById('v-prog-fine').value
        },
        statoLuoghi: document.getElementById('v-stato-luoghi').value,
        notePrescrizioni: document.getElementById('v-note-prescrizioni').value,
        presenti: currentPresenti,
        ncDrafts: currentNCDrafts,
        ncCollegateIds: verbaleEsistente_ref?.ncCollegateIds || [],
        impresePresentiIds: [...new Set(currentPresenti.map(p => p.impresaId).filter(id => id))],
        includiTabellaMezzi: document.getElementById('v-opt-mezzi')?.checked || false,
        redattoreInfo: {
            isDelegato: document.getElementById('v-cse-delegato')?.checked || false,
            nomeRedattore: document.getElementById('v-cse-nome').value,
            qualifica: document.getElementById('v-cse-qualifica').value,
            attoDelegaRiferimento: document.getElementById('v-cse-atto')?.value || '',
            firmaBase64: window._lastPastedSignature || verbaleEsistente_ref?.redattoreInfo?.firmaBase64 || null,
            timestampFirma: window._lastPastedSignature
                ? new Date().toISOString()
                : (verbaleEsistente_ref?.redattoreInfo?.timestampFirma || null)
        },
        allegatiFoto: window._vsAllegatiFoto || [],
        // Preserva visto titolare esistente (non sovrascrivere con il form)
        vistoTitolareNome: verbaleEsistente_ref?.vistoTitolareNome || null,
        vistoTitolareFirma: verbaleEsistente_ref?.vistoTitolareFirma || null,
        vistoTitolareTimestamp: verbaleEsistente_ref?.vistoTitolareTimestamp || null
    };
}

async function salvaVerbale(nuovoStato = 'bozza') {
    const verbaleEsistente = await getItem('verbali', currentVerbaleId);
    window._verbaleEsistente = verbaleEsistente;

    // Protezione: un finalizzato non può tornare a bozza
    if (verbaleEsistente && verbaleEsistente.stato === 'finalizzato' && nuovoStato !== 'finalizzato') {
        alert("Impossibile modificare un verbale finalizzato.");
        throw new Error('Finalizzato non modificabile');
    }

    // Acquisizione firme canvas prima di raccogliere i dati
    Object.keys(signatureCanvases).forEach(key => {
        const sign = signatureCanvases[key].toDataURL();
        if (sign) {
            if (key === 'cse') window._lastPastedSignature = sign;
            else {
                currentPresenti[key].firmaBase64 = sign;
                currentPresenti[key].firmato = true;
            }
        }
    });

    const item = { ...(_raccogliDatiForm()), stato: nuovoStato, modifiedAt: new Date().toISOString() };
    await saveItem('verbali', item);

    if (nuovoStato === 'bozza') {
        showToast("Bozza salvata ✓", "success");
        if (_pasteFirmaAC) { _pasteFirmaAC.abort(); _pasteFirmaAC = null; }
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    }
    return item;
}

async function eseguiFinalizzazione() {
    const verbaleEsistente = await getItem('verbali', currentVerbaleId);
    window._verbaleEsistente = verbaleEsistente;

    // Acquisizione firme canvas
    Object.keys(signatureCanvases).forEach(key => {
        const sign = signatureCanvases[key].toDataURL();
        if (sign) {
            if (key === 'cse') window._lastPastedSignature = sign;
            else {
                currentPresenti[key].firmaBase64 = sign;
                currentPresenti[key].firmato = true;
            }
        }
    });

    // Raccoglie dati dal form (senza salvare ancora)
    const dati = _raccogliDatiForm();

    // VALIDAZIONE prima di salvare
    const errori = [];
    if (!dati.dataSopralluogo) errori.push("Data sopralluogo");
    if (!dati.oggetto) errori.push("Oggetto");
    if (!dati.condizioniMeteo) errori.push("Condizioni meteo");
    if (!dati.statoLuoghi) errori.push("Stato dei luoghi");
    if (!dati.notePrescrizioni) errori.push("Note e prescrizioni");
    if (dati.presenti.length === 0) errori.push("Almeno un presente");
    if (!dati.impresePresentiIds || dati.impresePresentiIds.length === 0) errori.push("Almeno un'impresa presente");
    if (dati.redattoreInfo.isDelegato && !dati.redattoreInfo.attoDelegaRiferimento) errori.push("Atto di delega (obbligatorio se delegato)");
    if (!dati.redattoreInfo.firmaBase64) errori.push("Firma del redattore (CSE)");

    dati.presenti.forEach(p => {
        if (!p.firmaBase64 && !p.rifiuto) errori.push(`Firma di ${p.nome}`);
        if (p.rifiuto && !p.noteRifiuto) errori.push(`Motivo rifiuto di ${p.nome}`);
    });
    dati.ncDrafts.forEach((nc, i) => {
        if (!nc.descrizione || !nc.impresaId) errori.push(`Dettagli NC #${i+1} (descrizione e impresa)`);
    });

    if (errori.length > 0) {
        showToast("Errori: " + errori[0], "error", 5000);
        alert("ERRORE FINALIZZAZIONE. Campi mancanti:\n- " + errori.join("\n- "));
        return;
    }

    // Solo ora salva come finalizzato
    const _cantiereSnap = await getItem('projects', dati.projectId);
    const _snapshot = typeof risolviSnapshotRuoli === 'function' ? await risolviSnapshotRuoli(_cantiereSnap) : {};
    const verbale = { ...dati, ..._snapshot, stato: 'finalizzato', modifiedAt: new Date().toISOString() };
    await saveItem('verbali', verbale);

    // GAP 1: Creazione Record NC Reali
    const ncCreate = [];
    if (verbale.ncDrafts.length > 0 && verbale.ncCollegateIds.length === 0) {
        const dataPrefix = verbale.dataSopralluogo.replace(/-/g, '');
        for (let i = 0; i < verbale.ncDrafts.length; i++) {
            const draft = verbale.ncDrafts[i];
            const ncId = `nc_${Date.now()}_${i}`;
            const ncRecord = {
                id: ncId,
                projectId: verbale.projectId,
                verbaleOrigineId: verbale.id,
                numeroProgressivo: `${dataPrefix}/NC${String(i+1).padStart(2, '0')}`,
                data: verbale.dataSopralluogo,
                livello: draft.livello,
                scadenza: draft.scadenza,
                descrizione: draft.descrizione,
                impresaId: draft.impresaId,
                stato: 'aperta',
                createdAt: new Date().toISOString()
            };
            await saveItem('nc', ncRecord);
            ncCreate.push(ncRecord);
            verbale.ncCollegateIds.push(ncId);
        }
        await saveItem('verbali', verbale);
    }

    // Numerazione Progressiva
    if (!verbale.numeroProgressivo) {
        const dataPrefix = verbale.dataSopralluogo.replace(/-/g, '');
        const verbaliGiorno = await getByIndex('verbali', 'projectId', verbale.projectId);
        // max+1 anziché count+1: resistente alle lacune da cancellazioni (Issue #3)
        const numeri = verbaliGiorno
            .filter(v => v.dataSopralluogo === verbale.dataSopralluogo && v.stato === 'finalizzato' && v.numeroProgressivo)
            .map(v => parseInt((v.numeroProgressivo || '').replace(/\D/g, '')) || 0);
        const maxNum = Math.max(0, ...numeri);
        verbale.numeroProgressivo = `${dataPrefix}/VS${String(maxNum + 1).padStart(2, '0')}`;
        await saveItem('verbali', verbale);
    }

    // GAP 2, 3, 4: Mapping Dati per Word
    const cantiere = await getItem('projects', verbale.projectId);
    const imprese = await getByIndex('imprese', 'projectId', verbale.projectId);
    const mezziCantiere = verbale.includiTabellaMezzi ? await getByIndex('mezzi', 'projectId', verbale.projectId) : [];

    const dataWord = {
        ...verbale,
        numero_progressivo: verbale.numeroProgressivo,
        data_sopralluogo: new Date(verbale.dataSopralluogo).toLocaleDateString('it-IT'),
        codice_cantiere: cantiere?.id || cantiere?.codice || '-',
        nome_cantiere: cantiere?.nome || '-',
        condizioni_meteo: verbale.condizioniMeteo.toUpperCase(),
        progressiva_inizio: verbale.progressivaChilometrica.inizio,
        progressiva_fine: verbale.progressivaChilometrica.fine,
        stato_luoghi: verbale.statoLuoghi,
        note_prescrizioni: verbale.notePrescrizioni,
        
        imprese_presenti: Array.from(new Set(verbale.presenti.map(p => p.impresa))).map(impName => {
            const impObj = imprese.find(i => i.ragioneSociale === impName);
            return { ragione_sociale: impName, ruolo: impObj ? impObj.ruolo : 'Esecutrice' };
        }),
        
        referenti_presenti: verbale.presenti.map(p => ({
            nome_completo: p.nome,
            qualifica: p.qualifica,
            impresa: p.impresa
        })),

        mezzi_attrezzature: mezziCantiere.map(m => ({
            tipologia: m.tipologia,
            marca: m.marca,
            modello: m.modello,
            matricola: m.matricolaInail || m.targa || '-'
        })),

        non_conformita: ncCreate.map(nc => ({
            numero: nc.numeroProgressivo,
            livello: nc.livello.toUpperCase(),
            scadenza: new Date(nc.scadenza).toLocaleDateString('it-IT'),
            descrizione: nc.descrizione,
            impresa: imprese.find(i => i.id === nc.impresaId)?.ragioneSociale || '-'
        })),

        presenti_firme: verbale.presenti.map(p => ({
            nome_completo: p.nome,
            qualifica: p.qualifica,
            firma_image: p.firmaBase64,
            rifiutato: p.rifiuto ? 'SI' : 'NO',
            note_rifiuto: p.noteRifiuto || ''
        })),

        firma_cse: verbale.redattoreInfo.firmaBase64,
        nome_cse: verbale.redattoreInfo.nomeRedattore,
        ruolo_cse: verbale.redattoreInfo.qualifica,
        atto_delega: verbale.redattoreInfo.isDelegato ? verbale.redattoreInfo.attoDelegaRiferimento : '-',
        timestamp_firma_cse: verbale.redattoreInfo.timestampFirma ? new Date(verbale.redattoreInfo.timestampFirma).toLocaleString('it-IT') : '-',
        data_finalizzazione: new Date().toLocaleString('it-IT')
    };

    try {
        const wordBlob = await DocxGenerator.generate(dataWord);
        const fileName = `Verbale_Sopralluogo_${verbale.dataSopralluogo.replace(/-/g, '')}_${verbale.numeroProgressivo.replace(/\//g, '_')}.docx`;
        
        // GAP 5: Salvataggio OneDrive
        const oneDrivePath = await getItem('impostazioni', 'onedrive_path');
        if (oneDrivePath && oneDrivePath.valore) {
            try {
                // Assumiamo esistenza di salvaInOneDrive in app.js o globale
                if (typeof salvaInOneDrive === 'function') {
                    const cartella = `${oneDrivePath.valore}/Lotto_${verbale.projectId}/02_Verbali/Sopralluogo/`;
                    await salvaInOneDrive(cartella, fileName, wordBlob);
                }
            } catch (odErr) {
                console.warn("OneDrive fallito, scarico solo locale", odErr);
            }
        }

        const link = document.createElement('a');
        const _blobUrl834 = URL.createObjectURL(wordBlob);
        link.href = _blobUrl834;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(_blobUrl834), 2000);
        showToast("Verbale finalizzato con successo! ✓", "success");
        if (_pasteFirmaAC) { _pasteFirmaAC.abort(); _pasteFirmaAC = null; }
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    } catch (err) {
        console.error(err);
        alert("Errore generazione Word: " + err.message);
    }
}

/**
 * Utility
 */
function getImpresaNomeSync(id, listaImprese) {
    const imp = listaImprese.find(i => i.id === id);
    return imp ? imp.ragioneSociale : 'Impresa sconosciuta';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

async function eliminaVerbale(id) {
    if (!confirm("Vuoi eliminare definitivamente questo verbale?")) return;
    await deleteItem('verbali', id);
    renderVerbali();
}

// ─────────────────────────────────────────────
// RENDER PRESENTI
// Mostra la lista dei presenti nel form verbale.
// ─────────────────────────────────────────────
function renderPresenti() {
    const container = document.getElementById('presenti-container');
    if (!container) return;

    if (currentPresenti.length === 0) {
        container.innerHTML = `<div class="col-span-2 py-6 text-center text-[10px] text-slate-400 italic uppercase tracking-widest">Nessun presente aggiunto</div>`;
        return;
    }

    container.innerHTML = currentPresenti.map((p, idx) => `
        <div class="p-4 border border-slate-100 rounded-2xl bg-white space-y-3 relative">
            <button onclick="rimuoviPresente(${idx})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500 text-lg leading-none">&times;</button>
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">${p.nome.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="font-bold text-sm text-slate-800">${escapeHtml(p.nome)}</div>
                    <div class="text-[10px] text-slate-500">${escapeHtml(p.qualifica)} · ${escapeHtml(p.impresa || '-')}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="rifiuto-${idx}" ${p.rifiuto ? 'checked' : ''}
                       onchange="toggleRifiutoPresente(${idx}, this.checked)"
                       class="w-3.5 h-3.5 text-red-500">
                <label for="rifiuto-${idx}" class="text-[10px] text-red-600 font-bold">Rifiuta firma</label>
            </div>
            ${p.rifiuto ? `
            <input type="text" placeholder="Motivo rifiuto..."
                   value="${escapeHtml(p.noteRifiuto || '')}"
                   onchange="currentPresenti[${idx}].noteRifiuto = this.value"
                   class="w-full border border-red-200 rounded-lg p-2 text-xs bg-red-50">
            ` : `
            <div class="flex items-center gap-2">
                ${p.firmaBase64
                    ? `<img src="${p.firmaBase64}" class="h-10 border rounded-lg px-2 bg-slate-50" alt="firma">`
                    : `<div class="text-[10px] text-slate-400 italic">Firma mancante</div>`}
                <button onclick="inizializzaFirmaPresente(${idx})"
                        class="text-[10px] font-bold text-blue-600 hover:underline ml-auto">✍️ Firma</button>
            </div>
            `}
        </div>
    `).join('');
}

function rimuoviPresente(idx) {
    currentPresenti.splice(idx, 1);
    renderPresenti();
}

function toggleRifiutoPresente(idx, checked) {
    currentPresenti[idx].rifiuto = checked;
    currentPresenti[idx].firmaBase64 = null;
    renderPresenti();
}

// ─────────────────────────────────────────────
// MODAL AGGIUNGI PRESENTE
// ─────────────────────────────────────────────
async function mostraModalAggiungiPresente() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const [personeAnas, personeTerzi, imprese] = await Promise.all([
        getByIndex('persone_anas', 'projectId', projectId),
        getByIndex('persone_terzi', 'projectId', projectId),
        getByIndex('imprese', 'projectId', projectId)
    ]);

    const existing = document.getElementById('modal-aggiungi-presente');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-aggiungi-presente';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[3000] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div class="bg-slate-800 p-5 text-white flex justify-between items-center">
                <h3 class="font-bold">Aggiungi Presente</h3>
                <button onclick="document.getElementById('modal-aggiungi-presente').remove()" class="text-2xl">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <p class="text-xs text-slate-500">Seleziona da anagrafica o inserisci manualmente.</p>

                <!-- Selezione da anagrafica -->
                ${personeAnas.length > 0 || personeTerzi.length > 0 ? `
                <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Da Anagrafica</label>
                    <select id="sel-presente-anagrafica" class="w-full border rounded-xl p-3 text-sm">
                        <option value="">-- Seleziona persona --</option>
                        ${personeAnas.length > 0 ? `<optgroup label="Personale Sicurezza">
                            ${personeAnas.map(p => `<option value="anas:${p.id}:${p.nome} ${p.cognome}:${p.ruolo || p.qualifica || ''}:">${p.nome} ${p.cognome} (${p.ruolo || 'Sicurezza'})</option>`).join('')}
                        </optgroup>` : ''}
                        ${personeTerzi.length > 0 ? `<optgroup label="Enti Terzi">
                            ${personeTerzi.map(p => `<option value="terzi:${p.id}:${p.nome} ${p.cognome}:${p.qualifica || p.ente || ''}:">${p.nome} ${p.cognome} (${p.ente || 'Terzi'})</option>`).join('')}
                        </optgroup>` : ''}
                        ${imprese.length > 0 ? `<optgroup label="Referenti Imprese">
                            ${imprese.map(imp => `<option value="impresa:${imp.id}:Referente ${imp.ragioneSociale}:Preposto:${imp.id}">${imp.ragioneSociale} (Referente)</option>`).join('')}
                        </optgroup>` : ''}
                    </select>
                    <button onclick="aggiungiDaAnagrafica()" class="w-full bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition">Aggiungi selezionato</button>
                </div>
                <div class="border-t border-slate-100 my-2"></div>
                ` : ''}

                <!-- Inserimento manuale -->
                <div class="space-y-3">
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Inserimento Manuale</label>
                    <input type="text" id="pres-nome" placeholder="Nome e Cognome" class="w-full border rounded-xl p-3 text-sm">
                    <input type="text" id="pres-qualifica" placeholder="Qualifica / Ruolo" class="w-full border rounded-xl p-3 text-sm">
                    <select id="pres-impresa" class="w-full border rounded-xl p-3 text-sm">
                        <option value="">-- Impresa (opzionale) --</option>
                        ${imprese.map(i => `<option value="${i.id}:${i.ragioneSociale}">${i.ragioneSociale}</option>`).join('')}
                    </select>
                    <button onclick="aggiungiPresenteManuale()" class="w-full bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition">Aggiungi</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function aggiungiDaAnagrafica() {
    const sel = document.getElementById('sel-presente-anagrafica');
    if (!sel.value) return;
    const [origine, personaId, nome, qualifica, impresaId] = sel.value.split(':');
    const impresaNome = impresaId
        ? sel.options[sel.selectedIndex].text.match(/\(([^)]+)\)/)?.[1] || ''
        : '';
    currentPresenti.push({
        personaId, nome, qualifica,
        impresaId: impresaId || '',
        impresa: impresaNome,
        origine,
        firmato: false, firmaBase64: null, rifiuto: false, noteRifiuto: ''
    });
    document.getElementById('modal-aggiungi-presente').remove();
    renderPresenti();
}

function aggiungiPresenteManuale() {
    const nome = document.getElementById('pres-nome').value.trim();
    const qualifica = document.getElementById('pres-qualifica').value.trim();
    const impresaRaw = document.getElementById('pres-impresa').value;
    if (!nome) { alert("Inserisci il nome."); return; }

    const [impresaId, impresa] = impresaRaw ? impresaRaw.split(':') : ['', ''];
    currentPresenti.push({
        personaId: null, nome, qualifica,
        impresaId: impresaId || '',
        impresa: impresa || '',
        origine: 'manuale',
        firmato: false, firmaBase64: null, rifiuto: false, noteRifiuto: ''
    });
    document.getElementById('modal-aggiungi-presente').remove();
    renderPresenti();
}

// ─────────────────────────────────────────────
// FIRMA CSE — canvas
// ─────────────────────────────────────────────
function inizializzaFirmaCSE() {
    const box = document.getElementById('cse-signature-box');
    if (!box) return;
    box.innerHTML = '';
    const canvasId = 'canvas-cse-firma';
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full flex flex-col items-center gap-2';
    wrapper.innerHTML = `
        <div id="${canvasId}-container" class="w-full"></div>
        <button onclick="confermFirmaCSECanvas()"
                class="text-[10px] font-bold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
            ✓ Conferma firma
        </button>
    `;
    box.appendChild(wrapper);
    const sc = new SignatureCanvas(canvasId + '-container', { width: 340, height: 140 });
    signatureCanvases['cse'] = sc;
}

function confermFirmaCSECanvas() {
    const sc = signatureCanvases['cse'];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast("Firma vuota, disegna prima la firma.", "warning"); return; }
    window._lastPastedSignature = b64;
    if (!window._verbaleEsistente) window._verbaleEsistente = {};
    if (!window._verbaleEsistente.redattoreInfo) window._verbaleEsistente.redattoreInfo = {};
    window._verbaleEsistente.redattoreInfo.firmaBase64 = b64;
    const box = document.getElementById('cse-signature-box');
    if (box) box.innerHTML = `<img src="${b64}" class="max-h-full max-w-full object-contain">`;
    showToast("Firma acquisita ✓", "success");
}

// ─────────────────────────────────────────────
// FIRMA PRESENTE — canvas per ogni presente
// ─────────────────────────────────────────────
function inizializzaFirmaPresente(idx) {
    // Crea mini-modal firma per il presente
    const existing = document.getElementById('modal-firma-presente');
    if (existing) existing.remove();

    const p = currentPresenti[idx];
    const modal = document.createElement('div');
    modal.id = 'modal-firma-presente';
    modal.className = 'fixed inset-0 bg-slate-900/70 z-[4000] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="bg-slate-800 p-4 text-white flex justify-between">
                <span class="font-bold text-sm">Firma di ${escapeHtml(p.nome)}</span>
                <button onclick="document.getElementById('modal-firma-presente').remove()" class="text-xl">&times;</button>
            </div>
            <div class="p-6 space-y-4">
                <div id="canvas-presente-container-${idx}"></div>
                <button onclick="confermaFirmaPresente(${idx})"
                        class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700">
                    ✓ Conferma firma
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const sc = new SignatureCanvas(`canvas-presente-container-${idx}`, { width: 380, height: 160 });
    signatureCanvases[idx] = sc;
}

function confermaFirmaPresente(idx) {
    const sc = signatureCanvases[idx];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast("Firma vuota.", "warning"); return; }
    currentPresenti[idx].firmaBase64 = b64;
    currentPresenti[idx].firmato = true;
    document.getElementById('modal-firma-presente').remove();
    renderPresenti();
    showToast("Firma acquisita ✓", "success");
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 5.1-bis — Allegati foto, anteprima stampa, visto Titolare
// ─────────────────────────────────────────────────────────────────────────────

// ─── Allegati foto ────────────────────────────────────────────────────────────
function _fileToDataUrlVS(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });
}

async function handleFotoUploadVS(files) {
    if (!window._vsAllegatiFoto) window._vsAllegatiFoto = [];
    for (const file of Array.from(files)) {
        if (window._vsAllegatiFoto.length >= 20) { showToast('Max 20 foto per verbale.', 'warning'); break; }
        if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: supera 5 MB, ignorato.`, 'warning'); continue; }
        const dataUrl = await _fileToDataUrlVS(file);
        window._vsAllegatiFoto.push({
            id: 'foto_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            nome: file.name, mimeType: file.type,
            dimensioneBytes: file.size, timestamp: new Date().toISOString(), dataUrl
        });
    }
    renderAllegatiFotoVS();
}

function handleFotoDropVS(event) {
    event.preventDefault();
    if (event.dataTransfer?.files) handleFotoUploadVS(event.dataTransfer.files);
}

function rimuoviFotoVS(idx) {
    if (!window._vsAllegatiFoto) return;
    window._vsAllegatiFoto.splice(idx, 1);
    renderAllegatiFotoVS();
}

function renderAllegatiFotoVS() {
    const container = document.getElementById('vs-lista-allegati-foto');
    if (!container) return;
    const foto = window._vsAllegatiFoto || [];
    const isFin = !document.getElementById('v-data') || document.getElementById('v-data').disabled;
    if (!foto.length) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-2">Nessun allegato fotografico.</p>';
        return;
    }
    container.innerHTML = '<div class="grid grid-cols-3 md:grid-cols-5 gap-3">' + foto.map((f, i) => `
    <div class="relative group">
        <img src="${f.dataUrl}" alt="${escapeHtml(f.nome)}" class="w-full h-24 object-cover rounded-xl border border-slate-200">
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex flex-col items-center justify-center gap-1">
            <span class="text-white text-[9px] font-bold px-1 truncate w-full text-center">${escapeHtml(f.nome)}</span>
            <span class="text-slate-300 text-[9px]">${(f.dimensioneBytes/1024).toFixed(0)} KB</span>
            ${!isFin ? `<button onclick="rimuoviFotoVS(${i})" class="bg-red-600 text-white px-2 py-0.5 rounded text-[9px] font-bold">✕</button>` : ''}
        </div>
    </div>`).join('') + '</div>';
}

async function scaricaAllegatiFotoVerbale(verbaleId) {
    const verbale = await getItem('verbali', verbaleId);
    if (!verbale?.allegatiFoto?.length) { showToast('Nessuna foto da scaricare.', 'warning'); return; }
    if (typeof JSZip === 'undefined') { showToast('Libreria JSZip non disponibile.', 'error'); return; }
    const zip = new JSZip();
    const folder = zip.folder('Foto_Sopralluogo');
    verbale.allegatiFoto.forEach((f, i) => {
        const prefix = String(i + 1).padStart(3, '0') + '_';
        folder.file(prefix + f.nome, f.dataUrl.split(',')[1], { base64: true });
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const numProg = (verbale.numeroProgressivo || String(verbale.id)).replace(/\//g, '_');
    const dataStr = (verbale.dataSopralluogo || '').replace(/-/g, '');
    const link = document.createElement('a');
    const _blobUrl1171 = URL.createObjectURL(blob);
    link.href = _blobUrl1171;
    link.download = `Foto_Verbale_VS_${numProg}_${dataStr}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(_blobUrl1171), 2000);
    showToast('ZIP foto scaricato ✓', 'success');
}

// ─── Anteprima stampa ─────────────────────────────────────────────────────────
async function mostraAnteprimaVerbale(verbaleId) {
    let verbale;
    if (verbaleId) {
        verbale = await getItem('verbali', verbaleId);
    } else {
        // genera da form corrente senza salvare
        verbale = { ...(window._verbaleEsistente || {}), ..._raccogliDatiForm(), allegatiFoto: window._vsAllegatiFoto || [] };
    }
    if (!verbale) { showToast('Verbale non trovato.', 'error'); return; }

    let blob;
    try { blob = await _generaDocxVerbaleVS(verbale); }
    catch (err) { alert('Impossibile generare anteprima: ' + err.message); return; }

    const isBozza = verbale.stato !== 'finalizzato';
    document.getElementById('modal-anteprima-vs')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-anteprima-vs';
    modal.className = 'fixed inset-0 bg-black/80 z-[4000] flex flex-col';
    modal.innerHTML = `
    <div class="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shrink-0">
        <span class="font-bold">📝 Anteprima Verbale di Sopralluogo</span>
        ${isBozza ? '<span class="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-full">⚠ BOZZA — non legalmente valida</span>' : '<span class="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">FINALIZZATO</span>'}
        <div class="ml-auto flex gap-2">
            <button onclick="window.print()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">🖨 Stampa</button>
            <button onclick="_scaricaWordDaBlob_VS()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold">📄 Scarica Word</button>
            <button onclick="document.getElementById('modal-anteprima-vs').remove()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold">✕ Chiudi</button>
        </div>
    </div>
    <div class="flex-1 overflow-auto bg-white p-4">
        <div id="docx-preview-inner-vs" class="max-w-4xl mx-auto"></div>
    </div>`;
    document.body.appendChild(modal);
    window._currentAnteprimaBlobVS = blob;

    const renderLib = (typeof docx !== 'undefined' && typeof docx.renderAsync === 'function') ? docx
                    : (typeof window.docxPreview !== 'undefined' && typeof window.docxPreview.renderAsync === 'function') ? window.docxPreview
                    : null;
    if (renderLib) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const bodyEl = document.getElementById('docx-preview-inner-vs');
            document.getElementById('docx-style-vs')?.remove(); // evita accumulo ad ogni apertura modal
            const styleEl = document.createElement('div');
            styleEl.id = 'docx-style-vs';
            document.head.appendChild(styleEl);
            await renderLib.renderAsync(arrayBuffer, bodyEl, styleEl, {
                className: 'docx-preview', inWrapper: true, ignoreHeight: true, breakPages: true, renderHeaders: true, renderFooters: true
            });
        } catch (e) {
            console.error('[docx-preview VS]', e);
            document.getElementById('docx-preview-inner-vs').innerHTML = `<p class="text-red-500 text-sm p-4">Errore rendering: ${e.message}</p>`;
        }
    } else {
        document.getElementById('docx-preview-inner-vs').innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <p class="text-4xl mb-4">📄</p><p class="font-semibold">Anteprima non disponibile.</p>
            <p class="text-sm mt-2">Usa "Scarica Word" per visualizzare il documento.</p>
        </div>`;
    }
}

function _scaricaWordDaBlob_VS() {
    const blob = window._currentAnteprimaBlobVS;
    if (!blob) return;
    const link = document.createElement('a');
    const _blobUrl1243 = URL.createObjectURL(blob);
    link.href = _blobUrl1243;
    link.download = 'Verbale_Sopralluogo_Anteprima.docx';
    link.click();
    setTimeout(() => URL.revokeObjectURL(_blobUrl1243), 2000);
}

// Genera docx dal verbale (usato da anteprima + applicaVistoTitolare)
async function _generaDocxVerbaleVS(verbale) {
    const imprese = await getByIndex('imprese', 'projectId', verbale.projectId);
    const mezziCantiere = verbale.includiTabellaMezzi ? await getByIndex('mezzi', 'projectId', verbale.projectId) : [];
    const cantiere = await getItem('projects', verbale.projectId);
    const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => ({})) : {};

    const vistoApposto = verbale.redattoreInfo?.isDelegato && verbale.vistoTitolareNome != null;

    const dataWord = {
        numero_progressivo: verbale.numeroProgressivo || 'BOZZA',
        data_sopralluogo: verbale.dataSopralluogo ? new Date(verbale.dataSopralluogo + 'T00:00:00').toLocaleDateString('it-IT') : '—',
        codice_cantiere: cantiere?.id || cantiere?.codice || '-',
        nome_cantiere: cantiere?.nome || '-',
        condizioni_meteo: (verbale.condizioniMeteo || '').toUpperCase(),
        progressiva_inizio: verbale.progressivaChilometrica?.inizio || cantiere?.progressivaInizio || '',
        progressiva_fine: verbale.progressivaChilometrica?.fine || cantiere?.progressivaFine || '',
        ss_numero: cantiere?.ssNumero || '',
        codice_ppm_sil: cantiere?.codicePpmSil || '',
        contratto_numero: cantiere?.contrattoNumero || '',
        contratto_data: cantiere?.contrattoData ? new Date(cantiere.contrattoData + 'T00:00:00').toLocaleDateString('it-IT') : '',
        struttura_territoriale: cantiere?.strutturaTerritoriale || '',
        committente: cantiere?.committente || '',
        cup: cantiere?.cup || '',
        cig: cantiere?.cig || '',
        oggetto: verbale.oggetto || '',
        stato_luoghi: verbale.statoLuoghi || '',
        note_prescrizioni: verbale.notePrescrizioni || '',
        modulo_codice: imp.modulo_codice || '',
        modulo_versione: imp.modulo_versione || '',

        imprese_presenti: Array.from(new Set((verbale.presenti || []).map(p => p.impresa))).map(impName => {
            const impObj = imprese.find(i => i.ragioneSociale === impName);
            return { ragione_sociale: impName, ruolo: impObj ? impObj.ruolo : 'Esecutrice' };
        }),
        referenti_presenti: (verbale.presenti || []).map(p => ({
            nome_completo: p.nome, qualifica: p.qualifica, impresa: p.impresa
        })),
        mezzi_attrezzature: mezziCantiere.map(m => ({
            tipologia: m.tipologia, marca: m.marca, modello: m.modello,
            matricola: m.matricolaInail || m.targa || '-'
        })),
        non_conformita: [],  // già chiuse al momento dell'anteprima
        presenti_firme: (verbale.presenti || []).map(p => ({
            nome_completo: p.nome, qualifica: p.qualifica,
            firma_image: p.firmaBase64 || null,
            rifiutato: p.rifiuto ? [{}] : [],
            note_rifiuto: p.noteRifiuto || ''
        })),
        firma_cse: verbale.redattoreInfo?.firmaBase64 || null,
        nome_cse: verbale.redattoreInfo?.nomeRedattore || '',
        ruolo_cse: verbale.redattoreInfo?.qualifica || '',
        atto_delega: verbale.redattoreInfo?.isDelegato ? (verbale.redattoreInfo?.attoDelegaRiferimento || '-') : '-',
        timestamp_firma_cse: verbale.redattoreInfo?.timestampFirma ? new Date(verbale.redattoreInfo.timestampFirma).toLocaleString('it-IT') : '-',
        data_finalizzazione: verbale.dataFinalizzazione ? new Date(verbale.dataFinalizzazione).toLocaleString('it-IT') : '',

        // Visto titolare (condizionale)
        mostra_visto: vistoApposto ? [{}] : [],
        visto_titolare_nome: verbale.vistoTitolareNome || '',
        visto_titolare_timestamp: verbale.vistoTitolareTimestamp ? new Date(verbale.vistoTitolareTimestamp).toLocaleString('it-IT') : '',
        visto_titolare_firma: verbale.vistoTitolareFirma || null
    };

    return DocxGenerator.generate(dataWord);
}

// ─── Visto CSE Titolare ───────────────────────────────────────────────────────
async function applicaVistoTitolare(verbaleId, vistoData) {
    const verbale = await getItem('verbali', verbaleId);
    if (!verbale) { showToast('Verbale non trovato.', 'error'); return; }
    verbale.vistoTitolareNome = vistoData.nome;
    verbale.vistoTitolareFirma = vistoData.firmaBase64;
    verbale.vistoTitolareTimestamp = new Date().toISOString();
    await saveItem('verbali', verbale);
    showToast('Visto Titolare applicato ✓', 'success');
    return verbale;
}

async function _scaricaWordVerbaleById(verbaleId) {
    const verbale = await getItem('verbali', verbaleId);
    if (!verbale) { showToast('Verbale non trovato.', 'error'); return; }
    try {
        const blob = await _generaDocxVerbaleVS(verbale);
        const numProg = (verbale.numeroProgressivo || String(verbale.id)).replace(/\//g, '_');
        const dataStr = (verbale.dataSopralluogo || '').replace(/-/g, '');
        const link = document.createElement('a');
        const _blobUrl1334 = URL.createObjectURL(blob);
        link.href = _blobUrl1334;
        link.download = `Verbale_Sopralluogo_${dataStr}_${numProg}.docx`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(_blobUrl1334), 2000);
    } catch (err) { showToast('Errore generazione Word: ' + err.message, 'error'); }
}

// Chiude il modal editor e annulla il listener paste orfano (Issue #6)
window._chiudiModalEditorVerbale = function() {
    if (_pasteFirmaAC) { _pasteFirmaAC.abort(); _pasteFirmaAC = null; }
    document.getElementById('modal-editor-verbale')?.remove();
};

window.mostraAnteprimaVerbale        = mostraAnteprimaVerbale;
window._scaricaWordDaBlob_VS         = _scaricaWordDaBlob_VS;
window._scaricaWordVerbaleById       = _scaricaWordVerbaleById;
window.handleFotoUploadVS            = handleFotoUploadVS;
window.handleFotoDropVS              = handleFotoDropVS;
window.rimuoviFotoVS                 = rimuoviFotoVS;
window.renderAllegatiFotoVS          = renderAllegatiFotoVS;
window.scaricaAllegatiFotoVerbale    = scaricaAllegatiFotoVerbale;
window.applicaVistoTitolare          = applicaVistoTitolare;
window._generaDocxVerbaleVS          = _generaDocxVerbaleVS;

// ─────────────────────────────────────────────
// INTEGRAZIONE EVENTI INCIDENTALI (FASE 6bis)
// ─────────────────────────────────────────────

async function apriFormEventoDaVerbale(verbaleId) {
    if (typeof _apriFormEvento !== 'function') {
        alert('Modulo Eventi Incidentali non caricato.');
        return;
    }
    const projectId = sessionStorage.getItem('currentProjectId');
    const cantiere = projectId ? await getItem('projects', projectId).catch(() => null) : null;
    const prefill = {
        verbaleOrigineId: verbaleId,
        progressivaKm: cantiere?.progressivaInizio || null
    };
    // Dopo salvataggio ricarica la sezione eventi collegati
    const origSalva = window.salvaEvento;
    window.salvaEvento = async function(record) {
        try {
            const result = await origSalva(record);
            await _renderEvCollegatiVerbale(verbaleId);
            return result;
        } finally {
            // Ripristino garantito anche in caso di eccezione (Issue #5)
            window.salvaEvento = origSalva;
        }
    };
    _apriFormEvento(null, prefill);
}

async function _renderEvCollegatiVerbale(verbaleId) {
    const container = document.getElementById('ev-collegati-verbale-container');
    if (!container) return;
    if (typeof getByIndex !== 'function') return;
    const projectId = sessionStorage.getItem('currentProjectId');
    let eventi = [];
    try {
        const tutti = await getByIndex('eventi_incidentali', 'projectId', projectId);
        eventi = tutti.filter(e => e.verbaleOrigineId === verbaleId || e.verbaleOrigineId === String(verbaleId));
    } catch (_) { return; }

    if (eventi.length === 0) { container.innerHTML = ''; return; }

    const righe = eventi.map(ev => `
        <div class="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm">
            <div class="font-mono font-bold text-amber-800">${ev.codiceEvento || '—'}</div>
            <div class="text-slate-500 text-xs">${ev.tipologia === 'NEAR_MISS' ? '⚠️ Near Miss' : '🚨 Infortunio'} · ${ev.luogo || ''}</div>
            <div class="text-[10px] font-bold ${ev.stato==='APERTO'?'text-red-600':ev.stato==='CHIUSO'?'text-slate-400':'text-amber-700'}">${ev.stato}</div>
        </div>`).join('');

    container.innerHTML = `
        <div class="mt-2">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Eventi incidentali collegati (${eventi.length})</p>
          <div class="space-y-1">${righe}</div>
        </div>`;
}

window.apriFormEventoDaVerbale  = apriFormEventoDaVerbale;
window._renderEvCollegatiVerbale = _renderEvCollegatiVerbale;
