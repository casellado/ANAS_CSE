/**
 * docx-generator.js
 * Motore di generazione documenti Word (.docx) basato su docxtemplater.
 * Gestisce il caricamento del template da IndexedDB, la preparazione dei dati
 * e l'iniezione di immagini (firme, loghi).
 */

// ─────────────────────────────────────────────────────────────────────────────
// RICUCITURA RUN XML
// Microsoft Word può spezzare un segnaposto (es. {{header_destro}}) in più
// run XML consecutivi a causa di formattazione, autocorrettori, spell-checker
// o salvataggi multipli. docxtemplater non riesce a riconoscere i tag e lancia
// "Duplicate open tag" / "Duplicate close tag".
// Questa funzione pre-elabora il .docx per ricucire i run frammentati.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scorre i file XML rilevanti nel .docx e ricuce i run frammentati.
 * @param {PizZip} zip - oggetto PizZip con il .docx caricato
 * @returns {PizZip} - lo stesso zip, modificato in-place
 */
function ricuciRunsXml(zip) {
    const filesDaProcessare = [
        'word/document.xml',
        'word/header1.xml',
        'word/header2.xml',
        'word/header3.xml',
        'word/footer1.xml',
        'word/footer2.xml',
        'word/footer3.xml',
        'word/footnotes.xml',
        'word/endnotes.xml'
    ];

    for (const fileName of filesDaProcessare) {
        const file = zip.file(fileName);
        if (!file) continue;
        const xmlContent = file.asText();
        const xmlRicucito = _ricuciTagSpezzati(xmlContent);
        if (xmlRicucito !== xmlContent) {
            zip.file(fileName, xmlRicucito);
        }
    }

    return zip;
}

/**
 * Ricuce i tag docxtemplater spezzati in più <w:t> all'interno di ogni
 * paragrafo <w:p>. Copre tutti i tipi di delimitatori:
 *   {{ }}   tag semplice
 *   {# /}   loop apre/chiude
 *   {% }    immagine
 *   {^ /}   condizionale negato
 */
function _ricuciTagSpezzati(xmlContent) {
    // Regex paragrafo: NON ricorsiva, match greedy corretto con [\s\S]*?
    const regexParagrafo = /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g;

    return xmlContent.replace(regexParagrafo, (matchCompleto, attrsParagrafo, contenutoParagrafo) => {
        // Estrai tutti i testi <w:t> del paragrafo
        const regexT = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
        const tutteLeT = [];
        let m;
        while ((m = regexT.exec(contenutoParagrafo)) !== null) {
            tutteLeT.push(m[1]);
        }

        const testoCompleto = tutteLeT.join('');

        // Presenza di qualsiasi delimitatore docxtemplater nel testo concatenato
        const haDelimitatori = /\{[\{#%^\/]/.test(testoCompleto) || /[\}]\}/.test(testoCompleto);
        if (!haDelimitatori) return matchCompleto;

        // Verifica se almeno un <w:t> contiene un delimitatore parziale
        // (apertura senza chiusura o viceversa)
        let spezzato = false;
        for (const t of tutteLeT) {
            const apDoppia  = (t.match(/\{\{/g)  || []).length;
            const chDoppia  = (t.match(/\}\}/g)  || []).length;
            const apSingola = (t.match(/\{[#%^\/]/g) || []).length;
            const chSingola = (t.match(/[^{]\}/g) || []).length; // es. "tag}"

            if (apDoppia !== chDoppia || apSingola !== chSingola) {
                spezzato = true;
                break;
            }
        }

        if (!spezzato) return matchCompleto;

        // RICUCITURA: preserva <w:pPr> e il primo <w:rPr> trovati
        const matchPPr = contenutoParagrafo.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
        const pPrPreservato = matchPPr ? matchPPr[0] : '';

        const matchRPr = contenutoParagrafo.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
        const rPrPreservato = matchRPr ? matchRPr[0] : '';

        // Il contenuto dei <w:t> è già XML-escaped da Word, non va ri-escaped
        const nuovoContenuto =
            pPrPreservato +
            '<w:r>' +
            rPrPreservato +
            '<w:t xml:space="preserve">' +
            testoCompleto +
            '</w:t>' +
            '</w:r>';

        return `<w:p${attrsParagrafo || ''}>${nuovoContenuto}</w:p>`;
    });
}

const DocxGenerator = {
    
    /**
     * Carica il template .docx salvato in IndexedDB (store 'impostazioni').
     * @returns {Promise<ArrayBuffer>} Il contenuto del file template.
     */
    async getTemplate() {
        const templateData = await getItem('impostazioni', 'template_verbale_sopralluogo');
        if (!templateData || !templateData.valore) {
            throw new Error("Template Word non trovato. Carica il file .docx dal pulsante Template nella sezione Verbali.");
        }
        return templateData.valore; // ArrayBuffer salvato in handleTemplateUpload
    },

    /**
     * Genera il documento Word.
     * @param {Object} data Dati strutturati per i segnaposto.
     * @returns {Promise<Blob>} Il file generato.
     */
    async generate(data) {
        try {
            const content = await this.getTemplate();
            const zip = new PizZip(content);
            ricuciRunsXml(zip); // pre-elaborazione: ricuce run XML frammentati da Word

            // Configurazione modulo immagini
            const ImageModuleCtor = (typeof window.ImageModule === 'function' ? window.ImageModule : window.ImageModule?.default)
                                 || (typeof window.docxtemplaterImageModuleFree === 'function' ? window.docxtemplaterImageModuleFree : window.docxtemplaterImageModuleFree?.default);
            if (!ImageModuleCtor) {
                throw new Error("ImageModule non caricato. Controlla la connessione internet per il CDN.");
            }
            const imageOptions = {
                getImage(tagValue) {
                    return DocxGenerator.base64ToBinary(tagValue);
                },
                getSize(_img, _tagValue, tagName) {
                    // Dimensioni predefinite per firme e loghi
                    if (tagName.includes('logo')) return [120, 60];
                    if (tagName.includes('firma')) return [180, 80];
                    return [150, 75];
                }
            };
            const imageModule = new ImageModuleCtor(imageOptions);

            const doc = new window.docxtemplater(zip, {
                modules: [imageModule],
                paragraphLoop: true,
                linebreaks: true,
            });

            // Iniezione dati globali (logo, header, footer)
            const globalSettings = await this.getGlobalSettings();
            const finalData = { ...globalSettings, ...data };

            doc.render(finalData);

            const out = doc.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

            return out;
        } catch (error) {
            console.error("Errore generazione DOCX:", error);
            throw error;
        }
    },

    /**
     * Recupera logo, header, footer dal blocco impostazioni principale.
     * I 3 campi sono campi dentro l'oggetto impostazioni (non item separati).
     */
    async getGlobalSettings() {
        let imp = {};
        if (typeof window.caricaImpostazioni === 'function') {
            imp = await window.caricaImpostazioni(true); // skipCondivise=true per velocità
        }
        return {
            logo_aziendale: imp.logo_aziendale || null,
            header_destro:  imp.header_destro  || '',
            footer_centrale: imp.footer_centrale || 'CSE SafeHub',
            modulo_codice:  imp.modulo_codice  || '',
            modulo_versione: imp.modulo_versione || ''
        };
    },

    /**
     * Utility per convertire base64 in binario per docxtemplater.
     */
    base64ToBinary(base64String) {
        if (!base64String) return null;
        // Rimuove header data:image/...;base64, se presente
        const pureBase64 = base64String.split(',')[1] || base64String;
        const binaryString = window.atob(pureBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
};
