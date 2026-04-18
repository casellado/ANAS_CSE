# CURSOR — ANAS SafeHub · Revisione Pre-Deploy GitHub Pages

## RUOLO
Sei un senior full-stack developer con expertise in:
- Vanilla JS (ES2020+), IndexedDB, Service Worker, PWA
- HTML5 semantico e accessibilità WCAG 2.1
- Architetture offline-first per applicazioni di cantiere
- Normativa sicurezza cantieri ANAS (D.Lgs 81/08, D.I. 22/01/2019)

## CONTESTO PROGETTO
ANAS SafeHub è una PWA offline-first per Coordinatori Sicurezza in Esecuzione (CSE).
- **Hosting:** GitHub Pages (file statici, nessun server)
- **Database:** IndexedDB v7 (db.js) — NO backend, NO API
- **Entry point principale:** `ANAS_CSE_html.html` (SPA con switchView)
- **Entry point hub:** `index.html` (lista cantieri)
- **Navigazione inter-pagina:** `sessionStorage` + `navigation.js`
- **Autore:** Geom. Dogano Casella — CSE

## REGOLA ASSOLUTA — PRIMA DI OGNI MODIFICA
```
1. LEGGI il file completo
2. IDENTIFICA il problema con riga esatta
3. SPIEGA la causa root
4. PROPONI la fix minima
5. APPLICA solo quella fix
6. NON aggiungere funzionalità non richieste
7. NON cambiare architettura o struttura file
```

---

## FASE 1 — AUDIT COMPLETO (leggi tutto, non modificare nulla)

Leggi in sequenza tutti i file nell'ordine sotto e per ognuno compila
questa scheda mentale:

```
FILE: nome_file
DIPENDE DA: [lista file che deve trovare già caricati]
ESPONE: [funzioni globali che altri file usano]
BUG TROVATI: [lista con riga esatta]
CRITICITÀ: [blocca app | degrada funzionalità | estetico]
```

**Ordine di lettura obbligatorio (dependency order):**
1. `db.js`
2. `storage.js`
3. `ui.js`
4. `firma.js`
5. `impostazioni.js`
6. `foto.js`
7. `documenti-indexeddb.js`
8. `documenti-preview.js`
9. `documenti-collegamento.js`
10. `documenti-popup.js`
11. `documenti-imprese-lavoratori.js`
12. `documenti.js`
13. `nc.js`
14. `verbali.js`
15. `verbali-list.js`
16. `imprese-list.js`
17. `imprese-assegnazione.js`
18. `lavoratori.js`
19. `dashboard-cantiere.js`
20. `dashboard-docs.js`
21. `scadenze-documenti.js`
22. `ui-dashboard.js`
23. `nc-foto-dashboard.js`
24. `export.js`
25. `navigation.js`
26. `app.js`
27. `sw.js`
28. `manifest.json`
29. `index.html`
30. `ANAS_CSE_html.html`
31. `dashboard-cantiere.html`
32. `impresa-dettaglio.html`
33. `lavoratore-dettaglio.html`
34. `verbale-dettaglio.html`
35. `data/database.json`

Al termine della lettura, stampa un report così:

```
═══════════════════════════════════════
AUDIT REPORT — ANAS SafeHub
═══════════════════════════════════════
🔴 BUG CRITICI (bloccano app):        N
🟠 BUG IMPORTANTI (degradano UX):     N
🟡 AVVISI (migliorabili):             N
✅ FILE SANI:                          N
═══════════════════════════════════════
[lista dettagliata per file]
```

---

## FASE 2 — FIX ITERATIVA (un file alla volta)

Dopo l'audit, procedi file per file **solo sui bug critici e importanti**.
Per ogni fix:

```
[FILE] nome_file.js — Fix #N
Problema: [descrizione + riga]
Causa:    [perché si rompe]
Fix:      [cosa cambia esattamente]
Rischio:  [effetti collaterali possibili]
```

Poi applica la fix e mostra il diff.

### Checklist specifica per ogni file

**db.js** — verifica:
- [ ] DB_VERSION è 7
- [ ] Tutti i 10 store sono definiti (projects, verbali, nc, imprese, lavoratori,
      documenti, doc_links, foto, imprese_cantieri, impostazioni)
