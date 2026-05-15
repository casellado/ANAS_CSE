// ─────────────────────────────────────────────
// VERBALE VERIFICA MEZZI (MOD-10.8)
// ─────────────────────────────────────────────

async function apriFormVerbaleMezzi(projectId) {
  if (!projectId) {
    showToast('Seleziona prima un cantiere', 'warning');
    return;
  }

  const cantiere = await getItem('projects', projectId);
  if (!cantiere) return;

  const dataOggi = new Date().toISOString().split('T')[0];

  const modalHtml = `
    <div id="modal-verbale-mezzi" class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 opacity-0 transition-opacity">
      <div class="bg-white w-full max-w-lg rounded-2xl flex flex-col shadow-2xl transform scale-95 transition-transform duration-300">
        
        <div class="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            📋 Verbale Verifica Mezzi
          </h3>
          <button onclick="document.getElementById('modal-verbale-mezzi').remove()" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300">✕</button>
        </div>
        
        <div class="p-4 space-y-4">
          <p class="text-xs text-slate-500">
            Genera un verbale autonomo (ispezione specifica documentazione mezzi) ai sensi dell'art. 92 D.Lgs 81/08.
          </p>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Data Ispezione</label>
            <input type="date" id="vmezzi-data" value="${dataOggi}" class="w-full border-slate-300 rounded-xl">
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Cantiere</label>
            <input type="text" value="${escapeHtml(cantiere.nome)}" disabled class="w-full border-slate-300 bg-slate-100 rounded-xl text-slate-500">
          </div>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Note / Premessa del CSE</label>
            <textarea id="vmezzi-note" rows="3" class="w-full border-slate-300 rounded-xl text-sm" placeholder="Es. Ispezione periodica programmata sui mezzi di sollevamento..."></textarea>
          </div>
        </div>
        
        <div class="p-4 border-t bg-slate-50 rounded-b-2xl">
          <button id="btn-genera-verbale-mezzi" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2">
            📄 Genera Documento Word
          </button>
        </div>
        
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Animazione entrata
  requestAnimationFrame(() => {
    const m = document.getElementById('modal-verbale-mezzi');
    m.classList.remove('opacity-0');
    m.children[0].classList.remove('scale-95');
  });

  document.getElementById('btn-genera-verbale-mezzi').addEventListener('click', () => {
    const dataVerbale = document.getElementById('vmezzi-data').value;
    const note = document.getElementById('vmezzi-note').value;
    document.getElementById('modal-verbale-mezzi').remove();
    _generaEInviaVerbaleMezzi(projectId, dataVerbale, note);
  });
}

async function _generaEInviaVerbaleMezzi(projectId, dataVerbale, note) {
  try {
    showToast('Generazione verbale mezzi in corso...', 'info');

    const cantiere = await getItem('projects', projectId);
    const mezzi = await getMezziByProject(projectId);
    const mezziPresenti = mezzi.filter(m => m.presenteInCantiere);

    // P2-FIX: legge il nome CSE dalle impostazioni invece di usarlo hardcoded
    const imp = (typeof caricaImpostazioni === 'function') ? await caricaImpostazioni() : {};
    const nomeCse = imp.firmaNome || 'Coordinatore per l\'Esecuzione (CSE)';

    // Usa l'anagrafica per recuperare i nomi delle imprese
    const impreseMap = {};
    const tutteImprese = await getAll('imprese');
    tutteImprese.forEach(i => impreseMap[i.id] = i.ragioneSociale);

    const checkEmoji = (val) => val ? '✅' : '❌';

    let htmlTable = `
      <table style="width:100%; border-collapse: collapse; border: 1px solid #000; font-family: Arial, sans-serif; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 5px;">Impresa</th>
            <th style="border: 1px solid #000; padding: 5px;">Mezzo / Attrezzatura</th>
            <th style="border: 1px solid #000; padding: 5px;">Matricola / Serie</th>
            <th style="border: 1px solid #000; padding: 5px;">Libretto/CE</th>
            <th style="border: 1px solid #000; padding: 5px;">Ultima Verifica</th>
            <th style="border: 1px solid #000; padding: 5px;">Esito Conformità</th>
          </tr>
        </thead>
        <tbody>
    `;

    let conformiCount = 0;
    let nonConformi = [];

    if (mezziPresenti.length === 0) {
      htmlTable += `
        <tr>
          <td colspan="6" style="border: 1px solid #000; padding: 5px; text-align: center; font-style: italic;">
            Nessun mezzo o attrezzatura registrato attualmente presente in cantiere.
          </td>
        </tr>
      `;
    } else {
      mezziPresenti.forEach(m => {
        const impresaNome = impreseMap[m.impresaId] || 'Impresa Sconosciuta';
        const tipologia = TIPOLOGIE_MEZZI.find(t => t.id === m.tipologia) || { nome: 'Altro' };
        const conf = valutaConformitaDocumentale(m);
        
        if (conf.conforme) conformiCount++;
        else nonConformi.push(m);

        const badgeEsito = conf.conforme 
          ? '<span style="color: green; font-weight: bold;">CONFORME</span>' 
          : '<span style="color: red; font-weight: bold;">NON CONFORME</span>';

        const librettoCe = `${checkEmoji(m.documentazioneConsegnata?.libretto)} Lib. <br> ${checkEmoji(m.documentazioneConsegnata?.dichiarazioneCE)} CE`;
        
        const verificaStr = m.scadenzaVerificaPeriodica 
          ? `Scad. ${formattaData(m.scadenzaVerificaPeriodica)}` 
          : (tipologia.verifica ? '<span style="color:red">MANCANTE</span>' : 'N/A');

        htmlTable += `
          <tr>
            <td style="border: 1px solid #000; padding: 5px;">${escapeHtml(impresaNome)}</td>
            <td style="border: 1px solid #000; padding: 5px;"><strong>${escapeHtml(tipologia.nome)}</strong><br><span style="font-size: 8pt">${escapeHtml(m.marca)} ${escapeHtml(m.modello)}</span></td>
            <td style="border: 1px solid #000; padding: 5px;">${escapeHtml(m.matricola || m.numeroSerie || 'N/D')}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${librettoCe}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${verificaStr}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${badgeEsito}</td>
          </tr>
        `;
      });
    }

    htmlTable += `
        </tbody>
      </table>
    `;

    // Costruzione contenuto HTML Word
    const htmlWord = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Verbale Verifica Mezzi</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
          h1 { font-size: 16pt; text-align: center; margin-bottom: 20px; }
          h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-top: 20px; }
          .header-box { border: 2px solid #000; padding: 10px; margin-bottom: 20px; font-weight: bold; }
          .footer { font-size: 8pt; text-align: center; margin-top: 40px; color: #555; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="text-align: center; font-size: 14pt; margin-bottom: 10px;">VERBALE ISPETTIVO — MEZZI E ATTREZZATURE</div>
          <div>CANTIERE: ${escapeHtml(cantiere.nome)}</div>
          <div>DATA SOPRALLUOGO: ${formattaData(dataVerbale)}</div>
        </div>

        <p style="text-align: justify">
          Il sottoscritto Coordinatore per la Sicurezza in fase di Esecuzione (CSE), nell'espletamento 
          delle proprie funzioni di alta vigilanza previste dall'art. 92, comma 1, lett. a) e b) del D.Lgs. 81/08,
          ha proceduto alla verifica della documentazione e delle attestazioni di conformità relative ai mezzi
          d'opera e alle attrezzature complesse attualmente impiegate nel cantiere in oggetto.
        </p>

        ${note ? `
          <h2>Premessa / Note del CSE</h2>
          <p style="text-align: justify">${escapeHtml(note).replace(/\n/g, '<br>')}</p>
        ` : ''}

        <h2>Rilevamento e Verifica Documentale</h2>
        <p>In data odierna risultano tracciati <strong>${mezziPresenti.length}</strong> mezzi/attrezzature operative, di cui <strong>${conformiCount}</strong> conformi ai requisiti documentali minimi previsti.</p>

        ${htmlTable}

        ${nonConformi.length > 0 ? `
          <h2>Disposizioni</h2>
          <p style="color: red; font-weight: bold;">
            ATTENZIONE: Sono state riscontrate non conformità documentali per ${nonConformi.length} mezzi. 
            Vengono emesse contestuali comunicazioni di Non Conformità (NC) alle imprese proprietarie.
            Si ricorda il divieto di utilizzo delle attrezzature prive della documentazione cogente (art. 71 D.Lgs 81/08).
          </p>
        ` : `
          <h2>Esito</h2>
          <p>La documentazione esaminata per i mezzi tracciati risulta regolarmente acquisita.</p>
        `}

        <br><br>
        <div style="width: 100%; margin-top: 40px;">
          <div style="float: right; width: 40%; text-align: center; border-top: 1px solid #000; padding-top: 5px;">
            Il Coordinatore per l'Esecuzione<br>
            <i>(${escapeHtml(nomeCse)})</i>
          </div>
          <div style="clear: both;"></div>
        </div>

        <div class="footer">
          Documento generato da CSE SafeHub — ${new Date().toLocaleString('it-IT')}<br>
          La verifica è effettuata sulla base della documentazione fornita. Le verifiche periodiche (art. 71 c.11) restano in capo al datore di lavoro.
        </div>
      </body>
      </html>
    `;

    // Generazione File Word Base64 (identica al salvataggio standard)
    const blob = new Blob(['\ufeff', htmlWord], { type: 'application/msword' });
    const filename = `Verbale_Mezzi_${dataVerbale.replace(/-/g, '')}.doc`;

    // Salva file in OD (cartella verbale-mezzi -> 07_Mezzi_Attrezzature/05_Verbali_Ispezione)
    await salvaDocumento({
      filename: filename,
      blob: blob,
      cantiereId: projectId,
      tipoDoc: 'verbale-mezzi'
    });

    // Se ci sono NC, proponiamo la generazione automatica
    if (nonConformi.length > 0) {
      if (confirm(`Sono stati rilevati ${nonConformi.length} mezzi non conformi.\nVuoi generare automaticamente le relative Non Conformità?`)) {
        for (const m of nonConformi) {
          await generaNCdaMezzoNonConforme(m.id, projectId);
        }
      }
    }

  } catch (err) {
    console.error('Errore generazione verbale mezzi:', err);
    showToast('Errore generazione verbale: ' + err.message, 'error');
  }
}
