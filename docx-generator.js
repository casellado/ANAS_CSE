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
        if (!templateData || !templateData.file) {
            throw new Error("Template Word per il sopralluogo non trovato. Caricalo nelle impostazioni.");
        }
        return templateData.file; // Presumiamo sia un ArrayBuffer o base64
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
            const imageOptions = {
                getImage(tagValue) {
                    return DocxGenerator.base64ToBinary(tagValue);
                },
                getSize(img, tagValue, tagName) {
                    // Dimensioni predefinite per firme e loghi
                    if (tagName.includes('logo')) return [120, 60];
                    if (tagName.includes('firma')) return [180, 80];
                    return [150, 75];
                }
            };
            const imageModule = new ImageModule(imageOptions);

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
     * Recupera loghi e testi intestazione dalle impostazioni.
     */
    async getGlobalSettings() {
        const logo = await getItem('impostazioni', 'logo_aziendale');
        const header = await getItem('impostazioni', 'header_destro');
        const footer = await getItem('impostazioni', 'footer_centrale');
        
        return {
            logo_aziendale: logo ? logo.value : null, // Base64
            header_destro: header ? header.value : '',
            footer_centrale: footer ? footer.value : 'Generato con CSE SafeHub'
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