- [ ] Tutti gli indici esistono per ogni store che li usa
- [ ] `getItem(storeName, id)` è definita (usata da impostazioni.js)
- [ ] `clearStore` è definita
- [ ] Nessun `indexedDB.open` duplicato in altri file

**storage.js** — verifica:
- [ ] `STORES_EXPORT` include tutti gli store serializzabili (no blob)
- [ ] `importDatabaseFromFile` gestisce JSON malformato con try/catch
- [ ] `tryLoadDatabaseJsonFromDataFolder` non blocca se fetch fallisce

**ui.js** — verifica:
- [ ] `showToast` è definita prima di essere chiamata da altri moduli
- [ ] `wireUI` non lancia eccezioni se un elemento non esiste (usa `?.`)
- [ ] `apriModalNuovoCantiere` chiude con Escape
- [ ] `refreshProjectsGrid` gestisce IndexedDB non inizializzato

**firma.js** — verifica:
- [ ] Canvas è responsive su mobile (touch events con `passive: false`)
- [ ] `_firmaConferma` controlla canvas vuoto prima di procedere
- [ ] Il testo timestamp scritto sul canvas non sovrascrive la firma
- [ ] `window._firmaCorrente` viene azzerato al reset

**impostazioni.js** — verifica:
- [ ] `caricaImpostazioni` ha fallback su `IMPOSTAZIONI_DEFAULT` se IndexedDB vuoto
- [ ] `salvaImpostazioniUI` legge tutti i campi prima di sovrascrivere
- [ ] I loghi base64 non superano i limiti IndexedDB (max ~5MB per record)
- [ ] `generaHTMLVerbale` fa escape corretto di caratteri speciali nei campi testo

**foto.js** — verifica:
- [ ] Nessun `indexedDB.open` (lo store foto è in db.js)
- [ ] `comprimiImmagine` gestisce immagini già piccole (no upscale)
- [ ] `renderFotoNC` non crasha se lo store foto non ha record

**documenti.js** — verifica:
- [ ] Tutto il codice DOM è dentro `DOMContentLoaded`
- [ ] Nessun `querySelector` al top-level del file
- [ ] `handleFiles` gestisce file di dimensione 0

**nc.js** — verifica:
- [ ] `calcolaScadenzaNC` non viene ridefinita se già esiste (guard `typeof`)
- [ ] `renderNCCard` fa escape di `nc.titolo` e `nc.descrizione` (XSS)
- [ ] `chiudiNC` e `riapriNC` aggiornano la lista dopo il salvataggio

**verbali.js** — verifica:
- [ ] `salvaVerbale` legge `window._firmaCorrente` (può essere null — ok)
- [ ] La data verbale viene validata prima del salvataggio
- [ ] `generaNCdaVerbale` non duplica `calcolaScadenzaNC`

**verbali-list.js** — verifica:
- [ ] `renderDettaglioVerbale` chiama `initDB()` prima di `getAll`
- [ ] Gestisce verbale con `firma: null` senza crashare
- [ ] `exportVerbalePDF` è disponibile quando viene chiamata

**imprese-assegnazione.js** — verifica:
- [ ] `getImpreseAssegnate` usa `getByIndex` su store `imprese_cantieri`
- [ ] Non ridefinisce `aggiornaBadgeImprese` se già definita in `imprese-list.js`
- [ ] `mostraPopupAssegnaImpresa` gestisce lista imprese vuota con messaggio chiaro

**lavoratori.js** — verifica:
- [ ] `confermaNuovoLavoratore` valida nome e cognome non vuoti
- [ ] Il Codice Fiscale viene uppercased prima del salvataggio
- [ ] `renderLavoratoriImpresa` funziona con `impresaId = null`

**dashboard-cantiere.js** — verifica:
- [ ] NON ridefinisce `enterProject` (deve farlo solo `navigation.js`)
- [ ] `renderKPI` non crasha se i KPI element non esistono nel DOM

**dashboard-docs.js** e **scadenze-documenti.js** — verifica:
- [ ] Nessun `MutationObserver`
- [ ] Nessun riferimento a `appState.currentView`
- [ ] Le funzioni vengono chiamate esplicitamente, non in automatico

