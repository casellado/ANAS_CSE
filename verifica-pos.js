// verifica-pos.js — FASE 6.1
// Verifica Idoneità POS: CRUD + workflow BOZZA→FIRMATO→PROTOCOLLATO + docx

// ─────────────────────────────────────────────
// STATO MODULO
// ─────────────────────────────────────────────
let _firmaPerInvioInProgress = false;

// ─────────────────────────────────────────────
// HELPERS DB (autoIncrement — stesso pattern verbali-riunione.js)
// ─────────────────────────────────────────────

function _saveVerificaPosDB(record) {
    return new Promise((resolve, reject) => {
        const t = db.transaction('verifica_pos', 'readwrite');
        const s = t.objectStore('verifica_pos');
        record.modifiedAt = new Date().toISOString();
        const req = s.put(record);
        req.onsuccess = () => {
            if (!record.id) record.id = req.result;
            resolve(record);
        };
        req.onerror = () => reject(req.error);
    });
}

// ─────────────────────────────────────────────
// NUMERAZIONE PROGRESSIVA  YYYYMMDD/VP{NN}
// ─────────────────────────────────────────────

async function calcolaNumeroProgressivoVP(projectId, dataDocumento) {
    const tutti = await getByIndex('verifica_pos', 'projectId', projectId);
    const dataPrefix = (dataDocumento || '').replace(/-/g, '');
    // TODO ARCH: sostituire con IDBKeyRange su indice composto {projectId, dataDocumento}
    // per eliminare il carico di tutti i record in RAM.
    const numeri = tutti
        .filter(r => r.dataDocumento === dataDocumento && r.stato !== 'BOZZA' && r.numeroProgressivo)
        .map(r => parseInt((r.numeroProgressivo || '').replace(/\D/g, '')) || 0);
    const maxNum = Math.max(0, ...numeri);
    return `${dataPrefix}/VP${String(maxNum + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// LISTA
// ─────────────────────────────────────────────

async function listaVerifichePos(projectId) {
    const list = await getByIndex('verifica_pos', 'projectId', projectId);
    list.sort((a, b) => (b.dataDocumento || '').localeCompare(a.dataDocumento || ''));
    return list;
}

// ─────────────────────────────────────────────
// VALIDAZIONE PRE-FIRMA
// ─────────────────────────────────────────────

async function validaVerificaPos(record) {
    const errori = [];
    if (!record.impresaId) { errori.push('Seleziona l\'impresa affidataria'); }
    else {
        const imp = await getItem('imprese', record.impresaId);
        if (!imp?.pec) errori.push('L\'impresa selezionata non ha PEC — aggiungila in Anagrafiche → Imprese');
    }
    if (!record.dataDocumento) errori.push('Data documento obbligatoria');
    if (!record.esito) errori.push('Seleziona un esito');
    if (record.esito === 'idoneo' && !record.motivazioniIdoneo?.trim()) errori.push('Inserisci le motivazioni (Idoneo)');
    if (record.esito === 'integrazioni' && !record.motivazioniIntegrazioni?.trim()) errori.push('Inserisci le integrazioni richieste');
    if (record.esito === 'non_idoneo' && !record.motivazioniNonIdoneo?.trim()) errori.push('Inserisci le motivazioni (Non idoneo)');
    if (!record.altreVisure?.trim()) errori.push('Compilare il campo "Altre visure e verifiche"');
    const cantiere = await getItem('projects', record.projectId);
    if (!cantiere?.responsabileLavoriId) errori.push('Anagrafica Cantiere: manca il Responsabile dei Lavori (RL)');
    if (!record.nomeResponsabileArea?.trim()) errori.push('Inserisci il Responsabile Area Gestione Rete/Nuove Opere');
    return errori;
}

// ─────────────────────────────────────────────
// RENDER LISTA
// ─────────────────────────────────────────────

async function renderVerifichePos() {
    const projectId = sessionStorage.getItem('currentProjectId');
    const container = document.getElementById('view-verifica-pos');
    if (!container || !projectId) return;

    const lista = await listaVerifichePos(projectId);

    const badgeStato = (s) => {
        if (s === 'PROTOCOLLATO') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">✅ PROTOCOLLATO</span>';
        if (s === 'FIRMATO')      return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⏳ FIRMATO</span>';
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">📝 BOZZA</span>';
    };
    const badgeEsito = (e) => {
        if (e === 'idoneo')       return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">✅ Idoneo</span>';
        if (e === 'integrazioni') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠ Integrazioni</span>';
        if (e === 'non_idoneo')   return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">❌ Non idoneo</span>';
        return '<span class="text-slate-400 text-[10px]">—</span>';
    };

    // Risolvi ragioni sociali imprese in batch
    const impIds = [...new Set(lista.map(r => r.impresaId).filter(Boolean))];
    const impMap = {};
    for (const id of impIds) {
        const imp = await getItem('imprese', id);
        if (imp) impMap[id] = imp.ragioneSociale || String(id);
    }

    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 class="text-2xl font-bold text-slate-800 flex items-center gap-2"><span>📋</span> Verifica Idoneità POS</h3>
            <div class="flex gap-2 flex-wrap">
                <button onclick="apriFormVerificaPos(null)" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2">
                    <span>+</span> Nuova Verifica POS
                </button>
                <button onclick="mostraWizardTemplateVerificaPos()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold transition flex items-center gap-2" title="Carica/Sostituisci Template Word">
                    <span>⚙️</span> Template
                </button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                        <th class="px-4 py-3">N°</th>
                        <th class="px-4 py-3">Data</th>
                        <th class="px-4 py-3">Impresa</th>
                        <th class="px-4 py-3 text-center">Esito</th>
                        <th class="px-4 py-3 text-center">Stato</th>
                        <th class="px-4 py-3 text-right">Azioni</th>
                    </tr>
                </thead>
                <tbody>
                ${lista.length === 0
                    ? `<tr><td colspan="6" class="px-4 py-12 text-center text-slate-400 italic">Nessuna verifica POS per questo cantiere.</td></tr>`
                    : lista.map(r => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td class="px-4 py-3 font-mono text-xs font-bold">${escapeHtml(r.numeroProgressivo || 'BOZZA')}</td>
                        <td class="px-4 py-3 text-sm">${r.dataDocumento ? new Date(r.dataDocumento + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</td>
                        <td class="px-4 py-3 text-sm">${escapeHtml(impMap[r.impresaId] || '—')}
                            ${r.stato === 'PROTOCOLLATO' && r.numeroProtocollo ? `<div class="text-[10px] text-slate-500 mt-0.5">Prot. ${escapeHtml(r.numeroProtocollo)}</div>` : ''}
                        </td>
                        <td class="px-4 py-3 text-center">${badgeEsito(r.esito)}</td>
                        <td class="px-4 py-3 text-center">${badgeStato(r.stato)}</td>
                        <td class="px-4 py-3 text-right space-x-1">
                            <button onclick="apriFormVerificaPos('${r.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Apri">✏️</button>
                            <button onclick="mostraAnteprimaVerificaPos('${r.id}')" class="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Anteprima stampa">👁</button>
                            <button onclick="scaricaWordVerificaPos('${r.id}')" class="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Scarica Word per firma">📄</button>
                            ${r.stato === 'FIRMATO' ? `<button onclick="apriModalProtocollo('${r.id}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Carica protocollazione">📥</button>` : ''}
                            ${r.stato === 'PROTOCOLLATO' ? `<button onclick="scaricaPdfProtocollato('${r.id}')" class="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Scarica PDF protocollato">📎</button>` : ''}
                            ${r.stato === 'PROTOCOLLATO' ? `<button onclick="scaricaLetteraTrasmissione('${r.id}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Scarica lettera trasmissione">📨</button>` : ''}
                            ${r.stato === 'BOZZA' ? `<button onclick="eliminaVerificaPos('${r.id}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Elimina">🗑️</button>` : ''}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────
// FORM APERTURA / MODIFICA
// ─────────────────────────────────────────────

async function apriFormVerificaPos(id) {
    const projectId = sessionStorage.getItem('currentProjectId');
    const cantiere = await getItem('projects', projectId);
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    // Bug fix: ruolo salvato come 'AFFIDATARIA' uppercase, non 'Affidataria'
    const affidatarie = imprese.filter(i => i.ruolo === 'AFFIDATARIA');

    let record = null;
    if (id) {
        record = await getItem('verifica_pos', Number(id));
    }
    const isSolaLettura = record && (record.stato === 'FIRMATO' || record.stato === 'PROTOCOLLATO');

    // Calcola nome RL dal cantiere
    let nomeRlDefault = record?.nomeRl || '';
    if (!nomeRlDefault && cantiere?.responsabileLavoriId) {
        const rl = await getItem('persone_anas', cantiere.responsabileLavoriId);
        if (rl) nomeRlDefault = `${rl.cognome || ''} ${rl.nome || ''}`.trim();
    }

    // Warning dati amministrativi mancanti
    const datiMancanti = !cantiere?.ssNumero && !cantiere?.codicePpmSil && !cantiere?.cup && !cantiere?.cig;

    const container = document.getElementById('view-verifica-pos');
    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div class="flex items-center gap-4">
            <button onclick="renderVerifichePos()" class="text-slate-500 hover:text-slate-800 transition">← Lista</button>
            <h3 class="text-2xl font-bold text-slate-800">
                ${record ? (isSolaLettura ? '📋 Verifica POS' : '✏️ Modifica Verifica POS') : '+ Nuova Verifica POS'}
            </h3>
            ${record?.numeroProgressivo ? `<span class="font-mono text-xs bg-slate-100 px-2 py-1 rounded">${escapeHtml(record.numeroProgressivo)}</span>` : ''}
        </div>

        ${isSolaLettura ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <span class="text-2xl">🔒</span>
            <div>
                <p class="font-bold text-amber-800 text-sm">Documento già firmato e inviato</p>
                <p class="text-amber-700 text-xs mt-0.5">Le modifiche non sono più possibili. Stato: <strong>${record.stato}</strong></p>
            </div>
        </div>` : ''}

        ${datiMancanti ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <span class="text-xl">⚠️</span>
            <p class="text-amber-800 text-sm">Completa l'<button onclick="Router.navSubView('ANAGRAFICA_CANTIERE')" class="underline font-bold">Anagrafica Cantiere</button> prima di procedere (mancano SS, PPM/SIL, CUP, CIG).</p>
        </div>` : ''}

        <!-- SEZ 1: Intestazione cantiere (read-only) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>🏗️</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Dati Cantiere (da Anagrafica)</h4>
            </div>
            <div class="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">S.S. N°</span>${escapeHtml(cantiere?.ssNumero || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Lavori</span>${escapeHtml(cantiere?.nome || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Cod. PPM/SIL</span>${escapeHtml(cantiere?.codicePpmSil || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">CUP</span>${escapeHtml(cantiere?.cup || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">CIG</span>${escapeHtml(cantiere?.cig || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Commessa</span>${escapeHtml(cantiere?.commessaNumero || '—')}</div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase block">Voce di Budget</span>${escapeHtml(cantiere?.voceBudget || '—')}</div>
            </div>
        </div>

        <!-- SEZ 2: Impresa Affidataria -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>🏢</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Impresa Affidataria</h4>
            </div>
            <div class="p-6 space-y-3">
                ${isSolaLettura
                    ? `<p class="text-sm font-semibold text-slate-800">${escapeHtml(record?._impresaNome || '—')}</p>`
                    : `<select id="vp-impresaId" onchange="_aggiornaPecWarning()" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">— Seleziona impresa affidataria —</option>
                        ${affidatarie.map(i => `<option value="${i.id}" data-pec="${escapeHtml(i.pec || '')}" ${record?.impresaId == i.id ? 'selected' : ''}>${escapeHtml(i.ragioneSociale)}${i.pec ? ' · ' + escapeHtml(i.pec) : ''}</option>`).join('')}
                    </select>
                    <p id="vp-pec-warn" class="hidden text-xs text-amber-600">⚠ L'impresa selezionata non ha PEC — <button onclick="Router.navSubView('IMPRESE')" class="underline font-bold">Aggiungila in Anagrafiche → Imprese</button></p>`}
                ${affidatarie.length === 0 && !isSolaLettura
                    ? `<p class="text-xs text-amber-600">⚠ Nessuna impresa con ruolo Affidataria. <button onclick="Router.navSubView('IMPRESE')" class="underline font-bold">Aggiungila</button></p>`
                    : ''}
            </div>
        </div>

        <!-- SEZ 3: Dati documento -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>📄</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Dati Documento</h4>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Numero Progressivo</label>
                    <input type="text" id="vp-numeroProgressivo" value="${escapeHtml(record?.numeroProgressivo || 'Auto')}" readonly
                        class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-slate-50 text-slate-500">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data Documento *</label>
                    ${isSolaLettura
                        ? `<p class="text-sm font-semibold">${record?.dataDocumento ? new Date(record.dataDocumento + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</p>`
                        : `<input type="date" id="vp-dataDocumento" value="${record?.dataDocumento || ''}"
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">`}
                </div>
            </div>
        </div>

        <!-- SEZ 4: Altre visure -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>🔍</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Visure e Verifiche</h4>
            </div>
            <div class="p-6">
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Dichiarazione di verifica congruenza ed eventuali altre visure/visti *</label>
                ${isSolaLettura
                    ? `<p class="text-sm text-slate-800 whitespace-pre-wrap">${escapeHtml(record?.altreVisure || '—')}</p>`
                    : `<textarea id="vp-altreVisure" rows="3" placeholder="Es. verificata la congruenza con il PSC e gli elaborati progettuali..."
                        class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">${escapeHtml(record?.altreVisure || '')}</textarea>`}
            </div>
        </div>

        <!-- SEZ 5: Esito -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>⚖️</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Esito Verifica *</h4>
            </div>
            <div class="p-6 space-y-3">
                ${['idoneo','integrazioni','non_idoneo'].map(val => {
                    const label = val === 'idoneo' ? '✅ Idoneo' : val === 'integrazioni' ? '⚠ Idoneo con integrazioni' : '❌ Non idoneo';
                    const checked = record?.esito === val ? 'checked' : '';
                    return isSolaLettura
                        ? `<div class="flex items-center gap-3 p-3 rounded-xl ${record?.esito === val ? 'bg-blue-50 border border-blue-200' : 'opacity-40'}">
                               <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${record?.esito === val ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}">
                                   ${record?.esito === val ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                               </div>
                               <span class="text-sm font-semibold">${label}</span>
                           </div>`
                        : `<label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                               <input type="radio" name="vp-esito" value="${val}" ${checked} onchange="_aggiornaMotivazioni()"
                                   class="w-4 h-4 accent-blue-600">
                               <span class="text-sm font-semibold">${label}</span>
                           </label>`;
                }).join('')}
            </div>
        </div>

        <!-- SEZ 6: Motivazioni (condizionali) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="vp-motivazioni-box">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>📝</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Motivazioni</h4>
            </div>
            <div class="p-6 space-y-4">
                <div id="vp-mot-idoneo" class="${record?.esito === 'idoneo' ? '' : 'hidden'}">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Motivazioni / Note (Idoneo)</label>
                    ${isSolaLettura
                        ? `<p class="text-sm text-slate-800 whitespace-pre-wrap">${escapeHtml(record?.motivazioniIdoneo || '—')}</p>`
                        : `<textarea id="vp-motivazioniIdoneo" rows="4" placeholder="Eventuali note o motivazioni..."
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">${escapeHtml(record?.motivazioniIdoneo || '')}</textarea>`}
                </div>
                <div id="vp-mot-integrazioni" class="${record?.esito === 'integrazioni' ? '' : 'hidden'}">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Integrazioni richieste *</label>
                    ${isSolaLettura
                        ? `<p class="text-sm text-slate-800 whitespace-pre-wrap">${escapeHtml(record?.motivazioniIntegrazioni || '—')}</p>`
                        : `<textarea id="vp-motivazioniIntegrazioni" rows="4" placeholder="Descrivere le integrazioni richieste..."
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">${escapeHtml(record?.motivazioniIntegrazioni || '')}</textarea>`}
                </div>
                <div id="vp-mot-non-idoneo" class="${record?.esito === 'non_idoneo' ? '' : 'hidden'}">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Motivazioni della non idoneità *</label>
                    ${isSolaLettura
                        ? `<p class="text-sm text-slate-800 whitespace-pre-wrap">${escapeHtml(record?.motivazioniNonIdoneo || '—')}</p>`
                        : `<textarea id="vp-motivazioniNonIdoneo" rows="4" placeholder="Motivare la non conformità..."
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">${escapeHtml(record?.motivazioniNonIdoneo || '')}</textarea>`}
                </div>
                ${!record?.esito && !isSolaLettura ? `<p class="text-slate-400 text-sm italic">Seleziona un esito per compilare le motivazioni.</p>` : ''}
            </div>
        </div>

        <!-- SEZ 7: Visti esterni -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                <span>✍️</span><h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest">Visti Esterni</h4>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Responsabile dei Lavori (RL)</label>
                    ${isSolaLettura
                        ? `<p class="text-sm font-semibold">${escapeHtml(record?.nomeRl || '—')}</p>`
                        : `<input type="text" id="vp-nomeRl" value="${escapeHtml(nomeRlDefault)}"
                            placeholder="Nome RL (precompilato da Anagrafica Cantiere)"
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                          <p class="text-[10px] text-slate-400 mt-1">Precompilato da Anagrafica Cantiere. Modificabile per questo documento.</p>`}
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Resp. Area Gestione Rete / Nuove Opere *</label>
                    ${isSolaLettura
                        ? `<p class="text-sm font-semibold">${escapeHtml(record?.nomeResponsabileArea || '—')}</p>`
                        : `<input type="text" id="vp-nomeResponsabileArea" value="${escapeHtml(record?.nomeResponsabileArea || '')}"
                            placeholder="Es. Ing. Mario Rossi"
                            class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">`}
                </div>
            </div>
        </div>

        <!-- Pulsanti -->
        ${!isSolaLettura ? `
        <div class="flex flex-wrap gap-3 pb-8">
            <button onclick="salvaBozzaVerificaPos(${record?.id || 'null'})"
                class="bg-slate-600 hover:bg-slate-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">
                💾 Salva Bozza
            </button>
            <button onclick="mostraAnteprimaVerificaPos(${record?.id || 'null'})"
                class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl transition">
                👁 Anteprima Stampa
            </button>
            <button onclick="firmaPerInvio(${record?.id || 'null'})"
                class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">
                ✍️ Firma e Scarica per Invio
            </button>
        </div>` : `
        <div class="flex flex-wrap gap-3 pb-8">
            <button onclick="mostraAnteprimaVerificaPos('${record.id}')"
                class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl transition">
                👁 Anteprima Stampa
            </button>
            <button onclick="scaricaWordVerificaPos('${record.id}')"
                class="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">
                📄 Rigenera Word
            </button>
            ${record.stato === 'FIRMATO'
                ? `<button onclick="apriModalProtocollo('${record.id}')"
                    class="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">
                    📥 Carica Protocollazione
                  </button>` : ''}
        </div>`}
    </div>`;

    // Inizializza warning PEC se c'è già un'impresa selezionata
    if (!isSolaLettura) _aggiornaPecWarning();
}

// ─────────────────────────────────────────────
// HELPERS FORM (reactive)
// ─────────────────────────────────────────────

function _aggiornaPecWarning() {
    const sel = document.getElementById('vp-impresaId');
    const warn = document.getElementById('vp-pec-warn');
    if (!sel || !warn) return;
    const opt = sel.options[sel.selectedIndex];
    const pec = opt?.dataset?.pec || '';
    warn.classList.toggle('hidden', !sel.value || !!pec);
}

function _aggiornaMotivazioni() {
    const esito = document.querySelector('input[name="vp-esito"]:checked')?.value;
    document.getElementById('vp-mot-idoneo')?.classList.toggle('hidden', esito !== 'idoneo');
    document.getElementById('vp-mot-integrazioni')?.classList.toggle('hidden', esito !== 'integrazioni');
    document.getElementById('vp-mot-non-idoneo')?.classList.toggle('hidden', esito !== 'non_idoneo');
}

// ─────────────────────────────────────────────
// RACCOLTA DATI FORM
// ─────────────────────────────────────────────

function _raccogliFormVP(idEsistente) {
    const projectId = sessionStorage.getItem('currentProjectId');
    const esito = document.querySelector('input[name="vp-esito"]:checked')?.value || null;
    return {
        id: idEsistente || undefined,
        projectId,
        stato: 'BOZZA',
        dataDocumento: document.getElementById('vp-dataDocumento')?.value || null,
        impresaId: document.getElementById('vp-impresaId')?.value || null,
        altreVisure: document.getElementById('vp-altreVisure')?.value?.trim() || '',
        esito,
        motivazioniIdoneo: document.getElementById('vp-motivazioniIdoneo')?.value?.trim() || '',
        motivazioniIntegrazioni: document.getElementById('vp-motivazioniIntegrazioni')?.value?.trim() || '',
        motivazioniNonIdoneo: document.getElementById('vp-motivazioniNonIdoneo')?.value?.trim() || '',
        nomeRl: document.getElementById('vp-nomeRl')?.value?.trim() || '',
        nomeResponsabileArea: document.getElementById('vp-nomeResponsabileArea')?.value?.trim() || '',
    };
}

// ─────────────────────────────────────────────
// SALVA BOZZA
// ─────────────────────────────────────────────

async function salvaBozzaVerificaPos(idEsistente) {
    const numericId = idEsistente ? Number(idEsistente) : undefined;

    // Read-before-update: impedisce sovrascrittura di documenti già finalizzati
    const esistente = numericId ? await getItem('verifica_pos', numericId) : null;
    if (esistente && (esistente.stato === 'PROTOCOLLATO' || esistente.stato === 'FIRMATO')) {
        showToast('Impossibile alterare un documento finalizzato/protocollato.', 'error');
        return;
    }

    const formDati = _raccogliFormVP(numericId);
    // Merge: preserva i campi binari e le proprietà esistenti non presenti nel form
    const dati = esistente ? { ...esistente, ...formDati } : formDati;

    const saved = await _saveVerificaPosDB(dati);
    showToast('Bozza salvata ✓', 'success');
    // Riapri il form con l'id assegnato (per permettere salvataggi successivi)
    await apriFormVerificaPos(saved.id);
}

// ─────────────────────────────────────────────
// FIRMA E SCARICA (BOZZA → FIRMATO)
// ─────────────────────────────────────────────

async function firmaPerInvio(idEsistente) {
    // Double-submit guard
    if (_firmaPerInvioInProgress) return;
    _firmaPerInvioInProgress = true;
    const _btn = document.querySelector('[onclick^="firmaPerInvio"]');
    if (_btn) { _btn.disabled = true; _btn.textContent = '⏳ Elaborazione…'; }

    try {
        const numericId = idEsistente ? Number(idEsistente) : undefined;

        // Read-before-update: impedisce sovrascrittura di documenti già protocollati
        const esistente = numericId ? await getItem('verifica_pos', numericId) : null;
        if (esistente && esistente.stato === 'PROTOCOLLATO') {
            showToast('Impossibile alterare un documento già protocollato.', 'error');
            return;
        }

        const formDati = _raccogliFormVP(numericId);
        // Merge: preserva i campi binari e le proprietà esistenti non presenti nel form
        const dati = esistente ? { ...esistente, ...formDati } : formDati;

        // Validazione completa
        const errori = await validaVerificaPos(dati);
        if (errori.length > 0) {
            alert('ERRORI — correggere prima di procedere:\n- ' + errori.join('\n- '));
            return;
        }

        // Numerazione progressiva se non presente
        if (!dati.numeroProgressivo) {
            dati.numeroProgressivo = await calcolaNumeroProgressivoVP(dati.projectId, dati.dataDocumento);
        }

        // Snapshot nomeCse dalle impostazioni
        const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => ({})) : {};
        dati.nomeCse = imp.firmaNome || '';

        // Snapshot nomeRl da cantiere
        const cantiere = await getItem('projects', dati.projectId);
        if (!dati.nomeRl && cantiere?.responsabileLavoriId) {
            const rl = await getItem('persone_anas', cantiere.responsabileLavoriId);
            if (rl) dati.nomeRl = `${rl.cognome || ''} ${rl.nome || ''}`.trim();
        }

        dati.stato = 'FIRMATO';
        dati.dataFirmaDocumento = new Date().toISOString();

        const saved = await _saveVerificaPosDB(dati);

        // Genera e scarica Word
        try {
            const blob = await _generaDocxVP(saved);
            const fileName = `VerificaPOS_${(saved.dataDocumento || '').replace(/-/g, '')}_${(saved.numeroProgressivo || '').replace(/\//g, '_')}.docx`;
            const link = document.createElement('a');
            const blobUrl = URL.createObjectURL(blob);
            link.href = blobUrl;
            link.download = fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            showToast('Word scaricato ✓ — invia per firma digitale', 'success');
        } catch (err) {
            console.error('[VP] Errore Word:', err);
            alert('Errore generazione Word: ' + err.message);
        }

        await apriFormVerificaPos(saved.id);
    } finally {
        _firmaPerInvioInProgress = false;
        if (_btn) { _btn.disabled = false; _btn.textContent = '✍️ Firma e Scarica per Invio'; }
    }
}

