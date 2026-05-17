/**
 * verbali-riunione.js — FASE 5.2
 * Gestione Verbali Riunione di Coordinamento
 * Store: verbali_riunione (DB v12) — pattern replica verbali-sopralluogo.js
 */

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentVerbaleRiunioneId  = null;
let currentPresentiSicurezza  = [];
let currentPresentiImprese    = [];
let currentAllegatiFoto       = [];
let signatureCanvasesRC       = {};
let _verbaleRiunioneEsistente = null;

// ─── DB HELPER (autoIncrement: IDB assegna id al primo put) ───────────────────
function _saveVerbaleRiunioneDB(record) {
    return new Promise((resolve, reject) => {
        if (!db) { reject('DB non inizializzato.'); return; }
        const t = db.transaction('verbali_riunione', 'readwrite');
        const s = t.objectStore('verbali_riunione');
        record.modifiedAt = new Date().toISOString();
        const req = s.put(record);
        req.onsuccess = () => { record.id = req.result; resolve(record); };
        req.onerror  = () => reject(req.error);
    });
}

// ─── LISTA ────────────────────────────────────────────────────────────────────
async function renderVerbaliRiunione() {
    const projectId = sessionStorage.getItem('currentProjectId');
    if (!projectId) return;
    const container = document.getElementById('cantiere-content');
    const verbali = await getByIndex('verbali_riunione', 'projectId', projectId);
    verbali.sort((a, b) => (b.dataRiunione || '').localeCompare(a.dataRiunione || ''));

    const tipoLabel  = { preliminare: 'Preliminare', corso_opera: "Corso d'opera", nuove_imprese: 'Nuove imprese', rls: 'Coord. RLS' };
    const tipoColore = { preliminare: 'bg-blue-100 text-blue-700', corso_opera: 'bg-indigo-100 text-indigo-700', nuove_imprese: 'bg-orange-100 text-orange-700', rls: 'bg-purple-100 text-purple-700' };

    const rows = verbali.length ? verbali.map(v => {
        const totPresenti = (v.presentiSicurezza?.length || 0) + (v.presentiImprese?.length || 0);
        const stato = v.stato === 'FINALIZZATO'
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">FINALIZZATO</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700">BOZZA</span>';
        const tipo = v.tipoRiunione
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tipoColore[v.tipoRiunione] || 'bg-slate-100 text-slate-600'}">${tipoLabel[v.tipoRiunione] || v.tipoRiunione}</span>`
            : '—';
        const data = v.dataRiunione ? new Date(v.dataRiunione + 'T00:00:00').toLocaleDateString('it-IT') : '—';
        const isFin = v.stato === 'FINALIZZATO';
        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-mono text-xs font-bold text-slate-600">${escapeHtml(v.numeroProgressivo || '—')}</td>
            <td class="px-4 py-3 text-sm">${data}</td>
            <td class="px-4 py-3">${tipo}</td>
            <td class="px-4 py-3">${stato}</td>
            <td class="px-4 py-3 text-center text-sm text-slate-500">${totPresenti}</td>
            <td class="px-4 py-3 text-center text-sm text-slate-500">${v.allegatiFoto?.length || 0}</td>
            <td class="px-4 py-3">
                <div class="flex gap-1.5 justify-end">
                    <button onclick="apriVerbaleRiunione(${v.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="${isFin ? 'Visualizza' : 'Modifica'}">✏️</button>
                    <button onclick="mostraAnteprimaRiunione(${v.id})" class="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Anteprima stampa">👁</button>
                    ${isFin ? `<button onclick="_scaricaWordRiunione(${v.id})" class="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Scarica Word">📄</button>` : ''}
                    ${(v.allegatiFoto?.length > 0) ? `<button onclick="scaricaAllegatiFotoZip(${v.id})" class="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Scarica foto ZIP">🗜️</button>` : ''}
                    <button onclick="eliminaVerbaleRiunione(${v.id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Elimina">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="7" class="px-4 py-12 text-center text-slate-400 text-sm">Nessun verbale riunione. Clicca "+ Nuovo" per iniziare.</td></tr>`;

    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in">
        <header class="flex justify-between items-center">
            <div>
                <h2 class="text-3xl font-bold text-slate-900">Verbali Riunione di Coordinamento</h2>
                <p class="text-slate-500 text-sm mt-1">Ordinati per data riunione (più recente in cima)</p>
            </div>
            <div class="flex gap-3">
                <button onclick="mostraWizardTemplateRiunione()" class="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 transition shadow-sm">⚙️ Template Word</button>
                <button onclick="checkTemplateAndNewVerbaleRiunione()" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition shadow">+ Nuovo Verbale</button>
            </div>
        </header>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table class="w-full text-sm">
                <thead class="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th class="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">N°</th>
                        <th class="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                        <th class="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                        <th class="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stato</th>
                        <th class="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presenti</th>
                        <th class="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto</th>
                        <th class="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Azioni</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">${rows}</tbody>
            </table>
        </div>
    </div>`;
}

// ─── TEMPLATE ─────────────────────────────────────────────────────────────────
async function checkTemplateAndNewVerbaleRiunione() {
    const tpl = await getItem('impostazioni', 'template_verbale_riunione');
    if (!tpl?.valore) {
        if (confirm('Template Word non ancora caricato.\nVuoi caricarlo adesso?')) mostraWizardTemplateRiunione();
        return;
    }
    apriVerbaleRiunione(null);
}

async function mostraWizardTemplateRiunione() {
    const esistente = await getItem('impostazioni', 'template_verbale_riunione');
    const modal = document.createElement('div');
    modal.id = 'modal-template-riunione';
    modal.className = 'fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div class="bg-slate-800 p-5 text-white rounded-t-2xl flex justify-between items-center">
            <span class="font-bold">📄 Template Verbale Riunione di Coordinamento</span>
            <button onclick="document.getElementById('modal-template-riunione').remove()" class="text-xl">×</button>
        </div>
        <div class="p-6 space-y-4">
            <p class="text-sm text-slate-600">Carica <strong>Verbale_Riunione_di_Coordinamento_v3.docx</strong>.</p>
            ${esistente ? '<p class="text-xs text-green-600 font-semibold">✓ Template già caricato — puoi sostituirlo.</p>' : '<p class="text-xs text-orange-600 font-semibold">⚠ Nessun template caricato.</p>'}
            <label class="block">
                <span class="text-sm font-semibold text-slate-700">Seleziona file .docx</span>
                <input type="file" accept=".docx" onchange="handleTemplateUploadRiunione(event)"
                       class="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:font-semibold cursor-pointer">
            </label>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function handleTemplateUploadRiunione(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) { showToast('Seleziona un file .docx', 'error'); return; }
    const buffer = await file.arrayBuffer();
    await saveItem('impostazioni', { chiave: 'template_verbale_riunione', valore: buffer, nome: file.name });
    document.getElementById('modal-template-riunione')?.remove();
    showToast('Template caricato: ' + file.name, 'success');
}

// ─── FORM ─────────────────────────────────────────────────────────────────────
async function apriVerbaleRiunione(id = null) {
    signatureCanvasesRC = {};
    window._rcFirmaCse  = null;
    const projectId = sessionStorage.getItem('currentProjectId');
    const project   = await getItem('projects', projectId);
    const imprese   = await getByIndex('imprese', 'projectId', projectId);

    let verbale;
    if (id) {
        verbale = await getItem('verbali_riunione', id);
        _verbaleRiunioneEsistente = verbale;
        currentVerbaleRiunioneId  = verbale.id;
    } else {
        _verbaleRiunioneEsistente = null;
        currentVerbaleRiunioneId  = null;
        verbale = {
            projectId,
            stato: 'BOZZA',
            dataRiunione: new Date().toISOString().split('T')[0],
            tipoRiunione: 'corso_opera',
            labelPresentiSicurezza: 'ANAS',
            presentiSicurezza: [],
            presentiImprese: [],
            argomentiChecklist: ['illustrazione_psc','layout_cantiere','incarichi','responsabili','servizi_impianti','sorveglianza_sanitaria'],
            impresaPos: '',
            noteArgomenti: '',
            criticitaOsservazioni: '',
            istruzioniOperative: '',
            aggiornaPsc: false,
            allegatiFoto: [],
            nomeCse: '',
            ruoloCse: 'Titolare',
            attoDelega: '',
            firmaCseImage: null,
            timestampFirmaCse: null,
            numeroProgressivo: '',
            dataCreazione: new Date().toISOString(),
            dataFinalizzazione: null
        };
    }

    currentPresentiSicurezza = (verbale.presentiSicurezza || []).map(p => ({...p}));
    currentPresentiImprese   = (verbale.presentiImprese   || []).map(p => ({...p}));
    currentAllegatiFoto      = (verbale.allegatiFoto      || []).map(f => ({...f}));

    const isFin = verbale.stato === 'FINALIZZATO';
    const ro    = isFin ? 'readonly' : '';
    const rod   = isFin ? 'disabled' : '';
    const impreseOptions = imprese.map(i => `<option value="${escapeHtml(i.ragioneSociale)}">`).join('');

    const argomentiDef = [
        { id: 'illustrazione_psc',      label: 'Illustrazione PSC' },
        { id: 'layout_cantiere',        label: 'Layout di Cantiere' },
        { id: 'pos_impresa',            label: 'POS impresa (specifica impresa sotto)' },
        { id: 'incarichi',              label: 'Attribuzione incarichi e competenze' },
        { id: 'responsabili',           label: 'Responsabili di cantiere imprese esecutrici' },
        { id: 'servizi_impianti',       label: 'Servizi/impianti comuni' },
        { id: 'sorveglianza_sanitaria', label: 'Sorveglianza sanitaria' },
        { id: 'coordinamento_rls',      label: 'Coordinamento RLS' }
    ];
    const checklist = argomentiDef.map(a => {
        const ck = (verbale.argomentiChecklist || []).includes(a.id) ? 'checked' : '';
        return `<label class="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" id="arg-${a.id}" value="${a.id}" ${ck} ${rod} onchange="toggleArgPos()" class="mt-0.5 rounded">
            <span>${escapeHtml(a.label)}</span>
        </label>`;
    }).join('');

    const tipiRiunione = [
        { val: 'preliminare',   label: '🔵 Preliminare' },
        { val: 'corso_opera',   label: "🟢 In corso d'opera" },
        { val: 'nuove_imprese', label: '🟠 Ingresso nuove imprese' },
        { val: 'rls',           label: '🟣 Coordinamento RLS' }
    ];

    const container = document.getElementById('cantiere-content');
    container.innerHTML = `
    <datalist id="dl-imprese-rc">${impreseOptions}</datalist>
    <div class="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">

        <header class="flex items-center gap-4">
            <button onclick="renderVerbaliRiunione()" class="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">← Lista</button>
            <div>
                <h2 class="text-2xl font-bold text-slate-900">${isFin ? '📋' : '✏️'} Verbale Riunione di Coordinamento</h2>
                <p class="text-slate-500 text-sm">${isFin ? 'Finalizzato — sola lettura' : 'Bozza in lavorazione'}</p>
            </div>
            ${isFin ? '<span class="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">FINALIZZATO</span>' : ''}
        </header>

        <!-- 1. INTESTAZIONE -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">1. Intestazione cantiere</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div><span class="text-slate-400 text-xs block">Cantiere</span><span class="font-semibold">${escapeHtml(project?.nome || '—')}</span></div>
                <div><span class="text-slate-400 text-xs block">N° Progressivo</span><span id="rc-numero-display" class="font-mono font-bold text-slate-600">${escapeHtml(verbale.numeroProgressivo || '(assegnato alla finalizzazione)')}</span></div>
                <div><span class="text-slate-400 text-xs block">S.S. N°</span><span class="font-semibold">${escapeHtml(project?.ssNumero || '—')}</span></div>
                <div><span class="text-slate-400 text-xs block">Codice PPM/SIL</span><span class="font-semibold">${escapeHtml(project?.codicePpmSil || '—')}</span></div>
                <div class="col-span-2"><span class="text-slate-400 text-xs block">Titolo lavoro</span><span class="font-semibold">${escapeHtml(project?.titolo || project?.nome || '—')}</span></div>
                <div><span class="text-slate-400 text-xs block">Contratto N°</span><span class="font-semibold">${escapeHtml(project?.contrattoNumero || '—')}</span></div>
                <div><span class="text-slate-400 text-xs block">Del</span><span class="font-semibold">${project?.contrattoData ? new Date(project.contrattoData + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</span></div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Data riunione *</label>
                <input type="date" id="rc-data" value="${escapeHtml(verbale.dataRiunione || '')}" ${ro}
                       class="w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500">
            </div>
        </section>

        <!-- 2. TIPO RIUNIONE -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">2. Tipo riunione *</h3>
            <div class="grid grid-cols-2 gap-3">
                ${tipiRiunione.map(t => `
                <label class="flex items-center gap-2 text-sm cursor-pointer p-3 border rounded-xl hover:bg-slate-50 transition ${verbale.tipoRiunione === t.val ? 'border-slate-700 bg-slate-50' : 'border-slate-200'}">
                    <input type="radio" name="rc-tipo" value="${t.val}" ${verbale.tipoRiunione === t.val ? 'checked' : ''} ${rod} class="accent-slate-800">
                    ${t.label}
                </label>`).join('')}
            </div>
        </section>

        <!-- 3. PRESENTI SICUREZZA -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">3. Presenti per la Sicurezza *</h3>
                    <div class="mt-2 flex items-center gap-2">
                        <span class="text-xs text-slate-500">Label colonna firma:</span>
                        <input type="text" id="rc-label-sicurezza" value="${escapeHtml(verbale.labelPresentiSicurezza || 'ANAS')}" ${ro}
                               placeholder="es. ANAS, Comune…"
                               class="border border-slate-200 rounded-lg px-2 py-1 text-xs w-36 focus:ring-1 focus:ring-slate-400">
                    </div>
                </div>
                ${!isFin ? `<button onclick="aggiungiPresenteSicurezza()" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-600 transition">+ Aggiungi</button>` : ''}
            </div>
            <div id="lista-presenti-sicurezza"></div>
        </section>

        <!-- 4. PRESENTI IMPRESE -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">4. Imprese presenti *</h3>
                ${!isFin ? `<button onclick="aggiungiPresenteImpresa()" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-600 transition">+ Aggiungi impresa</button>` : ''}
            </div>
            <div id="lista-presenti-imprese"></div>
        </section>

        <!-- 5. ARGOMENTI -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">5. Argomenti discussi</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${checklist}</div>
            <div id="impresa-pos-wrapper" class="${(verbale.argomentiChecklist || []).includes('pos_impresa') ? '' : 'hidden'} mt-2">
                <label class="block text-xs font-semibold text-slate-600 mb-1">Impresa POS</label>
                <input type="text" id="rc-impresa-pos" value="${escapeHtml(verbale.impresaPos || '')}" ${ro}
                       list="dl-imprese-rc" placeholder="Ragione sociale impresa"
                       class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Note aggiuntive</label>
                <textarea id="rc-note-argomenti" rows="3" ${ro} placeholder="Eventuali approfondimenti…"
                          class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-slate-500">${escapeHtml(verbale.noteArgomenti || '')}</textarea>
            </div>
        </section>

        <!-- 6. CRITICITÀ -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">6. Criticità riscontrate ed osservazioni emerse</h3>
            <textarea id="rc-criticita" rows="5" ${ro} placeholder="Criticità riscontrate e osservazioni emerse…"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-slate-500">${escapeHtml(verbale.criticitaOsservazioni || '')}</textarea>
        </section>

        <!-- 7. ISTRUZIONI -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">7. Istruzioni operative e decisioni intraprese</h3>
            <textarea id="rc-istruzioni" rows="5" ${ro} placeholder="Istruzioni impartite, decisioni prese, misure da adottare…"
                      class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-slate-500">${escapeHtml(verbale.istruzioniOperative || '')}</textarea>
        </section>

        <!-- 8. AGGIORNA PSC -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6">
            <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" id="rc-aggiorna-psc" ${verbale.aggiornaPsc ? 'checked' : ''} ${rod} class="mt-0.5 rounded">
                <div>
                    <span class="font-semibold text-sm text-slate-700">La riunione comporta aggiornamento del PSC</span>
                    <p class="text-xs text-slate-400 mt-0.5">Questo flag sarà letto dalla gestione PSC (FASE 7bis)</p>
                </div>
            </label>
        </section>

        <!-- 9. ALLEGATI FOTO -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">8. Allegati fotografici</h3>
            <p class="text-xs text-slate-400">Le foto NON entrano nel Word — scaricabili come ZIP separato. Max 20 foto / 5 MB cad.</p>
            ${!isFin ? `
            <label class="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition"
                   ondragover="event.preventDefault()" ondrop="handleFotoDropRC(event)">
                <input type="file" accept="image/*" multiple onchange="handleFotoUploadRC(this.files)" class="hidden">
                <span class="text-slate-400 text-sm">📷 Trascina qui o clicca per selezionare</span>
            </label>` : ''}
            <div id="lista-allegati-foto"></div>
        </section>

        <!-- 10. FIRMA CSE -->
        <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 class="font-bold text-slate-700 text-sm uppercase tracking-widest">9. Il Coordinatore per la Sicurezza in fase di Esecuzione</h3>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Nome e Cognome CSE *</label>
                    <input type="text" id="rc-cse-nome" value="${escapeHtml(verbale.nomeCse || '')}" ${ro}
                           class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500" placeholder="Nome Cognome">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Ruolo *</label>
                    <div class="flex gap-4 mt-2">
                        <label class="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="radio" name="rc-ruolo-cse" value="Titolare" ${verbale.ruoloCse !== 'Delegato' ? 'checked' : ''} ${rod} onchange="toggleDelegaUI_RC(false)"> Titolare
                        </label>
                        <label class="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="radio" name="rc-ruolo-cse" value="Delegato" ${verbale.ruoloCse === 'Delegato' ? 'checked' : ''} ${rod} onchange="toggleDelegaUI_RC(true)"> Delegato
                        </label>
                    </div>
                </div>
            </div>
            <div id="rc-delega-wrapper" class="${verbale.ruoloCse === 'Delegato' ? '' : 'hidden'}">
                <label class="block text-xs font-semibold text-slate-600 mb-1">Atto di delega (riferimento) *</label>
                <input type="text" id="rc-cse-atto" value="${escapeHtml(verbale.attoDelega || '')}" ${ro}
                       class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500" placeholder="Es. Delega prot. 001/2026">
            </div>
            ${!isFin ? `
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-2">Firma CSE *</label>
                <div class="flex gap-2 mb-3 flex-wrap">
                    <button onclick="usaFirmaPermanenteCSE_RC()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">✓ Usa firma salvata</button>
                    <button onclick="inizializzaFirmaCSE_RC()" class="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-600">✏️ Disegna</button>
                    <button onclick="abilitaPasteFirmaCSE_RC()" class="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300">📋 Incolla</button>
                </div>
                <div id="rc-firma-cse-canvas-container"></div>
                <div id="rc-firma-cse-paste-area" class="hidden">
                    <textarea placeholder="Incolla qui l'immagine firma (Ctrl+V)…"
                              class="w-full h-20 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                              onpaste="handlePasteFirmaCSE_RC(event)"></textarea>
                </div>
                <div id="rc-firma-cse-preview">${verbale.firmaCseImage ? `<img src="${verbale.firmaCseImage}" class="h-16 border border-slate-200 rounded-lg p-1 mt-2" alt="Firma CSE">` : ''}</div>
            </div>` : verbale.firmaCseImage ? `
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Firma CSE</label>
                <img src="${verbale.firmaCseImage}" class="h-16 border border-slate-200 rounded-lg p-1" alt="Firma CSE">
            </div>` : ''}
        </section>

        <!-- PULSANTI -->
        ${!isFin ? `
        <div class="flex justify-end gap-3 pt-2">
            <button onclick="salvaVerbaleRiunioneForm('BOZZA')" class="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition">💾 Salva Bozza</button>
            <button onclick="mostraAnteprimaRiunioneCorrente()" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-indigo-700 transition">👁 Anteprima Stampa</button>
            <button onclick="eseguiFinalizzazioneRiunione()" class="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-green-700 transition">✅ Finalizza</button>
        </div>` : `
        <div class="flex justify-end gap-3 pt-2">
            <button onclick="mostraAnteprimaRiunione(${verbale.id})" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-indigo-700 transition">👁 Anteprima Stampa</button>
            <button onclick="_scaricaWordRiunione(${verbale.id})" class="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-green-700 transition">📄 Scarica Word</button>
        </div>`}
    </div>`;

    renderPresentiSicurezza();
    renderPresentiImprese();
    renderAllegatiFoto();

    // Pre-popola nome CSE da impostazioni se nuovo verbale
    if (!id && typeof caricaImpostazioni === 'function') {
        caricaImpostazioni().then(imp => {
            if (imp?.nomeCse) {
                const el = document.getElementById('rc-cse-nome');
                if (el && !el.value) el.value = imp.nomeCse;
            }
        }).catch(() => {});
    }

    // Ripristina firma CSE salvata
    if (verbale.firmaCseImage) window._rcFirmaCse = verbale.firmaCseImage;
}

// ─── ARGOMENTI ────────────────────────────────────────────────────────────────
function toggleArgPos() {
    const checked = document.getElementById('arg-pos_impresa')?.checked;
    document.getElementById('impresa-pos-wrapper')?.classList.toggle('hidden', !checked);
}

// ─── PRESENTI SICUREZZA ───────────────────────────────────────────────────────
function renderPresentiSicurezza() {
    const container = document.getElementById('lista-presenti-sicurezza');
    if (!container) return;
    const isFin = _verbaleRiunioneEsistente?.stato === 'FINALIZZATO';
    if (!currentPresentiSicurezza.length) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Nessun presente aggiunto.</p>';
        return;
    }
    container.innerHTML = currentPresentiSicurezza.map((p, i) => `
    <div class="border border-slate-100 rounded-xl p-4 mb-3 bg-slate-50">
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs text-slate-500 mb-1">Nome e Cognome *</label>
                <input type="text" value="${escapeHtml(p.nomeCognome || '')}"
                       onchange="currentPresentiSicurezza[${i}].nomeCognome=this.value" ${isFin ? 'readonly' : ''}
                       class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-slate-400">
            </div>
            <div>
                <label class="block text-xs text-slate-500 mb-1">Ruolo</label>
                <input type="text" value="${escapeHtml(p.ruolo || '')}"
                       onchange="currentPresentiSicurezza[${i}].ruolo=this.value" ${isFin ? 'readonly' : ''}
                       class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-slate-400">
            </div>
        </div>
        <div class="flex items-center gap-3">
            ${p.firma
                ? `<img src="${p.firma}" class="h-10 border border-slate-200 rounded p-0.5 bg-white" alt="firma">
                   ${!isFin ? `<button onclick="currentPresentiSicurezza[${i}].firma=null;renderPresentiSicurezza()" class="text-xs text-red-500 hover:underline">Rimuovi firma</button>` : ''}`
                : (!isFin ? `<button onclick="inizializzaFirmaSicurezza(${i})" class="bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-bold">✏️ Firma</button>
                             <button onclick="usaFirmaPermanenteSicurezza(${i})" class="bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold">✓ Permanente</button>`
                : '<span class="text-xs text-slate-400 italic">Non firmato</span>')}
            ${!isFin ? `<button onclick="rimuoviPresenteSicurezza(${i})" class="ml-auto text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs">✕ Rimuovi</button>` : ''}
        </div>
    </div>`).join('');
}

function aggiungiPresenteSicurezza() {
    currentPresentiSicurezza.push({ nomeCognome: '', ruolo: '', firma: null });
    renderPresentiSicurezza();
}
function rimuoviPresenteSicurezza(idx) {
    currentPresentiSicurezza.splice(idx, 1);
    renderPresentiSicurezza();
}
async function usaFirmaPermanenteSicurezza(idx) {
    const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => null) : null;
    const firma = imp?.firmaDigitale || imp?.firmaCse || null;
    if (!firma) { showToast('Nessuna firma permanente in Impostazioni.', 'warning'); return; }
    currentPresentiSicurezza[idx].firma = firma;
    renderPresentiSicurezza();
    showToast('Firma permanente applicata.', 'success');
}
function inizializzaFirmaSicurezza(idx) {
    document.getElementById('modal-firma-sic')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-firma-sic';
    modal.className = 'fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-96">
        <div class="bg-slate-800 p-4 text-white flex justify-between rounded-t-2xl">
            <span class="font-bold text-sm">Firma — ${escapeHtml(currentPresentiSicurezza[idx]?.nomeCognome || 'Presente')}</span>
            <button onclick="document.getElementById('modal-firma-sic').remove()" class="text-xl">×</button>
        </div>
        <div class="p-6 space-y-4">
            <div id="canvas-sic-${idx}"></div>
            <button onclick="confermaFirmaSicurezza(${idx})" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700">✓ Conferma firma</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    signatureCanvasesRC['sic_' + idx] = new SignatureCanvas('canvas-sic-' + idx, { width: 340, height: 150 });
}
function confermaFirmaSicurezza(idx) {
    const sc = signatureCanvasesRC['sic_' + idx];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast('Firma vuota.', 'warning'); return; }
    currentPresentiSicurezza[idx].firma = b64;
    document.getElementById('modal-firma-sic')?.remove();
    renderPresentiSicurezza();
    showToast('Firma acquisita ✓', 'success');
}

// ─── PRESENTI IMPRESE ─────────────────────────────────────────────────────────
function renderPresentiImprese() {
    const container = document.getElementById('lista-presenti-imprese');
    if (!container) return;
    const isFin = _verbaleRiunioneEsistente?.stato === 'FINALIZZATO';
    if (!currentPresentiImprese.length) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Nessuna impresa aggiunta.</p>';
        return;
    }
    container.innerHTML = currentPresentiImprese.map((p, i) => `
    <div class="border border-slate-100 rounded-xl p-4 mb-3 bg-slate-50">
        <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
                <label class="block text-xs text-slate-500 mb-1">Ragione sociale *</label>
                <input type="text" value="${escapeHtml(p.ragioneSociale || '')}" list="dl-imprese-rc"
                       onchange="currentPresentiImprese[${i}].ragioneSociale=this.value" ${isFin ? 'readonly' : ''}
                       class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-slate-400">
            </div>
            <div>
                <label class="block text-xs text-slate-500 mb-1">Nome firmatario</label>
                <input type="text" value="${escapeHtml(p.nomeFirmatario || '')}"
                       onchange="currentPresentiImprese[${i}].nomeFirmatario=this.value" ${isFin ? 'readonly' : ''}
                       class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-slate-400">
            </div>
            <div>
                <label class="block text-xs text-slate-500 mb-1">Ruolo firmatario</label>
                <input type="text" value="${escapeHtml(p.ruoloFirmatario || '')}"
                       onchange="currentPresentiImprese[${i}].ruoloFirmatario=this.value" ${isFin ? 'readonly' : ''}
                       class="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-slate-400">
            </div>
        </div>
        <div class="flex items-center gap-3">
            ${p.firma
                ? `<img src="${p.firma}" class="h-10 border border-slate-200 rounded p-0.5 bg-white" alt="firma">
                   ${!isFin ? `<button onclick="currentPresentiImprese[${i}].firma=null;renderPresentiImprese()" class="text-xs text-red-500 hover:underline">Rimuovi firma</button>` : ''}`
                : (!isFin ? `<button onclick="inizializzaFirmaImpresa(${i})" class="bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-bold">✏️ Firma</button>` : '<span class="text-xs text-slate-400 italic">Non firmato</span>')}
            ${!isFin ? `<button onclick="rimuoviPresenteImpresa(${i})" class="ml-auto text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs">✕ Rimuovi</button>` : ''}
        </div>
    </div>`).join('');
}

function aggiungiPresenteImpresa() {
    currentPresentiImprese.push({ ragioneSociale: '', nomeFirmatario: '', ruoloFirmatario: '', firma: null });
    renderPresentiImprese();
}
function rimuoviPresenteImpresa(idx) {
    currentPresentiImprese.splice(idx, 1);
    renderPresentiImprese();
}
function inizializzaFirmaImpresa(idx) {
    document.getElementById('modal-firma-imp')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-firma-imp';
    modal.className = 'fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-96">
        <div class="bg-slate-800 p-4 text-white flex justify-between rounded-t-2xl">
            <span class="font-bold text-sm">Firma — ${escapeHtml(currentPresentiImprese[idx]?.ragioneSociale || 'Impresa')}</span>
            <button onclick="document.getElementById('modal-firma-imp').remove()" class="text-xl">×</button>
        </div>
        <div class="p-6 space-y-4">
            <div id="canvas-imp-${idx}"></div>
            <button onclick="confermaFirmaImpresa(${idx})" class="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700">✓ Conferma firma</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    signatureCanvasesRC['imp_' + idx] = new SignatureCanvas('canvas-imp-' + idx, { width: 340, height: 150 });
}
function confermaFirmaImpresa(idx) {
    const sc = signatureCanvasesRC['imp_' + idx];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast('Firma vuota.', 'warning'); return; }
    currentPresentiImprese[idx].firma = b64;
    document.getElementById('modal-firma-imp')?.remove();
    renderPresentiImprese();
    showToast('Firma acquisita ✓', 'success');
}

// ─── ALLEGATI FOTO ────────────────────────────────────────────────────────────
function renderAllegatiFoto() {
    const container = document.getElementById('lista-allegati-foto');
    if (!container) return;
    const isFin = _verbaleRiunioneEsistente?.stato === 'FINALIZZATO';
    if (!currentAllegatiFoto.length) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-2">Nessun allegato fotografico.</p>';
        return;
    }
    container.innerHTML = '<div class="grid grid-cols-3 gap-3">' + currentAllegatiFoto.map((f, i) => `
    <div class="relative group">
        <img src="${f.dataUrl}" alt="${escapeHtml(f.nome)}" class="w-full h-28 object-cover rounded-xl border border-slate-200">
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex flex-col items-center justify-center gap-1">
            <span class="text-white text-[10px] font-bold text-center px-2 truncate w-full text-center">${escapeHtml(f.nome)}</span>
            <span class="text-slate-300 text-[9px]">${(f.dimensioneBytes / 1024).toFixed(0)} KB</span>
            ${!isFin ? `<button onclick="rimuoviFotoRC(${i})" class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">✕ Rimuovi</button>` : ''}
        </div>
    </div>`).join('') + '</div>';
}

async function handleFotoUploadRC(files) {
    for (const file of Array.from(files)) {
        if (currentAllegatiFoto.length >= 20) { showToast('Max 20 foto per verbale.', 'warning'); break; }
        if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: supera 5 MB, ignorato.`, 'warning'); continue; }
        const dataUrl = await _fileToDataUrlRC(file);
        currentAllegatiFoto.push({ id: 'foto_' + Date.now() + '_' + Math.random().toString(36).slice(2), nome: file.name, mimeType: file.type, dimensioneBytes: file.size, timestamp: new Date().toISOString(), dataUrl });
    }
    renderAllegatiFoto();
}
function handleFotoDropRC(event) {
    event.preventDefault();
    if (event.dataTransfer?.files) handleFotoUploadRC(event.dataTransfer.files);
}
function rimuoviFotoRC(idx) {
    currentAllegatiFoto.splice(idx, 1);
    renderAllegatiFoto();
}
function _fileToDataUrlRC(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });
}

