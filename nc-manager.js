// nc-manager.js — FASE 6.2
// Cruscotto Non Conformità: lista, filtri, workflow APERTA→IN_RISOLUZIONE→CHIUSA, export CSV

// ─────────────────────────────────────────────
// STATO ORDINAMENTO (modulo-level)
// ─────────────────────────────────────────────
let _ncSortCol = 'data';
let _ncSortDir = 'desc';
let _ncFiltriCorrente = {};
let _ncFilterRendering = false;
let _ncFilterPending = false;

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function isScaduta(nc) {
    if (nc.stato === 'CHIUSA') return false;
    if (!nc.dataScadenza) return false;
    return new Date(nc.dataScadenza).getTime() < Date.now();
}

function _badgeLivello(livello) {
    const cfg = {
        gravissima: 'bg-red-800 text-white',
        grave:      'bg-red-500 text-white',
        media:      'bg-orange-400 text-white',
        lieve:      'bg-yellow-300 text-slate-800'
    };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg[livello] || 'bg-slate-200 text-slate-700'}">${livello || '—'}</span>`;
}

function _badgeStato(nc) {
    if (isScaduta(nc)) return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-200 text-red-800">⚠ SCADUTA</span>';
    if (nc.stato === 'CHIUSA')         return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">✅ CHIUSA</span>';
    if (nc.stato === 'IN_RISOLUZIONE') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">🔄 IN RISOLUZIONE</span>';
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">🔴 APERTA</span>';
}

function _fmtData(val) {
    if (!val) return '—';
    return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('it-IT');
}

function _fmtDataOra(val) {
    if (!val) return '—';
    return new Date(val).toLocaleString('it-IT');
}

// ─────────────────────────────────────────────
// LETTURA + FILTRI
// ─────────────────────────────────────────────

async function listaNcCantiere(projectId, filtri = {}) {
    let lista = await getByIndex('nc', 'projectId', projectId);

    // Normalizza stato legacy se sfuggito alla migrazione
    lista = lista.map(nc => {
        if (nc.stato === 'aperta') nc.stato = 'APERTA';
        else if (nc.stato === 'in_risoluzione') nc.stato = 'IN_RISOLUZIONE';
        else if (nc.stato === 'chiusa') nc.stato = 'CHIUSA';
        return nc;
    });

    if (filtri.stato && filtri.stato !== 'ALL') {
        if (filtri.stato === 'SCADUTA') {
            lista = lista.filter(nc => isScaduta(nc));
        } else {
            lista = lista.filter(nc => nc.stato === filtri.stato);
        }
    }
    if (filtri.livello && filtri.livello !== 'ALL') {
        lista = lista.filter(nc => nc.livello === filtri.livello);
    }
    if (filtri.impresaId) {
        lista = lista.filter(nc => String(nc.impresaId) === String(filtri.impresaId));
    }
    if (filtri.testoLibero?.trim()) {
        const q = filtri.testoLibero.trim().toLowerCase();
        lista = lista.filter(nc => (nc.descrizione || '').toLowerCase().includes(q));
    }

    // Ordinamento
    const col = _ncSortCol;
    const dir = _ncSortDir;
    lista.sort((a, b) => {
        let va = a[col] || ''; let vb = b[col] || '';
        const cmp = String(va).localeCompare(String(vb), 'it', { numeric: true });
        return dir === 'asc' ? cmp : -cmp;
    });

    return lista;
}

async function contatoriNc(projectId) {
    const lista = await getByIndex('nc', 'projectId', projectId);
    let aperte = 0, inRisoluzione = 0, chiuse = 0, scadute = 0;
    for (const nc of lista) {
        const stato = nc.stato === 'aperta' ? 'APERTA' : nc.stato === 'in_risoluzione' ? 'IN_RISOLUZIONE' : nc.stato === 'chiusa' ? 'CHIUSA' : nc.stato;
        if (stato === 'CHIUSA') chiuse++;
        else if (stato === 'IN_RISOLUZIONE') { inRisoluzione++; if (isScaduta(nc)) scadute++; }
        else { aperte++; if (isScaduta(nc)) scadute++; }
    }
    return { aperte, inRisoluzione, chiuse, scadute, totale: lista.length };
}