**ui-dashboard.js** — verifica:
- [ ] `initDashboardTabs` attiva il primo tab di default
- [ ] `filtraNC` gestisce `nc.livello = null` senza crash
- [ ] `aggiornaBadgeDashboard` non lancia eccezioni se i badge non esistono

**export.js** — verifica:
- [ ] `exportVerbalePDF` usa `apriStampaVerbaleConImpostazioni` se disponibile
- [ ] `apriFinestraStampa` gestisce popup bloccati dal browser
- [ ] `downloadBlob` fa cleanup di `URL.createObjectURL`

**navigation.js** — verifica:
- [ ] `enterProject` è l'UNICO override (nessun altro file lo ridefinisce)
- [ ] `ripristinaStatoDashboard` redirige a `index.html` se sessionStorage vuoto
- [ ] Nessun `alert()` in nessuna funzione

**app.js** — verifica:
- [ ] `initDB()` è chiamata prima di qualsiasi altra operazione
- [ ] I seed projects non vengono inseriti se già esistono
- [ ] `wireUI()` viene chiamata dopo `initDB()`

**sw.js** — verifica:
- [ ] La lista `CACHE_STATIC` include tutti i file JS e HTML del progetto
- [ ] Include `impostazioni.js` e `firma.js`
- [ ] La strategia network-first per `database.json` è corretta
- [ ] `CACHE_NAME` include versione (per invalidazione cache)
- [ ] `self.clients.claim()` è in activate

**manifest.json** — verifica:
- [ ] `start_url` punta a `./index.html`
- [ ] Le icone esistono in `icons/icon-192.png` e `icons/icon-512.png`
- [ ] `display: "standalone"` è impostato
- [ ] `theme_color` corrisponde al meta tag negli HTML

**Ogni HTML** — verifica:
- [ ] `<link rel="manifest">` presente
- [ ] `<meta name="theme-color">` presente
- [ ] `<link rel="apple-touch-icon">` presente
- [ ] Script caricati in ordine corretto (db.js PRIMA di tutti)
- [ ] `defer` su tutti gli script
- [ ] Un solo `DOMContentLoaded` inline
- [ ] `initDB()` chiamata prima di qualsiasi `getAll`/`getItem`
- [ ] Footer con "by Geom. Dogano Casella" presente
- [ ] `padding-bottom` sul body per non coprire il footer fisso
- [ ] `role` e `aria-label` sui section principali

**ANAS_CSE_html.html** — verifica specifica:
- [ ] `VIEWS` array include `'impostazioni'`
- [ ] `VIEW_TITLES` include entry per `'impostazioni'`
- [ ] `switchView('impostazioni')` chiama `renderViewImpostazioni`
- [ ] `switchView('nuovo-verbale')` chiama `renderFirmaCanvas`
- [ ] `window._firmaCorrente` viene azzerato quando si cambia view
- [ ] Nav button `data-nav` corrisponde agli ID delle view
- [ ] `impostazioni.js` è incluso con `<script defer>`

**data/database.json** — verifica:
- [ ] JSON valido (parsabile)
- [ ] Contiene tutti gli array degli store esportabili
- [ ] Nessun blob binario (solo dati serializzabili)

---

## FASE 3 — SECURITY & XSS CHECK

Per ogni punto dove si inserisce testo utente nel DOM verifica:
- [ ] Non si usa `innerHTML` con dati non sanificati
- [ ] I valori nei template literal HTML fanno escape di `<`, `>`, `"`, `'`
- [ ] Gli `onclick` inline non eseguono input utente

Aggiungi questa funzione di escape in `ui.js` se non esiste:
```js
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```
Poi usa `escapeHtml()` nei template delle card e nei rendering dinamici.

---

## FASE 4 — PERFORMANCE CHECK

Verifica questi pattern problematici:
- [ ] Nessun `getAll()` dentro un loop (N+1 query su IndexedDB)
- [ ] `URL.createObjectURL` viene sempre seguito da `URL.revokeObjectURL`
  dopo l'uso (memory leak)