// ─────────────────────────────────────────────
// SCARICA WORD DIRETTO (da lista o form)
// ─────────────────────────────────────────────

async function scaricaWordVerificaPos(id) {
    const record = await getItem('verifica_pos', Number(id));
    if (!record) { showToast('Record non trovato.', 'error'); return; }
    try {
        const blob = await _generaDocxVP(record);
        const fileName = `VerificaPOS_${(record.dataDocumento || '').replace(/-/g, '')}_${(record.numeroProgressivo || record.id).toString().replace(/\//g, '_')}.docx`;
        const link = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) { showToast('Errore Word: ' + err.message, 'error'); }
}

// ─────────────────────────────────────────────
// GENERA DOCX
// ─────────────────────────────────────────────

async function _generaDocxVP(record) {
    const tplRecord = await getItem('impostazioni', 'template_verifica_pos');
    if (!tplRecord?.valore) throw new Error('Template Word non caricato. Usa il pulsante ⚙️ Template.');

    const cantiere = await getItem('projects', record.projectId);
    const impresa  = record.impresaId ? await getItem('imprese', record.impresaId) : {};
    const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => ({})) : {};

    const cb = (sel) => sel ? '☑' : '☐';

    const zip = new PizZip(tplRecord.valore);
    if (typeof ricuciRunsXml === 'function') ricuciRunsXml(zip); // ricucitura run XML frammentati
    const _ImgCtor = (typeof window.ImageModule === 'function' ? window.ImageModule : window.ImageModule?.default)
                  || (typeof window.docxtemplaterImageModuleFree === 'function' ? window.docxtemplaterImageModuleFree : window.docxtemplaterImageModuleFree?.default);
    if (!_ImgCtor) throw new Error('ImageModule non disponibile.');
    const imageModule = new _ImgCtor({
        centered: false, fileType: 'docx',
        getImage: (v) => DocxGenerator.base64ToBinary(v),
        getSize: (img, v, name) => name.includes('logo') ? [120, 40] : [150, 50]
    });
    const doc = new window.docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });

    doc.setData({
        logo_aziendale:          imp.logo_aziendale || null,
        modulo_codice:           imp.modulo_codice  || '',
        modulo_versione:         imp.modulo_versione || '',
        codice_ppm_sil:          cantiere?.codicePpmSil    || '',
        commessa_numero:         cantiere?.commessaNumero  || '',
        voce_budget:             cantiere?.voceBudget      || '',
        cup:                     cantiere?.cup             || '',
        cig:                     cantiere?.cig             || '',
        ss_numero:               cantiere?.ssNumero        || '',
        titolo_lavoro:           cantiere?.nome            || '',
        pec_impresa:             impresa?.pec              || '',
        ragione_sociale_impresa: impresa?.ragioneSociale   || '',
        nome_cse:                record.nomeCse            || imp.firmaNome || '',
        altre_visure:            record.altreVisure        || '',
        esito_idoneo:            cb(record.esito === 'idoneo'),
        esito_integrazioni:      cb(record.esito === 'integrazioni'),
        esito_non_idoneo:        cb(record.esito === 'non_idoneo'),
        motivazioni_idoneo:      record.esito === 'idoneo'        ? (record.motivazioniIdoneo || '')       : '',
        motivazioni_integrazioni:record.esito === 'integrazioni'  ? (record.motivazioniIntegrazioni || '') : '',
        motivazioni_non_idoneo:  record.esito === 'non_idoneo'    ? (record.motivazioniNonIdoneo || '')    : '',
        nome_rl:                 record.nomeRl               || '',
        nome_responsabile_area:  record.nomeResponsabileArea || '',
    });
    doc.render();
    return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─────────────────────────────────────────────