// ─────────────────────────────────────────────
// WORKFLOW STATO
// ─────────────────────────────────────────────

async function prendiInCarico(ncId) {
    const nc = await getItem('nc', ncId);
    if (!nc) return;
    nc.stato = 'IN_RISOLUZIONE';
    nc.dataPresaInCarico = new Date().toISOString();
    if (!nc.auditLog) nc.auditLog = [];
    nc.auditLog.push({ timestamp: nc.dataPresaInCarico, azione: 'PRESA_IN_CARICO', statoPrec: 'APERTA', statoNuovo: 'IN_RISOLUZIONE', nota: null });
    await saveItem('nc', nc);
    showToast('NC presa in carico ✓', 'success');
    await _refreshNcView();
}

async function chiudiNc(ncId, notaChiusura) {
    if (!notaChiusura || notaChiusura.trim().length < 10) {
        showToast('Nota di chiusura: minimo 10 caratteri.', 'error');
        return false;
    }
    const nc = await getItem('nc', ncId);
    if (!nc) return false;
    const statoPrec = nc.stato;
    nc.stato = 'CHIUSA';
    nc.dataChiusura = new Date().toISOString();
    nc.notaChiusura = notaChiusura.trim();
    if (!nc.auditLog) nc.auditLog = [];
    nc.auditLog.push({ timestamp: nc.dataChiusura, azione: 'CHIUSURA', statoPrec, statoNuovo: 'CHIUSA', nota: nc.notaChiusura });
    await saveItem('nc', nc);
    showToast('NC chiusa ✓', 'success');
    return true;
}

async function riaperturaNc(ncId, motivoRiapertura) {
    if (!motivoRiapertura || motivoRiapertura.trim().length < 10) {
        showToast('Motivo riapertura: minimo 10 caratteri.', 'error');
        return false;
    }
    const nc = await getItem('nc', ncId);
    if (!nc) return false;
    const vecchiaData = nc.dataChiusura;
    nc.stato = 'APERTA';
    nc.dataPresaInCarico = null;
    nc.dataChiusura = null;
    nc.notaChiusura = null;
    if (!nc.auditLog) nc.auditLog = [];
    nc.auditLog.push({ timestamp: new Date().toISOString(), azione: 'RIAPERTURA', statoPrec: 'CHIUSA', statoNuovo: 'APERTA', nota: motivoRiapertura.trim() });
    await saveItem('nc', nc);
    showToast('NC riaperta ✓', 'info');
    return true;
}

// ─────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────

