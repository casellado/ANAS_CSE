/**
 * verbali-sopralluogo.js
 * Modulo per la gestione completa dei verbali di sopralluogo (CRUD + UI).
 * Pattern FASE 5.1 - Allineato Specifiche v2.0
 */

let currentVerbaleId = null;
let currentPresenti = []; // Lista locale di {personaId, nome, qualifica, impresa, origine, firmato, firmaBase64, rifiuto, noteRifiuto}
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
            // Validazione base PizZip
            new PizZip(arrayBuffer);
            
            await saveItem('impostazioni', {
                chiave: 'template_verbale_sopralluogo',
                valore: arrayBuffer, // Salviamo come binary buffer per efficienza
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
            redattoreInfo: {
                isDelegato: false,
                nomeRedattore: impGlobal.firmaNome || 'CSE',
                qualifica: impGlobal.firmaQualifica || 'CSE',
                firmaBase64: impGlobal.firmaImmagine || null
            }
        };
    }

    currentPresenti = [...verbale.presenti];
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
                
                <!-- Sezione 1: Intestazione -->
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

                <!-- Sezione 2: Descrizione -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 2. Esito Ispezione
                    </h4>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stato dei Luoghi e Verifiche</label>
                            <textarea id="v-stato-luoghi" rows="4" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-300" placeholder="Descrivi cosa hai verificato e lo stato del cantiere...">${escapeHtml(verbale.statoLuoghi)}</textarea>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Note e Prescrizioni</label>
                            <textarea id="v-note-prescrizioni" rows="3" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-300" placeholder="Inserisci eventuali prescrizioni immediate...">${escapeHtml(verbale.notePrescrizioni)}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Sezione 3: Presenti e Firme -->
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
                    
                    <div id="presenti-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Popolato da renderPresenti() -->
                    </div>
                </div>

                <!-- Sezione 4: Firma CSE -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-600 rounded-full"></span> 4. Redattore (CSE)
                    </h4>
                    <div class="flex flex-col md:flex-row gap-6 items-center">
                        <div class="flex-1 space-y-4 w-full">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Redattore</label>
                                <input type="text" id="v-cse-nome" value="${escapeHtml(verbale.redattoreInfo.nomeRedattore)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualifica</label>
                                <input type="text" id="v-cse-qualifica" value="${escapeHtml(verbale.redattoreInfo.qualifica)}" ${isFinalizzato ? 'disabled' : ''} class="w-full border-slate-200 rounded-xl p-3 text-sm">
                            </div>
                        </div>
                        <div class="shrink-0">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-2 text-center">Firma Digitale</label>
                            <div id="cse-signature-box" class="w-64 h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden">
                                ${verbale.redattoreInfo.firmaBase64 ? `<img src="${verbale.redattoreInfo.firmaBase64}" class="max-h-full">` : '<span class="text-[10px] text-slate-400">Nessuna firma</span>'}
                            </div>
                            ${!isFinalizzato ? `<button onclick="inizializzaFirmaCSE()" class="w-full mt-2 text-[10px] font-bold text-blue-600 hover:underline">Firma Ora</button>` : ''}
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
}

/**
 * Gestione Presenti
 */
function renderPresenti() {
    const container = document.getElementById('presenti-container');
    if (!container) return;
    
    container.innerHTML = currentPresenti.map((p, idx) => `
        <div class="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3 relative group">
            <button onclick="rimuoviPresente(${idx})" class="absolute top-2 right-2 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
            <div class="flex items-start gap-3">
                <div class="bg-slate-200 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0">👤</div>
                <div>
                    <div class="text-xs font-bold text-slate-800">${escapeHtml(p.nome)}</div>
                    <div class="text-[10px] text-slate-500 uppercase">${escapeHtml(p.qualifica)}</div>
                    <div class="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">${escapeHtml(p.impresa)}</div>
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="ref-rifiuto-${idx}" ${p.rifiuto ? 'checked' : ''} onchange="toggleRifiutoFirma(${idx}, this.checked)" class="rounded text-red-600">
                    <label for="ref-rifiuto-${idx}" class="text-[10px] font-bold text-red-600 uppercase">Rifiuto Firma</label>
                </div>
                
                ${p.rifiuto ? `
                    <input type="text" placeholder="Motivo del rifiuto..." value="${escapeHtml(p.noteRifiuto || '')}" onchange="updateNotaRifiuto(${idx}, this.value)" class="w-full text-xs border-slate-200 rounded-lg p-2">
                ` : `
                    <div id="canvas-presente-${idx}" class="w-full h-24">
                        ${p.firmaBase64 ? `<img src="${p.firmaBase64}" class="h-full mx-auto">` : `<div class="h-full flex items-center justify-center border-2 border-dashed border-slate-200 text-[10px] text-slate-300">Firma mancante</div>`}
                    </div>
                    ${!p.firmaBase64 ? `<button onclick="abilitaFirmaPresente(${idx})" class="w-full text-[10px] font-bold text-blue-600">✍️ Firma ora</button>` : ''}
                `}
            </div>
        </div>
    `).join('');
}