// ANTEPRIMA STAMPA
// ─────────────────────────────────────────────

async function mostraAnteprimaVerificaPos(id) {
    let record;
    if (id) {
        record = await getItem('verifica_pos', Number(id));
    } else {
        // Genera da form corrente
        const dati = _raccogliFormVP(null);
        const imp = typeof caricaImpostazioni === 'function' ? await caricaImpostazioni().catch(() => ({})) : {};
        dati.nomeCse = imp.firmaNome || '';
        record = dati;
    }
    if (!record) { showToast('Record non trovato.', 'error'); return; }

    let blob;
    try { blob = await _generaDocxVP(record); }
    catch (err) { alert('Impossibile generare anteprima: ' + err.message); return; }

    document.getElementById('modal-anteprima-vp')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-anteprima-vp';
    modal.className = 'fixed inset-0 bg-black/80 z-[4000] flex flex-col';
    modal.innerHTML = `
    <div class="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shrink-0">
        <span class="font-bold">📋 Anteprima Verifica POS</span>
        ${record.stato !== 'FIRMATO' && record.stato !== 'PROTOCOLLATO'
            ? '<span class="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-full">⚠ BOZZA</span>' : ''}
        <div class="ml-auto flex gap-2">
            <button onclick="_scaricaWordDaBlob_VP()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold">📄 Scarica Word</button>
            <button onclick="document.getElementById('modal-anteprima-vp').remove()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold">✕ Chiudi</button>
        </div>
    </div>
    <div class="flex-1 overflow-auto bg-white p-4">
        <div id="docx-preview-inner-vp" class="max-w-4xl mx-auto"></div>
    </div>`;
    document.body.appendChild(modal);
    window._currentAnteprimaBlobVP = blob;

    const renderLib = (typeof docx !== 'undefined' && typeof docx.renderAsync === 'function') ? docx
                    : (typeof window.docxPreview !== 'undefined' && typeof window.docxPreview.renderAsync === 'function') ? window.docxPreview
                    : null;
    if (renderLib) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const styleEl = document.createElement('div');
            styleEl.id = 'docx-style-vp';
            document.head.appendChild(styleEl);
            await renderLib.renderAsync(arrayBuffer, document.getElementById('docx-preview-inner-vp'), styleEl, {
                className: 'docx-preview', inWrapper: true, ignoreHeight: true, breakPages: true, renderHeaders: true, renderFooters: true
            });
        } catch (e) {
            document.getElementById('docx-preview-inner-vp').innerHTML = `<p class="text-red-500 p-4">Errore rendering: ${e.message}</p>`;
        }
    } else {
        document.getElementById('docx-preview-inner-vp').innerHTML = `<div class="text-center py-16 text-slate-400"><p class="text-4xl mb-4">📄</p><p>Anteprima non disponibile. Usa "Scarica Word".</p></div>`;
    }
}

