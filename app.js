// app.js - SafeHub v3 Core Engine

/**
 * ROUTER: Gestisce il passaggio tra i livelli e le view
 */
const Router = {
    state: 'HOME', // 'HOME' | 'CANTIERE'
    currentProjectId: null,

    init() {
        window.addEventListener('load', async () => {
            await initDB();
            this.nav('HOME');
        });
    },

    async nav(target, projectId = null) {
        this.state = target;
        this.currentProjectId = projectId || sessionStorage.getItem('currentProjectId');
        
        const homeView = document.getElementById('view-home');
        const cantiereView = document.getElementById('view-cantiere');
        const btnBack = document.getElementById('btn-back-home');
        const appTitle = document.getElementById('app-title');

        if (target === 'HOME') {
            homeView.classList.remove('page-hidden');
            cantiereView.classList.add('page-hidden');
            btnBack.classList.add('page-hidden');
            appTitle.innerText = "SafeHub v3 · Home";
            sessionStorage.removeItem('currentProjectId');
            await CantiereController.renderGrid();
        } else if (target === 'CANTIERE') {
            homeView.classList.add('page-hidden');
            cantiereView.classList.remove('page-hidden');
            btnBack.classList.remove('page-hidden');
            if (projectId) sessionStorage.setItem('currentProjectId', projectId);
            
            const p = await getItem('projects', this.currentProjectId);
            appTitle.innerText = `Cantiere: ${p?.id || '?'}`;

            // Info sidebar
            const sidebarInfo = document.getElementById('sidebar-cantiere-info');
            if (sidebarInfo && p) {
                sidebarInfo.innerHTML = `<div class="font-bold text-slate-300 truncate">${p.nome}</div><div class="text-slate-600 font-mono">${p.id}</div>`;
            }

            // Default sub-view: Dashboard
            this.navSubView('DASHBOARD');
        }
    },

    async navSubView(target) {
        const container = document.getElementById('cantiere-content');
        container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">Caricamento ${target}...</div>`;

        // Aggiorna stato attivo sidebar
        document.querySelectorAll('[id^="nav-"]').forEach(btn => btn.classList.remove('nav-active'));
        const activeBtn = document.getElementById('nav-' + target);
        if (activeBtn) activeBtn.classList.add('nav-active');

        switch(target) {
            case 'DASHBOARD':
                await DashboardController.render();
                break;
            case 'IMPRESE':
                if (window.ImpreseModulo) await window.ImpreseModulo.render(container);
                else await ImpreseController.render();
                break;
            case 'ANAS':
                if (window.PersoneAnasModulo) await window.PersoneAnasModulo.render(container);
                else await PersoneController.render('ANAS');
                break;
            case 'TERZI':
                if (window.PersoneTerziModulo) await window.PersoneTerziModulo.render(container);
                else await PersoneController.render('TERZI');
                break;
            case 'LAVORATORI':
                if (window.LavoratoriModulo) await window.LavoratoriModulo.render(container);
                else await RisorseController.render('LAVORATORI');
                break;
            case 'MEZZI':
                if (window.MezziModulo) await window.MezziModulo.render(container);
                else await RisorseController.render('MEZZI');
                break;
            case 'VERBALI':
                container.innerHTML = `<div id="view-verbali"></div>`;
                if (window.renderVerbali) await window.renderVerbali();
                break;
            case 'VERBALI_RIUNIONE':
                container.innerHTML = `<div id="view-verbali-riunione"></div>`;
                if (window.renderVerbaliRiunione) await window.renderVerbaliRiunione();
                break;
            case 'ANAGRAFICA_CANTIERE':
                container.innerHTML = `<div id="view-anagrafica-cantiere"></div>`;
                if (window.renderAnagraficaCantiere) await window.renderAnagraficaCantiere();
                break;
            case 'IMPOSTAZIONI':
                container.innerHTML = `<div id="view-impostazioni"></div>`;
                if (window.renderViewImpostazioni) await window.renderViewImpostazioni('view-impostazioni');
                else container.innerHTML = `<div class="p-8 text-slate-400">Impostazioni non disponibili.</div>`;
                break;
            default:
                container.innerHTML = `
                    <div class="p-20 text-center bg-white rounded-[2.5rem] border">
                        <span class="text-5xl block mb-4">🚧</span>
                        <h3 class="text-xl font-bold">Sezione ${target} in costruzione</h3>
                        <p class="text-slate-400 mt-2">Implementazione prevista nelle fasi successive del refactoring.</p>
                    </div>
                `;
        }
    }
};

