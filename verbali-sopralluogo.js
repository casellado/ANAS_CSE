/**
 * verbali-sopralluogo.js
 * Modulo per la gestione completa dei verbali di sopralluogo (CRUD + UI).
 * Pattern FASE 5.1-bis - Chiusura GAP Audit
 */

let currentVerbaleId = null;
let currentPresenti = []; // Lista locale di {personaId, nome, qualifica, impresa, origine, firmato, firmaBase64, rifiuto, noteRifiuto}
let currentNCDrafts = []; // Lista locale di {livello, scadenza, descrizione, impresaId}
let signatureCanvases = {}; // Mappa idPresente -> istanza SignatureCanvas

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
                <button onclick="checkTemplateAndNewVerbale()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2">
                    <span>+</span> Nuovo Sopralluogo
                </button>
                <button onclick="mostraWizardTemplate()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold transition flex items-center gap-2" title="Configura Template Word">
                    <span>⚙️</span> Template
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
    verbali.sort((a,b) => new Date(b.data) - new Date(a.data));

    if (verbali.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-400">Nessun verbale emesso per questo cantiere.</td></tr>`;
        return;
    }

    tbody.innerHTML = verbali.map(v => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-xs font-bold">${v.numeroProgressivo || 'BOZZA'}</td>
            <td class="px-4 py-3 text-sm">${v.dataSopralluogo ? new Date(v.dataSopralluogo).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3 text-sm font-semibold truncate max-w-xs">${escapeHtml(v.oggetto || 'Senza oggetto')}</td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${v.stato === 'finalizzato' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                    ${v.stato}
                </span>
            </td>
            <td class="px-4 py-3 text-right space-x-1">
                <button onclick="apriVerbale('${v.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="${v.stato === 'finalizzato' ? 'Visualizza' : 'Modifica'}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button onclick="eliminaVerbale('${v.id}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Elimina">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Gestione Template Word (Wizard)
 */
async function mostraWizardTemplate() {
    const existing = document.getElementById('modal-wizard-template');
    if (existing) existing.remove();

    const currentTemplate = await getItem('impostazioni', 'template_verbale_sopralluogo');

    const modal = document.createElement('div');
    modal.id = 'modal-wizard-template';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[5000] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div class="bg-slate-800 p-6 text-white flex justify-between items-center">
                <h3 class="text-xl font-bold">Template Verbale Sopralluogo</h3>
                <button onclick="document.getElementById('modal-wizard-template').remove()" class="text-2xl">&times;</button>
            </div>
            <div class="p-8 space-y-6">
                <div class="text-center">
                    <div class="text-5xl mb-4">📄</div>
                    <p class="text-slate-600 text-sm leading-relaxed">
                        Carica il tuo file <strong>.docx</strong> personalizzato con i segnaposto {{...}}.
                    </p>
                </div>
                <div class="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-4 bg-slate-50 transition hover:border-blue-400">
                    <input type="file" id="template-upload" class="hidden" accept=".docx" onchange="handleTemplateUpload(event)">
                    <button onclick="document.getElementById('template-upload').click()" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">
                        ${currentTemplate ? 'Aggiorna Template' : 'Seleziona File .docx'}
                    </button>
                    <div id="template-status" class="text-xs font-bold ${currentTemplate ? 'text-green-600' : 'text-slate-400'}">
                        ${currentTemplate ? '✅ Template caricato: ' + (currentTemplate.name || 'Personalizzato') : 'Nessun file caricato'}
                    </div>
                </div>
                <div class="text-[10px] text-slate-400 italic bg-slate-100 p-3 rounded">
                    Segnaposto principali: {{numero_progressivo}}, {{data_sopralluogo}}, {{nome_cantiere}}, {#imprese_presenti}, {#presenti_firme}, {%firma_cse}...
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arrayBuffer = e.target.result;
            new PizZip(arrayBuffer);
            
            await saveItem('impostazioni', {
                chiave: 'template_verbale_sopralluogo',
                valore: arrayBuffer,
                name: file.name,
                uploadedAt: new Date().toISOString()
            });
            alert("Template caricato e validato correttamente ✓");
            document.getElementById('modal-wizard-template').remove();
        } catch (err) {
            alert("Errore nel file Word: assicurati che sia un .docx valido.");
        }
    };
    reader.readAsArrayBuffer(file);
}

async function checkTemplateAndNewVerbale() {
    const template = await getItem('impostazioni', 'template_verbale_sopralluogo');
    if (!template) {
        mostraWizardTemplate();
        alert("Carica il template Word prima di iniziare.");
        return;
    }
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
                            ${project.nome} · ID: ${currentVerbaleId} · ${verbale.stato}
                        </div>
                    </div>
                </div>
                <button onclick="document.getElementById('modal-editor-verbale').remove()" class="text-2xl hover:text-red-400 transition">&times;</button>
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

            <footer class="bg-slate-50 p-6 border-t flex justify-between items-center shrink-0">
                <button onclick="document.getElementById('modal-editor-verbale').remove()" class="text-sm font-bold text-slate-500 hover:text-slate-700">Annulla</button>
                <div class="flex gap-3">
                    ${!isFinalizzato ? `<button onclick="salvaVerbale('bozza')" class="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition">Salva Bozza</button>` : ''}
                    <button onclick="eseguiFinalizzazione()" class="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                        <span>💾</span> ${isFinalizzato ? 'Scarica Word' : 'Finalizza e Scarica'}
                    </button>
                </div>
            </footer>
        </div>
    `;

    document.body.appendChild(modal);
    renderPresenti();
    renderNCDrafts();
}

/**
 * Gestione UI
 */
function toggleDelegaUI(checked) {
    document.getElementById('delega-ui').classList.toggle('hidden', !checked);
}

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
    
    const projectId = sessionStorage.getItem('currentProjectId');
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    const isFinalizzato = (await getItem('verbali', currentVerbaleId))?.stato === 'finalizzato';

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
    
    // Listener temporaneo
    const onPaste = async (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    box.innerHTML = `<img src="${base64}" class="max-h-full">`;
                    // Salviamo temporaneamente in una variabile globale o nello stato
                    window._lastPastedSignature = base64;
                    showToast("Immagine incollata ✓", "success");
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    };
    
    document.addEventListener('paste', onPaste, { once: true });
}

async function usaFirmaPermanenteCSE() {
    const imp = await caricaImpostazioni();
    if (imp.firmaImmagine) {
        document.getElementById('cse-signature-box').innerHTML = `<img src="${imp.firmaImmagine}" class="max-h-full">`;
        window._lastPastedSignature = imp.firmaImmagine;
        showToast("Firma permanente applicata", "info");
    } else {
        alert("Nessuna firma permanente trovata in Impostazioni.");
    }
}

/**
 * Finalizzazione (GAP 1, 5, 6)
 */
async function salvaVerbale(nuovoStato = 'bozza') {
    const projectId = sessionStorage.getItem('currentProjectId');
    const verbaleEsistente = await getItem('verbali', currentVerbaleId);

    // GAP 9: Protezione finalizzato
    if (verbaleEsistente && verbaleEsistente.stato === 'finalizzato' && nuovoStato !== 'finalizzato') {
        alert("Impossibile modificare un verbale finalizzato.");
        throw new Error('Finalizzato non modificabile');
    }

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

    const item = {
        id: currentVerbaleId,
        projectId: projectId,
        tipo: 'sopralluogo',
        stato: nuovoStato,
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
        ncCollegateIds: verbaleEsistente?.ncCollegateIds || [],
        includiTabellaMezzi: document.getElementById('v-opt-mezzi').checked,
        redattoreInfo: {
            isDelegato: document.getElementById('v-cse-delegato').checked,
            nomeRedattore: document.getElementById('v-cse-nome').value,
            qualifica: document.getElementById('v-cse-qualifica').value,
            attoDelegaRiferimento: document.getElementById('v-cse-atto').value,
            firmaBase64: window._lastPastedSignature || verbaleEsistente?.redattoreInfo.firmaBase64,
            timestampFirma: window._lastPastedSignature ? new Date().toISOString() : verbaleEsistente?.redattoreInfo.timestampFirma
        },
        modifiedAt: new Date().toISOString()
    };

    await saveItem('verbali', item);
    if (nuovoStato === 'bozza') {
        showToast("Bozza salvata ✓", "success");
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    }
    return item;
}

async function eseguiFinalizzazione() {
    const verbale = await salvaVerbale('finalizzato');
    
    // GAP 6: Validazione Completa
    const errori = [];
    if (!verbale.dataSopralluogo) errori.push("Data sopralluogo");
    if (!verbale.oggetto) errori.push("Oggetto");
    if (!verbale.condizioniMeteo) errori.push("Condizioni meteo");
    if (!verbale.statoLuoghi) errori.push("Stato dei luoghi");
    if (!verbale.notePrescrizioni) errori.push("Note e prescrizioni");
    if (verbale.presenti.length === 0) errori.push("Almeno un presente");
    if (!verbale.impresePresentiIds || verbale.impresePresentiIds.length === 0) errori.push("Almeno un'impresa presente");
    if (verbale.redattoreInfo.isDelegato && !verbale.redattoreInfo.attoDelegaRiferimento) errori.push("Atto di delega (obbligatorio se delegato)");
    if (!verbale.redattoreInfo.firmaBase64) errori.push("Firma del redattore (CSE)");
    
    verbale.presenti.forEach((p, i) => {
        if (!p.firmaBase64 && !p.rifiuto) errori.push(`Firma di ${p.nome}`);
        if (p.rifiuto && !p.noteRifiuto) errori.push(`Motivo rifiuto di ${p.nome}`);
    });

    verbale.ncDrafts.forEach((nc, i) => {
        if (!nc.descrizione || !nc.impresaId) errori.push(`Dettagli NC #${i+1} (descrizione e impresa)`);
    });

    const template = await getItem('impostazioni', 'template_verbale_sopralluogo');
    if (!template) errori.push("Template Word non caricato in Impostazioni");

    if (errori.length > 0) {
        alert("ERRORE FINALIZZAZIONE. Campi mancanti:\n- " + errori.join("\n- "));
        return;
    }

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
        const count = verbaliGiorno.filter(v => v.dataSopralluogo === verbale.dataSopralluogo && v.stato === 'finalizzato').length;
        verbale.numeroProgressivo = `${dataPrefix}/VS${String(count + 1).padStart(2, '0')}`;
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
        link.href = URL.createObjectURL(wordBlob);
        link.download = fileName;
        link.click();
        
        showToast("Verbale finalizzato con successo! ✓", "success");
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
