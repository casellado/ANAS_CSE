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
        }
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
    const template = await getItem('impostazioni', 'template_verbale_sopralluogo');
    if (!template) errori.push("Template Word non caricato (pulsante ⚙️ Template)");

    if (errori.length > 0) {
        showToast("Errori: " + errori[0], "error", 5000);
        alert("ERRORE FINALIZZAZIONE. Campi mancanti:\n- " + errori.join("\n- "));
        return;
    }

    // Solo ora salva come finalizzato
    const verbale = { ...dati, stato: 'finalizzato', modifiedAt: new Date().toISOString() };
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
    link.href = URL.createObjectURL(blob);
    link.download = `Foto_Verbale_VS_${numProg}_${dataStr}.zip`;
    link.click();
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
    link.href = URL.createObjectURL(blob);
    link.download = 'Verbale_Sopralluogo_Anteprima.docx';
    link.click();
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
        progressiva_inizio: verbale.progressivaChilometrica?.inizio || '',
        progressiva_fine: verbale.progressivaChilometrica?.fine || '',
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

window.mostraAnteprimaVerbale        = mostraAnteprimaVerbale;
window._scaricaWordDaBlob_VS         = _scaricaWordDaBlob_VS;
window.handleFotoUploadVS            = handleFotoUploadVS;
window.handleFotoDropVS              = handleFotoDropVS;
window.rimuoviFotoVS                 = rimuoviFotoVS;
window.renderAllegatiFotoVS          = renderAllegatiFotoVS;
window.scaricaAllegatiFotoVerbale    = scaricaAllegatiFotoVerbale;
window.applicaVistoTitolare          = applicaVistoTitolare;
window._generaDocxVerbaleVS          = _generaDocxVerbaleVS;