/**
 * DASHBOARD: KPI e riepilogo cantiere
 */
const DashboardController = {
    async render() {
        const p = await getItem('projects', sessionStorage.getItem('currentProjectId'));
        const verbali = await getByIndex('verbali', 'projectId', p.id);
        const nc = await getByIndex('nc', 'projectId', p.id);

        const container = document.getElementById('cantiere-content');
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <header>
                    <h2 class="text-4xl font-extrabold text-slate-900">${p.nome}</h2>
                    <p class="text-slate-500 font-medium mt-1">Sintesi operativa e indicatori di sicurezza</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Verbali Emessi</span>
                        <div class="text-4xl font-black text-blue-600">${verbali.length}</div>
                    </div>
                    <div class="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">NC Aperte</span>
                        <div class="text-4xl font-black text-red-600">${nc.filter(n => n.stato === 'aperta').length}</div>
                    </div>
                    <div class="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Ultimo Sopralluogo</span>
                        <div class="text-lg font-bold text-slate-800">${verbali.length > 0 ? new Date(verbali[0].data).toLocaleDateString() : 'Nessuno'}</div>
                    </div>
                </div>

                <div class="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl flex justify-between items-center">
                    <div>
                        <h4 class="text-xl font-bold mb-1">Stato Cantiere: ${p.stato.toUpperCase()}</h4>
                        <p class="text-blue-100 text-sm">Tutti i sistemi di sicurezza sono attivi.</p>
                    </div>
                    <button class="bg-white text-blue-600 font-bold px-6 py-3 rounded-2xl shadow-lg">Esporta Report</button>
                </div>
            </div>
        `;
    }
};

/**
 * CONTROLLER: Logica di business per i cantieri
 */
const CantiereController = {
    async crea() {
        const id = document.getElementById('new-p-id').value.trim().toUpperCase();
        const nome = document.getElementById('new-p-name').value.trim();

        if (!id || !nome) {
            alert("Compila tutti i campi!");
            return;
        }

        const project = { id, nome, stato: 'attivo', createdAt: new Date().toISOString() };
        await saveItem('projects', project);
        
        UI.chiudiModalCantiere();
        await Router.nav('CANTIERE', id);
    },

    async renderGrid() {
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        const projects = await getByIndex('projects', 'stato', 'attivo');
        
        if (projects.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <span class="text-5xl block mb-4">📂</span>
                    <p class="text-slate-400 font-medium italic">Nessun cantiere attivo. Inizia creandone uno!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = projects.map(p => {
            const incompleto = typeof datiAmministrativiIncompleti === 'function' && datiAmministrativiIncompleti(p);
            const badge = incompleto
                ? `<div class="mt-2">
                       <button onclick="event.stopPropagation(); Router.nav('CANTIERE','${p.id}').then(()=>apriAnagraficaEditMode())"
                               class="bg-red-50 text-red-600 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-100 transition">
                           ⚠ Dati amministrativi incompleti
                       </button>
                   </div>`
                : '';
            return `
            <div class="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm card-hover cursor-pointer flex flex-col justify-between group" onclick="Router.nav('CANTIERE', '${p.id}')">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <span class="bg-blue-50 text-blue-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest">${p.id}</span>
                        <button class="text-slate-300 hover:text-red-500 transition-colors" onclick="event.stopPropagation(); CantiereController.elimina('${p.id}')">🗑️</button>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">${p.nome}</h3>
                    ${badge}
                </div>
                <div class="mt-8 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    <span>Creato: ${new Date(p.createdAt).toLocaleDateString()}</span>
                    <span class="text-blue-600">Entra →</span>
                </div>
            </div>`;
        }).join('');
    },

    async elimina(id) {
        if (confirm(`Sei sicuro di voler eliminare il cantiere ${id} e TUTTI i suoi dati?`)) {
            try {
                await eliminaCantiere(id);
                showToast(`Cantiere ${id} eliminato.`, 'info');
                await this.renderGrid();
            } catch (err) {
                console.error('Errore eliminazione cantiere:', err);
                showToast('Errore durante l\'eliminazione. Riprova.', 'error');
            }
        }
    }
};

/**
 * UI: Gestione elementi grafici
 */
const UI = {
    apriModalCantiere() {
        document.getElementById('modal-new-project').classList.remove('page-hidden');
    },
    chiudiModalCantiere() {
        document.getElementById('modal-new-project').classList.add('page-hidden');
        document.getElementById('new-p-id').value = '';
        document.getElementById('new-p-name').value = '';
    }
};

// Inizializzazione
Router.init();

// Esposizione per HTML
window.Router = Router;
window.UI = UI;
window.CantiereController = CantiereController;

/**
 * showToast — feedback visivo non bloccante
 * @param {string} msg  Messaggio
 * @param {string} tipo 'success' | 'error' | 'info' | 'warning'
 * @param {number} ms   Durata in ms (default 3000)
 */
function showToast(msg, tipo = 'success', ms = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) { console.log('[Toast]', msg); return; }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), ms);
}
window.showToast = showToast;

/**
 * escapeHtml — previene XSS nelle template string HTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

/**
 * IMPRESE: Gestione anagrafica scoped a cantiere
 */
const ImpreseController = {
    async render() {
        const projectId = sessionStorage.getItem('currentProjectId');
        const container = document.getElementById('cantiere-content');
        
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in">
                <header class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-bold text-slate-900">Imprese</h2>
                        <p class="text-slate-500">Anagrafica delle imprese operanti nel lotto</p>
                    </div>
                    <button onclick="ImpreseController.apriModal()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">+ Nuova Impresa</button>
                </header>
                <div id="imprese-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
            </div>
        `;
        await this.loadList();
    },

    async loadList() {
        const grid = document.getElementById('imprese-grid');
        const items = await getByIndex('imprese', 'projectId', sessionStorage.getItem('currentProjectId'));
        
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 italic">Nessuna impresa registrata.</div>`;
            return;
        }

        grid.innerHTML = items.map(i => `
            <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group">
                <div class="flex justify-between items-start mb-4">
                    <span class="bg-slate-100 text-slate-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">${i.ruolo}</span>
                    <button class="text-slate-300 hover:text-red-500" onclick="ImpreseController.elimina('${i.id}')">🗑️</button>
                </div>
                <h4 class="text-lg font-bold text-slate-800 mb-1">${i.ragioneSociale}</h4>
                <p class="text-xs text-slate-400 font-mono">P.IVA: ${i.partitaIva}</p>
                <div class="mt-6 pt-4 border-t border-slate-50 flex gap-2">
                    <button class="flex-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-xl text-[10px] font-bold uppercase transition-all">Dettagli</button>
                    <button class="flex-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-xl text-[10px] font-bold uppercase transition-all">Doc</button>
                </div>
            </div>
        `).join('');
    },

    apriModal() {
        // Implementerò il modal dinamico nel prossimo step
        const rag = prompt("Ragione Sociale:");
        const piva = prompt("Partita IVA (11 cifre):");
        const ruolo = prompt("Ruolo (AFFIDATARIA|ESECUTRICE|SUBAPPALTO):");
        if(rag && piva && ruolo) this.salva({ ragioneSociale: rag, partitaIva: piva, ruolo: ruolo.toUpperCase() });
    },

    async salva(data) {
        const id = 'imp_' + Date.now();
        const item = { ...data, id, projectId: sessionStorage.getItem('currentProjectId') };
        await saveItem('imprese', item);
        await this.loadList();
    },

    async elimina(id) {
        if(confirm("Eliminare l'impresa?")) {
            await deleteItem('imprese', id);
            await this.loadList();
        }
    }
};