async function mostraModalAggiungiPresente() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const lavoratori = await getByIndex('lavoratori', 'projectId', projectId);
    const terzi = await getByIndex('persone_terzi', 'projectId', projectId);
    const sicurezza = await getByIndex('persone_anas', 'projectId', projectId);
    const imprese = await getByIndex('imprese', 'projectId', projectId);

    const existing = document.getElementById('modal-add-presente');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-add-presente';
    modal.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div class="bg-slate-100 p-4 font-bold border-b text-slate-700">Aggiungi Presente</div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Seleziona da Anagrafica</label>
                    <select id="sel-presente-anag" class="w-full border-slate-200 rounded-xl p-3 text-sm" onchange="autoFillPresente(this.value)">
                        <option value="">-- Scegli o inserisci manuale --</option>
                        <optgroup label="Sicurezza">
                            ${sicurezza.map(p => `<option value="S|${p.id}|${p.nome}|${p.ruolo}|Sicurezza">${p.nome} (${p.ruolo})</option>`).join('')}
                        </optgroup>
                        <optgroup label="Lavoratori Imprese">
                            ${lavoratori.map(p => `<option value="L|${p.id}|${p.nome}|${p.qualifica}|${getImpresaNomeSync(p.impresaId, imprese)}">${p.nome} - ${getImpresaNomeSync(p.impresaId, imprese)}</option>`).join('')}
                        </optgroup>
                        <optgroup label="Terzi / Enti">
                            ${terzi.map(p => `<option value="T|${p.id}|${p.nome}|${p.ruolo}|Terzi">${p.nome} (${p.ruolo})</option>`).join('')}
                        </optgroup>
                    </select>
                </div>
                <hr>
                <div class="space-y-3">
                    <input type="text" id="new-p-nome" placeholder="Nome e Cognome" class="w-full border-slate-200 rounded-xl p-3 text-sm">
                    <input type="text" id="new-p-qual" placeholder="Qualifica/Mansione" class="w-full border-slate-200 rounded-xl p-3 text-sm">
                    <input type="text" id="new-p-imp" placeholder="Impresa/Ente" class="w-full border-slate-200 rounded-xl p-3 text-sm">
                </div>
                <div class="flex gap-2 pt-2">
                    <button onclick="document.getElementById('modal-add-presente').remove()" class="flex-1 py-2 text-sm font-bold text-slate-500">Annulla</button>
                    <button onclick="confermaAggiungiPresente()" class="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold shadow-lg">Aggiungi</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function autoFillPresente(val) {
    if (!val) return;
    const [tipo, id, nome, qual, imp] = val.split('|');
    document.getElementById('new-p-nome').value = nome;
    document.getElementById('new-p-qual').value = qual;
    document.getElementById('new-p-imp').value = imp;
}

function confermaAggiungiPresente() {
    const nome = document.getElementById('new-p-nome').value.trim();
    const qual = document.getElementById('new-p-qual').value.trim();
    const imp = document.getElementById('new-p-imp').value.trim();
    
    if (!nome) return alert("Inserisci il nome.");
    
    currentPresenti.push({
        id: 'P_' + Date.now(),
        nome, qual, impresa: imp,
        origine: 'manuale',
        firmato: false,
        firmaBase64: null,
        rifiuto: false,
        noteRifiuto: ''
    });
    
    document.getElementById('modal-add-presente').remove();
    renderPresenti();
}

function rimuoviPresente(idx) {
    currentPresenti.splice(idx, 1);
    renderPresenti();
}

function toggleRifiutoFirma(idx, checked) {
    currentPresenti[idx].rifiuto = checked;
    if (checked) currentPresenti[idx].firmaBase64 = null;
    renderPresenti();
}

function updateNotaRifiuto(idx, val) {
    currentPresenti[idx].noteRifiuto = val;
}

