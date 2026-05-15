# Manuale d'Uso — CSE SafeHub

Benvenuto nel **Manuale d'Uso ufficiale di CSE SafeHub**, la piattaforma
professionale dedicata ai **Coordinatori della Sicurezza in fase di Esecuzione
(CSE)** per la gestione operativa dei cantieri temporanei o mobili, ai sensi
del **D.Lgs 81/08 — Titolo IV**.

L'applicazione è progettata con un'architettura **offline-first**, garantendo
piena operatività anche in assenza di connessione Internet (utilizzando il
database locale del browser IndexedDB), ed è installabile come
**Progressive Web App (PWA)** su desktop, tablet e smartphone.

---

## 1. Introduzione

### Cos'è CSE SafeHub

CSE SafeHub è una suite integrata pensata per digitalizzare le attività
operative del CSE durante la fase esecutiva dei lavori, in conformità al
**D.Lgs 81/08, Titolo IV**.

Tutte le informazioni vengono salvate sul dispositivo e possono essere
sincronizzate con un archivio Cloud (OneDrive) o esportate localmente in
formato JSON per backup.

### A chi si rivolge

- **CSE** (Coordinatori della Sicurezza in fase di Esecuzione)
- **Ispettori di cantiere** assistenti al CSE
- **DL** (Direttori dei Lavori) che svolgono funzioni di CSE per appalti
  fino a 1 milione di euro (art. 114 c.4 D.Lgs 36/23)
- Qualunque tecnico professionista che operi nella sicurezza dei cantieri
  temporanei o mobili

### Filosofia di progetto

- ✅ **Offline-first**: l'app funziona senza Internet
- ✅ **Privacy-first**: tutti i dati restano sul dispositivo dell'utente
- ✅ **Zero costi**: software gratuito, open source, licenza MIT
- ✅ **Zero installazione complessa**: basta aprire il link nel browser

---

## 2. Installazione come PWA

L'applicazione può essere installata come un'app nativa sul tuo dispositivo:

- 🖥️ **Desktop (Chrome / Edge):** clicca sull'icona di installazione
  disponibile a destra della barra degli indirizzi e seleziona "Installa".
- 📱 **iOS (Safari):** premi il tasto "Condividi" e seleziona
  "Aggiungi alla schermata Home".
- 🤖 **Android (Chrome):** premi sui tre puntini in alto a destra e
  seleziona "Installa applicazione".

Una volta installata, CSE SafeHub funziona come una vera app:
icona nel menu, apertura a tutto schermo, niente barra del browser.

---

## 3. Struttura dell'applicazione

CSE SafeHub è organizzata su **2 livelli di navigazione**:

### Livello 1 — Home "I Miei Cantieri"

All'avvio l'applicazione mostra:

- **Griglia dei cantieri attivi** con codice, nome, stato e indicatore
  Non Conformità aperte
- **Bottone "+ Nuovo Cantiere"** per creare un nuovo cantiere
- **Strumenti globali**: Manuale, Numeri Emergenza, Assistente AI,
  Backup/Ripristino

### Livello 2 — Contesto Cantiere

Cliccando "ENTRA →" su un cantiere si apre la sua area di lavoro dedicata,
con sidebar di navigazione organizzata in 3 raggruppamenti:

**📊 Dashboard**
- Riepilogo KPI cantiere (NC aperte, verbali del mese, imprese attive,
  documenti in scadenza, ecc.)

**👷 Anagrafiche**
- **Imprese**: persone giuridiche (Affidataria, Esecutrice, SubAppalto, Fornitore)
- **Personale Tecnico**: figure professionali responsabili (RUP, DL, RL,
  CSE Titolare, CSE Delegato, Ispettore, Dirigente)
- **Enti Terzi**: ispettori esterni (Spresal, VVF, Provincia, Consulenti)
- **Lavoratori**: operai delle imprese con tracciamento formazione,
  visite mediche, abilitazioni patentini
- **Mezzi**: mezzi e attrezzature con libretti, verifiche periodiche, foto

