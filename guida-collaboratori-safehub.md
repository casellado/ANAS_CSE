# Guida alla Collaborazione Multi-Utente (OneDrive)
## ANAS SafeHub — Suite CSE

Questa guida spiega come condividere i dati dei cantieri con i colleghi ispettori e assistenti CSE utilizzando lo spazio **OneDrive aziendale**.

---

### 💡 Il concetto base
SafeHub salva i dati nel tuo browser (PC o Tablet). Per far sì che un collega veda quello che hai fatto tu, devi "esportare" un file del cantiere e metterlo in una cartella condivisa.

### 1. Preparazione (Solo la prima volta)
1. Apri il tuo **OneDrive aziendale** (Microsoft 365).
2. Crea una nuova cartella, ad esempio: `CANTIERE_SS106_SafeHub`.
3. Clicca su **Condividi** e inserisci l'indirizzo email dei tuoi colleghi assistenti/CSE.
4. Assicurati che abbiano i permessi di **modifica**.

### 2. Esportazione Dati (Chi ha fatto l'ispezione)
Dopo aver inserito verbali o NC su SafeHub:
1. Vai nella sezione **Impostazioni** o **Backup** di SafeHub.
2. Clicca su **Esporta Database (JSON)**.
3. Salva il file scaricato nella cartella condivisa su OneDrive creata al punto 1.
   * *Consiglio: Rinomina il file con la data, es: `safehub_backup_2026_05_09.json`.*

### 3. Importazione Dati (Il collega che riceve)
Il collega che deve vedere gli aggiornamenti:
1. Apre SafeHub sul suo dispositivo.
2. Va in **Impostazioni** -> **Importa Database (JSON)**.
3. Seleziona l'ultimo file presente nella cartella condivisa su OneDrive.
4. **Fatto!** Ora ha tutti i cantieri, i verbali e le NC aggiornate.

---

### ⚠️ Regole d'oro per evitare errori
1. **Uno alla volta**: Non modificate lo stesso cantiere nello stesso identico momento. SafeHub avvisa se stai per sovrascrivere dati più recenti, ma è meglio coordinarsi.
2. **File Unico**: Il file JSON contiene *tutti* i tuoi cantieri. Quando il tuo collega lo importa, vedrà tutto quello che hai esportato.
3. **Backup**: Questa procedura funge anche da backup. Se perdi il tablet, puoi recuperare tutto dall'ultimo file salvato su OneDrive.

---
*ANAS SafeHub — Innovazione digitale per la sicurezza sul lavoro.*