function abilitaFirmaPresente(idx) {
    const box = document.getElementById(`canvas-presente-${idx}`);
    if (!box) return;
    signatureCanvases[idx] = new SignatureCanvas(`canvas-presente-${idx}`, { width: box.clientWidth, height: 96 });
}

function inizializzaFirmaCSE() {
    const box = document.getElementById('cse-signature-box');
    box.innerHTML = '';
    signatureCanvases['cse'] = new SignatureCanvas('cse-signature-box', { width: box.clientWidth, height: 128 });
}

/**
 * Finalizzazione e Generazione
 */
async function salvaVerbale(nuovoStato = 'bozza') {
    const projectId = sessionStorage.getItem('currentProjectId');
    
    // Acquisizione firme correnti dai canvas
    Object.keys(signatureCanvases).forEach(key => {
        const sign = signatureCanvases[key].toDataURL();
        if (sign) {
            if (key === 'cse') {
                // Info redattore verrà aggiornata sotto
            } else {
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
        redattoreInfo: {
            isDelegato: false,
            nomeRedattore: document.getElementById('v-cse-nome').value,
            qualifica: document.getElementById('v-cse-qualifica').value,
            firmaBase64: signatureCanvases['cse'] ? signatureCanvases['cse'].toDataURL() || (await getItem('verbali', currentVerbaleId))?.redattoreInfo.firmaBase64 : (await getItem('verbali', currentVerbaleId))?.redattoreInfo.firmaBase64
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
    
    // 1. Validazione obbligatoria
    if (!verbale.dataSopralluogo || !verbale.oggetto || !verbale.statoLuoghi) {
        alert("Compila data, oggetto e stato dei luoghi prima di finalizzare.");
        return;
    }

    // 2. Numerazione Progressiva YYYYMMDD/VSNN
    if (!verbale.numeroProgressivo) {
        const dataPrefix = verbale.dataSopralluogo.replace(/-/g, '');
        const verbaliGiorno = await getByIndex('verbali', 'projectId', verbale.projectId);
        const count = verbaliGiorno.filter(v => v.dataSopralluogo === verbale.dataSopralluogo && v.stato === 'finalizzato').length;
        verbale.numeroProgressivo = `${dataPrefix}/VS${String(count + 1).padStart(2, '0')}`;
        await saveItem('verbali', verbale);
    }

    // 3. Preparazione Dati estesi per Word (Mapping loops)
    const imprese = await getByIndex('imprese', 'projectId', verbale.projectId);
    const dataWord = {
        ...verbale,
        numero_progressivo: verbale.numeroProgressivo,
        data_sopralluogo: new Date(verbale.dataSopralluogo).toLocaleDateString('it-IT'),
        condizioni_meteo: verbale.condizioniMeteo.toUpperCase(),
        progressiva_inizio: verbale.progressivaChilometrica.inizio,
        progressiva_fine: verbale.progressivaChilometrica.fine,
        
        imprese_presenti: Array.from(new Set(verbale.presenti.map(p => p.impresa))).map(impName => {
            const impObj = imprese.find(i => i.ragioneSociale === impName);
            return { ragione_sociale: impName, ruolo: impObj ? impObj.ruolo : 'Esecutrice' };
        }),
        
        referenti_presenti: verbale.presenti.map(p => ({
            nome_completo: p.nome,
            qualifica: p.qualifica,
            impresa: p.impresa
        })),

        presenti_firme: verbale.presenti.map(p => ({
            nome_completo: p.nome,
            qualifica: p.qualifica,
            firma_image: p.firmaBase64,
            rifiutato: p.rifiuto ? 'SI (Rifiuta firma)' : 'NO',
            note_rifiuto: p.noteRifiuto || ''
        })),

        firma_cse: verbale.redattoreInfo.firmaBase64,
        nome_cse: verbale.redattoreInfo.nomeRedattore,
        ruolo_cse: verbale.redattoreInfo.qualifica,
        data_finalizzazione: new Date().toLocaleString('it-IT')
    };

    try {
        const blob = await DocxGenerator.generate(dataWord);
        const fileName = `Verbale_${verbale.numeroProgressivo.replace(/\//g, '_')}.docx`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        
        showToast("Verbale finalizzato e scaricato! ✓", "success");
        document.getElementById('modal-editor-verbale').remove();
        renderVerbali();
    } catch (err) {
        console.error(err);
        alert("Errore generazione documento: " + err.message);
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