**📋 Operatività**
- **Verbali**: Sopralluogo e Riunione di Coordinamento
- **Verifica POS**: archivio verifiche di idoneità del Piano Operativo di Sicurezza
- **Non Conformità (NC)**: rilevazione con scadenze automatiche per gravità
- **Ordini di Servizio Inviati**: disposizioni del CSE
- **Ordini di Servizio Ricevuti**: comunicazioni dal RUP/DL/Stazione Appaltante
- **Lettere di Sospensione**: art. 92 c.1 lett. f
- **Diario CSE**: registro giornaliero delle attività
- **Eventi Incidentali**: segnalazione Near Miss e infortuni

**📁 Documentale**
- **Documenti Fondamentali**: PSC, POS, DURC, nomine, certificazioni
- **Registro PSC**: aggiornamento cronologico del Piano di Sicurezza e Coordinamento
- **Archivio File**: navigazione strutturata di tutti i documenti del cantiere

---

## 4. Gestione Cantieri

### Creare un nuovo cantiere

Dalla home cliccare **+ Nuovo Cantiere** e compilare:

- **Codice cantiere** (obbligatorio, formato alfanumerico maiuscolo,
  es. `CZ399`, `LOTTO_A2_KM12`)
- **Nome cantiere** (descrizione operativa, es. "Viadotto S. Giorgio")
- **Localizzazione** (testo libero)
- **Data inizio prevista**
- **Data fine prevista**

### Eliminare un cantiere

⚠️ **Operazione irreversibile**: eliminando un cantiere si rimuovono
automaticamente TUTTI i dati e documenti associati (anagrafiche, verbali,
NC, ODS, allegati, ecc.).

Si raccomanda di **esportare il backup** del cantiere prima
dell'eliminazione.

---

## 5. Anagrafiche del cantiere

Tutte le anagrafiche sono **specifiche del singolo cantiere**: la stessa
impresa che lavora su 2 cantieri sarà rappresentata da 2 record separati,
perché il ruolo (Affidataria, SubAppalto, ecc.) può cambiare per cantiere.

### Anagrafica Imprese

4 ruoli previsti:
- **Affidataria** — impresa principale appaltatrice
- **Esecutrice** — impresa di lavorazioni specifiche
- **SubAppalto** — subappaltatrice di altra impresa
- **Fornitore** — fornitura materiali/servizi

Per ogni impresa si tracciano: ragione sociale, P.IVA, CF, sede, PEC,
DURC con scadenza, eventuali altri documenti di idoneità.

### Anagrafica Lavoratori

Ogni lavoratore appartiene a un'impresa del cantiere. Si tracciano:
- Anagrafica base (nome, cognome, CF, mansione)
- Attestato di formazione con scadenza
- Visita medica con scadenza
- **Abilitazioni patentini** per tipologie di mezzi specifici
  (gru, escavatore, PLE, ecc.)

### Anagrafica Mezzi

Ogni mezzo appartiene a un'impresa. Le tipologie sono catalogate in
5 macro-categorie:

- 📦 **SC** — Strumenti per Carichi (gru, carrelli, paranchi)
- ⛏️ **SP** — Strumenti Perforanti (perforatrici, demolitori)
- 🏗️ **MT** — Macchine Terra (escavatori, pale, bulldozer)
- 🛠️ **OP** — Operatrici (autobetoniere, pompe, finitrici)
- ⚡ **AT** — Attrezzature Speciali (PLE, generatori, ponteggi)

Per ogni mezzo si tracciano: marca, modello, matricola INAIL, anno,
libretto uso/manutenzione, verifiche periodiche, foto.

CSE SafeHub mostra automaticamente per ogni mezzo i **lavoratori abilitati**
del cantiere ad utilizzarlo, basandosi sui patentini in corso di validità.

---

## 6. Verbali

CSE SafeHub gestisce 2 tipi di verbale generati automaticamente in formato
Word, con numerazione progressiva e archiviazione su OneDrive:

### Verbale di Sopralluogo

Documenta i sopralluoghi periodici del CSE in cantiere (art. 92 c.1 a).
Include:
- Data, ora, condizioni meteo
- Presenti (personale tecnico, imprese, terzi) con firme grafiche
- Stato dei luoghi e lavorazioni
- Prescrizioni del CSE
- Eventuali allegati (foto, mezzi presenti)