function _scaricaWordDaBlob_VP() {
    const blob = window._currentAnteprimaBlobVP;
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'VerificaPOS_Anteprima.docx';
    link.click();
}

// ─────────────────────────────────────────────
// MODAL CARICA PROTOCOLLAZIONE
// ─────────────────────────────────────────────

async function apriModalProtocollo(id) {
    document.getElementById('modal-protocollo-vp')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-protocollo-vp';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="bg-slate-800 p-5 text-white flex justify-between items-center">
            <h3 class="font-bold">📥 Carica Protocollazione</h3>
            <button onclick="document.getElementById('modal-protocollo-vp').remove()" class="text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Numero Protocollo *</label>
                <input type="text" id="prot-numero" placeholder="Es. PROT/2026/00123"
                    class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data Protocollazione *</label>
                <input type="date" id="prot-data"
                    class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">PDF Protocollato * (max 10 MB)</label>
                <input type="file" id="prot-pdf" accept=".pdf" class="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                <p id="prot-pdf-nome" class="text-xs text-slate-500 mt-1 hidden"></p>
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Lettera di Trasmissione RUP * (PDF/DOCX, max 10 MB)</label>
                <input type="file" id="prot-lettera" accept=".pdf,.docx" class="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                <p id="prot-lettera-nome" class="text-xs text-slate-500 mt-1 hidden"></p>
            </div>
            <div class="flex gap-3 pt-2">
                <button onclick="confermaProtocollo('${id}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition">✅ Conferma protocollazione</button>
                <button onclick="document.getElementById('modal-protocollo-vp').remove()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition">✕ Annulla</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    // Anteprima nomi file
    document.getElementById('prot-pdf').addEventListener('change', (e) => {
        const el = document.getElementById('prot-pdf-nome');
        if (e.target.files[0]) { el.textContent = '📎 ' + e.target.files[0].name; el.classList.remove('hidden'); }
    });
    document.getElementById('prot-lettera').addEventListener('change', (e) => {
        const el = document.getElementById('prot-lettera-nome');
        if (e.target.files[0]) { el.textContent = '📎 ' + e.target.files[0].name; el.classList.remove('hidden'); }
    });
}

