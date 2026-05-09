# Manuale d'Uso Ufficiale — ANAS SafeHub
## Piattaforma professionale per Coordinatori della Sicurezza (CSE)

Benvenuto nel Manuale d'Uso ufficiale di **ANAS SafeHub**, la piattaforma professionale dedicata ai Coordinatori della Sicurezza in Fase di Esecuzione (CSE) per i cantieri di ANAS SpA.

L'applicazione è progettata con un'architettura **offline-first**, garantendo la piena operatività anche in assenza di connessione Internet (utilizzando il database locale del browser IndexedDB) ed è predisposta per l'uso come **Progressive Web App (PWA)** sia su dispositivi mobili che su desktop.

---

### 1. Introduzione e Installazione (PWA)
**Cos'è ANAS SafeHub?**
È una suite integrata pensata per digitalizzare le operazioni del CSE, rispettando i requisiti del D.Lgs 81/08 e delle direttive ANAS. Tutte le informazioni vengono salvate sul dispositivo e possono essere sincronizzate con un archivio Cloud (OneDrive) o esportate in formato locale.

**Installazione come PWA:**
Grazie al supporto PWA, l'applicazione può essere installata come un'app nativa sul tuo dispositivo:
- **🖥️ Desktop (Chrome / Edge)**: Clicca sull'icona di installazione (disponibile a destra della barra degli indirizzi) e seleziona "Installa".
- **📱 iOS (Safari)**: Premi il tasto "Condividi" e seleziona "Aggiungi alla schermata Home".
- **🤖 Android (Chrome)**: Premi sui tre puntini in alto a destra e seleziona "Installa applicazione".

---

### 2. Gestione Cantieri
**📂 Hub Cantieri:**
All'accesso nell'Hub Cantieri, la schermata mostra una griglia dei cantieri attivi sul dispositivo.
- **Creazione**: Clicca su `+ Nuovo Cantiere`. Inserisci i dati identificativi (ID Cantiere/Codice, Nome Cantiere, Localizzazione).
- **Selezione**: Clicca sulla scheda del cantiere desiderato per entrare nella sua specifica **Dashboard**.

**📊 Dashboard di Cantiere:**
Una volta selezionato un cantiere, la Dashboard fornisce un riepilogo delle attività in corso:
- Statistiche generali sulle imprese e sui lavoratori attivi.
- Numero di Non Conformità aperte e in scadenza.
- Visualizzazione dei verbali già emessi.
- Collegamenti rapidi per creare nuovi elementi.

---

### 3. Anagrafiche (Imprese e Lavoratori)
Il modulo anagrafiche consente di censire tutte le figure professionali e le imprese operanti nel cantiere corrente.

**👥 Gestione Imprese:**
Accedi alla voce Anagrafiche:
- **Inserimento**: Clicca su `+ Nuova Impresa`. Specifica la Ragione Sociale, Partita IVA, Referente in cantiere e il ruolo (Affidataria, Subappaltatrice).
- **Controllo Documenti**: È possibile monitorare i documenti obbligatori dell'impresa (es. DURC, Certificati) inserendo la data di scadenza. Il sistema segnalerà automaticamente eventuali scadenze tramite avvisi cromatici.

**👷 Gestione Lavoratori:**
All'interno dell'impresa selezionata o nella sezione generale dei lavoratori:
- **Inserimento**: Aggiungi nome, cognome, codice fiscale, mansione e i relativi attestati di formazione/visite mediche.
- **Scadenze**: L'applicazione avvisa il CSE in caso di abilitazioni scadute o prossime alla scadenza.

---

### 4. Modulo Verbali
La sezione principale per l'emissione dei documenti legali e di controllo.

**4.1 📝 Verbale di Sopralluogo:**
- **Compilazione**: Clicca su `Nuovo Verbale`. Inserisci data, chilometrica, oggetto del sopralluogo, condizioni meteo, imprese e referenti presenti.
- **Prescrizioni del CSE**: Descrivi accuratamente lo stato dei luoghi e le prescrizioni imposte.
- **Firma e Anteprima**: È possibile apporre la firma digitale e cliccare su `🖨️ Anteprima` per visualizzare il layout di stampa PDF o `📄 Word` per scaricare il documento Word conforme.