### Verbale di Riunione di Coordinamento

Documenta le riunioni di coordinamento (art. 92 c.1 c). Include:
- Tipo riunione (Preliminare, In corso d'opera, Ingresso nuove imprese,
  Coordinamento RLS)
- Presenti con firme
- Argomenti trattati
- Decisioni assunte
- Esito ed eventuali prescrizioni

---

## 7. Non Conformità (NC)

CSE SafeHub gestisce le NC con scadenze automatiche per gravità:

| Livello | Scadenza | Quando si usa |
|---|---|---|
| 🚨 **Gravissima** | 24 ore | Pericolo grave e imminente, sospensione immediata |
| 🔴 **Grave** | 7 giorni | Inosservanza con rischio elevato |
| 🟠 **Media** | 15 giorni | Inosservanza sanabile |
| 🟡 **Lieve** | 30 giorni | Difformità minore documentale |

Per ogni NC si tracciano: descrizione, riferimento normativo, foto
evidenze, impresa responsabile, stato (aperta/in corso/chiusa) e note
di chiusura.

---

## 8. Documenti Fondamentali

Sezione dedicata al caricamento e tracciamento dei documenti chiave del
cantiere:

- **PSC** (Piano di Sicurezza e Coordinamento)
- **POS** delle imprese (Piano Operativo di Sicurezza)
- **DURC** delle imprese
- **Nomine** (RUP, DL, RL, CSE)
- **Idoneità Tecnico Professionale** (art. 90 c.9)
- **Fascicolo dell'opera**
- **Notifica preliminare** e aggiornamenti
- **Autorizzazioni** specifiche del cantiere

Per ogni documento è possibile impostare scadenze e ricevere alert nella
Dashboard cantiere.

---

## 9. Eventi Incidentali (Near Miss e Infortuni)

Sezione dedicata alla tracciabilità di:

- **Near Miss** (mancati infortuni): permette di identificare rischi
  ricorrenti e intervenire prima del vero incidente. Allineato a best
  practice internazionali ISO 45001.
- **Infortuni**: tracciamento con denuncia INAIL, verbale di pronto
  soccorso, relazione del CSE.

Form rapido a una pagina per favorire la segnalazione veloce. Ogni evento
può triggerare automaticamente una voce nel **Registro PSC** se richiede
revisione del Piano di Sicurezza.

---

## 10. Registro Aggiornamenti PSC

Il PSC va aggiornato in continuazione (art. 92 c.1 b D.Lgs 81/08).
CSE SafeHub **genera automaticamente** un registro cronologico degli
aggiornamenti basato sugli eventi che traccia:

- Ingresso/uscita di imprese
- Modifiche delle lavorazioni
- Nuovi rischi rilevati
- Revisioni dopo NC o eventi incidentali
- Aggiornamenti periodici

Output: PDF del Registro PSC aggiornato in qualsiasi momento, firmato
digitalmente dal CSE.

---

## 11. Sincronizzazione OneDrive

CSE SafeHub supporta una modalità di lavoro **collaborativo multi-utente**
basata su una cartella OneDrive condivisa tra colleghi CSE.

### Come si attiva

1. Dalla home cliccare sull'icona ☁️ OneDrive in alto a destra
2. Selezionare la cartella OneDrive locale (sincronizzata via client
   OneDrive di Windows)
3. CSE SafeHub crea la struttura standardizzata di sottocartelle
4. Da quel momento ogni dato e documento viene sincronizzato

### Struttura cartelle automatica

```
CartellaCondivisa/
├── _safehub/                    ← dati strutturati JSON
│   ├── registro_lotti.json
│   └── Lotto_XXX.json
└── Lotto_XXX/                   ← documenti del cantiere
    ├── 01_Documenti_Fondamentali/
    ├── 02_Verbali/
    ├── 03_Non_Conformita/
    ├── 04_Ordini_di_Servizio/
    ├── 05_Lettere_Sospensione/
    ├── 06_Diario_CSE/
    ├── 07_Mezzi_Attrezzature/
    └── 99_Altri_Documenti/
```

⚠️ **Compatibilità**: la sincronizzazione OneDrive richiede browser
desktop Chrome o Edge. Su mobile e altri browser l'app funziona ma
solo in modalità locale (no condivisione).

