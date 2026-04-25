# ANAS SafeHub — Suite CSE v2.0
> **Collaborazione Multi-Tecnico · Cloud Sync · Livello 2 Storage**

**Pannello operativo professionale per Coordinatori Sicurezza in Esecuzione (CSE) — ANAS SpA**
Moderno · Offline-first · Sincronizzato con OneDrive (FSAPI) · PWA installabile

Autore: **Geom. Dogano Casella** — CSE ANAS Regione Calabria
Cantieri operativi: S.S. 106 Jonica · A2 Autostrada del Mediterraneo

---

## 🚀 Novità v2.0: Collaborazione Real-Time
La versione 2.0 trasforma la Suite da strumento locale a piattaforma collaborativa per team di coordinamento, senza abbandonare la resilienza offline.

- **Livello 2 Storage**: Sincronizzazione trasparente tra **IndexedDB** (veloce, offline) e **OneDrive** (condiviso, persistente).
- **Audit Log Automativo**: Ogni modifica registra autore e timestamp (`modifiedBy`, `modifiedAt`).
- **Attività Recente**: Feed in tempo reale nella dashboard cantiere per monitorare i progressi del team.
- **Auto-Sync**: Polling intelligente ogni 3 minuti per rilevare aggiornamenti esterni.
- **Gestione Conflitti**: Rilevamento modifiche simultanee con opzioni di risoluzione manuale.

---

## 🔧 Architettura v2.0

| Layer | Tecnologia | Note |
|-------|-----------|------|
| **UI** | Tailwind CDN + Inter Font + animazioni.css | Premium Dark Mode & Glassmorphism |
| **Data Layer** | `storage.js` (Router) | Gestisce IndexedDB ↔ OneDrive in modo trasparente |
| **Local DB** | IndexedDB v7 | 10 store, cache runtime ultra-veloce |
| **Cloud DB** | OneDrive via File System Access API | Cartella di rete condivisa (File JSON strutturati) |
| **Sync** | Polling (3 min) + Visibility Change | Rilevamento modifiche esterne non bloccante |
| **PWA** | Service Worker v2.2.1 | Cache aggressiva + offline totale |

---

## 🗂️ Struttura Files v2.0 (Nuovi Moduli)

```
/
├── storage.js                   Router universale CRUD (IndexedDB + OneDrive)
├── storage-onedrive.js          Integrazione File System Access API (Cloud Sync)
├── onedrive-ui.js               Modali configurazione, auth e gestione conflitti
├── migrazione-onedrive.js       Utility per migrare dati locali verso il cloud
├── sw.js                        Service Worker v2.2.1 (Force-update logic)
│
├── verbali-list.js              Aggiornato: Badge 'Modificato da' + Tempo Relativo
├── dashboard-cantiere.js        Aggiornato: Sezione 'Attività Recente' (Audit)
├── ui.js                        Aggiornato: Helper formatTempoRelativo globale
└── ...                          (Moduli v1.5 preesistenti)
```

---

## 📋 Configurazione OneDrive
Per abilitare la collaborazione:
1. Apri la **Suite CSE** (ANAS_CSE_html.html).
2. Clicca il bottone **☁️ OneDrive** nella topbar.
3. Seleziona una cartella condivisa su OneDrive (es. `ANAS_PROGETTI/Lotto_CZ399`).
4. L'app sincronizzerà automaticamente Verbali e NC tra il database locale e i file JSON nella cartella.

---

## ⌨️ Scorciatoie tastiera (v2.0)

| Tasti | Azione |
|-------|--------|
| `Alt + 1` | Hub Cantieri |
| `Alt + 2` | Dashboard cantiere |
| `Alt + 3` | Non Conformità |
| `Alt + 4` | Documenti |
| `Ctrl + N` | Nuovo Verbale di Sopralluogo |
| `Ctrl + S` | Salva e Sincronizza (Cloud) |
| `Ctrl + Shift + R` | Nuova Riunione di Coordinamento |
| `/` | Focus sulla ricerca |
| `Esc` | Chiudi modal/pannello aperto |

---

## 🛡️ Normativa e Sicurezza Dati
- **Privacy**: I dati non passano mai per server intermedi. Il sync avviene direttamente tra browser e cartella locale di OneDrive dell'utente.
- **Audit**: In conformità con le procedure ANAS, ogni verbale e NC porta la firma digitale del tecnico che ha effettuato l'ultima modifica.
- **Offline**: Se la connessione cade o OneDrive non è raggiungibile, l'app continua a lavorare su IndexedDB e sincronizzerà al ripristino.

---

## 📞 Contatti e Supporto

**Geom. Dogano Casella**
Coordinatore Sicurezza in Esecuzione (CSE) — ANAS SpA
Regione Calabria
