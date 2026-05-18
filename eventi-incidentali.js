// eventi-incidentali.js — FASE 6bis MVP
// Cruscotto Near Miss + Infortuni: CRUD, workflow, promozione, CSV, widget dashboard

// ─────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────

const SOTTOTIPI = {
    NEAR_MISS:  ['caduta_oggetto','caduta_persona','scivolamento','urto_mezzo','malfunzionamento_attrezzatura','altro'],
    INFORTUNIO: ['caduta_altezza','caduta_piano','schiacciamento','taglio','ustione','elettrico','inalazione','investimento','altro']
};

const GRAVITA = {
    NEAR_MISS:  ['basso','medio','alto','molto_alto'],
    INFORTUNIO: ['lieve','medio','grave','gravissimo','mortale']
};

const LABEL_SOTTOTIPO = {
    caduta_oggetto:'Caduta oggetto', caduta_persona:'Caduta persona', scivolamento:'Scivolamento',
    urto_mezzo:'Urto mezzo', malfunzionamento_attrezzatura:'Malfunzionamento attrezzatura',
    caduta_altezza:'Caduta dall\'altezza', caduta_piano:'Caduta in piano', schiacciamento:'Schiacciamento',
    taglio:'Taglio/Lacerazione', ustione:'Ustione', elettrico:'Contatto elettrico',
    inalazione:'Inalazione sostanze', investimento:'Investimento', altro:'Altro'
};

const LABEL_GRAVITA = {
    basso:'Basso', medio:'Medio', alto:'Alto', molto_alto:'Molto alto',
    lieve:'Lieve (≤3gg)', grave:'Grave (>40gg)', gravissimo:'Gravissimo', mortale:'Mortale'
};

const GIORNI_DA_PROMUOVERE = 7; // Near Miss aperti da più di N giorni

// ─────────────────────────────────────────────
// STATO MODULO
// ─────────────────────────────────────────────

let _evSortCol = 'dataOraEvento';
let _evSortDir = 'desc';
let _evFiltriCorrente = {};
let _evTestimoni = [];
let _evSoccorritori = [];
let _evComunicazioni = [];
let _evAllegati = [];
let _evCurrentId = null; // null = nuovo, number = modifica
let _evPromozioneNearMissId = null;
let _evPromozioneTestimoni = [];
let _evPromozioneSoccorritori = [];

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function _fmtData(val) {
    if (!val) return '—';
    return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('it-IT');
}

function _fmtDataOra(val) {
    if (!val) return '—';
    return new Date(val).toLocaleString('it-IT');
}

function _uuid() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}

function _badgeTipologia(tipologia) {
    if (tipologia === 'NEAR_MISS')
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">⚠️ Near Miss</span>';
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">🚨 Infortunio</span>';
}

function _badgeGravita(gravita, tipologia) {
    const grave = tipologia === 'INFORTUNIO' && (gravita === 'gravissimo' || gravita === 'mortale');
    const cls = grave ? 'bg-red-800 text-white' :
                gravita === 'grave' || gravita === 'alto' || gravita === 'molto_alto' ? 'bg-red-200 text-red-900' :
                gravita === 'medio' ? 'bg-orange-200 text-orange-900' : 'bg-green-100 text-green-800';
    const label = LABEL_GRAVITA[gravita] || gravita || '—';
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}">${label}</span>`;
}

function _badgeStato(ev) {
    const map = {
        APERTO:                   'bg-red-100 text-red-700',
        IN_GESTIONE:              'bg-amber-100 text-amber-700',
        CHIUSO:                   'bg-slate-200 text-slate-600',
        PROMOSSO_AD_INFORTUNIO:   'bg-purple-100 text-purple-700'
    };
    const labelMap = {
        APERTO:'🔴 Aperto', IN_GESTIONE:'🔄 In gestione',
        CHIUSO:'✅ Chiuso', PROMOSSO_AD_INFORTUNIO:'🔗 Promosso'
    };
    const cls = map[ev.stato] || 'bg-slate-100 text-slate-600';
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}">${labelMap[ev.stato] || ev.stato}</span>`;
}

function isCollegato(ev) {
    return !!(ev.infortunioPromossoId || ev.nearMissOriginaleId);
}

function linkEventoCollegato(ev) {
    if (ev.infortunioPromossoId) return { tipo: 'promosso_a',  id: ev.infortunioPromossoId };
    if (ev.nearMissOriginaleId)  return { tipo: 'promosso_da', id: ev.nearMissOriginaleId };
    return null;
}

// ─────────────────────────────────────────────
// NUMERAZIONE PROGRESSIVA
// ─────────────────────────────────────────────

async function calcolaCodiceEvento(projectId, tipologia) {
    // Usa max(numero)+1 per resistere alle lacune da cancellazioni.
    // TODO: race condition residua se due salvataggi avvengono simultaneamente;
    // soluzione definitiva richiede un contatore atomico dedicato (single-record).
    const tutti = await getByIndex('eventi_incidentali', 'projectId', projectId);
    const suffisso = tipologia === 'NEAR_MISS' ? 'NM' : 'INF';
    const stessaTipo = tutti.filter(e => e.tipologia === tipologia);
    const numeri = stessaTipo.map(e => parseInt((e.codiceEvento || '').replace(/\D/g, '')) || 0);
    const nn = String(Math.max(0, ...numeri) + 1).padStart(2, '0');
    return `EV${nn}/${suffisso}`;
}

// ─────────────────────────────────────────────
// VALIDAZIONE
// ─────────────────────────────────────────────

function validaEvento(record) {
    const errs = [];
    if (!record.tipologia) errs.push('Tipologia obbligatoria.');
    if (!record.sottotipo) errs.push('Sottotipo obbligatorio.');
    if (!record.gravita)   errs.push('Gravità obbligatoria.');
    if (!record.dataOraEvento) errs.push('Data/ora evento obbligatoria.');
    if (!record.luogo)     errs.push('Luogo obbligatorio.');
    if (!record.descrizioneEvento || record.descrizioneEvento.trim().length < 30)
        errs.push('Descrizione evento obbligatoria (min 30 caratteri).');
    if (!record.azioniImmediate || !record.azioniImmediate.trim())
        errs.push('Azioni immediate obbligatorie.');
    if (record.tipologia === 'INFORTUNIO' && !record.infortunatoNome)
        errs.push('Nome infortunato obbligatorio per Infortuni.');
    return errs;
}

// ─────────────────────────────────────────────
// SAVE DB (autoIncrement helper)
// ─────────────────────────────────────────────

