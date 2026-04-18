# ANAS SafeHub — Suite CSE v1.5

**Pannello operativo per Coordinatori Sicurezza in Esecuzione (CSE) — ANAS SpA**
Offline-first · IndexedDB · USB-master · GitHub Pages · PWA installabile

Autore: **Geom. Dogano Casella** — CSE ANAS Regione Calabria
Cantieri operativi: S.S. 106 Jonica · A2 Autostrada del Mediterraneo

---

## 🚀 Avvio rapido

1. Copia la cartella sul PC (desktop o USB)
2. Avvia un web server locale in quella cartella:
   - `npx serve` (se hai Node.js)
   - `python -m http.server` (se hai Python)
   - VS Code Live Server
3. Apri `http://localhost:XXXX/` nel browser
4. Su Chrome/Edge → click icona "Installa" nella barra indirizzi per PWA

> Non funziona aprendo direttamente `index.html` (file://) per via di IndexedDB e fetch.

---

## 🗂️ Struttura repository

```
/
├── index.html                   Hub Cantieri (entry point)
├── ANAS_CSE_html.html           Suite CSE completa (SPA)
├── dashboard-cantiere.html      Dashboard per singolo cantiere
├── impresa-dettaglio.html       Scheda impresa
├── lavoratore-dettaglio.html    Scheda lavoratore
├── verbale-dettaglio.html       Dettaglio verbale firmato
│
├── animazioni.css               Animazioni v1.5 (motion-reduce aware)
├── manifest.json                PWA manifest
├── sw.js                        Service Worker v1.5 (cache + offline)
│
├── data/
│   └── database.json            Master USB (caricato automaticamente)
│
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
│
├── Core / Storage / UI
│   ├── db.js                    IndexedDB v7 (10 store)
│   ├── storage.js               Read/write + bulk save + USB I/O
│   ├── ui.js                    UI shell, toast animato, modal cantiere,
│   │                            Alert NC globale (P5), badge card cantieri
│   ├── navigation.js            Router inter-pagina + sessionStorage
│   └── app.js                   Bootstrap index.html
│
├── Funzionalità CSE
│   ├── firma.js                 Canvas firma + caricaFirmaSuCanvas (P2)
│   ├── foto.js                  Cattura/archiviazione foto NC
│   ├── nc.js                    CRUD Non Conformità + bottone sospensione
│   ├── nc-foto-dashboard.js     NC con foto thumbnails
│   ├── verbali.js               Verbale di Sopralluogo
│   ├── verbali-list.js          Lista verbali (3 tipi distinti)
│   ├── verbali-riunione.js      Mod.RE.01-10 Riunione Coordinamento
│   ├── verbali-pos.js           Mod.RE.01-5 Verifica Idoneità POS
│   ├── lettera-sospensione.js   Proposta sospensione art.92 c.1 lett.f (P6)
│   └── report-giornaliero.js    Diario CSE giornaliero art.92 c.1 lett.a (P7)
│
├── Anagrafica & Documenti
│   ├── imprese-list.js
│   ├── imprese-assegnazione.js
│   ├── lavoratori.js
│   ├── documenti.js + 5 moduli collegati
│   └── scadenze-documenti.js
│
├── Dashboard
│   ├── dashboard-cantiere.js    KPI sicurezza + alert pulse NC gravissime
│   ├── dashboard-docs.js
│   └── ui-dashboard.js
│
├── Output & Workflow
│   ├── export.js                PDF · Word · JSON · USB (FSAPI)
│   ├── salvataggio.js           Pannello multi-formato
│   ├── email.js                 Invio Outlook/Gmail precompilato (P4)
│   ├── impostazioni.js          Settings + firma persistente (P2)
│   ├── smart-memory.js          Autocomplete campi frequenti
│   └── ricerca-normativa.js     AI Gemini per normativa
│
└── UX v1.5
    ├── scorciatoie.js           Keyboard shortcuts (Ctrl+N, Ctrl+S, ecc.)
    └── ai-assistente.js         Gemini Nano locale (opzionale)
```

---

## 🔧 Architettura

| Layer | Tecnologia | Note |
|-------|-----------|------|
| UI | Tailwind CDN + Inter Font + animazioni.css | Zero build step |
| Dati | IndexedDB v7 (10 store) | Cache runtime browser |
| Persistenza | `data/database.json` | Master USB / sync |
| Export | PDF (print) · Word (.doc) · JSON · USB (FSAPI) | Nativo browser |
| PWA | Service Worker v1.5 + Manifest | Installabile + offline |
| AI | Gemini Nano locale + Gemini API | Configurabile in Settings |

### Store IndexedDB v7 (10 store)

| Store | Chiave | Indici |
|-------|--------|--------|
| `projects` | `id` | `nome` |
| `verbali` | `id` | `projectId`, `tipo` |
| `nc` | `id` | `projectId`, `stato` |
| `imprese` | `id` | — |
| `lavoratori` | `id` | `impresaId` |
| `documenti` | `id` | `nome`, `tags` |
| `doc_links` | `id` | `[tipo, riferimentoId]` |
| `foto` | `id` | `ncId` |
| `imprese_cantieri` | `id` | `projectId`, `impresaId` |
| `impostazioni` | `id` | — |

---

## 📋 Flusso di lavoro CSE

```
Hub Cantieri (index.html)
  ├─ Alert NC globale (P5): gravissime, scadute, scadenza oggi
  ├─ Card cantieri con badge NC per colpo d'occhio
  │
  ↓ [click Entra]
Dashboard Cantiere (dashboard-cantiere.html)
  ├─ KPI Sicurezza (NC aperte, gravissime, scadute, tempo medio, score)
  ├─ KPI Documentali (totali, collegati a verbali/NC)
  ├─ Alert ANAS pulsante se gravissime aperte > 24h
  ├─ Tab: NC · Verbali · Imprese · Documenti
  │
  ↓ [click azione o shortcut]
Suite CSE (ANAS_CSE_html.html — SPA)
  ├─ Selettore cantiere rapido in topbar (P1)
  ├─ Bottone "📋 Oggi" → Diario giornaliero (P7)
  ├─ Form Sopralluogo (data + KM + meteo + imprese + firma persistente)
  ├─ Form Riunione Coordinamento Mod.RE.01-10 (multi-select imprese P3)
  ├─ Form Verifica Idoneità POS Mod.RE.01-5
  ├─ Non Conformità → Bottone sospensione art.92 (P6) se gravissima > 20h
  ├─ Documenti (Cantiere/Normative/ODS)
  └─ Impostazioni (firma persistente, loghi, committente)
```

---

## ⌨️ Scorciatoie tastiera

| Tasti | Azione |
|-------|--------|
| `Alt + 1` | Hub Cantieri |
| `Alt + 2` | Dashboard cantiere |
| `Alt + 3` | Non Conformità |
| `Alt + 4` | Documenti |
| `Ctrl + N` | Nuovo Verbale di Sopralluogo |
| `Ctrl + Shift + R` | Nuova Riunione di Coordinamento |
| `Ctrl + Shift + P` | Nuova Verifica POS |
| `Ctrl + Shift + O` | Diario giornaliero (Oggi) |
| `Ctrl + S` | Salva il contesto corrente |
| `/` | Focus sulla ricerca |
| `Esc` | Chiudi modal/pannello aperto |
| `Shift + ?` | Mostra guida scorciatoie |

Su Mac usa ⌘ al posto di Ctrl.

---

## 🛡️ Normativa di riferimento

- **D.Lgs 81/2008** — Testo Unico Sicurezza
- **D.I. 22/01/2019** — Segnaletica cantieri stradali
- **Art. 92 c.1 lett. f** — Proposta sospensione lavori per gravi inosservanze
- **Art. 92 c.1 lett. a** — Obbligo di vigilanza e annotazione sul diario CSE
- **Procedura ANAS** — NC gravissime: sospensione obbligatoria entro 24h

### Scadenze NC

| Livello | Scadenza |
|---------|----------|
| Gravissima | 24 ore |
| Grave | 72 ore (3 giorni) |
| Media / Lieve | 7 giorni |

---

## ✨ Novità v1.5

### Animazioni mirate
- Toast slide-in da destra con progress bar e hover pause
- Pulse alert sulle NC gravissime (`box-shadow` respiratorio)
- Checkmark animato + flash verde sui 5 salvataggi principali
- Skeleton loading al posto dello spinner generico
- Fade transition 200ms tra view SPA
- Tutto rispetta `prefers-reduced-motion` (WCAG)

### P5 — Alert NC scadenza su Hub
Badge colorati sulle card cantiere (🔴 gravissime · ⏰ scadute · ⚠️ scadenza oggi) + banner aggregato sopra la griglia. Al mattino vedi subito dove intervenire prima.

### P6 — Lettera Sospensione art. 92 c.1 lett. f
Bottone "🚨 Sospensione" che appare solo su NC gravissime aperte da oltre 20h. Modal precompilato con dati NC, cantiere, destinatari (P4), motivazione legale. Genera Word formale con protocollo, intestazione studio, firma persistente. La NC viene marcata con `sospensioneGenerata` per evitare duplicazioni.

### P7 — Diario CSE giornaliero
Bottone "📋 Oggi" nella topbar. Aggrega in automatico cantieri visitati, sopralluoghi, riunioni, verifiche POS, NC aperte/chiuse del giorno corrente. Export PDF o Word con firma persistente. Accetta data target per rigenerare report di giorni passati.

### Scorciatoie tastiera
Modulo `scorciatoie.js` con 12 shortcut per velocizzare il lavoro serale di formalizzazione. `Shift+?` mostra la guida completa.

---

## 📜 Novità v1.4 (migliorie CSE senior)

### P1 — Selettore cantiere rapido in topbar
Cambio contesto tra cantieri senza tornare all'Hub.

### P2 — Firma persistente CSE
Firma una sola volta nelle Impostazioni → applicata automaticamente a tutti i verbali.

### P3 — Multi-select imprese in Riunione
Selezione dalle imprese assegnate al cantiere (zero typo, coerenza anagrafica).

### P4 — Destinatari email per cantiere
R.U.P., D.L., PEC Impresa Affidataria pre-compilati nei mailto.

---

## 🐛 Bug fixati nella history

### v1.4 → v1.5 (questa release)

| ID | Bug | Modulo |
|----|-----|--------|
| KBD-01 | `Ctrl+N` apriva nuova finestra browser invece di creare verbale | `scorciatoie.js` |

### v1.3 → v1.4

| ID | Bug | Modulo |
|----|-----|--------|
| C1+C2 | View dashboard/nc/documenti mostravano dati vuoti senza cantiere attivo | `ANAS_CSE_html.html` |
| C3 | `renderVerbaliList` non distingueva tipi (Riunione/POS come Sopralluogo) | `verbali-list.js` |
| C4 | Memory leak `URL.createObjectURL` senza revoke nelle foto NC | `foto.js` |
| C5 | Form nuovo-verbale senza data pre-compilata | `ANAS_CSE_html.html` |
| I1 | `rimuoviLavoratore` eliminava senza conferma | `lavoratori.js` |
| I2 | Nessun bottone "Elimina impresa" nella scheda | `imprese-list.js` |
| I3 | Dashboard cantiere senza loading state | `dashboard-cantiere.html` |
| I4 | `tryLoadDatabaseJsonFromDataFolder` saveItem in loop (lento) | `storage.js` |
| I5 | `MutationObserver` su tutto il DOM senza filtri | `smart-memory.js` |
| X2 | Typo `apriSalvaggioVerificaPOS` → `apriSalvataggioVerificaPOS` | `verbali-pos.js` |
| S1 | `verbali` sopralluogo senza campo `tipo` esplicito | `verbali.js` |

### v1.2 → v1.3

| Bug | Fix |
|-----|-----|
| Crash DB alla prima apertura | Store `foto` spostato in `db.js` v6 |
| `imprese_cantieri` mancante | Store aggiunto in `db.js` |
| `TypeError` al load di `documenti.js` | Wrapped in `DOMContentLoaded` |
| Loop di alert prima della navigazione | Override pulito in `navigation.js` |
| Race condition su `enterProject` | Override unico in `navigation.js` |
| `prompt()` per creare cantieri | Modal accessibile con validazione |

---

## 💾 Gestione dati USB

1. **Avvio**: fetch automatico di `./data/database.json`
2. **Import manuale**: **Carica da USB** → seleziona `database.json`
3. **Export**: **Salva su USB** → scarica `database.json`
4. **FSAPI**: su Chrome → scrittura diretta al file system

---

## 📊 Metriche codebase v1.5

- **37 file JavaScript** (tutti sintatticamente validi)
- **6 file HTML** (tutti ben formati)
- **1 file CSS** dedicato animazioni
- **10 store IndexedDB**
- **12 scorciatoie tastiera**
- **39 asset** cacheable nel Service Worker
- **100%** bottoni con aria-label (WCAG 2.1)

---

## 📞 Contatti

**Geom. Dogano Casella**
Coordinatore Sicurezza in Esecuzione (CSE) — ANAS SpA
S.S. 106 Jonica + A2 Autostrada del Mediterraneo · Calabria
