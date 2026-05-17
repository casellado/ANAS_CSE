// cantiere-anagrafica.js — FASE 4-septies
// Vista Anagrafica Cantiere: read mode + edit mode + dropdown FK + calcolo data fine

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function calcolaDataFineLavori(cantiere) {
    if (!cantiere.dataInizioEffettiva) return null;
    if (cantiere.durataContrattuale == null) return null;
    const inizio = new Date(cantiere.dataInizioEffettiva);
    const giorniTot = (cantiere.durataContrattuale || 0) + (cantiere.giorniSospensione || 0);
    const fine = new Date(inizio);
    fine.setDate(fine.getDate() + giorniTot);
    return fine;
}

function datiAmministrativiIncompleti(cantiere) {
    return !cantiere.cup
        && !cantiere.cig
        && !cantiere.contrattoNumero
        && !cantiere.dataInizioEffettiva
        && !cantiere.rupId
        && !cantiere.cseTitolareId;
}

function _fmt(val) {
    return (val !== null && val !== undefined && val !== '') ? escapeHtml(String(val)) : '<span class="text-slate-400">—</span>';
}

function _fmtData(val) {
    if (!val) return '<span class="text-slate-400">—</span>';
    return new Date(val + 'T00:00:00').toLocaleDateString('it-IT');
}

function _fmtImporto(val) {
    if (val === null || val === undefined || val === '') return '<span class="text-slate-400">—</span>';
    return '€ ' + Number(val).toLocaleString('it-IT', { minimumFractionDigits: 2 });
}

// Aggiorna in tempo reale il campo data fine calcolata (edit mode)
function _aggiornaDataFineCalcolata() {
    const inizio = document.getElementById('ca-dataInizioEffettiva')?.value || null;
    const durata = document.getElementById('ca-durataContrattuale')?.value;
    const sospensioni = document.getElementById('ca-giorniSospensione')?.value;
    const el = document.getElementById('ca-data-fine-calcolata');
    if (!el) return;
    const cantiere = {
        dataInizioEffettiva: inizio || null,
        durataContrattuale: durata !== '' && durata != null ? Number(durata) : null,
        giorniSospensione: sospensioni !== '' && sospensioni != null ? Number(sospensioni) : 0
    };
    const fine = calcolaDataFineLavori(cantiere);
    el.textContent = fine ? fine.toLocaleDateString('it-IT') : 'Dati insufficienti';
}

// Validazione soft CUP / CIG
function _validaCupCig() {
    const cup = document.getElementById('ca-cup')?.value || '';
    const cig = document.getElementById('ca-cig')?.value || '';
    const cupWarn = document.getElementById('ca-cup-warn');
    const cigWarn = document.getElementById('ca-cig-warn');
    if (cupWarn) cupWarn.classList.toggle('hidden', !cup || /^[A-Z0-9]{15}$/i.test(cup));
    if (cigWarn) cigWarn.classList.toggle('hidden', !cig || /^[A-Z0-9]{10}$/i.test(cig));
}

// Validazione soft date
function _validaDateOperative() {
    const inizio = document.getElementById('ca-dataInizioEffettiva')?.value;
    const fine = document.getElementById('ca-dataFineEffettiva')?.value;
    const warn = document.getElementById('ca-date-warn');
    if (warn) warn.classList.toggle('hidden', !(inizio && fine && fine < inizio));
    _aggiornaDataFineCalcolata();
}

// ─────────────────────────────────────────────
// RENDER PRINCIPALE (read mode)
// ─────────────────────────────────────────────

