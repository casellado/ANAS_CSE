/**
 * docx-image-module.js
 * Modulo immagini custom per docxtemplater 3.50.0+ (browser-only).
 *
 * Sostituisce docxtemplater-image-module-free@1.1.1 che usa xmldom interno
 * (docxtemplater@3.7.0) — incompatibile con docxtemplater@3.50.0 che usa
 * DOMParser/XMLSerializer nativo. Il crash risultante era:
 *   "Failed to execute 'serializeToString' on 'XMLSerializer':
 *    parameter 1 is not of type 'Node'."
 *
 * Questo modulo opera interamente con il DOMParser nativo del browser,
 * producendo nodi DOM omogenei con quelli di docxtemplater 3.50.0.
 *
 * API pubblica (compatibile con image-module-free):
 *   new ImageModule({ getImage(tagValue), getSize(img, tagValue, tagName) })
 *
 * Tag supportati nei template (singola graffa):
 *   {%nomeTag}   — immagine inline
 *
 * NOTA: gestisce solo PNG (sufficiente per firme, loghi, timbri).
 * Immagini null/undefined → PNG 1×1 trasparente (no crash).
 */

(function (global) {
    'use strict';

    // PNG 1×1 trasparente come fallback per valori null/undefined
    var TRANSPARENT_PNG_B64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    var NS = {
        DRAWINGML:  'http://schemas.openxmlformats.org/drawingml/2006/main',
        PICTURE:    'http://schemas.openxmlformats.org/drawingml/2006/picture',
        RELS_IMAGE: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        WORDML:     'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    };

    // ─── Costruttore ────────────────────────────────────────────────────────────

    function ImageModule(options) {
        this.options     = options || {};
        this.zip         = null;
        this.xmlDocuments = null;
        this._imgCounter  = 1;
        // Mappa filePath → counter immagini per gestire più immagini per file
        this._relCounters = {};
    }

    ImageModule.prototype.name = 'DocxImageModuleCustom';

    // ─── Interfaccia docxtemplater 3.50.0 ───────────────────────────────────────

    /**
     * optionsTransformer: aggiunge i file .rels e [Content_Types].xml alla lista
     * dei file XML che docxtemplater deve parsare (e quindi riscrivere come Node).
     */
    ImageModule.prototype.optionsTransformer = function (opts, docxtemplater) {
        this.zip = docxtemplater.zip;
        var relsFiles = this.zip.file(/\.xml\.rels$/).map(function (f) { return f.name; });
        var ctFile    = '[Content_Types].xml';
        var extra     = relsFiles.slice();
        if (this.zip.file(ctFile)) extra.push(ctFile);
        opts.xmlFileNames = (opts.xmlFileNames || []).concat(extra);
        return opts;
    };

    /**
     * set: riceve lo stato interno da docxtemplater (zip aggiornato, xmlDocuments).
     */
    ImageModule.prototype.set = function (opts) {
        if (opts.zip)          this.zip          = opts.zip;
        if (opts.xmlDocuments) this.xmlDocuments  = opts.xmlDocuments;
    };

    /**
     * parse: riconosce {%tagName} e restituisce un placeholder per render().
     */
    ImageModule.prototype.parse = function (placeholder) {
        if (typeof placeholder !== 'string') return null;
        if (placeholder.charAt(0) !== '%')   return null;
        return {
            type:   'placeholder',
            value:  placeholder.slice(1).trim(),
            module: this.name,
        };
    };

    /**
     * render: genera il markup OOXML per l'immagine e aggiorna i file .rels.
     */
    ImageModule.prototype.render = function (part, options) {
        if (!part || part.module !== this.name) return null;

        // Risolvi il valore del tag nello scope corrente
        var tagValue = options.scopeManager
            ? options.scopeManager.getValue(part.value, { part: part })
            : null;

        // ── DEBUG (rimuovere dopo verifica) ──────────────────────────────────
        console.log('[ImageModule] render →', {
            tag:          part.value,
            filePath:     options && options.filePath || '(non passato → default document.xml)',
            tagValueLen:  tagValue ? tagValue.length : 0,
            tagValueSnip: tagValue ? tagValue.slice(0, 30) + '…' : 'NULL'
        });
        // ─────────────────────────────────────────────────────────────────────

        // Fallback a PNG trasparente se il valore è assente
        var imgSrc = tagValue || TRANSPARENT_PNG_B64;

        // Converti base64 → Uint8Array
        var imgBytes = _base64ToUint8Array(imgSrc);

        // Ottieni dimensioni
        var size = [150, 50];
        if (typeof this.options.getSize === 'function') {
            try { size = this.options.getSize(imgBytes, tagValue, part.value); } catch (_e) {}
        }

        // Aggiungi immagine al ZIP e ottieni rId
        // options.filePath: docxtemplater v3 lo passa per ogni file XML elaborato.
        // Se non disponibile (edge case) si cade su document.xml.
        var filePath = (options && options.filePath) ? options.filePath : 'word/document.xml';
        var rId = this._addImageRel(filePath, imgBytes);

        // Conversione px → EMU (1px ≈ 9525 EMU @ 96 dpi)
        var emuW = Math.round((size[0] || 150) * 9525);
        var emuH = Math.round((size[1] || 50)  * 9525);
        var imgId = this._imgCounter;

        var xml =
            '<w:drawing xmlns:w="' + NS.WORDML + '">' +
              '<wp:inline distT="0" distB="0" distL="0" distR="0"' +
                ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
                '<wp:extent cx="' + emuW + '" cy="' + emuH + '"/>' +
                '<wp:docPr id="' + imgId + '" name="Img' + imgId + '"/>' +
                '<a:graphic xmlns:a="' + NS.DRAWINGML + '">' +
                  '<a:graphicData uri="' + NS.PICTURE + '">' +
                    '<pic:pic xmlns:pic="' + NS.PICTURE + '">' +
                      '<pic:nvPicPr>' +
                        '<pic:cNvPr id="0" name="Picture"/>' +
                        '<pic:cNvPicPr/>' +
                      '</pic:nvPicPr>' +
                      '<pic:blipFill>' +
                        '<a:blip r:embed="' + rId + '"' +
                          ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>' +
                        '<a:stretch><a:fillRect/></a:stretch>' +
                      '</pic:blipFill>' +
                      '<pic:spPr>' +
                        '<a:xfrm>' +
                          '<a:off x="0" y="0"/>' +
                          '<a:ext cx="' + emuW + '" cy="' + emuH + '"/>' +
                        '</a:xfrm>' +
                        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
                      '</pic:spPr>' +
                    '</pic:pic>' +
                  '</a:graphicData>' +
                '</a:graphic>' +
              '</wp:inline>' +
            '</w:drawing>';

        return { value: xml };
    };

    // ─── Helpers privati ────────────────────────────────────────────────────────

    /**
     * Aggiunge l'immagine al ZIP e il Relationship nel file .rels corrispondente.
     * Usa esclusivamente DOMParser nativo — zero xmldom.
     * @returns {string} rId (es. "rId5")
     */
    ImageModule.prototype._addImageRel = function (filePath, imgBytes) {
        var imgName = 'img_custom_' + (this._imgCounter++) + '.png';
        var mediaPath = 'word/media/' + imgName;
        this.zip.file(mediaPath, imgBytes, { binary: true });

        // Determina il path del file .rels corrispondente
        // es. "word/document.xml" → "word/_rels/document.xml.rels"
        var relsPath = _toRelsPath(filePath);

        var rId;
        if (this.xmlDocuments && this.xmlDocuments[relsPath]) {
            // Il file .rels è già stato parsato da docxtemplater come DOM nativo
            var relsDoc = this.xmlDocuments[relsPath];
            rId = _appendRelationship(relsDoc, '../media/' + imgName);
        } else {
            // Fallback: legge dal ZIP, modifica, reinserisce come stringa
            rId = this._addRelFallback(relsPath, '../media/' + imgName);
        }

        // Registra image/png in [Content_Types].xml se non già presente
        this._ensureContentType('png', 'image/png');

        return rId;
    };

    /**
     * Fallback: modifica il .rels come stringa XML pura (senza DOM).
     * Usato quando xmlDocuments non contiene il file .rels.
     */
    ImageModule.prototype._addRelFallback = function (relsPath, target) {
        var existingContent = '';
        var relsFile = this.zip.file(relsPath);
        if (relsFile) {
            existingContent = relsFile.asText();
        } else {
            existingContent =
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '</Relationships>';
        }

        // Trova il max rId esistente
        var maxId = 0;
        var rIdRe = /Id="rId(\d+)"/g;
        var m;
        while ((m = rIdRe.exec(existingContent)) !== null) {
            maxId = Math.max(maxId, parseInt(m[1], 10));
        }
        var newId = maxId + 1;
        var newRel =
            '<Relationship Id="rId' + newId + '"' +
            ' Type="' + NS.RELS_IMAGE + '"' +
            ' Target="' + target + '"/>';

        var updated = existingContent.replace(
            '</Relationships>',
            newRel + '</Relationships>'
        );
        this.zip.file(relsPath, updated);
        return 'rId' + newId;
    };

    /**
     * Assicura che [Content_Types].xml registri l'estensione richiesta.
     */
    ImageModule.prototype._ensureContentType = function (ext, contentType) {
        var ctPath = '[Content_Types].xml';
        if (!this.xmlDocuments || !this.xmlDocuments[ctPath]) {
            // Fallback stringa
            var ctFile = this.zip.file(ctPath);
            if (!ctFile) return;
            var ctContent = ctFile.asText();
            if (ctContent.indexOf('Extension="' + ext + '"') !== -1) return;
            var newDefault =
                '<Default Extension="' + ext + '" ContentType="' + contentType + '"/>';
            var updated = ctContent.replace('</Types>', newDefault + '</Types>');
            this.zip.file(ctPath, updated);
            return;
        }
        var ctDoc = this.xmlDocuments[ctPath];
        var defaults = ctDoc.getElementsByTagName('Default');
        for (var i = 0; i < defaults.length; i++) {
            if (defaults[i].getAttribute('Extension') === ext) return;
        }
        var types = ctDoc.getElementsByTagName('Types')[0];
        if (!types) return;
        var def = ctDoc.createElement('Default');
        def.setAttribute('Extension', ext);
        def.setAttribute('ContentType', contentType);
        types.appendChild(def);
    };

    // ─── Utility pure ───────────────────────────────────────────────────────────

    /**
     * Converte un path XML nel corrispondente path .rels.
     * "word/document.xml" → "word/_rels/document.xml.rels"
     * "word/header1.xml"  → "word/_rels/header1.xml.rels"
     */
    function _toRelsPath(filePath) {
        var slash = filePath.lastIndexOf('/');
        var dir   = slash >= 0 ? filePath.slice(0, slash + 1) : '';
        var file  = slash >= 0 ? filePath.slice(slash + 1) : filePath;
        return dir + '_rels/' + file + '.rels';
    }

    /**
     * Aggiunge un nodo <Relationship> al document DOM nativo e restituisce il rId.
     */
    function _appendRelationship(relsDoc, target) {
        var NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
        var rels = relsDoc.getElementsByTagName('Relationships')[0];
        if (!rels) return 'rId1';

        var existing = rels.getElementsByTagName('Relationship');
        var maxId = 0;
        for (var i = 0; i < existing.length; i++) {
            var idAttr = existing[i].getAttribute('Id') || '';
            if (/^rId\d+$/.test(idAttr)) {
                maxId = Math.max(maxId, parseInt(idAttr.slice(3), 10));
            }
        }
        var newId  = maxId + 1;
        var newRel = relsDoc.createElementNS(NS_RELS, 'Relationship');
        newRel.setAttribute('Id',     'rId' + newId);
        newRel.setAttribute('Type',   NS.RELS_IMAGE);
        newRel.setAttribute('Target', target);
        rels.appendChild(newRel);
        return 'rId' + newId;
    }

    /**
     * Converte una stringa base64 (con o senza header data:...) in Uint8Array.
     */
    function _base64ToUint8Array(b64) {
        var pure = b64;
        var comma = b64.indexOf(',');
        if (comma !== -1) pure = b64.slice(comma + 1);
        try {
            var bin    = window.atob(pure);
            var bytes  = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return bytes;
        } catch (_e) {
            // Se la decodifica fallisce, ritorna il PNG trasparente
            var fallback = window.atob(TRANSPARENT_PNG_B64);
            var fb = new Uint8Array(fallback.length);
            for (var j = 0; j < fallback.length; j++) fb[j] = fallback.charCodeAt(j);
            return fb;
        }
    }

    // ─── Esposizione globale ─────────────────────────────────────────────────────

    // Compatibile con il pattern di lookup esistente nei 3 caller:
    //   (typeof window.ImageModule === 'function') ? window.ImageModule : ...
    global.ImageModule = ImageModule;

}(typeof window !== 'undefined' ? window : this));