**4.2 📋 Riunione di Coordinamento:**
- **Compilazione**: Clicca su `Riunione Coord.`. Scegli il tipo di riunione (es. Preliminare, In corso d'opera, Ingresso nuove imprese, Coordinamento RLS).
- **Argomenti trattati**: Inserisci gli argomenti di discussione e le decisioni operative assunte.
- **Firma multipla**: Gestisce le firme dei vari presenti (ANAS, Imprese).

**4.3 ✅ Verifica POS (Mod. RE. 01-5):**
- **Checklist**: Compila la checklist deterministica composta da tutte le voci di verifica obbligatorie per il Piano Operativo di Sicurezza dell'impresa.
- **Esito finale**: Seleziona l'idoneità del POS (Idoneo / Idoneo con prescrizioni / Non idoneo).
- **Generazione**: Stampa o esporta il documento nel layout industriale ufficiale ANAS a 6 colonne fisse.

---

### 5. Modulo Sicurezza (NC e ODS)
**⚠️ Non Conformità (NC) e Ordini di Servizio (ODS Inviati):**
- **Apertura NC**: Registra le criticità riscontrate in cantiere. Scegli la gravità (**Lieve** - 7gg, **Grave** - 72h, **Gravissima** - 24h).
- **Emissione ODS**: Associa alla NC una specifica disposizione d'ordine (ODS) all'impresa responsabile.
- **Evidenze Fotografiche**: È possibile scattare foto in tempo reale dal cantiere e allegarle alla NC.

**📥 ODS Ricevuti:**
- **Tracciamento**: Registra e archivia gli Ordini di Servizio ricevuti dalla stazione appaltante o dalla Direzione Lavori per avere una cronologia sempre disponibile e consultabile offline.

---

### 6. Modulo Documenti
**📋 Documenti Fondamentali:**
Consente al CSE di raccogliere i documenti cardine del cantiere:
- PSC (Piano di Sicurezza e Coordinamento)
- Fascicolo dell'opera
- Nomina del CSE

**📚 Normative & Documenti:**
Sezione dedicata alla consultazione rapida delle norme vigenti (es. D.Lgs 81/08, D.I. 22/01/2019) e all'archiviazione di documenti extra e allegati.

---

### 7. Impostazioni, Firme e OneDrive
**⚙️ Setup Personale:**
All'interno della sezione Impostazioni:
- **Configurazione Loghi**: È possibile caricare i loghi aziendali e del committente (es. ANAS SpA) che verranno inclusi nell'intestazione di tutti i verbali generati.
- **Firma Predefinita**: Disegna o carica la tua firma di CSE. Questa firma verrà precompilata nei nuovi verbali per accelerare il lavoro.

**🔗 Integrazione OneDrive e Collaborazione:**
- **Sincronizzazione**: Collega il tuo account Microsoft OneDrive per salvare una copia sicura dei database di cantiere nel cloud.
- **Collaborazione Team**: Per lavorare con altri colleghi, utilizza la procedura di esportazione/importazione JSON:
    1. **Esporta**: Chi aggiorna i dati clicca su `Esporta Database (JSON)`.
    2. **Condividi**: Salva il file su una cartella OneDrive condivisa con il team.
    3. **Importa**: Il collega carica l'ultimo file tramite `Importa Database (JSON)`.
- *Vedi la [Guida Collaboratori](./guida-collaboratori-safehub.md) per i dettagli.*

---

### 8. Assistente AI (Gemini Nano)
L'applicazione integra l'assistente AI **Gemini Nano** basato sull'API nativa del browser (Chrome LanguageModel API 138+). Tutte le elaborazioni AI avvengono localmente sul dispositivo dell'utente per garantire velocità, sicurezza e privacy assoluta.

**🤖 Stato dell'AI e Indicatore:**
In alto nella topbar, un badge di stato indica lo stato dell'assistente locale:
- `🤖 AI Pronta`: Il modello locale è stato caricato e pronto all'uso.
- `⏳ AI Download…`: Il modello locale è in fase di download.
- `🔍 AI Verifica…`: Il browser sta verificando la disponibilità del modello.
- `— AI N/D`: Il modello locale non è supportato da questo browser.

**📝 Casi d'uso dell'Assistente AI:**
Nei vari moduli (Verbali, NC) sono presenti i pulsanti `🤖 Suggerisci con AI` per compilare automaticamente i testi basandosi sul contesto normativo e di cantiere:
1. **Suggerisci Stato dei Luoghi**: Genera la descrizione formale dello "Stato dei luoghi e lavorazioni in corso" per i verbali di sopralluogo.
2. **Suggerisci Prescrizioni CSE**: Aiuta il CSE a redigere prescrizioni formali basandosi sul problema riscontrato e citando la normativa pertinente (es. D.Lgs 81/08).
3. **Suggerisci Descrizione Non Conformità**: Compila una descrizione tecnica e prescrittiva per una nuova NC basandosi sulla gravità.
4. **Riassunto Verbale**: Analizza e riassume in punti chiave i testi di un verbale esistente.

---
*Manuale ufficiale aggiornato — SafeHub 2026*