---

## 12. Assistente AI (Gemini Nano)

CSE SafeHub integra un **assistente AI in locale** basato su Gemini Nano,
disponibile in Chrome 138+. L'AI **non invia nessun dato al cloud**:
funziona interamente sul tuo dispositivo.

### Quando usarlo

L'AI suggerisce testi per:
- Stato dei luoghi (verbale sopralluogo)
- Prescrizioni del CSE
- Descrizioni tecniche di NC
- Motivazioni di sospensione

L'utente legge il suggerimento, lo modifica liberamente, lo accetta o
lo rifiuta. L'AI **non sostituisce** il giudizio professionale del CSE.

### Requisiti hardware

- Chrome 138 o superiore (desktop)
- RAM: 16 GB (o GPU con 4 GB VRAM)
- Disco: 22 GB liberi
- Sistema operativo: Windows 10/11, macOS 13+, Linux

Su dispositivi mobili l'AI **non è disponibile**.

---

## 13. Backup e ripristino

### Backup automatico OneDrive

Se hai attivato OneDrive, i tuoi dati sono automaticamente protetti dal
backup del provider Microsoft.

### Backup manuale JSON

Dalla home → bottone "💾 Backup" puoi:

- **Esportare** un file JSON con TUTTI i dati locali (anagrafiche,
  verbali, NC, ODS, configurazioni)
- **Importare** un backup precedente per ripristinare lo stato

Il file JSON di backup è di piccole dimensioni (tipicamente < 10 MB)
e può essere conservato come copia di sicurezza.

⚠️ Il backup JSON contiene SOLO i metadati strutturati. I file fisici
(PDF, foto, Word) sono salvati separatamente in OneDrive o
nel database locale del browser.

---

## 14. Sicurezza e privacy

CSE SafeHub è progettato secondo principi di **Privacy by Design**:

- ✅ Tutti i dati restano sul dispositivo dell'utente
- ✅ La sincronizzazione OneDrive avviene tra il TUO PC e il TUO cloud
- ✅ L'Assistente AI funziona in locale, nessun dato esce dal dispositivo
- ✅ Nessun server di terze parti riceve mai i tuoi dati
- ✅ Nessuna telemetria, nessun tracking, nessuna pubblicità

CSE SafeHub è conforme al **GDPR** in quanto non effettua nessun
trattamento centralizzato dei dati personali.

---

## 15. Risoluzione dei problemi comuni

### L'app non si apre offline

Verifica di aver visitato il sito almeno una volta con connessione attiva
prima di andare offline. Il Service Worker scarica le risorse necessarie
al primo accesso.

### OneDrive non si sincronizza

- Verifica che il client OneDrive di Windows sia attivo
- Verifica che la cartella selezionata sia effettivamente
  sincronizzata (icona verde di Windows)
- Verifica di aver concesso i permessi al browser

### L'AI non risponde

- Verifica di usare Chrome 138 o superiore
- Verifica che il modello Gemini Nano sia stato scaricato
  (richiede ~2.4 GB)
- Verifica che il dispositivo abbia almeno 16 GB di RAM o GPU con 4 GB VRAM

### Dati persi dopo aggiornamento browser

I dati in IndexedDB sono persistenti, ma alcune impostazioni del browser
possono cancellarli (modalità Incognito, pulizia profonda dei dati).
Si raccomanda di esportare regolarmente un backup JSON.

---

## 16. Contatti e supporto

CSE SafeHub è un progetto open source mantenuto dall'autore.

Per segnalazione bug, richieste di feature, contributi o domande:

- **Repository ufficiale**: https://github.com/casellado/ANAS_CSE
- **Issue tracker**: https://github.com/casellado/ANAS_CSE/issues

---

## Licenza

CSE SafeHub è rilasciato sotto licenza **MIT**. Vedi il file `LICENSE`
incluso nel repository per i dettagli completi.

Copyright © 2026 **Geom. Dogano Casella**.
Tutti i diritti riservati salvo quanto espressamente concesso dalla
licenza MIT.

---

*Manuale d'Uso — versione di maggio 2026*
*CSE SafeHub · by Geom. Dogano Casella*