async function scaricaAllegatiFotoZip(verbaleId) {
    const verbale = await getItem('verbali_riunione', verbaleId);
    if (!verbale?.allegatiFoto?.length) { showToast('Nessuna foto da scaricare.', 'warning'); return; }
    if (typeof JSZip === 'undefined') { showToast('Libreria JSZip non disponibile.', 'error'); return; }
    const zip = new JSZip();
    const folder = zip.folder('Foto_Riunione');
    for (const f of verbale.allegatiFoto) folder.file(f.nome, f.dataUrl.split(',')[1], { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    const numProg = (verbale.numeroProgressivo || String(verbale.id)).replace(/\//g, '_');
    const dataStr = (verbale.dataRiunione || '').replace(/-/g, '');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Foto_Verbale_RC_${numProg}_${dataStr}.zip`;
    link.click();
    showToast('ZIP foto scaricato ✓', 'success');
}

// ─── FIRMA CSE ────────────────────────────────────────────────────────────────
function toggleDelegaUI_RC(show) {
    document.getElementById('rc-delega-wrapper')?.classList.toggle('hidden', !show);
}
function inizializzaFirmaCSE_RC() {
    const container = document.getElementById('rc-firma-cse-canvas-container');
    if (!container) return;
    container.innerHTML = `
    <div class="border border-slate-200 rounded-xl overflow-hidden mb-2">
        <div id="rc-cse-canvas-wrap"></div>
        <button onclick="confermFirmaCSECanvas_RC()" class="w-full bg-blue-600 text-white py-2 text-xs font-bold hover:bg-blue-700">✓ Conferma</button>
    </div>`;
    signatureCanvasesRC['cse'] = new SignatureCanvas('rc-cse-canvas-wrap', { width: 400, height: 140 });
}
function confermFirmaCSECanvas_RC() {
    const sc = signatureCanvasesRC['cse'];
    if (!sc) return;
    const b64 = sc.toDataURL();
    if (!b64) { showToast('Firma vuota.', 'warning'); return; }
    window._rcFirmaCse = b64;
    _aggiornaPreviewFirmaCSE_RC(b64);
    showToast('Firma CSE acquisita ✓', 'success');
}
async function usaFirmaPermanenteCSE_RC() {
    const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => null) : null;
    const firma = imp?.firmaDigitale || imp?.firmaCse || null;
    if (!firma) { showToast('Nessuna firma permanente in Impostazioni.', 'warning'); return; }
    window._rcFirmaCse = firma;
    _aggiornaPreviewFirmaCSE_RC(firma);
    showToast('Firma permanente CSE caricata ✓', 'success');
}
function abilitaPasteFirmaCSE_RC() {
    const area = document.getElementById('rc-firma-cse-paste-area');
    if (area) { area.classList.remove('hidden'); area.querySelector('textarea')?.focus(); }
}
function handlePasteFirmaCSE_RC(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            _fileToDataUrlRC(item.getAsFile()).then(dataUrl => {
                window._rcFirmaCse = dataUrl;
                _aggiornaPreviewFirmaCSE_RC(dataUrl);
                document.getElementById('rc-firma-cse-paste-area')?.classList.add('hidden');
                showToast('Firma incollata ✓', 'success');
            });
            break;
        }
    }
}
function _aggiornaPreviewFirmaCSE_RC(dataUrl) {
    const p = document.getElementById('rc-firma-cse-preview');
    if (p) p.innerHTML = `<img src="${dataUrl}" class="h-16 border border-slate-200 rounded-lg p-1 mt-2" alt="Firma CSE">`;
}

// ─── RACCOLTA DATI FORM ───────────────────────────────────────────────────────
function _raccogliDatiFormRiunione() {
    const argomenti = ['illustrazione_psc','layout_cantiere','pos_impresa','incarichi','responsabili','servizi_impianti','sorveglianza_sanitaria','coordinamento_rls']
        .filter(id => document.getElementById('arg-' + id)?.checked);
    const tipoEl    = document.querySelector('input[name="rc-tipo"]:checked');
    const ruoloCseEl = document.querySelector('input[name="rc-ruolo-cse"]:checked');
    const firmaCse  = window._rcFirmaCse || _verbaleRiunioneEsistente?.firmaCseImage || null;
    return {
        id: currentVerbaleRiunioneId,
        projectId: sessionStorage.getItem('currentProjectId'),
        dataRiunione: document.getElementById('rc-data')?.value || '',
        tipoRiunione: tipoEl?.value || 'corso_opera',
        labelPresentiSicurezza: document.getElementById('rc-label-sicurezza')?.value || 'ANAS',
        presentiSicurezza: currentPresentiSicurezza.map(p => ({...p})),
        presentiImprese: currentPresentiImprese.map(p => ({...p})),
        argomentiChecklist: argomenti,
        impresaPos: document.getElementById('rc-impresa-pos')?.value || '',
        noteArgomenti: document.getElementById('rc-note-argomenti')?.value || '',
        criticitaOsservazioni: document.getElementById('rc-criticita')?.value || '',
        istruzioniOperative: document.getElementById('rc-istruzioni')?.value || '',
        aggiornaPsc: document.getElementById('rc-aggiorna-psc')?.checked || false,
        allegatiFoto: currentAllegatiFoto.map(f => ({...f})),
        nomeCse: document.getElementById('rc-cse-nome')?.value || '',
        ruoloCse: ruoloCseEl?.value || 'Titolare',
        attoDelega: document.getElementById('rc-cse-atto')?.value || '',
        firmaCseImage: firmaCse,
        timestampFirmaCse: firmaCse ? (window._rcFirmaCse ? new Date().toISOString() : (_verbaleRiunioneEsistente?.timestampFirmaCse || null)) : null,
        numeroProgressivo: _verbaleRiunioneEsistente?.numeroProgressivo || '',
        stato: _verbaleRiunioneEsistente?.stato || 'BOZZA',
        dataCreazione: _verbaleRiunioneEsistente?.dataCreazione || new Date().toISOString(),
        dataFinalizzazione: _verbaleRiunioneEsistente?.dataFinalizzazione || null
    };
}

// ─── SALVA BOZZA ─────────────────────────────────────────────────────────────
async function salvaVerbaleRiunioneForm(nuovoStato = 'BOZZA') {
    const esistente = currentVerbaleRiunioneId ? await getItem('verbali_riunione', currentVerbaleRiunioneId) : null;
    if (esistente?.stato === 'FINALIZZATO' && nuovoStato !== 'FINALIZZATO') {
        alert('Impossibile modificare un verbale finalizzato.');
        return null;
    }
    const dati = _raccogliDatiFormRiunione();
    dati.stato = nuovoStato;
    if (!dati.id) delete dati.id;
    const saved = await _saveVerbaleRiunioneDB(dati);
    currentVerbaleRiunioneId  = saved.id;
    _verbaleRiunioneEsistente = saved;
    if (nuovoStato === 'BOZZA') showToast('Bozza salvata ✓', 'success');
    return saved;
}

// ─── FINALIZZAZIONE ───────────────────────────────────────────────────────────
async function eseguiFinalizzazioneRiunione() {
    // Acquisisci firme canvas ancora aperte
    Object.entries(signatureCanvasesRC).forEach(([key, sc]) => {
        const b64 = sc.toDataURL();
        if (!b64) return;
        if (key === 'cse') { window._rcFirmaCse = b64; }
        else if (key.startsWith('sic_')) { const idx = parseInt(key.split('_')[1]); if (currentPresentiSicurezza[idx]) currentPresentiSicurezza[idx].firma = b64; }
        else if (key.startsWith('imp_')) { const idx = parseInt(key.split('_')[1]); if (currentPresentiImprese[idx]) currentPresentiImprese[idx].firma = b64; }
    });

    const dati = _raccogliDatiFormRiunione();

    // VALIDAZIONE
    const errori = [];
    if (!dati.dataRiunione) errori.push('Data riunione');
    if (!dati.tipoRiunione) errori.push('Tipo riunione');
    if (!dati.presentiSicurezza.filter(p => p.nomeCognome?.trim()).length) errori.push('Almeno 1 presente per la sicurezza');
    if (!dati.presentiImprese.filter(p => p.ragioneSociale?.trim()).length) errori.push('Almeno 1 impresa presente');
    if (!dati.criticitaOsservazioni?.trim() && !dati.istruzioniOperative?.trim()) errori.push('Criticità/Osservazioni o Istruzioni operative (almeno uno)');
    if (!dati.nomeCse?.trim()) errori.push('Nome CSE');
    if (!dati.ruoloCse) errori.push('Ruolo CSE');
    if (dati.ruoloCse === 'Delegato' && !dati.attoDelega?.trim()) errori.push('Atto di delega (obbligatorio se Delegato)');
    if (!dati.firmaCseImage) errori.push('Firma CSE');
    const tpl = await getItem('impostazioni', 'template_verbale_riunione');
    if (!tpl?.valore) errori.push('Template Word non caricato (pulsante ⚙️ Template)');

    if (errori.length > 0) {
        showToast('Errori: ' + errori[0], 'error', 5000);
        alert('ERRORE FINALIZZAZIONE. Campi mancanti:\n- ' + errori.join('\n- '));
        return;
    }

    const saved = await salvaVerbaleRiunioneForm('BOZZA');
    if (!saved) return;

    let verbale = { ...saved };
    if (!verbale.numeroProgressivo) {
        const dataPrefix = verbale.dataRiunione.replace(/-/g, '');
        const tutti = await getByIndex('verbali_riunione', 'projectId', verbale.projectId);
        const count = tutti.filter(v => v.dataRiunione === verbale.dataRiunione && v.stato === 'FINALIZZATO').length;
        verbale.numeroProgressivo = `${dataPrefix}/RC${String(count + 1).padStart(2, '0')}`;
    }
    verbale.stato = 'FINALIZZATO';
    verbale.dataFinalizzazione = new Date().toISOString();
    await _saveVerbaleRiunioneDB(verbale);
    _verbaleRiunioneEsistente = verbale;

    try {
        const wordBlob = await _generaDocxRiunione(verbale);
        const fileName = `Verbale_Riunione_${verbale.dataRiunione.replace(/-/g, '')}_${verbale.numeroProgressivo.replace(/\//g, '_')}.docx`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(wordBlob);
        link.download = fileName;
        link.click();
        showToast('Verbale finalizzato ✓ — Word scaricato', 'success');
        renderVerbaliRiunione();
    } catch (err) {
        console.error('[FASE5.2] Errore Word:', err);
        alert('Errore generazione Word: ' + err.message);
    }
}

// ─── GENERAZIONE DOCX ────────────────────────────────────────────────────────
async function _generaDocxRiunione(verbale) {
    const tplRecord = await getItem('impostazioni', 'template_verbale_riunione');
    if (!tplRecord?.valore) throw new Error('Template non trovato. Carica il file .docx dal pulsante ⚙️ Template.');

    const settings = await DocxGenerator.getGlobalSettings();
    const project  = await getItem('projects', verbale.projectId);

    const checkbox = (key) => verbale.tipoRiunione === key ? '☑' : '☐';
    const dataRiunioneFormatted = verbale.dataRiunione
        ? new Date(verbale.dataRiunione + 'T00:00:00').toLocaleDateString('it-IT')
        : '—';

    const zip = new PizZip(tplRecord.valore);
    const imageModule = new window.ImageModule({
        centered: false,
        fileType: 'docx',
        getImage: (tagValue) => DocxGenerator.base64ToBinary(tagValue),
        getSize: (img, tagValue, tagName) => tagName === 'logo_aziendale' ? [120, 40] : [150, 50]
    });
    const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });

    doc.setData({
        logo_aziendale:    settings.logoBase64 || null,
        modulo_codice:     settings.moduloCodiceRC   || 'MOD.RC.01',
        modulo_versione:   settings.moduloVersioneRC || 'v1.0',
        ss_numero:         project?.ssNumero        || '—',
        codice_ppm_sil:    project?.codicePpmSil    || '—',
        titolo_lavoro:     project?.titolo          || project?.nome || '—',
        contratto_numero:  project?.contrattoNumero || '—',
        contratto_data:    project?.contrattoData   ? new Date(project.contrattoData + 'T00:00:00').toLocaleDateString('it-IT') : '—',
        data_riunione:              dataRiunioneFormatted,
        label_presenti_sicurezza:   verbale.labelPresentiSicurezza || '—',
        tipo_preliminare:    checkbox('preliminare'),
        tipo_corso_opera:    checkbox('corso_opera'),
        tipo_nuove_imprese:  checkbox('nuove_imprese'),
        tipo_rls:            checkbox('rls'),
        presenti_sicurezza: (verbale.presentiSicurezza || []).map(p => ({ nome_cognome: p.nomeCognome || '—' })),
        presenti_imprese:   (verbale.presentiImprese   || []).map(p => ({ ragione_sociale: p.ragioneSociale || '—' })),
        impresa_pos:            (verbale.argomentiChecklist || []).includes('pos_impresa') ? (verbale.impresaPos || '—') : '',
        note_argomenti:         verbale.noteArgomenti         || '',
        criticita_osservazioni: verbale.criticitaOsservazioni || '',
        istruzioni_operative:   verbale.istruzioniOperative   || '',
        nome_cse:               verbale.nomeCse || '—'
    });
    doc.render();
    return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── DOWNLOAD WORD DA LISTA ───────────────────────────────────────────────────
async function _scaricaWordRiunione(verbaleId) {
    const verbale = await getItem('verbali_riunione', verbaleId);
    if (!verbale) { showToast('Verbale non trovato.', 'error'); return; }
    try {
        const blob = await _generaDocxRiunione(verbale);
        const fileName = `Verbale_Riunione_${verbale.dataRiunione.replace(/-/g, '')}_${verbale.numeroProgressivo.replace(/\//g, '_')}.docx`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        showToast('Word scaricato ✓', 'success');
    } catch (err) { console.error(err); showToast('Errore: ' + err.message, 'error'); }
}

// ─── ANTEPRIMA ────────────────────────────────────────────────────────────────
async function mostraAnteprimaRiunione(verbaleId) {
    const verbale = await getItem('verbali_riunione', verbaleId);
    if (!verbale) { showToast('Verbale non trovato.', 'error'); return; }
    await _mostraAnteprimaConVerbale(verbale);
}
async function mostraAnteprimaRiunioneCorrente() {
    const dati = _raccogliDatiFormRiunione();
    await _mostraAnteprimaConVerbale({ ..._verbaleRiunioneEsistente, ...dati });
}
async function _mostraAnteprimaConVerbale(verbale) {
    let blob;
    try { blob = await _generaDocxRiunione(verbale); }
    catch (err) { alert('Impossibile generare anteprima: ' + err.message); return; }

    const isBozza = verbale.stato !== 'FINALIZZATO';
    document.getElementById('modal-anteprima-rc')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-anteprima-rc';
    modal.className = 'fixed inset-0 bg-black/80 z-[4000] flex flex-col';
    modal.innerHTML = `
    <div class="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shrink-0">
        <span class="font-bold">📋 Anteprima Verbale Riunione di Coordinamento</span>
        ${isBozza ? '<span class="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-full">⚠ BOZZA — non legalmente valida</span>' : '<span class="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">FINALIZZATO</span>'}
        <div class="ml-auto flex gap-2">
            <button onclick="window.print()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">🖨 Stampa</button>
            <button onclick="_scaricaWordDaBlob_RC()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold">📄 Scarica Word</button>
            <button onclick="document.getElementById('modal-anteprima-rc').remove()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold">✕ Chiudi</button>
        </div>
    </div>
    <div class="flex-1 overflow-auto bg-white p-4">
        <div id="docx-preview-inner-rc" class="max-w-4xl mx-auto"></div>
    </div>`;
    document.body.appendChild(modal);
    window._currentAnteprimaBlobRC = blob;

    const renderLib = (typeof docx !== 'undefined' && typeof docx.renderAsync === 'function') ? docx
                    : (typeof window.docxPreview !== 'undefined' && typeof window.docxPreview.renderAsync === 'function') ? window.docxPreview
                    : null;

    if (renderLib) {
        try {
            // Converte Blob → ArrayBuffer (richiesto da alcune versioni della libreria)
            const arrayBuffer = await blob.arrayBuffer();
            const bodyContainer = document.getElementById('docx-preview-inner-rc');
            // styleContainer dedicato per evitare contaminazione CSS globale
            const styleContainer = document.createElement('div');
            styleContainer.id = 'docx-style-container-rc';
            document.head.appendChild(styleContainer);
            await renderLib.renderAsync(arrayBuffer, bodyContainer, styleContainer, {
                className: 'docx-preview',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: true,
                breakPages: true,
                renderHeaders: true,
                renderFooters: true,
                renderFootnotes: true
            });
        } catch (e) {
            console.error('[docx-preview]', e);
            document.getElementById('docx-preview-inner-rc').innerHTML = `<p class="text-red-500 text-sm p-4">Errore rendering: ${e.message}</p>`;
        }
    } else {
        document.getElementById('docx-preview-inner-rc').innerHTML = `
        <div class="text-center py-16 text-slate-400">
            <p class="text-4xl mb-4">📄</p>
            <p class="font-semibold">Anteprima non disponibile (libreria docx-preview non caricata).</p>
            <p class="text-sm mt-2">Usa "Scarica Word" per visualizzare il documento.</p>
        </div>`;
    }
}
function _scaricaWordDaBlob_RC() {
    const blob = window._currentAnteprimaBlobRC;
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Verbale_Riunione_Anteprima.docx';
    link.click();
}

// ─── ELIMINA ──────────────────────────────────────────────────────────────────
async function eliminaVerbaleRiunione(id) {
    const verbale = await getItem('verbali_riunione', id);
    if (!verbale) return;
    const msg = verbale.stato === 'FINALIZZATO'
        ? `Il verbale ${verbale.numeroProgressivo || id} è FINALIZZATO.\nEliminazione irreversibile. Confermi?`
        : 'Eliminare questa bozza?';
    if (!confirm(msg)) return;
    await deleteItem('verbali_riunione', id);
    showToast('Verbale eliminato.', 'success');
    renderVerbaliRiunione();
}

// ─── ESPOSIZIONE GLOBALE ──────────────────────────────────────────────────────
window.renderVerbaliRiunione              = renderVerbaliRiunione;
window.apriVerbaleRiunione                = apriVerbaleRiunione;
window.checkTemplateAndNewVerbaleRiunione = checkTemplateAndNewVerbaleRiunione;
window.mostraWizardTemplateRiunione       = mostraWizardTemplateRiunione;
window.handleTemplateUploadRiunione       = handleTemplateUploadRiunione;
window.salvaVerbaleRiunioneForm           = salvaVerbaleRiunioneForm;
window.eseguiFinalizzazioneRiunione       = eseguiFinalizzazioneRiunione;
window.mostraAnteprimaRiunione            = mostraAnteprimaRiunione;
window.mostraAnteprimaRiunioneCorrente    = mostraAnteprimaRiunioneCorrente;
window.scaricaAllegatiFotoZip             = scaricaAllegatiFotoZip;
window._scaricaWordRiunione               = _scaricaWordRiunione;
window._scaricaWordDaBlob_RC              = _scaricaWordDaBlob_RC;
window.eliminaVerbaleRiunione             = eliminaVerbaleRiunione;
window.aggiungiPresenteSicurezza          = aggiungiPresenteSicurezza;
window.rimuoviPresenteSicurezza           = rimuoviPresenteSicurezza;
window.inizializzaFirmaSicurezza          = inizializzaFirmaSicurezza;
window.confermaFirmaSicurezza             = confermaFirmaSicurezza;
window.usaFirmaPermanenteSicurezza        = usaFirmaPermanenteSicurezza;
window.aggiungiPresenteImpresa            = aggiungiPresenteImpresa;
window.rimuoviPresenteImpresa             = rimuoviPresenteImpresa;
window.inizializzaFirmaImpresa            = inizializzaFirmaImpresa;
window.confermaFirmaImpresa               = confermaFirmaImpresa;
window.handleFotoUploadRC                 = handleFotoUploadRC;
window.handleFotoDropRC                   = handleFotoDropRC;
window.rimuoviFotoRC                      = rimuoviFotoRC;
window.toggleArgPos                       = toggleArgPos;
window.toggleDelegaUI_RC                  = toggleDelegaUI_RC;
window.inizializzaFirmaCSE_RC             = inizializzaFirmaCSE_RC;
window.confermFirmaCSECanvas_RC           = confermFirmaCSECanvas_RC;
window.usaFirmaPermanenteCSE_RC           = usaFirmaPermanenteCSE_RC;
window.abilitaPasteFirmaCSE_RC            = abilitaPasteFirmaCSE_RC;
window.handlePasteFirmaCSE_RC             = handlePasteFirmaCSE_RC;