async function confermaProtocollo(id) {
    const numero = document.getElementById('prot-numero')?.value.trim();
    const data   = document.getElementById('prot-data')?.value;
    const pdfFile     = document.getElementById('prot-pdf')?.files[0];
    const letteraFile = document.getElementById('prot-lettera')?.files[0];

    const errori = [];
    if (!numero)     errori.push('Numero protocollo obbligatorio');
    if (!data)       errori.push('Data protocollazione obbligatoria');
    if (!pdfFile)    errori.push('PDF protocollato obbligatorio');
    if (!letteraFile)errori.push('Lettera di trasmissione obbligatoria');
    if (pdfFile && pdfFile.size > 10 * 1024 * 1024)     errori.push('PDF protocollato supera 10 MB');
    if (letteraFile && letteraFile.size > 10 * 1024 * 1024) errori.push('Lettera trasmissione supera 10 MB');

    if (errori.length > 0) { alert('Errori:\n- ' + errori.join('\n- ')); return; }

    const _leggiBlob = (file) => new Promise((res, rej) => {
        const r = new FileReader(); r.onload = (e) => res(e.target.result); r.onerror = rej; r.readAsArrayBuffer(file);
    });

    const record = await getItem('verifica_pos', Number(id));
    if (!record) { showToast('Record non trovato.', 'error'); return; }

    // TODO ARCH (OOM): i due ArrayBuffer (fino a 20 MB totali) vengono serializzati
    // nel record principale. getByIndex('verifica_pos', ...) de-serializza TUTTI i buffer
    // storici in RAM, causando OOM su dispositivi mobili dopo il 2°/3° record protocollato.
    // Soluzione: splitting in store separato `files_store` con {id, parentId, tipo, buffer};
    // qui salvare solo {pdfProtocollatoId, pdfProtocollatoNome} e caricare il buffer
    // solo in scaricaPdfProtocollato / scaricaLetteraTrasmissione.
    record.stato                     = 'PROTOCOLLATO';
    record.numeroProtocollo          = numero;
    record.dataProtocollazione       = data;
    record.pdfProtocollato           = await _leggiBlob(pdfFile);
    record.pdfProtocollatoNome       = pdfFile.name;
    record.lettreTrasmissioneRup     = await _leggiBlob(letteraFile);
    record.lettreTrasmissioneNome    = letteraFile.name;
    record.dataProtocollazioneCaricata = new Date().toISOString();

    await _saveVerificaPosDB(record);
    document.getElementById('modal-protocollo-vp').remove();
    showToast('Protocollazione caricata ✓', 'success');
    await renderVerifichePos();
}

