# CSE SafeHub

**Suite gestionale per Coordinatori della Sicurezza in Esecuzione (CSE)**
Progressive Web App per la gestione documentale dei cantieri ai sensi del D.Lgs 81/08.

> Sviluppato autonomamente da **Geom. Dogano Casella**, professionista tecnico e specialista in sicurezza dei cantieri temporanei o mobili.

---

## 🎯 Cos'è CSE SafeHub

CSE SafeHub è una PWA (Progressive Web App) che aiuta il CSE a gestire l'intero
ciclo documentale del cantiere in conformità al D.Lgs 81/08 - Titolo IV:

- 📋 Verbali di sopralluogo, riunioni di coordinamento, verifica POS
- ⚠️ Non Conformità con scadenze automatiche per livello di gravità
- 📝 Lettere di sospensione lavori (art. 92 c.1 lett. f)
- 📅 Diario giornaliero CSE (art. 92 c.1 lett. a)
- 📁 Archivio documenti fondamentali (PSC, POS, DURC, Nomine)
- 🚜 Tracciamento mezzi e attrezzature (art. 71 + art. 92)
- ☁️ Archivio condiviso OneDrive multi-utente
- 📱 Funziona offline, su PC, tablet e telefono

## 🏗️ Architettura

- **Vanilla JavaScript** (zero build step, zero dipendenze npm)
- **IndexedDB** per persistenza locale
- **Service Worker** per funzionalità offline
- **OneDrive** per condivisione dati tra colleghi
- **GitHub Pages** per distribuzione

Filosofia: massima semplicità tecnica, manutenibilità da una persona sola,
zero dipendenze fragili.

## 📊 Impatto e Valore Aggiunto

L'adozione di CSE SafeHub nel flusso di lavoro del CSE porta benefici misurabili in termini di efficienza e sicurezza giuridica:

- **Efficienza Temporale**: Riduzione del **70% del tempo** di redazione verbali grazie all'inserimento dati in cantiere e alla generazione istantanea del PDF/Word.
- **Compliance Normativa**: Azzeramento degli errori formali nel calcolo delle scadenze delle Non Conformità (es. automatismo NC Gravissima -> 24h).
- **Continuità Operativa**: Funzionamento garantito al **100% offline**, essenziale per ispezioni in gallerie, trincee o zone montane prive di segnale.
- **Standardizzazione**: Produzione di output documentali uniformi, professionali e conformi agli standard di settore.
- **Costi**: Implementazione a **costo zero**, senza necessità di licenze, infrastrutture server o formazione IT specifica.

## ✨ Supporto alla Redazione con AI

CSE SafeHub include un modulo di assistenza intelligente che permette di trasformare note di cantiere rapide in verbali formali e professionali. L'AI funge da "copilota" per migliorare la qualità del linguaggio tecnico-giuridico, garantendo al contempo la massima riservatezza: l'utente mantiene il controllo totale sui dati, decidendo cosa elaborare per la redazione finale.

## 🚀 Come usarla

L'applicazione è pubblicata su:
**https://casellado.github.io/ANAS_CSE/**

Per una guida completa all'uso e alla configurazione:
👉 **[Leggi il Manuale d'Uso](./MANUALE.md)**

## 📜 Origine e finalità del progetto

CSE SafeHub nasce dall'esigenza professionale di velocizzare e standardizzare
il flusso documentale del Coordinatore della Sicurezza in Esecuzione,
riducendo il tempo richiesto dalla formalizzazione di verbali, Non
Conformità, Ordini di Servizio e comunicazioni formali che, con strumenti
generici come Word ed Excel, comporta una significativa quota di lavoro
ripetitivo.

Il software è opera personale dell'autore, sviluppata integralmente al di fuori
di contesti lavorativi istituzionali e con strumentazione informatica propria.

L'obiettivo è fornire uno strumento operativo quotidiano per i CSE, una soluzione
semplice, gratuita e priva di vincoli commerciali, conforme al D.Lgs 81/08.

## 📄 Licenza

Distribuito con licenza **MIT** — vedi file [LICENSE](./LICENSE).

L'utilizzo è libero, gratuito, e copiabile. La paternità autoriale resta
del Geom. Dogano Casella, come da timestamp pubblici dei commit di questo
repository.

## 🤝 Contributi

Chi voglia segnalare bug, suggerire migliorie o contribuire al codice può
aprire una Issue o una Pull Request.

I CSE colleghi che desiderano usare CSE SafeHub nei propri cantieri possono
farlo liberamente.

## 📞 Contatti

**Geom. Dogano Casella**
https://github.com/casellado/ANAS_CSE

---

*CSE SafeHub · by Geom. Dogano Casella*