async function renderAnagraficaCantiere(editMode = false) {
    const projectId = sessionStorage.getItem('currentProjectId');
    const container = document.getElementById('cantiere-content');
    if (!container || !projectId) return;

    const cantiere = await getItem('projects', projectId);
    if (!cantiere) {
        container.innerHTML = '<div class="p-8 text-red-500">Cantiere non trovato.</div>';
        return;
    }

    // Risolvi nomi FK da persone_anas
    const persone = await getByIndex('persone_anas', 'projectId', projectId);
    const imprese = await getByIndex('imprese', 'projectId', projectId);

    const risolviPersona = (id) => {
        if (!id) return null;
        const p = persone.find(x => x.id == id);
        if (!p) return '⚠ ruolo orfano';
        return `${p.cognome || ''} ${p.nome || ''}`.trim() + (p.matricolaAnas ? ` (${p.matricolaAnas})` : '');
    };

    const risolviImpresa = (id) => {
        if (!id) return null;
        const imp = imprese.find(x => x.id == id);
        return imp ? escapeHtml(imp.ragioneSociale || imp.nome || String(id)) : '⚠ impresa orfana';
    };

    const dataFineCalcolata = calcolaDataFineLavori(cantiere);

    if (editMode) {
        await _renderEditMode(container, cantiere, persone, imprese);
        return;
    }

    // ── READ MODE ──
    const sezione = (titolo, icona, righe) => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
            <span>${icona}</span>
            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">${titolo}</h4>
        </div>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            ${righe}
        </div>
    </div>`;

    const riga = (label, val) => `
    <div>
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">${label}</div>
        <div class="text-sm text-slate-800">${val}</div>
    </div>`;

    const rigaNome = (label, id) => {
        const nome = risolviPersona(id);
        const val = nome ? `<span class="${nome.startsWith('⚠') ? 'text-amber-600' : ''}">${escapeHtml(nome)}</span>` : '<span class="text-slate-400">—</span>';
        return riga(label, val);
    };

    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div class="flex justify-between items-start">
            <div>
                <h2 class="text-3xl font-extrabold text-slate-900">📋 Anagrafica Cantiere</h2>
                <p class="text-slate-500 text-sm mt-1">Dati amministrativi e istituzionali</p>
            </div>
            <button onclick="renderAnagraficaCantiere(true)" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">✏️ Modifica</button>
        </div>

        ${sezione('Dati Base', '🏗️', `
            ${riga('Codice Cantiere', _fmt(cantiere.id))}
            ${riga('Nome Cantiere', _fmt(cantiere.nome))}
            ${riga('Committente', _fmt(cantiere.committente))}
        `)}

        ${sezione('Identificativo Viario', '🛣️', `
            ${riga('S.S. N°', _fmt(cantiere.ssNumero))}
            ${riga('Progressiva Inizio', _fmt(cantiere.progressivaInizio))}
            ${riga('Progressiva Fine', _fmt(cantiere.progressivaFine))}
            ${riga('Struttura Territoriale', _fmt(cantiere.strutturaTerritoriale))}
        `)}

        ${sezione('Codifiche Amministrative', '🔢', `
            ${riga('Codice PPM/SIL', _fmt(cantiere.codicePpmSil))}
            ${riga('Commessa N°', _fmt(cantiere.commessaNumero))}
            ${riga('Voce di Budget', _fmt(cantiere.voceBudget))}
            ${riga('CUP', _fmt(cantiere.cup))}
            ${riga('CIG', _fmt(cantiere.cig))}
        `)}

        ${sezione('Dati Contrattuali', '📄', `
            ${riga('Contratto N°', _fmt(cantiere.contrattoNumero))}
            ${riga('Data Contratto', _fmtData(cantiere.contrattoData))}
            ${riga('Importo Contratto', _fmtImporto(cantiere.importoContratto))}
            ${riga('Data Consegna Lavori', _fmtData(cantiere.dataConsegnaLavori))}
            ${riga('Durata Contrattuale (gg)', _fmt(cantiere.durataContrattuale))}
            ${riga('Giorni Sospensione', cantiere.giorniSospensione != null ? String(cantiere.giorniSospensione) : '0')}
            <div class="md:col-span-2 mt-1 bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                <span class="text-slate-400">📅</span>
                <span class="text-slate-600">Data fine prevista (calcolata):</span>
                <span class="font-bold text-slate-800">${dataFineCalcolata ? dataFineCalcolata.toLocaleDateString('it-IT') : '<span class="text-slate-400">Dati insufficienti</span>'}</span>
                <span class="text-xs text-slate-400 ml-1">(inizio + durata + sospensioni)</span>
            </div>
        `)}

        ${sezione('Date Operative', '📅', `
            ${riga('Data Inizio Effettiva', _fmtData(cantiere.dataInizioEffettiva))}
            ${riga('Data Fine Effettiva', _fmtData(cantiere.dataFineEffettiva))}
        `)}

        ${sezione('Ruoli Istituzionali', '👷', `
            ${rigaNome('RUP', cantiere.rupId)}
            ${rigaNome('DL (Direttore Lavori)', cantiere.dlId)}
            ${rigaNome('CSE Titolare', cantiere.cseTitolareId)}
            ${rigaNome('CSE Delegato', cantiere.cseDelegatoId)}
            ${rigaNome('Ispettore di Cantiere', cantiere.ispettoreCantiereId)}
            ${rigaNome('Responsabile dei Lavori', cantiere.responsabileLavoriId)}
        `)}

        ${sezione('CSP Esterno', '🔰', `
            ${riga('Nome', _fmt(cantiere.cspNome))}
            ${riga('Qualifica', _fmt(cantiere.cspQualifica))}
            ${riga('Recapito', _fmt(cantiere.cspRecapito))}
        `)}

        ${sezione('Esecutore', '🏢', `
            ${riga('Impresa Affidataria', cantiere.impresaAffidatariaId ? `<span>${risolviImpresa(cantiere.impresaAffidatariaId)}</span>` : '<span class="text-slate-400">—</span>')}
            ${riga('Direttore Tecnico (Impresa)', _fmt(cantiere.direttoreTecnicoNome))}
            ${riga('Direttore di Cantiere (Impresa)', _fmt(cantiere.direttoreCantiereNome))}
        `)}
    </div>`;
}