function _sanitizeCsvField(val) {
    const s = String(val ?? '');
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

async function esportaCsvNc(projectId, filtri = {}) {
    const lista = await listaNcCantiere(projectId, filtri);
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    const impMap = {};
    imprese.forEach(i => { impMap[i.id] = i.ragioneSociale || String(i.id); });

    const header = ['Numero', 'Livello', 'Data apertura', 'Impresa', 'Descrizione', 'Scadenza', 'Stato', 'Scaduta', 'Data presa in carico', 'Data chiusura', 'Nota chiusura', 'Verbale origine'];
    const righe = lista.map(nc => [
        nc.numeroProgressivo || nc.id,
        nc.livello || '',
        _fmtData(nc.data || nc.createdAt),
        impMap[nc.impresaId] || '',
        _sanitizeCsvField(nc.descrizione || '').replace(/"/g, '""'),
        _fmtData(nc.dataScadenza),
        nc.stato || '',
        isScaduta(nc) ? 'SI' : 'NO',
        nc.dataPresaInCarico ? _fmtDataOra(nc.dataPresaInCarico) : '',
        nc.dataChiusura ? _fmtDataOra(nc.dataChiusura) : '',
        _sanitizeCsvField(nc.notaChiusura || '').replace(/"/g, '""'),
        nc.verbaleOrigineId || ''
    ]);

    const csv = [header, ...righe].map(r => r.map(v => `"${v}"`).join(';')).join('\r\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NC_Cantiere_${projectId}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast('CSV esportato ✓', 'success');
}

// ─────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────

async function renderNcCruscotto() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const container = document.getElementById('view-nc');
    if (!container || !projectId) return;

    const contatori = await contatoriNc(projectId);
    const imprese = await getByIndex('imprese', 'projectId', projectId);

    container.innerHTML = `
    <div class="space-y-5 animate-in fade-in slide-in-from-bottom-4">

        <div class="flex justify-between items-center">
            <h3 class="text-2xl font-bold text-slate-800 flex items-center gap-2">⚠️ Non Conformità</h3>
            <button onclick="esportaCsvNc('${projectId}', _ncFiltriCorrente)"
                class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2">
                📊 Esporta CSV
            </button>
        </div>

        <!-- CONTATORI -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            ${_cardContatore('🔴', 'Aperte', contatori.aperte, 'bg-red-50 border-red-200 text-red-700', 'APERTA')}
            ${_cardContatore('🔄', 'In risoluzione', contatori.inRisoluzione, 'bg-amber-50 border-amber-200 text-amber-700', 'IN_RISOLUZIONE')}
            ${_cardContatore('⚠', 'Scadute', contatori.scadute, 'bg-red-100 border-red-300 text-red-800', 'SCADUTA')}
            ${_cardContatore('✅', 'Chiuse', contatori.chiuse, 'bg-green-50 border-green-200 text-green-700', 'CHIUSA')}
            ${_cardContatore('📋', 'Totale', contatori.totale, 'bg-slate-50 border-slate-200 text-slate-700', 'ALL')}
        </div>

        <!-- FILTRI -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
            <div>
                <label for="nc-f-stato" class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Stato</label>
                <select id="nc-f-stato" onchange="_applicaFiltriNc()" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="ALL">Tutti</option>
                    <option value="APERTA">Aperte</option>
                    <option value="IN_RISOLUZIONE">In risoluzione</option>
                    <option value="SCADUTA">⚠ Scadute</option>
                    <option value="CHIUSA">Chiuse</option>
                </select>
            </div>
            <div>
                <label for="nc-f-livello" class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Livello</label>
                <select id="nc-f-livello" onchange="_applicaFiltriNc()" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="ALL">Tutti</option>
                    <option value="gravissima">Gravissima</option>
                    <option value="grave">Grave</option>
                    <option value="media">Media</option>
                    <option value="lieve">Lieve</option>
                </select>
            </div>
            <div>
                <label for="nc-f-impresa" class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Impresa</label>
                <select id="nc-f-impresa" onchange="_applicaFiltriNc()" class="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Tutte</option>
                    ${imprese.map(i => `<option value="${i.id}">${escapeHtml(i.ragioneSociale || String(i.id))}</option>`).join('')}
                </select>
            </div>
            <div class="flex-1 min-w-[180px]">
                <label for="nc-f-testo" class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cerca descrizione</label>
                <input type="text" id="nc-f-testo" oninput="_debounceNc()" placeholder="Cerca..."
                    class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <button onclick="_resetFiltriNc()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-bold transition">↺ Reset</button>
        </div>

        <!-- TABELLA (desktop) / CARD (mobile) -->
        <div id="nc-lista-container"></div>
    </div>`;

    await _renderListaNc(projectId);
}

function _cardContatore(icona, label, val, cls, filtro) {
    return `<button onclick="_filtroContatore('${filtro}')"
        class="border rounded-xl p-4 flex flex-col items-center gap-1 cursor-pointer hover:shadow-md transition ${cls}">
        <span class="text-xl">${icona}</span>
        <span class="text-2xl font-black">${val}</span>
        <span class="text-[10px] font-bold uppercase tracking-wide">${label}</span>
    </button>`;
}

function _filtroContatore(valore) {
    const sel = document.getElementById('nc-f-stato');
    if (sel) { sel.value = valore; _applicaFiltriNc(); }
}

function _leggiFiltriForms() {
    return {
        stato:       document.getElementById('nc-f-stato')?.value || 'ALL',
        livello:     document.getElementById('nc-f-livello')?.value || 'ALL',
        impresaId:   document.getElementById('nc-f-impresa')?.value || null,
        testoLibero: document.getElementById('nc-f-testo')?.value || ''
    };
}

let _ncDebounceTimer = null;
function _debounceNc() {
    clearTimeout(_ncDebounceTimer);
    _ncDebounceTimer = setTimeout(_applicaFiltriNc, 300);
}

async function _applicaFiltriNc() {
    if (_ncFilterRendering) { _ncFilterPending = true; return; }
    _ncFilterRendering = true;
    try {
        const projectId = sessionStorage.getItem('currentProjectId');
        _ncFiltriCorrente = _leggiFiltriForms();
        await _renderListaNc(projectId);
    } finally {
        _ncFilterRendering = false;
        if (_ncFilterPending) { _ncFilterPending = false; _applicaFiltriNc(); }
    }
}

function _resetFiltriNc() {
    const ids = ['nc-f-stato','nc-f-livello','nc-f-impresa','nc-f-testo'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = el.tagName === 'SELECT' ? (id === 'nc-f-impresa' ? '' : 'ALL') : ''; });
    _ncFiltriCorrente = {};
    _applicaFiltriNc();
}

function _thSort(col, label) {
    const icon = _ncSortCol === col ? (_ncSortDir === 'asc' ? '▲' : '▼') : '↕';
    return `<th class="px-3 py-3 cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap" onclick="_sortNc('${col}')">${label} <span class="text-slate-400 text-[10px]">${icon}</span></th>`;
}

function _sortNc(col) {
    if (_ncSortCol === col) _ncSortDir = _ncSortDir === 'asc' ? 'desc' : 'asc';
    else { _ncSortCol = col; _ncSortDir = 'asc'; }
    _applicaFiltriNc();
}

async function _renderListaNc(projectId) {
    const filtri = _leggiFiltriForms();
    _ncFiltriCorrente = filtri;
    const lista = await listaNcCantiere(projectId, filtri);
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    const impMap = {};
    imprese.forEach(i => { impMap[i.id] = i.ragioneSociale || String(i.id); });

    const container = document.getElementById('nc-lista-container');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 italic">Nessuna non conformità trovata con i filtri selezionati.</div>`;
        return;
    }

    // DESKTOP TABLE
    const tabellaHtml = `
    <div class="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                    ${_thSort('numeroProgressivo', 'N°')}
                    ${_thSort('data', 'Data')}
                    ${_thSort('livello', 'Livello')}
                    <th class="px-3 py-3">Impresa</th>
                    <th class="px-3 py-3">Descrizione</th>
                    ${_thSort('dataScadenza', 'Scadenza')}
                    ${_thSort('stato', 'Stato')}
                    <th class="px-3 py-3 text-right">Azioni</th>
                </tr>
            </thead>
            <tbody>
            ${lista.map(nc => {
                const rigaCls = nc.stato === 'CHIUSA'
                    ? 'bg-slate-50 text-slate-400'
                    : isScaduta(nc)
                        ? 'bg-red-50'
                        : '';
                const borderCls = nc.stato === 'IN_RISOLUZIONE'
                    ? 'border-l-4 border-l-amber-400'
                    : nc.stato === 'CHIUSA'
                        ? 'border-l-4 border-l-slate-300'
                        : isScaduta(nc)
                            ? 'border-l-4 border-l-red-600'
                            : 'border-l-4 border-l-red-400';
                return `<tr class="border-b border-slate-100 hover:bg-blue-50/30 transition ${rigaCls} ${borderCls}">
                    <td class="px-3 py-2.5 font-mono text-xs font-bold whitespace-nowrap">${escapeHtml(nc.numeroProgressivo || String(nc.id))}</td>
                    <td class="px-3 py-2.5 text-xs whitespace-nowrap">${_fmtData(nc.data || nc.createdAt)}</td>
                    <td class="px-3 py-2.5">${_badgeLivello(nc.livello)}</td>
                    <td class="px-3 py-2.5 text-xs max-w-[120px] truncate">${escapeHtml(impMap[nc.impresaId] || '—')}</td>
                    <td class="px-3 py-2.5 text-xs max-w-[200px]"><span class="line-clamp-2">${escapeHtml(nc.descrizione || '—')}</span></td>
                    <td class="px-3 py-2.5 text-xs whitespace-nowrap ${nc.dataScadenza && new Date(nc.dataScadenza) < new Date() && nc.stato !== 'CHIUSA' ? 'text-red-600 font-bold' : ''}">${_fmtData(nc.dataScadenza)}</td>
                    <td class="px-3 py-2.5">${_badgeStato(nc)}</td>
                    <td class="px-3 py-2.5 text-right">${_menuAzioniNc(nc)}</td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;

    // MOBILE CARDS
    const cardsHtml = `
    <div class="md:hidden space-y-3">
        ${lista.map(nc => {
            const scadCls = isScaduta(nc) ? 'border-red-400 bg-red-50' : nc.stato === 'CHIUSA' ? 'border-slate-200 bg-slate-50 opacity-70' : nc.stato === 'IN_RISOLUZIONE' ? 'border-amber-300' : 'border-red-300';
            return `<div class="bg-white border-l-4 rounded-xl border border-slate-200 p-4 ${scadCls}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono text-xs font-bold text-slate-600">${escapeHtml(nc.numeroProgressivo || String(nc.id))}</span>
                        ${_badgeStato(nc)}
                    </div>
                    ${_menuAzioniNc(nc, true)}
                </div>
                <div class="flex items-center gap-2 mb-1">${_badgeLivello(nc.livello)} <span class="text-xs text-slate-500 truncate">${escapeHtml(impMap[nc.impresaId] || '—')}</span></div>
                <p class="text-sm text-slate-700 line-clamp-2 mb-2">${escapeHtml(nc.descrizione || '—')}</p>
                <div class="flex gap-3 text-[10px] text-slate-500">
                    <span>📅 Apertura: ${_fmtData(nc.data || nc.createdAt)}</span>
                    <span class="${nc.dataScadenza && new Date(nc.dataScadenza) < new Date() && nc.stato !== 'CHIUSA' ? 'text-red-600 font-bold' : ''}">⏰ Scad: ${_fmtData(nc.dataScadenza)}</span>
                </div>
            </div>`;
        }).join('')}
    </div>`;

    container.innerHTML = tabellaHtml + cardsHtml;
}

function _menuAzioniNc(nc, mobile = false) {
    const id = nc.id;
    const btnCls = mobile
        ? 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg font-bold transition'
        : 'p-1.5 hover:bg-slate-100 rounded text-slate-600 transition text-sm';
    return `<div class="flex gap-1 justify-end flex-wrap">
        <button onclick="apriDettaglioNc('${id}')" class="${btnCls}" title="Dettaglio">🔍</button>
        <button onclick="_vaiVerbaleOrigine('${nc.verbaleOrigineId}')" class="${btnCls}" title="Verbale origine">📝</button>
        ${nc.stato === 'APERTA' ? `<button onclick="_confermaPresaInCarico('${id}')" class="${btnCls}" title="Prendi in carico">🔄</button>` : ''}
        ${nc.stato !== 'CHIUSA' ? `<button onclick="apriModalChiudiNc('${id}')" class="${btnCls}" title="Chiudi NC">✅</button>` : ''}
        ${nc.stato === 'CHIUSA' ? `<button onclick="apriModalRiaperturaNc('${id}')" class="${btnCls}" title="Riapri NC">↩️</button>` : ''}
    </div>`;
}

async function _vaiVerbaleOrigine(verbaleOrigineId) {
    if (!verbaleOrigineId) { showToast('Verbale origine non disponibile.', 'warning'); return; }
    await Router.navSubView('VERBALI');
    // Il verbale sarà visibile nella lista; non c'è un deeplink diretto al form
}

async function _confermaPresaInCarico(ncId) {
    if (!confirm('Prendere in carico questa NC?')) return;
    await prendiInCarico(ncId);
}

async function _refreshNcView() {
    await renderNcCruscotto();
}

// ─────────────────────────────────────────────
// MODAL DETTAGLIO NC
// ─────────────────────────────────────────────

async function apriDettaglioNc(ncId) {
    const nc = await getItem('nc', ncId);
    if (!nc) return;
    const impresa = nc.impresaId ? await getItem('imprese', nc.impresaId) : null;
    const verbale = nc.verbaleOrigineId ? await getItem('verbali', nc.verbaleOrigineId) : null;

    const auditLog = nc.auditLog || [];
    // Aggiungi apertura sintetica all'inizio se non presente
    const timeline = [
        { timestamp: nc.createdAt || nc.data, azione: 'APERTURA', nota: `Da verbale ${nc.verbaleOrigineId || '—'}`, statoNuovo: 'APERTA' },
        ...auditLog
    ];

    const iconaAzione = { APERTURA: '🔴', PRESA_IN_CARICO: '🔄', CHIUSURA: '✅', RIAPERTURA: '↩️' };

    document.getElementById('modal-dettaglio-nc')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-dettaglio-nc';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-h-none">
        <div class="bg-slate-800 p-5 text-white flex justify-between items-center sticky top-0 z-10 print:bg-white print:text-slate-900 print:border-b">
            <div>
                <h3 class="font-bold text-lg">NC ${escapeHtml(nc.numeroProgressivo || String(nc.id))}</h3>
                <p class="text-slate-400 text-xs">Cantiere: ${sessionStorage.getItem('currentProjectId')}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.print()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold print:hidden">🖨 Stampa</button>
                <button onclick="document.getElementById('modal-dettaglio-nc').remove()" class="text-2xl print:hidden">&times;</button>
            </div>
        </div>
        <div class="p-6 space-y-5 print:p-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Livello</span>${_badgeLivello(nc.livello)}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Stato</span>${_badgeStato(nc)}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Impresa</span><span class="font-semibold">${escapeHtml(impresa?.ragioneSociale || '—')}</span></div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Data apertura</span>${_fmtData(nc.data || nc.createdAt)}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Scadenza</span>
                    <span class="${isScaduta(nc) ? 'text-red-600 font-bold' : ''}">${_fmtData(nc.dataScadenza)}${isScaduta(nc) ? ' ⚠ SCADUTA' : ''}</span>
                </div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Verbale origine</span>
                    <button onclick="document.getElementById('modal-dettaglio-nc').remove(); _vaiVerbaleOrigine('${nc.verbaleOrigineId}')"
                        class="text-blue-600 underline text-xs font-bold">${escapeHtml(nc.verbaleOrigineId || '—')} →</button>
                </div>
            </div>
            <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Descrizione</span>
                <p class="text-sm text-slate-800 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">${escapeHtml(nc.descrizione || '—')}</p>
            </div>
            ${nc.notaChiusura ? `<div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nota di chiusura</span>
                <p class="text-sm text-slate-800 bg-green-50 rounded-xl p-3 whitespace-pre-wrap">${escapeHtml(nc.notaChiusura)}</p>
            </div>` : ''}
            <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-3">Timeline</span>
                <div class="space-y-2">
                    ${timeline.map(ev => `
                    <div class="flex gap-3 items-start">
                        <span class="text-lg mt-0.5">${iconaAzione[ev.azione] || '●'}</span>
                        <div>
                            <p class="text-xs font-bold text-slate-700">${_fmtDataOra(ev.timestamp)} — ${ev.azione.replace(/_/g, ' ')}</p>
                            ${ev.nota ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(ev.nota)}</p>` : ''}
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

// ─────────────────────────────────────────────
// MODAL CHIUDI NC
// ─────────────────────────────────────────────

async function apriModalChiudiNc(ncId) {
    const nc = await getItem('nc', ncId);
    if (!nc) return;
    document.getElementById('modal-chiudi-nc')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-chiudi-nc';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-slate-800 p-5 text-white flex justify-between items-center">
            <h3 class="font-bold">✅ Chiudi NC ${escapeHtml(nc.numeroProgressivo || String(nc.id))}</h3>
            <button onclick="document.getElementById('modal-chiudi-nc').remove()" class="text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nota di chiusura * (min 10 caratteri)</label>
                <textarea id="nc-nota-chiusura" rows="4"
                    placeholder="Descrivere come è stata risolta la non conformità..."
                    class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"></textarea>
                <p class="text-[10px] text-slate-400 mt-1">ℹ Questa nota è la documentazione della risoluzione e sarà conservata in modo permanente.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="_confermaChiudiNc('${ncId}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition">✅ Conferma chiusura</button>
                <button onclick="document.getElementById('modal-chiudi-nc').remove()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition">✕ Annulla</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function _confermaChiudiNc(ncId) {
    const nota = document.getElementById('nc-nota-chiusura')?.value || '';
    const ok = await chiudiNc(ncId, nota);
    if (ok) {
        document.getElementById('modal-chiudi-nc').remove();
        await _refreshNcView();
    }
}

// ─────────────────────────────────────────────
// MODAL RIAPRI NC
// ─────────────────────────────────────────────

async function apriModalRiaperturaNc(ncId) {
    const nc = await getItem('nc', ncId);
    if (!nc) return;
    document.getElementById('modal-riapri-nc')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-riapri-nc';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-slate-800 p-5 text-white flex justify-between items-center">
            <h3 class="font-bold">↩️ Riapri NC ${escapeHtml(nc.numeroProgressivo || String(nc.id))}</h3>
            <button onclick="document.getElementById('modal-riapri-nc').remove()" class="text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                ⚠ Stai riaprendo una NC chiusa il <strong>${_fmtData(nc.dataChiusura)}</strong>.
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Motivo della riapertura * (min 10 caratteri)</label>
                <textarea id="nc-motivo-riapertura" rows="3"
                    placeholder="Motivare la riapertura..."
                    class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"></textarea>
                <p class="text-[10px] text-slate-400 mt-1">ℹ La nota di chiusura precedente sarà eliminata.</p>
            </div>
            <div class="flex gap-3">
                <button onclick="_confermaRiaperturaNc('${ncId}')" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition">↩️ Conferma riapertura</button>
                <button onclick="document.getElementById('modal-riapri-nc').remove()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition">✕ Annulla</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function _confermaRiaperturaNc(ncId) {
    const motivo = document.getElementById('nc-motivo-riapertura')?.value || '';
    const ok = await riaperturaNc(ncId, motivo);
    if (ok) {
        document.getElementById('modal-riapri-nc').remove();
        await _refreshNcView();
    }
}

// ─────────────────────────────────────────────
// WIDGET DASHBOARD (BLOCCO 5)
// ─────────────────────────────────────────────

async function renderWidgetNcDashboard(projectId) {
    const container = document.getElementById('dashboard-widget-nc');
    if (!container) return;
    const c = await contatoriNc(projectId);
    container.innerHTML = `
    <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition"
         onclick="Router.navSubView('NC')">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">⚠️ Non Conformità</span>
        <div class="flex gap-4 mb-2">
            <div><span class="text-2xl font-black text-red-600">${c.aperte}</span> <span class="text-xs text-slate-500">Aperte</span></div>
            <div><span class="text-2xl font-black text-amber-500">${c.inRisoluzione}</span> <span class="text-xs text-slate-500">In risoluzione</span></div>
        </div>
        ${c.scadute > 0 ? `<p class="text-xs font-bold text-red-600 mb-2">⚠ ${c.scadute} SCADUTE</p>` : ''}
        <p class="text-xs text-blue-600 font-bold mt-1">Vai al cruscotto NC →</p>
    </div>`;
}
window.renderWidgetNcDashboard = renderWidgetNcDashboard;

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

window.renderNcCruscotto       = renderNcCruscotto;
window.apriDettaglioNc         = apriDettaglioNc;
window.apriModalChiudiNc       = apriModalChiudiNc;
window.apriModalRiaperturaNc   = apriModalRiaperturaNc;
window.prendiInCarico          = prendiInCarico;
window.chiudiNc                = chiudiNc;
window.riaperturaNc            = riaperturaNc;
window.esportaCsvNc            = esportaCsvNc;
window.isScaduta               = isScaduta;
window.contatoriNc             = contatoriNc;
window.listaNcCantiere         = listaNcCantiere;
window._applicaFiltriNc        = _applicaFiltriNc;
window._debounceNc             = _debounceNc;
window._resetFiltriNc          = _resetFiltriNc;
window._sortNc                 = _sortNc;
window._filtroContatore        = _filtroContatore;
window._vaiVerbaleOrigine      = _vaiVerbaleOrigine;
window._confermaPresaInCarico  = _confermaPresaInCarico;
window._confermaChiudiNc       = _confermaChiudiNc;
window._confermaRiaperturaNc   = _confermaRiaperturaNc;
window._ncFiltriCorrente       = _ncFiltriCorrente;