function _saveEventoDB(record) {
    return new Promise((resolve, reject) => {
        const t = db.transaction('eventi_incidentali', 'readwrite');
        const s = t.objectStore('eventi_incidentali');
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
// CRUD
// ─────────────────────────────────────────────

async function salvaEvento(record) {
    const isNuovo = !record.id;
    if (isNuovo) {
        const projectId = sessionStorage.getItem('currentProjectId');
        record.projectId     = record.projectId || projectId;
        record.codiceEvento  = record.codiceEvento || await calcolaCodiceEvento(record.projectId, record.tipologia);
        record.dataSegnalazione = new Date().toISOString();
        record.stato         = record.stato || 'APERTO';
        record.auditLog      = record.auditLog || [];
        record.testimoni     = record.testimoni || [];
        record.soccorritori  = record.soccorritori || [];
        record.comunicatoA   = record.comunicatoA || [];
        record.allegati      = record.allegati || [];
        record.infortunioPromossoId = null;
        record.nearMissOriginaleId  = record.nearMissOriginaleId || null;

        // Snapshot CSE
        const imp = typeof caricaImpostazioni === 'function'
            ? await caricaImpostazioni().catch(() => ({})) : {};
        record.nomeCse  = imp.firmaNome  || '';
        record.ruoloCse = imp.firmaRuolo || '';

        record.auditLog.push({
            timestamp: new Date().toISOString(),
            azione: 'CREATO',
            statoPrec: null,
            statoNuovo: record.stato,
            nota: null
        });
    }
    return _saveEventoDB(record);
}

async function listaEventiCantiere(projectId, filtri = {}) {
    let lista = await getByIndex('eventi_incidentali', 'projectId', projectId);

    if (filtri.tipologia) lista = lista.filter(e => e.tipologia === filtri.tipologia);
    if (filtri.stato)     lista = lista.filter(e => e.stato === filtri.stato);
    if (filtri.gravita)   lista = lista.filter(e => e.gravita === filtri.gravita);
    if (filtri.mese) {
        lista = lista.filter(e => e.dataOraEvento && e.dataOraEvento.startsWith(filtri.mese));
    }
    if (filtri.testo) {
        const q = filtri.testo.toLowerCase();
        lista = lista.filter(e =>
            (e.descrizioneEvento || '').toLowerCase().includes(q) ||
            (e.luogo || '').toLowerCase().includes(q) ||
            (e.codiceEvento || '').toLowerCase().includes(q)
        );
    }

    lista.sort((a, b) => {
        let va = a[_evSortCol] || '';
        let vb = b[_evSortCol] || '';
        if (va < vb) return _evSortDir === 'asc' ? -1 : 1;
        if (va > vb) return _evSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    return lista;
}

async function contatoriEventi(projectId) {
    const lista = await getByIndex('eventi_incidentali', 'projectId', projectId);
    const now = new Date();
    const sogliaPromozione = new Date(now - GIORNI_DA_PROMUOVERE * 86400000);

    const nearMissAperti   = lista.filter(e => e.tipologia === 'NEAR_MISS'  && (e.stato === 'APERTO' || e.stato === 'IN_GESTIONE')).length;
    const infortuniAperti  = lista.filter(e => e.tipologia === 'INFORTUNIO' && (e.stato === 'APERTO' || e.stato === 'IN_GESTIONE')).length;
    const aperti           = lista.filter(e => e.stato === 'APERTO').length;
    const inGestione       = lista.filter(e => e.stato === 'IN_GESTIONE').length;
    const chiusi           = lista.filter(e => e.stato === 'CHIUSO').length;
    const promossi         = lista.filter(e => e.stato === 'PROMOSSO_AD_INFORTUNIO').length;
    const daPromuovere     = lista.filter(e =>
        e.tipologia === 'NEAR_MISS' &&
        (e.stato === 'APERTO' || e.stato === 'IN_GESTIONE') &&
        e.dataOraEvento && new Date(e.dataOraEvento) < sogliaPromozione
    ).length;
    return { nearMissAperti, infortuniAperti, aperti, inGestione, chiusi, promossi, daPromuovere, totale: lista.length };
}

async function dettaglioEvento(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return null;
    let verbaleOrigine = null;
    if (ev.verbaleOrigineId) {
        verbaleOrigine = await getItem('verbali', ev.verbaleOrigineId).catch(() => null);
    }
    return { ev, verbaleOrigine };
}

async function eliminaEvento(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    if (ev.stato !== 'APERTO') throw new Error('Solo eventi APERTI possono essere eliminati.');
    if (ev.infortunioPromossoId) throw new Error('Evento collegato a una promozione: non eliminabile.');
    await deleteItem('eventi_incidentali', eventoId);
}

// ─────────────────────────────────────────────
// ALLEGATI
// ─────────────────────────────────────────────

async function aggiungiAllegato(eventoId, file, tipologia) {
    // TODO ARCH (OOM): il blob viene serializzato nel record evento principale.
    // Ogni getByIndex deserializza TUTTI i blob in RAM (fino a 300MB per evento).
    // Fix definitivo: salvare il contenuto binario in un object store separato
    // 'allegati_eventi' e conservare qui solo i metadati {id,nome,mimeType,dimensione}.
    if (file.size > 10 * 1024 * 1024) throw new Error('File troppo grande (max 10MB).');
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) throw new Error('Evento non trovato.');
    if ((ev.allegati || []).length >= 30) throw new Error('Limite 30 allegati per evento.');
    const allegato = {
        id: _uuid(), nome: file.name, mimeType: file.type,
        dimensione: file.size, timestamp: new Date().toISOString(),
        tipologia: tipologia || 'altro', blob: file
    };
    ev.allegati = ev.allegati || [];
    ev.allegati.push(allegato);
    return _saveEventoDB(ev);
}

async function eliminaAllegato(eventoId, allegatoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    ev.allegati = (ev.allegati || []).filter(a => a.id !== allegatoId);
    return _saveEventoDB(ev);
}

async function scaricaAllegato(eventoId, allegatoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    const a = (ev.allegati || []).find(x => x.id === allegatoId);
    if (!a) return;
    const url = URL.createObjectURL(new Blob([a.blob], { type: a.mimeType }));
    const link = document.createElement('a');
    link.href = url; link.download = a.nome; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─────────────────────────────────────────────
// WORKFLOW
// ─────────────────────────────────────────────

async function prendiInCaricoEvento(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev || ev.stato !== 'APERTO') throw new Error('Solo eventi APERTI possono essere presi in carico.');
    const prec = ev.stato;
    ev.stato = 'IN_GESTIONE';
    ev.dataPresaInCarico = new Date().toISOString();
    ev.auditLog = ev.auditLog || [];
    ev.auditLog.push({ timestamp: new Date().toISOString(), azione: 'PRESA_IN_CARICO', statoPrec: prec, statoNuovo: 'IN_GESTIONE', nota: null });
    return _saveEventoDB(ev);
}

async function chiudiEvento(eventoId, notaChiusura) {
    if (!notaChiusura || notaChiusura.trim().length < 10)
        throw new Error('Nota chiusura obbligatoria (min 10 caratteri).');
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev || (ev.stato !== 'APERTO' && ev.stato !== 'IN_GESTIONE'))
        throw new Error('Solo eventi APERTI o IN_GESTIONE possono essere chiusi.');
    const prec = ev.stato;
    ev.stato = 'CHIUSO';
    ev.dataChiusura = new Date().toISOString();
    ev.notaChiusura = notaChiusura.trim();
    ev.auditLog = ev.auditLog || [];
    ev.auditLog.push({ timestamp: new Date().toISOString(), azione: 'CHIUSURA', statoPrec: prec, statoNuovo: 'CHIUSO', nota: notaChiusura.trim() });
    return _saveEventoDB(ev);
}

async function riapriEvento(eventoId, motivoRiapertura) {
    if (!motivoRiapertura || motivoRiapertura.trim().length < 10)
        throw new Error('Motivo riapertura obbligatorio (min 10 caratteri).');
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev || ev.stato !== 'CHIUSO') throw new Error('Solo eventi CHIUSI possono essere riaperti.');
    const prec = ev.stato;
    ev.stato = 'APERTO';
    ev.dataChiusura = null;
    ev.notaChiusura = null;
    ev.auditLog = ev.auditLog || [];
    ev.auditLog.push({ timestamp: new Date().toISOString(), azione: 'RIAPERTURA', statoPrec: prec, statoNuovo: 'APERTO', nota: motivoRiapertura.trim() });
    return _saveEventoDB(ev);
}

// ─────────────────────────────────────────────
// PROMOZIONE NEAR MISS → INFORTUNIO
// ─────────────────────────────────────────────

async function promuoviAdInfortunio(nearMissId, datiInfortunio, motivazione) {
    if (!motivazione || motivazione.trim().length < 20)
        throw new Error('Motivazione promozione obbligatoria (min 20 caratteri).');
    const nearMiss = await getItem('eventi_incidentali', nearMissId);
    if (!nearMiss) throw new Error('Near Miss non trovato.');
    if (nearMiss.tipologia !== 'NEAR_MISS') throw new Error('Solo Near Miss possono essere promossi.');
    if (nearMiss.stato !== 'APERTO' && nearMiss.stato !== 'IN_GESTIONE')
        throw new Error('Solo Near Miss APERTI o IN_GESTIONE possono essere promossi.');

    // Copia solo i metadati degli allegati — non i blob — per evitare duplicazione in memoria.
    // TODO ARCH: una volta separati i blob in 'allegati_eventi', collegare qui per riferimento.
    const allegatiCopiati = (nearMiss.allegati || []).map(({ blob: _b, ...meta }) => ({
        ...meta, id: _uuid(), timestamp: new Date().toISOString()
    }));

    // Codice nuovo Infortunio
    const codiceInfortunio = await calcolaCodiceEvento(nearMiss.projectId, 'INFORTUNIO');
    const now = new Date().toISOString();

    // Crea Infortunio
    const infortunio = {
        projectId:           nearMiss.projectId,
        codiceEvento:        codiceInfortunio,
        tipologia:           'INFORTUNIO',
        nearMissOriginaleId: nearMissId,
        infortunioPromossoId: null,
        // Campi comuni copiati dal Near Miss
        verbaleOrigineId:    nearMiss.verbaleOrigineId || null,
        dataOraEvento:       datiInfortunio.dataOraEvento || nearMiss.dataOraEvento,
        dataSegnalazione:    now,
        luogo:               datiInfortunio.luogo || nearMiss.luogo,
        progressivaKm:       datiInfortunio.progressivaKm || nearMiss.progressivaKm || null,
        condizioniMeteo:     datiInfortunio.condizioniMeteo || nearMiss.condizioniMeteo || null,
        descrizioneEvento:   datiInfortunio.descrizioneEvento || nearMiss.descrizioneEvento,
        attrezzatureCoinvolte: datiInfortunio.attrezzatureCoinvolte || nearMiss.attrezzatureCoinvolte || null,
        sostanzeCoinvolte:   datiInfortunio.sostanzeCoinvolte || nearMiss.sostanzeCoinvolte || null,
        lavorazioneInCorso:  datiInfortunio.lavorazioneInCorso || nearMiss.lavorazioneInCorso || null,
        causeApparenti:      datiInfortunio.causeApparenti || nearMiss.causeApparenti || null,
        testimoni:           datiInfortunio.testimoni || nearMiss.testimoni || [],
        soccorritori:        datiInfortunio.soccorritori || nearMiss.soccorritori || [],
        allegati:            allegatiCopiati,
        comunicatoA:         [],
        azioniImmediate:     datiInfortunio.azioniImmediate || nearMiss.azioniImmediate || '',
        sospensioneApplicata: datiInfortunio.sospensioneApplicata || false,
        sospensioneDettagli: datiInfortunio.sospensioneDettagli || null,
        azioniCorrettive:    datiInfortunio.azioniCorrettive || null,
        aggiornaPsc:         datiInfortunio.aggiornaPsc || false,
        // Campi specifici Infortunio
        sottotipo:           datiInfortunio.sottotipo || '',
        gravita:             datiInfortunio.gravita || '',
        infortunatoNome:     datiInfortunio.infortunatoNome || '',
        infortunatoImpresaId: datiInfortunio.infortunatoImpresaId || null,
        infortunatoMansione: datiInfortunio.infortunatoMansione || null,
        infortunatoEta:      datiInfortunio.infortunatoEta || null,
        tipoLesione:         datiInfortunio.tipoLesione || null,
        parteCorpoColpita:   datiInfortunio.parteCorpoColpita || null,
        giorniProgInattivita: datiInfortunio.giorniProgInattivita || null,
        giorniEffettiviInat: datiInfortunio.giorniEffettiviInat || null,
        denunciaInailFatta:  datiInfortunio.denunciaInailFatta || null,
        soccorsoIntervenuto: datiInfortunio.soccorsoIntervenuto || null,
        ospedaleDi:          datiInfortunio.ospedaleDi || null,
        // Stato
        stato:               'APERTO',
        dataPresaInCarico:   null,
        dataChiusura:        null,
        notaChiusura:        null,
        dataPromozione:      null,
        // Snapshot CSE
        nomeCse:             nearMiss.nomeCse || '',
        ruoloCse:            nearMiss.ruoloCse || '',
        auditLog: [{
            timestamp: now,
            azione: 'CREATO',
            statoPrec: null,
            statoNuovo: 'APERTO',
            nota: `Creato da promozione Near Miss ${nearMiss.codiceEvento}. Motivazione: ${motivazione.trim()}`
        }]
    };

    // Salvataggio atomico: crea Infortunio e segna Near Miss come promosso
    // in un'unica transazione IndexedDB. Se una delle due scritture fallisce,
    // entrambe vengono annullate (rollback automatico).
    return new Promise((resolve, reject) => {
        const t  = db.transaction('eventi_incidentali', 'readwrite');
        const s  = t.objectStore('eventi_incidentali');
        infortunio.modifiedAt = now;

        const reqInf = s.put(infortunio);
        reqInf.onsuccess = () => {
            if (!infortunio.id) infortunio.id = reqInf.result;

            const statoPrec = nearMiss.stato; // cattura prima della mutazione
            nearMiss.stato = 'PROMOSSO_AD_INFORTUNIO';
            nearMiss.infortunioPromossoId = infortunio.id;
            nearMiss.dataPromozione = now;
            nearMiss.modifiedAt = now;
            nearMiss.auditLog = nearMiss.auditLog || [];
            nearMiss.auditLog.push({
                timestamp: now,
                azione: 'PROMOZIONE_AD_INFORTUNIO',
                statoPrec,
                statoNuovo: 'PROMOSSO_AD_INFORTUNIO',
                nota: `Promosso a Infortunio ${infortunio.codiceEvento}. Motivazione: ${motivazione.trim()}`
            });
            s.put(nearMiss).onerror = () => {};
        };
        reqInf.onerror = () => {};

        t.oncomplete = () => resolve({ nearMissAggiornato: nearMiss, infortunioCreato: infortunio });
        t.onerror    = () => reject(t.error);
        t.onabort    = () => reject(t.error || new Error('Transazione annullata'));
    });
}

// ─────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────

function _sanitizeCsvFieldEv(val) {
    const s = String(val ?? '');
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

async function esportaCsvEventi(projectId, filtri = {}) {
    const lista = await listaEventiCantiere(projectId, filtri);
    const BOM = '\uFEFF';
    const righe = [
        ['Codice','Tipologia','Data/Ora','Luogo','Gravità','Sottotipo','Infortunato','Stato','Data chiusura','Nota chiusura','Verbale origine','Evento collegato'].join(';')
    ];
    lista.forEach(ev => {
        const link = linkEventoCollegato(ev);
        righe.push([
            ev.codiceEvento || '',
            ev.tipologia === 'NEAR_MISS' ? 'Near Miss' : 'Infortunio',
            _fmtDataOra(ev.dataOraEvento),
            _sanitizeCsvFieldEv(ev.luogo || '').replace(/;/g,'|'),
            LABEL_GRAVITA[ev.gravita] || ev.gravita || '',
            LABEL_SOTTOTIPO[ev.sottotipo] || ev.sottotipo || '',
            _sanitizeCsvFieldEv(ev.infortunatoNome || ''),
            ev.stato || '',
            _fmtData(ev.dataChiusura),
            _sanitizeCsvFieldEv(ev.notaChiusura || '').replace(/;/g,'|').replace(/\n/g,' '),
            ev.verbaleOrigineId || '',
            link ? `${link.tipo === 'promosso_a' ? 'Promosso→' : '←OrigineDa'} ID:${link.id}` : ''
        ].join(';'));
    });
    const csv = BOM + righe.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `eventi_incidentali_${projectId}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─────────────────────────────────────────────
// RENDER CRUSCOTTO
// ─────────────────────────────────────────────

async function renderEventiCruscotto() {
    const container = document.getElementById('view-eventi');
    if (!container) return;
    const projectId = sessionStorage.getItem('currentProjectId');
    const contatori = await contatoriEventi(projectId);

    container.innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <header class="flex items-center justify-between">
        <div>
          <h2 class="text-3xl font-extrabold text-slate-900">Eventi Incidentali</h2>
          <p class="text-slate-500 text-sm mt-1">Near Miss e Infortuni — D.L. 159/2025 e D.Lgs. 81/08</p>
        </div>
        <button onclick="_apriFormEvento(null)" class="bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-red-700 transition shadow">+ Nuovo Evento</button>
      </header>

      <!-- Contatori -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        ${_boxContatore('⚠️','Near Miss aperti', contatori.nearMissAperti, 'bg-yellow-50 border-yellow-200', () => _filtroEvento({tipologia:'NEAR_MISS',stato:'APERTO'}),'ev-box-nm')}
        ${_boxContatore('🚨','Infortuni aperti', contatori.infortuniAperti, 'bg-red-50 border-red-200', () => _filtroEvento({tipologia:'INFORTUNIO',stato:'APERTO'}),'ev-box-inf')}
        ${_boxContatore('🔴','Aperti totali', contatori.aperti, 'bg-red-50 border-red-100', () => _filtroEvento({stato:'APERTO'}),'ev-box-aperti')}
        ${_boxContatore('🟡','In gestione', contatori.inGestione, 'bg-amber-50 border-amber-200', () => _filtroEvento({stato:'IN_GESTIONE'}),'ev-box-gestione')}
        ${_boxContatore('✅','Chiusi', contatori.chiusi, 'bg-slate-50 border-slate-200', () => _filtroEvento({stato:'CHIUSO'}),'ev-box-chiusi')}
      </div>

      ${contatori.daPromuovere > 0 ? `
      <div class="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 text-amber-800 text-sm font-medium">
        ⚠️ <strong>${contatori.daPromuovere}</strong> Near Miss aperti da più di ${GIORNI_DA_PROMUOVERE} giorni — valutare promozione ad Infortunio.
      </div>` : ''}

      <!-- Filtri -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Tipologia</label>
            <select id="ev-fil-tipo" onchange="_applicaFiltriEv()" class="border rounded-lg px-3 py-2 text-sm">
              <option value="">Tutti</option>
              <option value="NEAR_MISS">Near Miss</option>
              <option value="INFORTUNIO">Infortunio</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Stato</label>
            <select id="ev-fil-stato" onchange="_applicaFiltriEv()" class="border rounded-lg px-3 py-2 text-sm">
              <option value="">Tutti</option>
              <option value="APERTO">Aperto</option>
              <option value="IN_GESTIONE">In gestione</option>
              <option value="CHIUSO">Chiuso</option>
              <option value="PROMOSSO_AD_INFORTUNIO">Promosso</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Gravità</label>
            <select id="ev-fil-gravita" onchange="_applicaFiltriEv()" class="border rounded-lg px-3 py-2 text-sm">
              <option value="">Tutte</option>
              <option value="basso">Basso</option><option value="medio">Medio</option>
              <option value="alto">Alto</option><option value="molto_alto">Molto alto</option>
              <option value="lieve">Lieve</option><option value="grave">Grave</option>
              <option value="gravissimo">Gravissimo</option><option value="mortale">Mortale</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Mese</label>
            <input type="month" id="ev-fil-mese" onchange="_applicaFiltriEv()" class="border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Ricerca</label>
            <input type="text" id="ev-fil-testo" oninput="_debounceEv()" placeholder="Testo libero…" class="border rounded-lg px-3 py-2 text-sm w-full">
          </div>
          <button onclick="_resetFiltriEv()" class="border border-slate-300 rounded-lg px-4 py-2 text-sm hover:bg-slate-50 transition">Reset</button>
          <button onclick="esportaCsvEventi(sessionStorage.getItem('currentProjectId'),_evFiltriCorrente)" class="border border-slate-300 rounded-lg px-4 py-2 text-sm hover:bg-slate-50 transition">📊 CSV</button>
        </div>
      </div>

      <!-- Tabella -->
      <div id="ev-lista-container" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-8 text-center text-slate-400 italic">Caricamento…</div>
      </div>
    </div>`;

    await _renderListaEv({});
}

function _boxContatore(icona, label, valore, cls, onclickFn, id) {
    window['_evBox_' + id] = onclickFn;
    return `<div id="${id}" onclick="_evBox_${id}()" class="cursor-pointer bg-white border ${cls} rounded-2xl p-5 hover:shadow-md transition text-center">
        <div class="text-2xl">${icona}</div>
        <div class="text-3xl font-black text-slate-800 my-1">${valore}</div>
        <div class="text-[11px] text-slate-500 font-medium">${label}</div>
    </div>`;
}

function _filtroEvento(filtri) {
    _evFiltriCorrente = filtri;
    const tipo  = document.getElementById('ev-fil-tipo');
    const stato = document.getElementById('ev-fil-stato');
    if (tipo  && filtri.tipologia) tipo.value  = filtri.tipologia;
    if (stato && filtri.stato)     stato.value = filtri.stato;
    _renderListaEv(filtri);
}

function _applicaFiltriEv() {
    _evFiltriCorrente = {
        tipologia: document.getElementById('ev-fil-tipo')?.value   || '',
        stato:     document.getElementById('ev-fil-stato')?.value  || '',
        gravita:   document.getElementById('ev-fil-gravita')?.value || '',
        mese:      document.getElementById('ev-fil-mese')?.value   || '',
        testo:     document.getElementById('ev-fil-testo')?.value  || ''
    };
    Object.keys(_evFiltriCorrente).forEach(k => { if (!_evFiltriCorrente[k]) delete _evFiltriCorrente[k]; });
    _renderListaEv(_evFiltriCorrente);
}

let _evDebounceTimer = null;
function _debounceEv() {
    clearTimeout(_evDebounceTimer);
    _evDebounceTimer = setTimeout(_applicaFiltriEv, 300);
}

function _resetFiltriEv() {
    _evFiltriCorrente = {};
    ['ev-fil-tipo','ev-fil-stato','ev-fil-gravita','ev-fil-mese','ev-fil-testo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    _renderListaEv({});
}

function _sortEv(col) {
    if (_evSortCol === col) _evSortDir = _evSortDir === 'asc' ? 'desc' : 'asc';
    else { _evSortCol = col; _evSortDir = 'desc'; }
    _renderListaEv(_evFiltriCorrente);
}

async function _renderListaEv(filtri) {
    const container = document.getElementById('ev-lista-container');
    if (!container) return;
    const projectId = sessionStorage.getItem('currentProjectId');
    const lista = await listaEventiCantiere(projectId, filtri);

    if (lista.length === 0) {
        container.innerHTML = `<div class="p-12 text-center text-slate-400 italic">Nessun evento trovato.</div>`;
        return;
    }

    const thCls = 'px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left cursor-pointer hover:text-slate-700';
    const _th = (label, col) => `<th class="${thCls}" onclick="_sortEv('${col}')">${label}${_evSortCol===col?(_evSortDir==='asc'?' ↑':' ↓'):''}</th>`;

    const righe = lista.map(ev => {
        const isGravissimo = ev.tipologia === 'INFORTUNIO' && (ev.gravita === 'gravissimo' || ev.gravita === 'mortale');
        const borderCls = ev.stato === 'PROMOSSO_AD_INFORTUNIO' ? 'bg-slate-50' :
                          ev.tipologia === 'NEAR_MISS' ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-red-500';
        const rowExtra = isGravissimo ? 'ring-1 ring-red-300' : '';
        const link = linkEventoCollegato(ev);

        const azioni = _menuAzioniEv(ev);
        return `<tr class="${borderCls} ${rowExtra} hover:bg-slate-50 transition">
            <td class="px-4 py-3 font-mono text-sm font-bold text-slate-700">
                ${ev.codiceEvento || '—'}
                ${link ? `<span class="ml-1 text-[10px] text-purple-600">🔗</span>` : ''}
            </td>
            <td class="px-4 py-3">${_badgeTipologia(ev.tipologia)}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${_fmtDataOra(ev.dataOraEvento)}</td>
            <td class="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate" title="${escapeHtml(ev.luogo||'')}">${escapeHtml(ev.luogo) || '—'}</td>
            <td class="px-4 py-3">${_badgeGravita(ev.gravita, ev.tipologia)}</td>
            <td class="px-4 py-3">${_badgeStato(ev)}</td>
            <td class="px-4 py-3">${azioni}</td>
        </tr>`;
    }).join('');

    // Mobile cards
    const cards = lista.map(ev => {
        const link = linkEventoCollegato(ev);
        return `<div class="p-4 border-b border-slate-100 last:border-0">
            <div class="flex items-start justify-between gap-2">
                <div>
                    <div class="font-mono font-bold text-sm text-slate-800">${ev.codiceEvento || '—'} ${link ? '🔗' : ''}</div>
                    <div class="flex gap-2 mt-1 flex-wrap">${_badgeTipologia(ev.tipologia)} ${_badgeStato(ev)}</div>
                    <div class="text-xs text-slate-500 mt-1">${_fmtDataOra(ev.dataOraEvento)} — ${escapeHtml(ev.luogo) || '—'}</div>
                    <div class="mt-1">${_badgeGravita(ev.gravita, ev.tipologia)}</div>
                </div>
                <div>${_menuAzioniEv(ev)}</div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <!-- Desktop -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                ${_th('Codice','codiceEvento')}
                ${_th('Tipo','tipologia')}
                ${_th('Data/Ora','dataOraEvento')}
                ${_th('Luogo','luogo')}
                ${_th('Gravità','gravita')}
                ${_th('Stato','stato')}
                <th class="${thCls}">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${righe}</tbody>
          </table>
        </div>
        <!-- Mobile -->
        <div class="md:hidden divide-y divide-slate-100">${cards}</div>`;
}

function _menuAzioniEv(ev) {
    const id = ev.id;
    const puoEliminare = ev.stato === 'APERTO' && !ev.infortunioPromossoId;
    const puoPromuovere = ev.tipologia === 'NEAR_MISS' && (ev.stato === 'APERTO' || ev.stato === 'IN_GESTIONE');
    const puoPrendereInCarico = ev.stato === 'APERTO';
    const puoChiudere = ev.stato === 'APERTO' || ev.stato === 'IN_GESTIONE';
    const puoRiaprire = ev.stato === 'CHIUSO';
    const promosso = ev.stato === 'PROMOSSO_AD_INFORTUNIO';

    const menuId = `ev-menu-${id}`;
    const voci = [
        `<button onclick="_chiudiTuttiMenuEv();apriDettaglioEvento(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50">🔍 Apri dettaglio</button>`,
        ev.verbaleOrigineId ? `<button onclick="_chiudiTuttiMenuEv();_vaiVerbaleOrigineEv(${ev.verbaleOrigineId})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50">📝 Vai al verbale origine</button>` : '',
        isCollegato(ev) ? `<button onclick="_chiudiTuttiMenuEv();_vaiEventoCollegatoEv(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50">🔗 Vai a evento collegato</button>` : '',
        puoPrendereInCarico ? `<button onclick="_chiudiTuttiMenuEv();_confermaPrendiInCaricoEv(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-amber-700">🟡 Prendi in carico</button>` : '',
        puoPromuovere ? `<button onclick="_chiudiTuttiMenuEv();apriModalPromuoviInfortunio(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-purple-700">🔗 Promuovi a Infortunio</button>` : '',
        puoChiudere ? `<button onclick="_chiudiTuttiMenuEv();apriModalChiudiEvento(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">✅ Chiudi</button>` : '',
        puoRiaprire ? `<button onclick="_chiudiTuttiMenuEv();apriModalRiapriEvento(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-blue-700">🔄 Riapri</button>` : '',
        !promosso ? `<button onclick="_chiudiTuttiMenuEv();_apriFormEvento(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50">✏️ Modifica</button>` : '',
        `<button onclick="_chiudiTuttiMenuEv();_stampaDettaglioEv(${id})" class="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50">🖨 Stampa scheda</button>`,
        puoEliminare ? `<hr class="my-1 border-slate-100"><button onclick="_chiudiTuttiMenuEv();_eliminaEventoConferma(${id})" class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">🗑 Elimina</button>` : ''
    ].filter(Boolean).join('');

    return `<div class="relative inline-block">
        <button onclick="event.stopPropagation();_toggleMenuEv('${menuId}')"
                class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition text-lg leading-none">⋯</button>
        <div id="${menuId}" class="hidden absolute right-0 z-50 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1">${voci}</div>
    </div>`;
}

function _toggleMenuEv(menuId) {
    _chiudiTuttiMenuEv();
    const m = document.getElementById(menuId);
    if (m) m.classList.toggle('hidden');
}
function _chiudiTuttiMenuEv() {
    document.querySelectorAll('[id^="ev-menu-"]').forEach(m => m.classList.add('hidden'));
}
document.addEventListener('click', _chiudiTuttiMenuEv);

// ─────────────────────────────────────────────
// FORM NUOVO/MODIFICA EVENTO
// ─────────────────────────────────────────────

function _resetEvModaleState() {
    _evTestimoni     = [];
    _evSoccorritori  = [];
    _evComunicazioni = [];
    _evAllegati      = [];
    _evCurrentId     = null;
    document.getElementById('modal-form-evento')?.remove();
}

async function _apriFormEvento(eventoId = null, prefill = {}) {
    _evCurrentId = eventoId;
    _evTestimoni = [];
    _evSoccorritori = [];
    _evComunicazioni = [];
    _evAllegati = [];

    let ev = null;
    if (eventoId) {
        ev = await getItem('eventi_incidentali', eventoId);
        if (ev) {
            _evTestimoni    = [...(ev.testimoni    || [])];
            _evSoccorritori = [...(ev.soccorritori || [])];
            _evComunicazioni= [...(ev.comunicatoA  || [])];
            _evAllegati     = [...(ev.allegati     || [])];
        }
    }

    const projectId = sessionStorage.getItem('currentProjectId');
    const imprese = await getByIndex('imprese', 'projectId', projectId);

    const valRaw = (campo, def='') => ev ? (ev[campo] ?? def) : (prefill[campo] ?? def);
    const val = (campo, def='') => { const v = valRaw(campo, def); return typeof v === 'string' ? escapeHtml(v) : v; };

    const opzImprese = `<option value="">— Seleziona —</option>` +
        imprese.map(i => `<option value="${i.id}" ${valRaw('infortunatoImpresaId')==i.id?'selected':''}>${escapeHtml(i.ragioneSociale)}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'modal-form-evento';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-8">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 class="text-xl font-bold text-slate-900">${eventoId ? 'Modifica Evento' : 'Nuovo Evento Incidentale'}</h3>
        <button onclick="_resetEvModaleState()" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6 space-y-6">

        <!-- Sez 1: Tipologia -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">1. Tipologia</legend>
          <div class="flex gap-8">
            <label class="flex items-center gap-2 cursor-pointer font-semibold">
              <input type="radio" name="ev-tipologia" value="NEAR_MISS" onchange="_evCambiaTipologia()"
                     ${valRaw('tipologia','NEAR_MISS')==='NEAR_MISS'?'checked':''}>
              <span class="text-yellow-700">⚠️ Near Miss</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer font-semibold">
              <input type="radio" name="ev-tipologia" value="INFORTUNIO" onchange="_evCambiaTipologia()"
                     ${valRaw('tipologia')==='INFORTUNIO'?'checked':''}>
              <span class="text-red-700">🚨 Infortunio</span>
            </label>
          </div>
        </fieldset>

        <!-- Sez 2: Quando e dove -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">2. Quando e dove</legend>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Data / Ora evento *</label>
              <input type="datetime-local" id="ev-dataOra" value="${val('dataOraEvento','').slice(0,16)}"
                     class="w-full border rounded-xl px-3 py-2">
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Luogo *</label>
              <input type="text" id="ev-luogo" value="${val('luogo')}"
                     placeholder="Es. Settore B, piano 2, prossimità scavo"
                     class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Progressiva km</label>
              <input type="text" id="ev-progressiva" value="${val('progressivaKm')}"
                     placeholder="km 246+150" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Condizioni meteo</label>
              <input type="text" id="ev-meteo" value="${val('condizioniMeteo')}"
                     placeholder="Es. Pioggia, vento moderato" class="w-full border rounded-xl px-3 py-2">
            </div>
          </div>
        </fieldset>

        <!-- Sez 3: Classificazione -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">3. Classificazione</legend>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Sottotipo *</label>
              <select id="ev-sottotipo" class="w-full border rounded-xl px-3 py-2">
                <option value="">— Seleziona —</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Gravità *</label>
              <select id="ev-gravita" class="w-full border rounded-xl px-3 py-2">
                <option value="">— Seleziona —</option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- Sez 4: Persone coinvolte -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">4. Persone coinvolte</legend>
          <div id="ev-sezione-infortunato" class="${valRaw('tipologia')==='INFORTUNIO'?'':'hidden'} space-y-3 mb-4 pb-4 border-b border-slate-200">
            <p class="text-xs font-bold text-red-700 uppercase">Dati infortunato</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Nome e cognome *</label>
                <input type="text" id="ev-inforNome" value="${val('infortunatoNome')}" class="w-full border rounded-xl px-3 py-2">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Impresa</label>
                <select id="ev-inforImpresa" class="w-full border rounded-xl px-3 py-2">${opzImprese}</select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Mansione</label>
                <input type="text" id="ev-inforMansione" value="${val('infortunatoMansione')}" class="w-full border rounded-xl px-3 py-2">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Età</label>
                <input type="number" id="ev-inforEta" value="${val('infortunatoEta')}" min="16" max="80" class="w-full border rounded-xl px-3 py-2">
              </div>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-600 uppercase mb-2">Testimoni</p>
            <div id="ev-testimoni-list" class="space-y-2 mb-2"></div>
            <button type="button" onclick="_evAggiungiTestimone()" class="text-blue-600 text-sm font-semibold hover:underline">+ Aggiungi testimone</button>
          </div>
          <div class="mt-4">
            <p class="text-xs font-bold text-slate-600 uppercase mb-2">Soccorritori</p>
            <div id="ev-soccorritori-list" class="space-y-2 mb-2"></div>
            <button type="button" onclick="_evAggiungiSoccorritore()" class="text-blue-600 text-sm font-semibold hover:underline">+ Aggiungi soccorritore</button>
          </div>
        </fieldset>

        <!-- Sez 5: Descrizione e cause -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">5. Descrizione e cause</legend>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Descrizione evento * (min 30 caratteri)</label>
              <textarea id="ev-descrizione" rows="4" placeholder="Racconto fattuale di quanto accaduto…"
                        class="w-full border rounded-xl px-3 py-2 text-sm">${val('descrizioneEvento')}</textarea>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Attrezzature coinvolte</label>
                <input type="text" id="ev-attrezzature" value="${val('attrezzatureCoinvolte')}" class="w-full border rounded-xl px-3 py-2">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Sostanze coinvolte</label>
                <input type="text" id="ev-sostanze" value="${val('sostanzeCoinvolte')}" class="w-full border rounded-xl px-3 py-2">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Lavorazione in corso</label>
                <input type="text" id="ev-lavorazione" value="${val('lavorazioneInCorso')}" class="w-full border rounded-xl px-3 py-2">
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Cause apparenti</label>
              <textarea id="ev-cause" rows="2" class="w-full border rounded-xl px-3 py-2 text-sm">${val('causeApparenti')}</textarea>
            </div>
          </div>
        </fieldset>

        <!-- Sez 6: Conseguenze (solo Infortunio) -->
        <fieldset id="ev-sezione-conseguenze" class="${valRaw('tipologia')==='INFORTUNIO'?'':'hidden'} bg-red-50 rounded-2xl p-5 border border-red-100">
          <legend class="text-[10px] font-bold text-red-400 uppercase tracking-widest px-2 mb-3">6. Conseguenze (Infortunio)</legend>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Tipo lesione</label>
              <input type="text" id="ev-lesione" value="${val('tipoLesione')}" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Parte corpo colpita</label>
              <input type="text" id="ev-parteCorpo" value="${val('parteCorpoColpita')}" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Giorni prognosi</label>
              <input type="number" id="ev-giorniProg" value="${val('giorniProgInattivita')}" min="0" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Ospedale di</label>
              <input type="text" id="ev-ospedale" value="${val('ospedaleDi')}" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div class="md:col-span-2 flex flex-wrap gap-6">
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" id="ev-soccorso" ${val('soccorsoIntervenuto')?'checked':''}> Soccorso 118/Ambulanza intervenuto
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" id="ev-inail" ${val('denunciaInailFatta')?'checked':''}> Denuncia INAIL fatta dall'impresa
              </label>
            </div>
          </div>
        </fieldset>

        <!-- Sez 7: Azioni CSE -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">7. Azioni CSE</legend>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Azioni immediate *</label>
              <textarea id="ev-azioniImmediate" rows="3" placeholder="Cosa ha fatto il CSE immediatamente…"
                        class="w-full border rounded-xl px-3 py-2 text-sm">${val('azioniImmediate')}</textarea>
            </div>
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" id="ev-sosp" ${val('sospensioneApplicata')?'checked':''}
                     onchange="document.getElementById('ev-sosp-det').classList.toggle('hidden',!this.checked)">
              Sospensione lavorazioni applicata
            </label>
            <div id="ev-sosp-det" class="${val('sospensioneApplicata')?'':'hidden'}">
              <input type="text" id="ev-sospDet" value="${val('sospensioneDettagli')}"
                     placeholder="Dettagli sospensione…" class="w-full border rounded-xl px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Azioni correttive pianificate</label>
              <textarea id="ev-azioniCorr" rows="2" class="w-full border rounded-xl px-3 py-2 text-sm">${val('azioniCorrettive')}</textarea>
            </div>
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" id="ev-psc" ${val('aggiornaPsc')?'checked':''}> Aggiornamento PSC necessario (FASE 7bis)
            </label>
          </div>
        </fieldset>

        <!-- Sez 8: Comunicazioni -->
        <fieldset class="bg-slate-50 rounded-2xl p-5">
          <legend class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">8. Comunicazioni</legend>
          <div id="ev-comunicazioni-list" class="space-y-2 mb-2"></div>
          <button type="button" onclick="_evAggiungiComunicazione()" class="text-blue-600 text-sm font-semibold hover:underline">+ Aggiungi comunicazione</button>
        </fieldset>

      </div>

      <!-- Pulsanti -->
      <div class="px-6 pb-6 flex gap-3 flex-wrap">
        <button onclick="_salvaFormEvento(false)" class="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition shadow">💾 Salva</button>
        <button onclick="_salvaFormEvento(true)"  class="bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-amber-600 transition shadow">▶ Salva e Prendi in carico</button>
        <button onclick="_resetEvModaleState()" class="border border-slate-300 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition">Annulla</button>
      </div>
    </div>`;

    document.body.appendChild(modal);
    _evCambiaTipologia();
    _evRenderTestimoni();
    _evRenderSoccorritori();
    _evRenderComunicazioni();
}

function _evCambiaTipologia() {
    const tipo = document.querySelector('input[name="ev-tipologia"]:checked')?.value || 'NEAR_MISS';
    const sezInf    = document.getElementById('ev-sezione-infortunato');
    const sezConseg = document.getElementById('ev-sezione-conseguenze');
    if (sezInf)    sezInf.classList.toggle('hidden',    tipo !== 'INFORTUNIO');
    if (sezConseg) sezConseg.classList.toggle('hidden', tipo !== 'INFORTUNIO');

    // Aggiorna dropdown sottotipo e gravità
    const selSotto  = document.getElementById('ev-sottotipo');
    const selGravita= document.getElementById('ev-gravita');
    if (selSotto) {
        const curr = selSotto.value;
        selSotto.innerHTML = '<option value="">— Seleziona —</option>' +
            (SOTTOTIPI[tipo] || []).map(v => `<option value="${v}" ${curr===v?'selected':''}>${LABEL_SOTTOTIPO[v]||v}</option>`).join('');
    }
    if (selGravita) {
        const curr = selGravita.value;
        selGravita.innerHTML = '<option value="">— Seleziona —</option>' +
            (GRAVITA[tipo] || []).map(v => `<option value="${v}" ${curr===v?'selected':''}>${LABEL_GRAVITA[v]||v}</option>`).join('');
    }
}

function _evRenderTestimoni() {
    const cont = document.getElementById('ev-testimoni-list');
    if (!cont) return;
    cont.innerHTML = _evTestimoni.map((t,i) => `
        <div class="flex gap-2 items-center bg-white border border-slate-200 rounded-xl p-2">
          <input type="text" placeholder="Nome" value="${t.nome||''}" onchange="_evTestimoni[${i}].nome=this.value" class="flex-1 border rounded-lg px-2 py-1 text-sm">
          <input type="text" placeholder="Ruolo" value="${t.ruolo||''}" onchange="_evTestimoni[${i}].ruolo=this.value" class="flex-1 border rounded-lg px-2 py-1 text-sm">
          <input type="text" placeholder="Impresa" value="${t.impresa||''}" onchange="_evTestimoni[${i}].impresa=this.value" class="flex-1 border rounded-lg px-2 py-1 text-sm">
          <button onclick="_evTestimoni.splice(${i},1);_evRenderTestimoni()" class="text-red-400 hover:text-red-600 px-1">&times;</button>
        </div>`).join('');
}

function _evAggiungiTestimone() {
    _evTestimoni.push({ nome:'', ruolo:'', impresa:'', recapito:'' });
    _evRenderTestimoni();
}

function _evRenderSoccorritori() {
    const cont = document.getElementById('ev-soccorritori-list');
    if (!cont) return;
    cont.innerHTML = _evSoccorritori.map((s,i) => `
        <div class="flex gap-2 items-center bg-white border border-slate-200 rounded-xl p-2">
          <input type="text" placeholder="Nome" value="${s.nome||''}" onchange="_evSoccorritori[${i}].nome=this.value" class="flex-1 border rounded-lg px-2 py-1 text-sm">
          <input type="text" placeholder="Qualifica" value="${s.qualifica||''}" onchange="_evSoccorritori[${i}].qualifica=this.value" class="flex-1 border rounded-lg px-2 py-1 text-sm">
          <button onclick="_evSoccorritori.splice(${i},1);_evRenderSoccorritori()" class="text-red-400 hover:text-red-600 px-1">&times;</button>
        </div>`).join('');
}

function _evAggiungiSoccorritore() {
    _evSoccorritori.push({ nome:'', qualifica:'' });
    _evRenderSoccorritori();
}

function _evRenderComunicazioni() {
    const cont = document.getElementById('ev-comunicazioni-list');
    if (!cont) return;
    cont.innerHTML = _evComunicazioni.map((c,i) => `
        <div class="flex gap-2 items-center bg-white border border-slate-200 rounded-xl p-2 flex-wrap">
          <input type="text" placeholder="A chi (ruolo)" value="${c.ruolo||''}" onchange="_evComunicazioni[${i}].ruolo=this.value" class="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[100px]">
          <input type="text" placeholder="Nome" value="${c.nome||''}" onchange="_evComunicazioni[${i}].nome=this.value" class="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[100px]">
          <select onchange="_evComunicazioni[${i}].mezzo=this.value" class="border rounded-lg px-2 py-1 text-sm">
            <option value="mail" ${c.mezzo==='mail'?'selected':''}>Mail</option>
            <option value="PEC" ${c.mezzo==='PEC'?'selected':''}>PEC</option>
            <option value="telefono" ${c.mezzo==='telefono'?'selected':''}>Telefono</option>
            <option value="verbale" ${c.mezzo==='verbale'?'selected':''}>Verbale</option>
          </select>
          <input type="date" value="${c.dataInvio||''}" onchange="_evComunicazioni[${i}].dataInvio=this.value" class="border rounded-lg px-2 py-1 text-sm">
          <button onclick="_evComunicazioni.splice(${i},1);_evRenderComunicazioni()" class="text-red-400 hover:text-red-600 px-1">&times;</button>
        </div>`).join('');
}

function _evAggiungiComunicazione() {
    _evComunicazioni.push({ ruolo:'', nome:'', mezzo:'mail', dataInvio:'' });
    _evRenderComunicazioni();
}

function _g(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function _gc(id) { const el = document.getElementById(id); return el ? el.checked : false; }

async function _salvaFormEvento(prendiInCarico = false) {
    const tipo = document.querySelector('input[name="ev-tipologia"]:checked')?.value || 'NEAR_MISS';
    const record = {
        id:               _evCurrentId || undefined,
        tipologia:        tipo,
        sottotipo:        _g('ev-sottotipo'),
        gravita:          _g('ev-gravita'),
        dataOraEvento:    _g('ev-dataOra'),
        luogo:            _g('ev-luogo'),
        progressivaKm:    _g('ev-progressiva') || null,
        condizioniMeteo:  _g('ev-meteo') || null,
        infortunatoNome:  tipo === 'INFORTUNIO' ? _g('ev-inforNome') : null,
        infortunatoImpresaId: tipo === 'INFORTUNIO' ? (_g('ev-inforImpresa') ? Number(_g('ev-inforImpresa')) : null) : null,
        infortunatoMansione: tipo === 'INFORTUNIO' ? _g('ev-inforMansione') || null : null,
        infortunatoEta:   tipo === 'INFORTUNIO' ? (Number(_g('ev-inforEta')) || null) : null,
        testimoni:        _evTestimoni,
        soccorritori:     _evSoccorritori,
        descrizioneEvento: _g('ev-descrizione'),
        attrezzatureCoinvolte: _g('ev-attrezzature') || null,
        sostanzeCoinvolte: _g('ev-sostanze') || null,
        lavorazioneInCorso: _g('ev-lavorazione') || null,
        causeApparenti:   _g('ev-cause') || null,
        tipoLesione:      tipo === 'INFORTUNIO' ? _g('ev-lesione') || null : null,
        parteCorpoColpita:tipo === 'INFORTUNIO' ? _g('ev-parteCorpo') || null : null,
        giorniProgInattivita: tipo === 'INFORTUNIO' ? (Number(_g('ev-giorniProg')) || null) : null,
        soccorsoIntervenuto: tipo === 'INFORTUNIO' ? _gc('ev-soccorso') : null,
        denunciaInailFatta:  tipo === 'INFORTUNIO' ? _gc('ev-inail') : null,
        ospedaleDi:       tipo === 'INFORTUNIO' ? _g('ev-ospedale') || null : null,
        azioniImmediate:  _g('ev-azioniImmediate'),
        sospensioneApplicata: _gc('ev-sosp'),
        sospensioneDettagli: _gc('ev-sosp') ? _g('ev-sospDet') || null : null,
        azioniCorrettive: _g('ev-azioniCorr') || null,
        aggiornaPsc:      _gc('ev-psc'),
        comunicatoA:      _evComunicazioni,
        allegati:         _evAllegati
    };

    const errs = validaEvento(record);
    if (errs.length > 0) { alert('Errori di validazione:\n• ' + errs.join('\n• ')); return; }

    try {
        let saved = await salvaEvento(record);
        if (prendiInCarico && saved.stato === 'APERTO') {
            saved = await prendiInCaricoEvento(saved.id);
        }
        document.getElementById('modal-form-evento')?.remove();
        await renderEventiCruscotto();
        alert(`Evento ${saved.codiceEvento} salvato correttamente.`);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

// ─────────────────────────────────────────────
// DETTAGLIO EVENTO
// ─────────────────────────────────────────────

async function apriDettaglioEvento(eventoId) {
    const { ev, verbaleOrigine } = await dettaglioEvento(eventoId) || {};
    if (!ev) return;

    const link = linkEventoCollegato(ev);
    const modal = document.createElement('div');
    modal.id = 'modal-dettaglio-evento';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0';

    const timelineHtml = (ev.auditLog || []).map(entry => {
        const icoMap = { CREATO:'🟢', PRESA_IN_CARICO:'🟡', CHIUSURA:'✅', RIAPERTURA:'🔄', PROMOZIONE_AD_INFORTUNIO:'🔗' };
        return `<div class="flex gap-3 text-sm">
            <div class="text-xl leading-none">${icoMap[entry.azione]||'•'}</div>
            <div>
                <div class="font-bold text-slate-700">${new Date(entry.timestamp).toLocaleString('it-IT')} — ${entry.azione.replace(/_/g,' ')}</div>
                ${entry.nota ? `<div class="text-slate-500 italic mt-0.5">${escapeHtml(entry.nota)}</div>` : ''}
                ${entry.statoPrec ? `<div class="text-[11px] text-slate-400">${entry.statoPrec} → ${entry.statoNuovo}</div>` : ''}
            </div>
        </div>`;
    }).join('');

    modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 print:shadow-none print:rounded-none">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center print:hidden">
        <h3 class="text-xl font-bold">${ev.codiceEvento} — Dettaglio</h3>
        <div class="flex gap-2">
          <button onclick="window.print()" class="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200">🖨 Stampa</button>
          <button onclick="document.getElementById('modal-dettaglio-evento').remove()" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>
      </div>
      <div class="p-6 space-y-5">
        <div class="flex flex-wrap gap-2">${_badgeTipologia(ev.tipologia)} ${_badgeGravita(ev.gravita,ev.tipologia)} ${_badgeStato(ev)}</div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-slate-400">Codice</span><div class="font-mono font-bold">${ev.codiceEvento}</div></div>
          <div><span class="text-slate-400">Data/Ora</span><div class="font-semibold">${_fmtDataOra(ev.dataOraEvento)}</div></div>
          <div class="col-span-2"><span class="text-slate-400">Luogo</span><div class="font-semibold">${escapeHtml(ev.luogo)||'—'}</div></div>
          ${ev.progressivaKm ? `<div><span class="text-slate-400">Progressiva</span><div>${escapeHtml(ev.progressivaKm)}</div></div>` : ''}
          ${ev.condizioniMeteo ? `<div><span class="text-slate-400">Meteo</span><div>${escapeHtml(ev.condizioniMeteo)}</div></div>` : ''}
        </div>
        ${ev.tipologia === 'INFORTUNIO' && ev.infortunatoNome ? `
        <div class="bg-red-50 rounded-xl p-4 text-sm">
          <p class="font-bold text-red-700 mb-2">Infortunato</p>
          <p><strong>${escapeHtml(ev.infortunatoNome)}</strong>${ev.infortunatoMansione ? ` — ${escapeHtml(ev.infortunatoMansione)}` : ''}</p>
          ${ev.tipoLesione ? `<p>Lesione: ${escapeHtml(ev.tipoLesione)}${ev.parteCorpoColpita?' ('+escapeHtml(ev.parteCorpoColpita)+')':''}</p>` : ''}
        </div>` : ''}
        <div class="text-sm">
          <p class="text-slate-400 mb-1">Descrizione</p>
          <p class="text-slate-800">${escapeHtml(ev.descrizioneEvento)||'—'}</p>
        </div>
        <div class="text-sm">
          <p class="text-slate-400 mb-1">Azioni immediate CSE</p>
          <p class="text-slate-800">${escapeHtml(ev.azioniImmediate)||'—'}</p>
        </div>
        ${verbaleOrigine ? `<div class="text-sm bg-blue-50 rounded-xl p-3"><span class="text-slate-400">Verbale origine: </span><span class="font-semibold">${escapeHtml(String(verbaleOrigine.numero||verbaleOrigine.id))}</span></div>` : ''}
        ${link ? `<div class="text-sm bg-purple-50 rounded-xl p-3">
          <span class="text-slate-400">${link.tipo==='promosso_a'?'Promosso ad Infortunio →':'Originato da Near Miss ←'} </span>
          <button onclick="apriDettaglioEvento(${link.id});document.getElementById('modal-dettaglio-evento').remove()" class="font-semibold text-purple-700 hover:underline">ID ${link.id}</button>
        </div>` : ''}
        ${(ev.auditLog||[]).length ? `
        <div>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Timeline</p>
          <div class="space-y-3">${timelineHtml}</div>
        </div>` : ''}
        ${ev.notaChiusura ? `<div class="bg-slate-50 rounded-xl p-4 text-sm"><p class="text-slate-400 mb-1">Nota chiusura</p><p>${escapeHtml(ev.notaChiusura)}</p></div>` : ''}
      </div>
    </div>`;

    document.body.appendChild(modal);
}

// ─────────────────────────────────────────────
// MODAL PROMUOVI A INFORTUNIO
// ─────────────────────────────────────────────

async function apriModalPromuoviInfortunio(nearMissId) {
    const nearMiss = await getItem('eventi_incidentali', nearMissId);
    if (!nearMiss) return;

    _evPromozioneNearMissId = nearMissId;
    _evPromozioneTestimoni    = [...(nearMiss.testimoni    || [])];
    _evPromozioneSoccorritori = [...(nearMiss.soccorritori || [])];

    const projectId = sessionStorage.getItem('currentProjectId');
    const imprese = await getByIndex('imprese', 'projectId', projectId);
    const opzImprese = `<option value="">— Seleziona —</option>` +
        imprese.map(i => `<option value="${i.id}">${i.ragioneSociale}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'modal-promuovi-infortunio';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 class="text-xl font-bold text-red-700">🔗 Promuovi a Infortunio</h3>
          <p class="text-sm text-slate-500 mt-1">Near Miss: <strong>${nearMiss.codiceEvento}</strong></p>
        </div>
        <button onclick="document.getElementById('modal-promuovi-infortunio').remove()" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6 space-y-5">
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠️ Verranno creati <strong>2 record distinti</strong>: il Near Miss ${nearMiss.codiceEvento} passerà a stato "Promosso" e verrà creato un nuovo record Infortunio.
        </div>

        <!-- Classificazione Infortunio -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Sottotipo Infortunio *</label>
            <select id="prm-sottotipo" class="w-full border rounded-xl px-3 py-2">
              <option value="">— Seleziona —</option>
              ${SOTTOTIPI.INFORTUNIO.map(v=>`<option value="${v}">${LABEL_SOTTOTIPO[v]||v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Gravità Infortunio *</label>
            <select id="prm-gravita" class="w-full border rounded-xl px-3 py-2">
              <option value="">— Seleziona —</option>
              ${GRAVITA.INFORTUNIO.map(v=>`<option value="${v}">${LABEL_GRAVITA[v]||v}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Dati Infortunato -->
        <div class="bg-red-50 rounded-2xl p-4 space-y-3">
          <p class="text-xs font-bold text-red-700 uppercase">Dati infortunato</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1">Nome e cognome *</label>
              <input type="text" id="prm-inforNome" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Impresa</label>
              <select id="prm-inforImpresa" class="w-full border rounded-xl px-3 py-2">${opzImprese}</select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Mansione</label>
              <input type="text" id="prm-inforMansione" class="w-full border rounded-xl px-3 py-2">
            </div>
          </div>
        </div>

        <!-- Conseguenze -->
        <div class="space-y-3">
          <p class="text-xs font-bold text-slate-500 uppercase">Conseguenze</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Tipo lesione</label>
              <input type="text" id="prm-lesione" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Parte corpo colpita</label>
              <input type="text" id="prm-parteCorpo" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Giorni prognosi</label>
              <input type="number" id="prm-giorniProg" min="0" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Ospedale di</label>
              <input type="text" id="prm-ospedale" class="w-full border rounded-xl px-3 py-2">
            </div>
            <div class="col-span-2 flex flex-wrap gap-6">
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" id="prm-soccorso"> Soccorso intervenuto</label>
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" id="prm-inail"> Denuncia INAIL fatta dall'impresa</label>
            </div>
          </div>
        </div>

        <!-- Motivazione promozione -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Motivazione della promozione * (min 20 caratteri)</label>
          <textarea id="prm-motivazione" rows="3" placeholder="Spiegare perché il Near Miss viene classificato come Infortunio…"
                    class="w-full border rounded-xl px-3 py-2 text-sm"></textarea>
          <div id="prm-motivazione-err" class="text-red-600 text-xs mt-1 hidden">Motivazione obbligatoria (min 20 caratteri).</div>
        </div>
      </div>
      <div class="px-6 pb-6 flex gap-3">
        <button onclick="_confermaPromozione()" class="bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-red-700 transition shadow">🔗 Conferma promozione</button>
        <button onclick="document.getElementById('modal-promuovi-infortunio').remove()" class="border border-slate-300 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition">Annulla</button>
      </div>
    </div>`;

    document.body.appendChild(modal);
}

async function _confermaPromozione() {
    const motivazione = document.getElementById('prm-motivazione')?.value.trim() || '';
    const errEl = document.getElementById('prm-motivazione-err');

    if (motivazione.length < 20) {
        if (errEl) errEl.classList.remove('hidden');
        return;
    }
    if (errEl) errEl.classList.add('hidden');

    const datiInfortunio = {
        sottotipo:           document.getElementById('prm-sottotipo')?.value || '',
        gravita:             document.getElementById('prm-gravita')?.value   || '',
        infortunatoNome:     document.getElementById('prm-inforNome')?.value.trim() || '',
        infortunatoImpresaId: Number(document.getElementById('prm-inforImpresa')?.value) || null,
        infortunatoMansione: document.getElementById('prm-inforMansione')?.value.trim() || null,
        tipoLesione:         document.getElementById('prm-lesione')?.value.trim() || null,
        parteCorpoColpita:   document.getElementById('prm-parteCorpo')?.value.trim() || null,
        giorniProgInattivita: Number(document.getElementById('prm-giorniProg')?.value) || null,
        ospedaleDi:          document.getElementById('prm-ospedale')?.value.trim() || null,
        soccorsoIntervenuto: document.getElementById('prm-soccorso')?.checked || false,
        denunciaInailFatta:  document.getElementById('prm-inail')?.checked   || false,
        testimoni:           _evPromozioneTestimoni,
        soccorritori:        _evPromozioneSoccorritori
    };

    if (!datiInfortunio.infortunatoNome) { alert('Nome infortunato obbligatorio.'); return; }
    if (!datiInfortunio.sottotipo)       { alert('Sottotipo infortunio obbligatorio.'); return; }
    if (!datiInfortunio.gravita)         { alert('Gravità obbligatoria.'); return; }

    try {
        const { infortunioCreato } = await promuoviAdInfortunio(_evPromozioneNearMissId, datiInfortunio, motivazione);
        document.getElementById('modal-promuovi-infortunio')?.remove();
        await renderEventiCruscotto();
        alert(`✅ Promozione completata. Nuovo Infortunio ${infortunioCreato.codiceEvento} creato.`);
        apriDettaglioEvento(infortunioCreato.id);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

// ─────────────────────────────────────────────
// MODAL CHIUDI / RIAPRI
// ─────────────────────────────────────────────

async function apriModalChiudiEvento(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;

    const giorniAperti = ev.dataOraEvento
        ? Math.floor((Date.now() - new Date(ev.dataOraEvento)) / 86400000) : 0;
    const warningInail = ev.tipologia === 'INFORTUNIO' && giorniAperti > 30
        ? `<div class="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2 text-amber-800 text-sm mb-3">⚠️ Questo Infortunio è aperto da più di 30 giorni. Verificare che la denuncia INAIL sia stata fatta dall'impresa.</div>` : '';

    const modal = document.createElement('div');
    modal.id = 'modal-chiudi-evento';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md">
      <div class="p-6 border-b border-slate-100">
        <h3 class="text-lg font-bold text-slate-900">Chiudi Evento</h3>
        <p class="text-sm text-slate-500 mt-1">${ev.codiceEvento}</p>
      </div>
      <div class="p-6 space-y-4">
        ${warningInail}
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Nota chiusura * (min 10 caratteri)</label>
          <textarea id="ev-nota-chiusura" rows="4" placeholder="Descrivere come l'evento è stato risolto…"
                    class="w-full border rounded-xl px-3 py-2 text-sm"></textarea>
          <div id="ev-nota-chiusura-err" class="text-red-600 text-xs mt-1 hidden">Nota obbligatoria (min 10 caratteri).</div>
        </div>
      </div>
      <div class="px-6 pb-6 flex gap-3">
        <button onclick="_confermaChiudiEvento(${eventoId})" class="bg-slate-700 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition">✅ Conferma chiusura</button>
        <button onclick="document.getElementById('modal-chiudi-evento').remove()" class="border border-slate-300 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition">Annulla</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
}

async function _confermaChiudiEvento(eventoId) {
    const nota = document.getElementById('ev-nota-chiusura')?.value.trim() || '';
    const errEl = document.getElementById('ev-nota-chiusura-err');
    if (nota.length < 10) { if (errEl) errEl.classList.remove('hidden'); return; }
    try {
        await chiudiEvento(eventoId, nota);
        document.getElementById('modal-chiudi-evento')?.remove();
        await renderEventiCruscotto();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

async function apriModalRiapriEvento(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    const modal = document.createElement('div');
    modal.id = 'modal-riapri-evento';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md">
      <div class="p-6 border-b border-slate-100">
        <h3 class="text-lg font-bold text-slate-900">Riapri Evento</h3>
        <p class="text-sm text-slate-500 mt-1">${ev.codiceEvento}</p>
      </div>
      <div class="p-6">
        <label class="block text-xs font-semibold text-slate-600 mb-1">Motivo riapertura * (min 10 caratteri)</label>
        <textarea id="ev-motivo-riapertura" rows="3" class="w-full border rounded-xl px-3 py-2 text-sm"></textarea>
        <div id="ev-motivo-riapertura-err" class="text-red-600 text-xs mt-1 hidden">Motivo obbligatorio (min 10 caratteri).</div>
      </div>
      <div class="px-6 pb-6 flex gap-3">
        <button onclick="_confermaRiapriEvento(${eventoId})" class="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition">🔄 Conferma riapertura</button>
        <button onclick="document.getElementById('modal-riapri-evento').remove()" class="border border-slate-300 px-6 py-2.5 rounded-xl hover:bg-slate-50 transition">Annulla</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
}

async function _confermaRiapriEvento(eventoId) {
    const motivo = document.getElementById('ev-motivo-riapertura')?.value.trim() || '';
    const errEl  = document.getElementById('ev-motivo-riapertura-err');
    if (motivo.length < 10) { if (errEl) errEl.classList.remove('hidden'); return; }
    try {
        await riapriEvento(eventoId, motivo);
        document.getElementById('modal-riapri-evento')?.remove();
        await renderEventiCruscotto();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

// ─────────────────────────────────────────────
// AZIONI RAPIDE
// ─────────────────────────────────────────────

async function _confermaPrendiInCaricoEv(eventoId) {
    if (!confirm('Prendere in carico questo evento?')) return;
    try {
        await prendiInCaricoEvento(eventoId);
        await renderEventiCruscotto();
    } catch (e) { alert('Errore: ' + e.message); }
}

async function _eliminaEventoConferma(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    if (!confirm(`Eliminare definitivamente ${ev.codiceEvento}?`)) return;
    try {
        await eliminaEvento(eventoId);
        await renderEventiCruscotto();
    } catch (e) { alert('Errore: ' + e.message); }
}

function _vaiVerbaleOrigineEv(verbaleId) {
    Router.navSubView('VERBALI');
}

async function _vaiEventoCollegatoEv(eventoId) {
    const ev = await getItem('eventi_incidentali', eventoId);
    if (!ev) return;
    const link = linkEventoCollegato(ev);
    if (link) apriDettaglioEvento(link.id);
}

async function _stampaDettaglioEv(eventoId) {
    await apriDettaglioEvento(eventoId);
    setTimeout(() => window.print(), 300);
}

// ─────────────────────────────────────────────
// WIDGET DASHBOARD
// ─────────────────────────────────────────────

async function renderWidgetEventiDashboard(projectId) {
    const container = document.getElementById('dashboard-widget-eventi');
    if (!container) return;
    const c = await contatoriEventi(projectId);

    container.innerHTML = `
    <div class="bg-white border border-slate-200 rounded-3xl p-6 cursor-pointer hover:shadow-md transition" onclick="Router.navSubView('EVENTI')">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-widest">🚨 Eventi Incidentali</h4>
        <span class="text-xs text-blue-600 font-semibold">Vai al cruscotto →</span>
      </div>
      <div class="space-y-2 text-sm">
        ${c.nearMissAperti > 0  ? `<div class="flex justify-between"><span class="text-slate-500">Near Miss aperti</span><span class="font-bold text-yellow-700">${c.nearMissAperti}</span></div>` : ''}
        ${c.infortuniAperti > 0 ? `<div class="flex justify-between"><span class="text-slate-500">Infortuni in gestione</span><span class="font-bold text-red-700">${c.infortuniAperti}</span></div>` : ''}
        ${c.nearMissAperti === 0 && c.infortuniAperti === 0 ? `<div class="text-slate-400 italic text-center py-2">Nessun evento aperto</div>` : ''}
        ${c.daPromuovere > 0 ? `<div class="mt-2 bg-amber-50 rounded-lg px-3 py-1.5 text-amber-700 text-xs font-medium">⚠️ ${c.daPromuovere} da valutare (>${GIORNI_DA_PROMUOVERE}gg)</div>` : ''}
      </div>
      <div class="mt-4 text-[11px] text-slate-400">${c.totale} totali · ${c.chiusi} chiusi</div>
    </div>`;
}

// ─────────────────────────────────────────────
// EXPORT GLOBALE
// ─────────────────────────────────────────────

window.renderEventiCruscotto          = renderEventiCruscotto;
window.renderWidgetEventiDashboard    = renderWidgetEventiDashboard;
window.apriDettaglioEvento            = apriDettaglioEvento;
window.apriModalChiudiEvento          = apriModalChiudiEvento;
window.apriModalRiapriEvento          = apriModalRiapriEvento;
window.apriModalPromuoviInfortunio    = apriModalPromuoviInfortunio;
window._apriFormEvento                = _apriFormEvento;
window._resetEvModaleState            = _resetEvModaleState;
window._confermaPromozione            = _confermaPromozione;
window._confermaChiudiEvento          = _confermaChiudiEvento;
window._confermaRiapriEvento          = _confermaRiapriEvento;
window._confermaPrendiInCaricoEv      = _confermaPrendiInCaricoEv;
window._eliminaEventoConferma         = _eliminaEventoConferma;
window._vaiVerbaleOrigineEv           = _vaiVerbaleOrigineEv;
window._vaiEventoCollegatoEv          = _vaiEventoCollegatoEv;
window._stampaDettaglioEv             = _stampaDettaglioEv;
window._applicaFiltriEv               = _applicaFiltriEv;
window._resetFiltriEv                 = _resetFiltriEv;
window._sortEv                        = _sortEv;
window._debounceEv                    = _debounceEv;
window._filtroEvento                  = _filtroEvento;
window._toggleMenuEv                  = _toggleMenuEv;
window._chiudiTuttiMenuEv             = _chiudiTuttiMenuEv;
window._evCambiaTipologia             = _evCambiaTipologia;
window._evRenderTestimoni             = _evRenderTestimoni;
window._evAggiungiTestimone           = _evAggiungiTestimone;
window._evRenderSoccorritori          = _evRenderSoccorritori;
window._evAggiungiSoccorritore        = _evAggiungiSoccorritore;
window._evRenderComunicazioni         = _evRenderComunicazioni;
window._evAggiungiComunicazione       = _evAggiungiComunicazione;
window._salvaFormEvento               = _salvaFormEvento;
window.salvaEvento                    = salvaEvento;
window.listaEventiCantiere            = listaEventiCantiere;
window.contatoriEventi                = contatoriEventi;
window.calcolaCodiceEvento            = calcolaCodiceEvento;
window.validaEvento                   = validaEvento;
window.promuoviAdInfortunio           = promuoviAdInfortunio;
window.prendiInCaricoEvento           = prendiInCaricoEvento;
window.chiudiEvento                   = chiudiEvento;
window.riapriEvento                   = riapriEvento;
window.eliminaEvento                  = eliminaEvento;
window.esportaCsvEventi               = esportaCsvEventi;
window.aggiungiAllegato               = aggiungiAllegato;
window.eliminaAllegato                = eliminaAllegato;
window.scaricaAllegato                = scaricaAllegato;
window.isCollegato                    = isCollegato;
window.linkEventoCollegato            = linkEventoCollegato;
window._evTestimoni                   = _evTestimoni;
window._evSoccorritori                = _evSoccorritori;
window._evComunicazioni               = _evComunicazioni;