window.ImpreseController = ImpreseController;

/**
 * PERSONE: Gestione anagrafica personale ANAS e Terzi
 */
const PersoneController = {
    async render(tipo = 'ANAS') {
        const container = document.getElementById('cantiere-content');
        const isAnas = tipo === 'ANAS';
        
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in">
                <header class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-bold text-slate-900">${isAnas ? 'Sicurezza & Personale' : 'Enti Terzi'}</h2>
                        <p class="text-slate-500">${isAnas ? 'Referenti tecnici e ruoli di coordinamento' : 'Autorità e consulenti esterni'}</p>
                    </div>
                    <button onclick="PersoneController.apriModal('${tipo}')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">+ Nuovo</button>
                </header>
                <div id="persone-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
            </div>
        `;
        await this.loadList(tipo);
    },

    async loadList(tipo) {
        const grid = document.getElementById('persone-grid');
        const store = tipo === 'ANAS' ? 'persone_anas' : 'persone_terzi';
        const items = await getByIndex(store, 'projectId', sessionStorage.getItem('currentProjectId'));
        
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 italic">Nessun referente registrato.</div>`;
            return;
        }

        grid.innerHTML = items.map(p => `
            <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group card-hover">
                <div class="flex justify-between items-start mb-4">
                    <span class="bg-indigo-50 text-indigo-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">${p.ruolo || p.ente || 'Referente'}</span>
                    <button class="text-slate-300 hover:text-red-500" onclick="PersoneController.elimina('${p.id}', '${tipo}')">🗑️</button>
                </div>
                <h4 class="text-lg font-bold text-slate-800 mb-1">${p.nome} ${p.cognome}</h4>
                <p class="text-xs text-slate-400">${p.qualifica}</p>
                <div class="mt-6 pt-4 border-t border-slate-50 flex flex-col gap-2">
                    <div class="flex items-center gap-2 text-xs text-slate-500"><span>📧</span> ${p.email || '-'}</div>
                    <div class="flex items-center gap-2 text-xs text-slate-500"><span>📞</span> ${p.telefono || '-'}</div>
                </div>
            </div>
        `).join('');
    },

    apriModal(tipo) {
        const nome = prompt("Nome:");
        const cognome = prompt("Cognome:");
        const qualifica = prompt("Qualifica:");
        const ruolo = prompt(tipo === 'ANAS' ? "Ruolo (RUP|DL|CSE):" : "Ente:");
        if(nome && cognome) {
            const data = { nome, cognome, qualifica };
            if(tipo === 'ANAS') data.ruolo = ruolo; else data.ente = ruolo;
            this.salva(data, tipo);
        }
    },

    async salva(data, tipo) {
        const store = tipo === 'ANAS' ? 'persone_anas' : 'persone_terzi';
        const id = (tipo === 'ANAS' ? 'pa_' : 'pt_') + Date.now();
        const item = { ...data, id, projectId: sessionStorage.getItem('currentProjectId') };
        await saveItem(store, item);
        await this.loadList(tipo);
    },

    async elimina(id, tipo) {
        if(confirm("Eliminare il referente?")) {
            const store = tipo === 'ANAS' ? 'persone_anas' : 'persone_terzi';
            await deleteItem(store, id);
            await this.loadList(tipo);
        }
    }
};