// ─────────────────────────────────────────────
// DOWNLOAD ALLEGATI PROTOCOLLAZIONE
// ─────────────────────────────────────────────

async function scaricaPdfProtocollato(id) {
    const r = await getItem('verifica_pos', Number(id));
    if (!r?.pdfProtocollato) { showToast('PDF protocollato non disponibile.', 'warning'); return; }
    const blob = new Blob([r.pdfProtocollato], { type: 'application/pdf' });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = r.pdfProtocollatoNome || `Prot_${r.numeroProtocollo || id}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

async function scaricaLetteraTrasmissione(id) {
    const r = await getItem('verifica_pos', Number(id));
    if (!r?.lettreTrasmissioneRup) { showToast('Lettera di trasmissione non disponibile.', 'warning'); return; }
    const mime = (r.lettreTrasmissioneNome || '').endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
    const blob = new Blob([r.lettreTrasmissioneRup], { type: mime });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = r.lettreTrasmissioneNome || `Lettera_Trasmissione_${r.numeroProtocollo || id}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

// ─────────────────────────────────────────────
// ELIMINA (solo BOZZA)
// ─────────────────────────────────────────────

async function eliminaVerificaPos(id) {
    const r = await getItem('verifica_pos', Number(id));
    if (!r) return;
    if (r.stato !== 'BOZZA') { showToast('Eliminazione consentita solo per bozze.', 'warning'); return; }
    if (!confirm('Eliminare questa verifica POS?')) return;
    await deleteItem('verifica_pos', Number(id));
    showToast('Verifica eliminata.', 'info');
    await renderVerifichePos();
}

// ─────────────────────────────────────────────
// TEMPLATE WORD WIZARD
// ─────────────────────────────────────────────

async function mostraWizardTemplateVerificaPos() {
    document.getElementById('modal-tpl-vp')?.remove();
    const currentTpl = await getItem('impostazioni', 'template_verifica_pos');
    const modal = document.createElement('div');
    modal.id = 'modal-tpl-vp';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[5000] p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="bg-slate-800 p-6 text-white flex justify-between items-center">
            <h3 class="text-xl font-bold">Template Verifica POS</h3>
            <button onclick="document.getElementById('modal-tpl-vp').remove()" class="text-2xl">&times;</button>
        </div>
        <div class="p-8 space-y-6">
            <div class="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-4 bg-slate-50 hover:border-blue-400 transition">
                <input type="file" id="tpl-vp-upload" class="hidden" accept=".docx" onchange="handleTemplateUploadVP(event)">
                <button onclick="document.getElementById('tpl-vp-upload').click()" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">
                    ${currentTpl ? '🔄 Aggiorna Template' : '📂 Seleziona File .docx'}
                </button>
                <div class="text-xs font-bold ${currentTpl ? 'text-green-600' : 'text-slate-400'}" id="tpl-vp-status">
                    ${currentTpl ? '✅ Template caricato: ' + (currentTpl.name || 'Verifica_Idoneita_POS') : 'Nessun file caricato'}
                </div>
            </div>
            <p class="text-[10px] text-slate-400 italic bg-slate-100 p-3 rounded">
                Segnaposti: {{nome_cse}}, {{ss_numero}}, {{titolo_lavoro}}, {{codice_ppm_sil}}, {{cup}}, {{cig}}, {{pec_impresa}}, {{ragione_sociale_impresa}}, {esito_idoneo}, {{motivazioni_idoneo}}, {{nome_rl}}, {%logo_aziendale}...
            </p>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function handleTemplateUploadVP(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        await saveItem('impostazioni', { chiave: 'template_verifica_pos', valore: e.target.result, name: file.name });
        document.getElementById('tpl-vp-status').textContent = '✅ Template caricato: ' + file.name;
        document.getElementById('tpl-vp-status').className = 'text-xs font-bold text-green-600';
        showToast('Template Verifica POS salvato ✓', 'success');
    };
    reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

window.renderVerifichePos               = renderVerifichePos;
window.apriFormVerificaPos              = apriFormVerificaPos;
window.salvaBozzaVerificaPos            = salvaBozzaVerificaPos;
window.firmaPerInvio                    = firmaPerInvio;
window.scaricaWordVerificaPos           = scaricaWordVerificaPos;
window.mostraAnteprimaVerificaPos       = mostraAnteprimaVerificaPos;
window._scaricaWordDaBlob_VP            = _scaricaWordDaBlob_VP;
window.apriModalProtocollo              = apriModalProtocollo;
window.confermaProtocollo               = confermaProtocollo;
window.scaricaPdfProtocollato           = scaricaPdfProtocollato;
window.scaricaLetteraTrasmissione       = scaricaLetteraTrasmissione;
window.eliminaVerificaPos               = eliminaVerificaPos;
window.mostraWizardTemplateVerificaPos  = mostraWizardTemplateVerificaPos;
window.handleTemplateUploadVP           = handleTemplateUploadVP;
window._aggiornaPecWarning              = _aggiornaPecWarning;
window._aggiornaMotivazioni             = _aggiornaMotivazioni;
window.calcolaNumeroProgressivoVP       = calcolaNumeroProgressivoVP;
window.validaVerificaPos                = validaVerificaPos;
