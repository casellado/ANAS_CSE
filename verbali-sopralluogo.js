/**
 * verbali-sopralluogo.js
 * Modulo per la gestione completa dei verbali di sopralluogo (CRUD + UI).
 * Pattern FASE 5.1
 */

let currentVerbaleId = null;
let signatureCSE = null;
let presentFirme = []; // Array di {id, nome, qualifica, canvas, rifiutato}

/**
 * Renderizza la lista dei verbali del cantiere corrente.
 */
async function renderVerbali() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const container = document.getElementById('view-verbali');
    if (!container) return;

    // Se non abbiamo view-verbali lo creiamo al volo (inject in index.html)
    // Per ora assumiamo che index.html abbia già lo scheletro o usiamo il placeholder
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

        <!-- Tabella Verbali -->
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
    
    // Caricamento dati
    const tbody = document.getElementById('verbali-tbody');
    const verbali = await getByIndex('verbali', 'projectId', projectId);
    
    // Sort decrescente per data
    verbali.sort((a,b) => new Date(b.data) - new Date(a.data));

    if (verbali.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-400">Nessun verbale emesso per questo cantiere.</td></tr>`;
        return;
    }

    tbody.innerHTML = verbali.map(v => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-xs font-bold">${v.numero || 'BOZZA'}</td>
            <td class="px-4 py-3 text-sm">${v.data ? new Date(v.data).toLocaleDateString() : '-'}</td>
            <td class="px-4 py-3 text-sm font-semibold truncate max-w-xs">${escapeHtml(v.oggetto || 'Senza oggetto')}</td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${v.stato === 'finalizzato' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                    ${v.stato}
                </span>
            </td>
            <td class="px-4 py-3 text-right space-x-1">
                <button onclick="apriVerbale('${v.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Dettaglio/Modifica">
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
 * Wizard caricamento template Word.
 */
async function mostraWizardTemplate() {
    const existing = document.getElementById('modal-wizard-template');
    if (existing) existing.remove();

    const currentTemplate = await getItem('impostazioni', 'template_verbale_sopralluogo');

    const modal = document.createElement('div');
    modal.id = 'modal-wizard-template';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div class="bg-slate-800 p-6 text-white flex justify-between items-center">
                <h3 class="text-xl font-bold">Template Verbale Sopralluogo</h3>
                <button onclick="document.getElementById('modal-wizard-template').remove()" class="text-2xl">&times;</button>
            </div>
            <div class="p-8 space-y-6">
                <div class="text-center">
                    <div class="text-5xl mb-4">📄</div>
                    <p class="text-slate-600 text-sm leading-relaxed">
                        Per generare il verbale in formato Word, devi caricare un file <strong>.docx</strong> 
                        preparato con i segnaposto corretti (es. {{data_sopralluogo}}).
                    </p>
                </div>

                <div class="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-4 bg-slate-50 transition hover:border-blue-400">
                    <input type="file" id="template-upload" class="hidden" accept=".docx" onchange="handleTemplateUpload(event)">
                    <button onclick="document.getElementById('template-upload').click()" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">
                        ${currentTemplate ? 'Aggiorna Template' : 'Seleziona File .docx'}
                    </button>
                    <div id="template-status" class="text-xs font-bold ${currentTemplate ? 'text-green-600' : 'text-slate-400'}">
                        ${currentTemplate ? '✅ Template attualmente caricato' : 'Nessun file caricato'}
                    </div>
                </div>

                <div class="text-[10px] text-slate-400 italic">
                    I segnaposto supportati includono: {{numero}}, {{data}}, {{oggetto}}, {#imprese_presenti}...
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
        alert("Per favore, seleziona un file in formato .docx");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        await saveItem('impostazioni', {
            chiave: 'template_verbale_sopralluogo',
            file: arrayBuffer,
            name: file.name,
            updatedAt: new Date().toISOString()
        });
        alert("Template caricato con successo!");
        document.getElementById('modal-wizard-template').remove();
    };
    reader.readAsArrayBuffer(file);
}

async function checkTemplateAndNewVerbale() {
    const template = await getItem('impostazioni', 'template_verbale_sopralluogo');
    if (!template) {
        mostraWizardTemplate();
        alert("Devi caricare un template Word prima di creare un verbale.");
        return;
    }
    apriVerbale(); // Crea nuovo
}

/**
 * Form Dettaglio Verbale (CRUD).
 */
async function apriVerbale(id = null) {
    currentVerbaleId = id || 'VS_' + Date.now();
    let verbale = id ? await getItem('verbali', id) : null;
    const projectId = sessionStorage.getItem('currentProjectId');
    const project = await getItem('projects', projectId);

    if (!verbale) {
        verbale = {
            id: currentVerbaleId,
            projectId: projectId,
            tipo: 'sopralluogo',
            numero: '',
            data: new Date().toISOString().split('T')[0],
            oggetto: 'Sopralluogo di coordinamento e controllo',
            condizioniMeteo: 'Sereno',
            progressivaInizio: '',
            progressivaFine: '',
            statoLuoghi: '',
            notePrescrizioni: '',
            impreseIds: [],
            presenti: [],
            ncIds: [],
            stato: 'bozza',
            createdAt: new Date().toISOString()
        };
    }

    const isFinalizzato = verbale.stato === 'finalizzato';

    // UI del Form (Modal gigante o View dedicata)
    const existing = document.getElementById('modal-editor-verbale');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-editor-verbale';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex flex-col p-4 md:p-8';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col flex-1 overflow-hidden">
            <header class="bg-slate-800 text-white p-6 flex justify-between items-center shrink-0">
                <div>
                    <h3 class="text-xl font-bold">${id ? 'Modifica Verbale' : 'Nuovo Verbale di Sopralluogo'}</h3>
                    <div class="text-xs text-slate-400 font-mono">${currentVerbaleId} | ${verbale.stato.toUpperCase()}</div>
                </div>
                <button onclick="document.getElementById('modal-editor-verbale').remove()" class="text-2xl">&times;</button>
            </header>

            <div class="flex-1 overflow-y-auto p-8 space-y-10 bg-slate-50">
                <!-- Sezione 1: Dati Generali -->
                <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">1. Dati Generali</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Sopralluogo</label>
                            <input type="date" id="v-data" value="${verbale.data}" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-2.5 text-sm">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Oggetto</label>
                            <input type="text" id="v-oggetto" value="${escapeHtml(verbale.oggetto)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-2.5 text-sm">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Meteo</label>
                            <input type="text" id="v-meteo" value="${escapeHtml(verbale.condizioniMeteo)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-2.5 text-sm">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Progr. Inizio (Km/Area)</label>
                            <input type="text" id="v-prog-inizio" value="${escapeHtml(verbale.progressivaInizio)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-2.5 text-sm">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Progr. Fine (Km/Area)</label>
                            <input type="text" id="v-prog-fine" value="${escapeHtml(verbale.progressivaFine)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-2.5 text-sm">
                        </div>
                    </div>
                </div>

                <!-- Sezione 2: Descrizione Stato Luoghi -->
                <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">2. Esito Sopralluogo</h4>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stato dei Luoghi e Verifiche</label>
                            <textarea id="v-stato-luoghi" rows="5" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">${escapeHtml(verbale.statoLuoghi)}</textarea>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Note e Prescrizioni Immediate</label>
                            <textarea id="v-note-prescrizioni" rows="4" ${isFinalizzato ? 'disabled' : ''} class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">${escapeHtml(verbale.notePrescrizioni)}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Placeholder per Presenti e Firme -->
                <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">3. Presenti e Firme</h4>
                    <p class="text-xs text-slate-400 italic">Modulo firme integrato in arrivo nella sottomissione completa.</p>
                </div>
            </div>

            <footer class="bg-slate-50 p-6 border-t flex justify-between items-center shrink-0">
                <button onclick="document.getElementById('modal-editor-verbale').remove()" class="text-sm font-bold text-slate-500 hover:text-slate-700">Annulla</button>
                <div class="flex gap-3">
                    ${!isFinalizzato ? `<button onclick="salvaVerbale('bozza')" class="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition">Salva Bozza</button>` : ''}
                    <button onclick="finalizzaVerbale()" class="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                        <span>💾</span> ${isFinalizzato ? 'Scarica Word' : 'Finalizza e Scarica'}
                    </button>
                </div>
            </footer>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Logica di salvataggio.
 */
async function salvaVerbale(nuovoStato = 'bozza') {
    const projectId = sessionStorage.getItem('currentProjectId');
    const item = {
        id: currentVerbaleId,
        projectId: projectId,
        tipo: 'sopralluogo',
        data: document.getElementById('v-data').value,
        oggetto: document.getElementById('v-oggetto').value,
        condizioniMeteo: document.getElementById('v-meteo').value,
        progressivaInizio: document.getElementById('v-prog-inizio').value,
        progressivaFine: document.getElementById('v-prog-fine').value,
        statoLuoghi: document.getElementById('v-stato-luoghi').value,
        notePrescrizioni: document.getElementById('v-note-prescrizioni').value,
        stato: nuovoStato,
        modifiedAt: new Date().toISOString()
    };

    await saveItem('verbali', item);
    if (nuovoStato === 'bozza') {
        alert("Bozza salvata!");
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    }
    return item;
}

async function finalizzaVerbale() {
    const verbale = await salvaVerbale('finalizzato');
    
    // Assegnazione numero progressivo se mancante
    if (!verbale.numero) {
        const today = verbale.data.replace(/-/g, '');
        const verbaliGiorno = await getByIndex('verbali', 'data', verbale.data);
        const count = verbaliGiorno.filter(v => v.projectId === verbale.projectId && v.stato === 'finalizzato').length;
        verbale.numero = `${today}/VS${String(count).padStart(2, '0')}`;
        await saveItem('verbali', verbale);
    }

    // Generazione WORD
    try {
        const blob = await DocxGenerator.generate(verbale);
        const fileName = `Verbale_${verbale.numero.replace(/\//g, '_')}.docx`;
        
        // Download browser
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        
        alert("Verbale finalizzato e scaricato con successo!");
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    } catch (e) {
        alert("Errore generazione Word: " + e.message);
    }
}