// ─────────────────────────────────────────────
// EDIT MODE
// ─────────────────────────────────────────────

async function _renderEditMode(container, cantiere, persone, imprese) {
    const dropdownRuolo = (id, ruolo, valore) => {
        const filtered = persone.filter(p => p.ruolo === ruolo);
        if (filtered.length === 0) {
            return `<select id="${id}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50 text-amber-700">
                <option value="">⚠ Nessuna persona con ruolo ${ruolo} — <a onclick="Router.navSubView('ANAS')" class="underline cursor-pointer">Aggiungi</a></option>
            </select>
            <p class="text-xs text-amber-600 mt-1">⚠ Nessuna persona con ruolo <strong>${ruolo}</strong> in Anagrafica Sicurezza. <button onclick="Router.navSubView('ANAS')" class="underline font-bold">Aggiungi</button></p>`;
        }
        return `<select id="${id}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">— Nessuno —</option>
            ${filtered.map(p => `<option value="${p.id}" ${valore == p.id ? 'selected' : ''}>${p.cognome || ''} ${p.nome || ''}${p.matricolaAnas ? ' (' + p.matricolaAnas + ')' : ''}</option>`).join('')}
        </select>`;
    };

    const dropdownImprese = (id, valore) => {
        const affidatarie = imprese.filter(i => i.ruolo === 'Affidataria');
        if (affidatarie.length === 0) {
            return `<select id="${id}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-amber-50 text-amber-700">
                <option value="">⚠ Nessuna impresa Affidataria</option>
            </select>
            <p class="text-xs text-amber-600 mt-1">⚠ Nessuna impresa con ruolo <strong>Affidataria</strong>. <button onclick="Router.navSubView('IMPRESE')" class="underline font-bold">Aggiungi</button></p>`;
        }
        return `<select id="${id}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">— Nessuna —</option>
            ${affidatarie.map(i => `<option value="${i.id}" ${valore == i.id ? 'selected' : ''}>${escapeHtml(i.ragioneSociale || i.nome || String(i.id))}</option>`).join('')}
        </select>`;
    };

    const campo = (label, inputHtml, hint = '') => `
    <div>
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">${label}</label>
        ${inputHtml}
        ${hint ? `<p class="text-[10px] text-slate-400 mt-0.5">${hint}</p>` : ''}
    </div>`;

    const txt = (id, val, placeholder = '', type = 'text') =>
        `<input type="${type}" id="${id}" value="${escapeHtml(val ?? '')}" placeholder="${placeholder}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">`;

    const num = (id, val, placeholder = '', min = '') =>
        `<input type="number" id="${id}" value="${val ?? ''}" placeholder="${placeholder}" min="${min}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">`;

    const data = (id, val) =>
        `<input type="date" id="${id}" value="${val ?? ''}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">`;

    const sezioneEdit = (titolo, icona, righe) => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
            <span>${icona}</span>
            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">${titolo}</h4>
        </div>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            ${righe}
        </div>
    </div>`;

    const dataFineCalc = calcolaDataFineLavori(cantiere);

    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div class="flex justify-between items-start">
            <div>
                <h2 class="text-3xl font-extrabold text-slate-900">✏️ Modifica Anagrafica Cantiere</h2>
                <p class="text-slate-500 text-sm mt-1">Tutti i campi sono opzionali tranne Codice e Nome</p>
            </div>
            <div class="flex gap-2">
                <button onclick="salvaAnagraficaCantiere()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">💾 Salva</button>
                <button onclick="renderAnagraficaCantiere(false)" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2.5 rounded-xl transition">✕ Annulla</button>
            </div>
        </div>

        ${sezioneEdit('Dati Base', '🏗️', `
            ${campo('Codice Cantiere *', `<input type="text" id="ca-id" value="${escapeHtml(cantiere.id)}" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50" readonly>`, 'Il codice non è modificabile')}
            ${campo('Nome Cantiere *', txt('ca-nome', cantiere.nome, 'Es. Lavori SS 106 Jonica'))}
            ${campo('Committente', txt('ca-committente', cantiere.committente, 'Es. ANAS S.p.A. - S.T. Calabria'))}
        `)}

        ${sezioneEdit('Identificativo Viario', '🛣️', `
            ${campo('S.S. N°', txt('ca-ssNumero', cantiere.ssNumero, 'Es. S.S. 106 Jonica'))}
            ${campo('Progressiva Inizio', txt('ca-progressivaInizio', cantiere.progressivaInizio, 'Es. km 245+200'))}
            ${campo('Progressiva Fine', txt('ca-progressivaFine', cantiere.progressivaFine, 'Es. km 247+800'))}
            ${campo('Struttura Territoriale', txt('ca-strutturaTerritoriale', cantiere.strutturaTerritoriale, 'Es. S.T. Calabria'))}
        `)}

        ${sezioneEdit('Codifiche Amministrative', '🔢', `
            ${campo('Codice PPM/SIL', txt('ca-codicePpmSil', cantiere.codicePpmSil, 'Es. PPM/2025/00471'))}
            ${campo('Commessa N°', txt('ca-commessaNumero', cantiere.commessaNumero, 'Es. C-2025-CZ-019'))}
            ${campo('Voce di Budget', txt('ca-voceBudget', cantiere.voceBudget, 'Es. VB.04.12.001'))}
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">CUP</label>
                <input type="text" id="ca-cup" value="${escapeHtml(cantiere.cup ?? '')}" placeholder="Es. F11B23000000005" maxlength="20"
                    oninput="_validaCupCig()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400">
                <p id="ca-cup-warn" class="hidden text-xs text-amber-600 mt-1">⚠ Formato CUP non standard (attesi 15 caratteri alfanumerici)</p>
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">CIG</label>
                <input type="text" id="ca-cig" value="${escapeHtml(cantiere.cig ?? '')}" placeholder="Es. 9876543210" maxlength="15"
                    oninput="_validaCupCig()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400">
                <p id="ca-cig-warn" class="hidden text-xs text-amber-600 mt-1">⚠ Formato CIG non standard (attesi 10 caratteri alfanumerici)</p>
            </div>
        `)}

        ${sezioneEdit('Dati Contrattuali', '📄', `
            ${campo('Contratto N°', txt('ca-contrattoNumero', cantiere.contrattoNumero, 'Es. REP. 4521'))}
            ${campo('Data Contratto', data('ca-contrattoData', cantiere.contrattoData))}
            ${campo('Importo Contratto (€)', num('ca-importoContratto', cantiere.importoContratto, 'Es. 185320.50', '0'))}
            ${campo('Data Consegna Lavori', data('ca-dataConsegnaLavori', cantiere.dataConsegnaLavori))}
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Durata Contrattuale (giorni)</label>
                <input type="number" id="ca-durataContrattuale" value="${cantiere.durataContrattuale ?? ''}" placeholder="Es. 365" min="1"
                    oninput="_aggiornaDataFineCalcolata()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Giorni Sospensione</label>
                <input type="number" id="ca-giorniSospensione" value="${cantiere.giorniSospensione ?? 0}" placeholder="0" min="0"
                    oninput="_aggiornaDataFineCalcolata()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div class="md:col-span-2 bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                <span class="text-slate-400">📅</span>
                <span class="text-slate-600">Data fine prevista (calcolata):</span>
                <span id="ca-data-fine-calcolata" class="font-bold text-slate-800">${dataFineCalc ? dataFineCalc.toLocaleDateString('it-IT') : 'Dati insufficienti'}</span>
                <span class="text-xs text-slate-400 ml-1">(inizio + durata + sospensioni)</span>
            </div>
        `)}

        ${sezioneEdit('Date Operative', '📅', `
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Data Inizio Effettiva</label>
                <input type="date" id="ca-dataInizioEffettiva" value="${cantiere.dataInizioEffettiva ?? ''}"
                    oninput="_validaDateOperative()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Data Fine Effettiva</label>
                <input type="date" id="ca-dataFineEffettiva" value="${cantiere.dataFineEffettiva ?? ''}"
                    oninput="_validaDateOperative()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <p id="ca-date-warn" class="hidden text-xs text-amber-600 mt-1">⚠ La data fine è anteriore alla data inizio</p>
            </div>
        `)}

        ${sezioneEdit('Ruoli Istituzionali', '👷', `
            ${campo('RUP', dropdownRuolo('ca-rupId', 'RUP', cantiere.rupId))}
            ${campo('DL (Direttore Lavori)', dropdownRuolo('ca-dlId', 'DL', cantiere.dlId))}
            ${campo('CSE Titolare', dropdownRuolo('ca-cseTitolareId', 'CSE_TITOLARE', cantiere.cseTitolareId))}
            ${campo('CSE Delegato', dropdownRuolo('ca-cseDelegatoId', 'CSE_DELEGATO', cantiere.cseDelegatoId))}
            ${campo('Ispettore di Cantiere', dropdownRuolo('ca-ispettoreCantiereId', 'ISPETTORE_CANTIERE', cantiere.ispettoreCantiereId))}
            ${campo('Responsabile dei Lavori', dropdownRuolo('ca-responsabileLavoriId', 'RL', cantiere.responsabileLavoriId))}
        `)}

        ${sezioneEdit('CSP Esterno (testo libero)', '🔰', `
            ${campo('Nome', txt('ca-cspNome', cantiere.cspNome, 'Es. Ing. Mario Rossi'))}
            ${campo('Qualifica', txt('ca-cspQualifica', cantiere.cspQualifica, 'Es. Ingegnere'))}
            ${campo('Recapito', txt('ca-cspRecapito', cantiere.cspRecapito, 'Es. m.rossi@studio.it'))}
        `)}

        ${sezioneEdit('Esecutore', '🏢', `
            ${campo('Impresa Affidataria', dropdownImprese('ca-impresaAffidatariaId', cantiere.impresaAffidatariaId))}
            ${campo('Direttore Tecnico (lato impresa)', txt('ca-direttoreTecnicoNome', cantiere.direttoreTecnicoNome, 'Es. Ing. Bianchi'))}
            ${campo('Direttore di Cantiere (lato impresa)', txt('ca-direttoreCantiereNome', cantiere.direttoreCantiereNome, 'Es. Geom. Verdi'))}
        `)}

        <div class="flex gap-2 pb-8">
            <button onclick="salvaAnagraficaCantiere()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow transition">💾 Salva Anagrafica</button>
            <button onclick="renderAnagraficaCantiere(false)" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-3 rounded-xl transition">✕ Annulla</button>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────
// SALVATAGGIO
// ─────────────────────────────────────────────

async function salvaAnagraficaCantiere() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const cantiere = await getItem('projects', projectId);
    if (!cantiere) return;

    const nome = document.getElementById('ca-nome')?.value.trim();
    if (!nome) { showToast('Il nome cantiere è obbligatorio.', 'error'); return; }

    const importoRaw = document.getElementById('ca-importoContratto')?.value;
    const importo = importoRaw !== '' && importoRaw != null ? Number(importoRaw) : null;
    if (importo !== null && importo < 0) { showToast('L\'importo contratto non può essere negativo.', 'error'); return; }

    const durataRaw = document.getElementById('ca-durataContrattuale')?.value;
    const durata = durataRaw !== '' && durataRaw != null ? parseInt(durataRaw, 10) : null;
    if (durata !== null && (isNaN(durata) || durata < 1)) { showToast('La durata contrattuale deve essere un numero intero positivo.', 'error'); return; }

    const sospRaw = document.getElementById('ca-giorniSospensione')?.value;
    const sospensioni = sospRaw !== '' && sospRaw != null ? parseInt(sospRaw, 10) : 0;
    if (isNaN(sospensioni) || sospensioni < 0) { showToast('I giorni di sospensione devono essere ≥ 0.', 'error'); return; }

    const _v = (id) => { const el = document.getElementById(id); return el ? (el.value.trim() || null) : null; };
    const _fk = (id) => { const el = document.getElementById(id); return el && el.value ? el.value : null; };

    const aggiornato = {
        ...cantiere,
        nome,
        committente: _v('ca-committente'),
        ssNumero: _v('ca-ssNumero'),
        progressivaInizio: _v('ca-progressivaInizio'),
        progressivaFine: _v('ca-progressivaFine'),
        strutturaTerritoriale: _v('ca-strutturaTerritoriale'),
        codicePpmSil: _v('ca-codicePpmSil'),
        commessaNumero: _v('ca-commessaNumero'),
        voceBudget: _v('ca-voceBudget'),
        cup: _v('ca-cup'),
        cig: _v('ca-cig'),
        contrattoNumero: _v('ca-contrattoNumero'),
        contrattoData: _v('ca-contrattoData'),
        importoContratto: importo,
        dataConsegnaLavori: _v('ca-dataConsegnaLavori'),
        durataContrattuale: durata,
        giorniSospensione: sospensioni,
        rupId: _fk('ca-rupId'),
        dlId: _fk('ca-dlId'),
        cseTitolareId: _fk('ca-cseTitolareId'),
        cseDelegatoId: _fk('ca-cseDelegatoId'),
        ispettoreCantiereId: _fk('ca-ispettoreCantiereId'),
        responsabileLavoriId: _fk('ca-responsabileLavoriId'),
        cspNome: _v('ca-cspNome'),
        cspQualifica: _v('ca-cspQualifica'),
        cspRecapito: _v('ca-cspRecapito'),
        dataInizioEffettiva: _v('ca-dataInizioEffettiva'),
        dataFineEffettiva: _v('ca-dataFineEffettiva'),
        impresaAffidatariaId: _fk('ca-impresaAffidatariaId'),
        direttoreTecnicoNome: _v('ca-direttoreTecnicoNome'),
        direttoreCantiereNome: _v('ca-direttoreCantiereNome')
    };

    await saveItem('projects', aggiornato);
    showToast('Anagrafica cantiere salvata ✓', 'success');
    await renderAnagraficaCantiere(false);
}

// ─────────────────────────────────────────────
// EDIT MODE DIRETTO (per badge da lista)
// ─────────────────────────────────────────────

async function apriAnagraficaEditMode() {
    await Router.navSubView('ANAGRAFICA_CANTIERE');
    // Attendi il render, poi forza edit mode
    setTimeout(() => renderAnagraficaCantiere(true), 50);
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

window.renderAnagraficaCantiere  = renderAnagraficaCantiere;
window.salvaAnagraficaCantiere   = salvaAnagraficaCantiere;
window.calcolaDataFineLavori     = calcolaDataFineLavori;
window.datiAmministrativiIncompleti = datiAmministrativiIncompleti;
window.apriAnagraficaEditMode    = apriAnagraficaEditMode;
window._aggiornaDataFineCalcolata = _aggiornaDataFineCalcolata;
window._validaCupCig             = _validaCupCig;
window._validaDateOperative      = _validaDateOperative;
