# 📚 Manuale d'Uso — CSE SafeHub
*Piattaforma professionale per Coordinatori della Sicurezza (CSE)*

Benvenuto nel Manuale d'Uso ufficiale di **CSE SafeHub**, la piattaforma professionale dedicata ai Coordinatori della Sicurezza in Fase di Esecuzione (CSE) per la gestione operativa dei cantieri temporanei o mobili.

L'applicazione è progettata con un'architettura **offline-first**, garantendo la piena operatività anche in assenza di connessione Internet (utilizzando il database locale del browser IndexedDB) ed è predisposta per l'uso come **Progressive Web App (PWA)** sia su dispositivi mobili che su desktop.

---

### 1. Introduzione e Installazione (PWA)
**Cos'è CSE SafeHub?**
È una suite integrata pensata per digitalizzare le operazioni del CSE, rispettando i requisiti del D.Lgs 81/08. Tutte le informazioni vengono salvate sul dispositivo e possono essere sincronizzate con un archivio Cloud (OneDrive) o esportate in formato locale.

**Installazione come PWA:**
L'applicazione può essere installata come un'app nativa sul tuo dispositivo:
*   **🖥️ Desktop (Chrome / Edge):** Clicca sull'icona di installazione nella barra degli indirizzi e seleziona "Installa".
*   **📱 iOS (Safari):** Premi il tasto "Condividi" e seleziona "Aggiungi alla schermata Home".
*   **🤖 Android (Chrome):** Premi sui tre puntini in alto a destra e seleziona "Installa applicazione".

---

### 2. Gestione Cantieri
**📂 Hub Cantieri:**
Schermata principale che mostra la griglia dei cantieri attivi.
*   **Creazione:** Clicca su `+ Nuovo Cantiere`. Inserisci i dati identificativi (ID/Codice, Nome, Localizzazione).
*   **Selezione:** Clicca sulla scheda del cantiere per entrare nella Dashboard specifica.

**📊 Dashboard di Cantiere:**
Fornisce un riepilogo in tempo reale:
*   Statistiche su imprese e lavoratori attivi.
*   Numero di Non Conformità aperte e in scadenza.
*   Visualizzazione cronologica dei verbali emessi.
*   Collegamenti rapidi per le operazioni di campo.

---

### 3. Anagrafiche (Imprese e Lavoratori)
**👥 Gestione Imprese:**
*   **Inserimento:** Registra Ragione Sociale, Partita IVA, Referente e ruolo (Affidataria, Esecutrice, ecc.).
*   **Controllo Documenti:** Monitora documenti obbligatori (es. DURC, Certificati) con avvisi automatici sulle scadenze.

**👷 Gestione Lavoratori:**
*   **Inserimento:** Aggiungi anagrafica, mansione, attestati formativi e visite mediche.
*   **Scadenze:** Sistema di alert per abilitazioni e idoneità prossime alla scadenza.

---

### 4. Modulo Verbali
**4.1 📝 Verbale di Sopralluogo:**
*   **Compilazione:** Inserisci data, chilometrica/area, oggetto, meteo e presenti.
*   **Prescrizioni:** Documenta lo stato dei luoghi e le disposizioni imposte.
*   **Numerazione:** Automatizzata nel formato `YYYYMMDD/VS01`.
*   **Esportazione:** Anteprima PDF professionale o download in formato **Word editabile**.

**4.2 📋 Riunione di Coordinamento:**
*   **Tipologia:** Seleziona tra Preliminare, In corso d'opera, Coordinamento RLS, ecc.
*   **Argomenti:** Registra le decisioni operative assunte.
*   **Motivazione CSE:** Campo obbligatorio per documentare l'attività di vigilanza ex art. 92 D.Lgs 81/08.
*   **Firma multipla:** Gestisce le firme digitali di tutti i soggetti presenti.

**4.3 ✅ Verifica Idoneità POS:**
*   **Checklist:** Valutazione deterministica basata sui requisiti normativi.
*   **Esito finale:** Idoneo / Idoneo con prescrizioni / Non idoneo.
*   **Generazione:** Esportazione del documento nel layout professionale a colonne standard.

---

### 5. Modulo Sicurezza (NC e ODS)
**⚠️ Non Conformità (NC) e Ordini di Servizio (ODS):**
*   **Apertura NC:** Registra criticità con gravità variabile (Lieve, Media, Grave, Gravissima). Le scadenze per la risoluzione sono calcolate automaticamente.
*   **Emissione ODS:** Associa alla NC una disposizione d'ordine formale.
*   **Foto:** Allega evidenze fotografiche scattate direttamente dal dispositivo.

**📥 ODS Ricevuti:**
*   Archivia e traccia gli Ordini di Servizio ricevuti dalla Committenza o dalla Direzione Lavori per una cronologia completa consultabile offline.

---

### 6. Modulo Documenti
**📋 Documenti di Cantiere:**
Raccolta centralizzata di PSC, Fascicolo dell'opera, Nomina CSE, POS, DURC, Notifica Preliminare e ITP.

**📚 Normative:**
Consultazione rapida delle norme vigenti (D.Lgs 81/08, Norme Tecniche, ecc.) e archiviazione allegati extra.

---

### 7. Impostazioni e Personalizzazione
*   **Configurazione Loghi:** Carica i loghi del tuo studio e del Committente per l'intestazione automatica dei documenti.
*   **Firma Digitale:** Disegna o carica la tua firma per precompilare i documenti.
*   **Metadati:** Configura il nome del tecnico e le clausole standard da riportare nel footer.

---

### 8. Archivio Condiviso OneDrive
Supporta la modalità **Archivio Condiviso**, permettendo a più tecnici di lavorare sugli stessi dati.
*   **PC Windows:** Pieno supporto tramite client OneDrive attivo e cartella condivisa selezionata.
*   **Mobile:** Sincronizzazione tramite IndexedDB locale con possibilità di esportazione manuale.
*   **Collaborazione:** Sistema di avviso in caso di modifiche esterne rilevate per evitare conflitti.

---

### 9. Assistente AI (Gemini Nano — Edge Intelligence)
SafeHub integra **Gemini Nano**, l'intelligenza artificiale che opera interamente in locale sul dispositivo.
*   **Privacy Totale:** Nessun dato o verbale viene inviato al cloud. L'elaborazione avviene esclusivamente nel chip del tuo PC.
*   **Supporto al CSE:** Suggerimenti normativi, classificazione automatica della gravità delle NC e trasformazione di appunti rapidi in prescrizioni formali.
*   **Attivazione:** Richiede Chrome 138+ con flag sperimentali abilitati per la Edge Intelligence.

---

### 10. Riconoscimenti
Si ringrazia per il supporto e la fase di collaudo il **Geom. Antonio Perrone**, il cui contributo ha permesso la sperimentazione sul campo dello strumento.

---
*CSE SafeHub — Innovazione digitale per la sicurezza sul lavoro.*