window.PersoneController = PersoneController;

/**
 * RISORSE: Gestione Lavoratori e Mezzi scoped a Impresa e Cantiere
 */
const RisorseController = {
    async render(tipo = 'LAVORATORI') {
        const container = document.getElementById('cantiere-content');
        const isLav = tipo === 'LAVORATORI';
        const projectId = sessionStorage.getItem('currentProjectId');
        const imprese = await getByIndex('imprese', 'projectId', projectId);
        
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in">
                <header class="flex justify-between items-center">
                    <div>
                        <h2 class="text-3xl font-bold text-slate-900">${isLav ? 'Lavoratori' : 'Mezzi & Attrezzature'}</h2>
                        <p class="text-slate-500">${isLav ? 'Maestranze operanti nel lotto' : 'Parco macchine e attrezzature di cantiere'}</p>
                    </div>
                    <button onclick="RisorseController.apriModal('${tipo}')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">+ Nuovo</button>
                </header>
                <div class="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtra per Impresa:</span>
                    <select id="filter-resource-impresa" onchange="RisorseController.loadList('${tipo}', this.value)" class="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none">
                        <option value="">Tutte le Imprese</option>
                        ${imprese.map(i => `<option value="${i.id}">${i.ragioneSociale}</option>`).join('')}
                    </select>
                </div>
                <div id="resources-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
            </div>
        `;
        await this.loadList(tipo);
    },

    async loadList(tipo, impresaId = null) {
        const grid = document.getElementById('resources-grid');
        const store = tipo === 'LAVORATORI' ? 'lavoratori' : 'mezzi';
        let items = await getByIndex(store, 'projectId', sessionStorage.getItem('currentProjectId'));
        
        if (impresaId) {
            items = items.filter(i => i.impresaId === impresaId);
        }

        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 italic">Nessuna risorsa trovata.</div>`;
            return;
        }

        const imprese = await getByIndex('imprese', 'projectId', sessionStorage.getItem('currentProjectId'));

        grid.innerHTML = items.map(item => {
            const imp = imprese.find(i => i.id === item.impresaId);
            return `
                <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm card-hover relative group">
                    <div class="flex justify-between items-start mb-4">
                        <span class="bg-blue-50 text-blue-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">${imp ? imp.ragioneSociale : 'Indipendente'}</span>
                        <button class="text-slate-300 hover:text-red-500" onclick="RisorseController.elimina('${item.id}', '${tipo}')">🗑️</button>
                    </div>
                    <h4 class="text-lg font-bold text-slate-800 mb-1">${tipo === 'LAVORATORI' ? `${item.nome} ${item.cognome}` : `${item.marca} ${item.modello}`}</h4>
                    <p class="text-xs text-slate-400">${item.mansione || item.tipologia || '-'}</p>
                    <div class="mt-6 pt-4 border-t border-slate-50">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2">Stato Documentazione</div>
                        <div class="flex gap-1">
                            <div class="h-1.5 flex-1 rounded-full bg-green-500"></div>
                            <div class="h-1.5 flex-1 rounded-full bg-green-500"></div>
                            <div class="h-1.5 flex-1 rounded-full bg-slate-200"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    async apriModal(tipo) {
        const projectId = sessionStorage.getItem('currentProjectId');
        const imprese = await getByIndex('imprese', 'projectId', projectId);
        if (imprese.length === 0) { alert("Crea prima un'impresa!"); return; }

        const impId = prompt("ID Impresa (scegli tra: " + imprese.map(i => i.ragioneSociale + "[" + i.id + "]").join(', ') + "):");
        const val1 = prompt(tipo === 'LAVORATORI' ? "Nome:" : "Marca:");
        const val2 = prompt(tipo === 'LAVORATORI' ? "Cognome:" : "Modello:");
        
        if(impId && val1 && val2) {
            const data = { impresaId: impId };
            if(tipo === 'LAVORATORI') { data.nome = val1; data.cognome = val2; } 
            else { data.marca = val1; data.modello = val2; }
            await this.salva(data, tipo);
        }
    },

    async salva(data, tipo) {
        const store = tipo === 'LAVORATORI' ? 'lavoratori' : 'mezzi';
        const id = (tipo === 'LAVORATORI' ? 'lav_' : 'mzo_') + Date.now();
        const item = { ...data, id, projectId: sessionStorage.getItem('currentProjectId') };
        await saveItem(store, item);
        await this.loadList(tipo);
    },

    async elimina(id, tipo) {
        if(confirm("Eliminare la risorsa?")) {
            const store = tipo === 'LAVORATORI' ? 'lavoratori' : 'mezzi';
            await deleteItem(store, id);
            await this.loadList(tipo);
        }
    }
};

window.RisorseController = RisorseController;