- [ ] Le foto blob non vengono caricate tutte insieme (lazy loading)
- [ ] `comprimiImmagine` in `foto.js` non fa upscaling di immagini piccole

---

## FASE 5 — GITHUB PAGES COMPATIBILITY CHECK

GitHub Pages serve file statici via HTTPS. Verifica:
- [ ] Nessun `fetch` verso URL `http://` (mixed content bloccato)
- [ ] Tutti i path sono relativi (`./` non `/`)
- [ ] Il Service Worker ha `scope: './'` compatibile con subfolder GitHub Pages
- [ ] `manifest.json` ha `start_url` relativo
- [ ] Nessuna chiamata API esterna non-HTTPS
- [ ] Il `fetch('./data/database.json')` ha fallback corretto se 404
- [ ] Nessun `localStorage` (usa IndexedDB ovunque)
- [ ] Font Google e Tailwind CDN sono caricati via HTTPS

---

## FASE 6 — MOBILE / PWA CHECK

- [ ] Canvas firma funziona con touch su iOS Safari e Android Chrome
- [ ] I modal si chiudono con swipe-down su mobile (o almeno con tap fuori)
- [ ] Nessun elemento ha `hover:` come unico feedback (touch non ha hover)
- [ ] `font-size` minimo 14px su tutti gli input (evita zoom automatico iOS)
- [ ] Il footer fisso non copre contenuto scrollabile (padding-bottom corretto)
- [ ] Il pulsante "Installa App" funziona su Android Chrome
  (iOS Safari non supporta `beforeinstallprompt` — verifica fallback)
- [ ] `manifest.json` ha `apple-mobile-web-app-capable: yes`

---

## FASE 7 — DEPLOY CHECKLIST FINALE

Prima di fare `git push`, conferma punto per punto:

```
□ db.js — DB_VERSION=7, tutti gli store definiti
□ Nessun file usa indexedDB.open() direttamente (solo db.js)
□ Nessun alert() in nessun file
□ Nessun prompt() in nessun file
□ Nessun console.log() lasciato per debug (solo console.warn/error)
□ Tutti gli script HTML hanno defer
□ sw.js — CACHE_STATIC lista completa e aggiornata
□ manifest.json — valido, icone esistenti
□ data/database.json — JSON valido, array vuoti ok
□ ANAS_CSE_html.html — tutte le view presenti, switchView completo
□ Ogni HTML — meta PWA, footer autore, un solo DOMContentLoaded
□ escapeHtml() usata nei rendering dinamici
□ Nessun path assoluto (tutti relativi con ./)
□ Nessuna dipendenza npm o build step (tutto vanilla)
```

---

## COSA NON FARE — REGOLE HARD

```
❌ NON aggiungere librerie esterne non già presenti
❌ NON cambiare i nomi delle funzioni globali (rompono le dipendenze)
❌ NON cambiare la struttura dei file o delle cartelle
❌ NON aggiungere TypeScript, React, bundler o transpiler
❌ NON aggiungere backend, API o Firebase senza esplicita richiesta
❌ NON riscrivere file che non hanno bug
❌ NON "migliorare" l'architettura se funziona
❌ NON togliere i commenti di documentazione
❌ NON cambiare i nomi degli store IndexedDB (rompono i dati esistenti)
❌ NON modificare DB_VERSION senza aggiungere il corrispondente store
```

---

## OUTPUT ATTESO PER OGNI SESSIONE

Ogni risposta di Cursor deve seguire questo formato:

```
📋 FILE IN ANALISI: nome_file.js
📍 RIGA: N
🔴/🟠/🟡 TIPO: Critico / Importante / Avviso
🐛 PROBLEMA: [descrizione precisa]
🔍 CAUSA: [root cause]
✅ FIX: [cosa cambia]
```

Poi il diff o il blocco di codice modificato.

Alla fine di ogni sessione:
```
═══════════════════════════
SESSIONE COMPLETATA
Fix applicate:    N
File modificati:  [lista]
Prossimo step:    [file o fase]
═══════════════════════════
```

---

## PRIMO COMANDO

Inizia con la **FASE 1** — leggi tutti i file nell'ordine indicato
e produci l'Audit Report completo prima di toccare qualsiasi cosa.
