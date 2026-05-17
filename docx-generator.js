/**
 * docx-generator.js
 * Motore di generazione documenti Word (.docx) basato su docxtemplater.
 * Gestisce il caricamento del template da IndexedDB, la preparazione dei dati
 * e l'iniezione di immagini (firme, loghi).
 */

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
            
            // Configurazione modulo immagini
            const ImageModuleCtor = window.ImageModule || window.docxtemplaterImageModuleFree;
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
