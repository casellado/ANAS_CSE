# GUIDA SETUP — Deploy Protetto ANAS SafeHub

## Architettura finale

```
[Repo PRIVATO: anas-safehub-source]   ← solo tu lo vedi
         │ sorgente leggibile
         │ npm run build → offusca tutto
         │ GitHub Actions automatico
         ↓
[Repo PUBBLICO: anas-safehub-pages]   ← tutti vedono solo questo
         │ solo codice offuscato/minificato
         │ nessun commento, nomi variabili in hex
         ↓
[GitHub Pages]
         https://tuousername.github.io/anas-safehub-pages/
```

---

## STEP 1 — Crea i due repository GitHub

### Repo privato (sorgente)
1. Vai su github.com → New repository
2. Nome: `anas-safehub-source`
3. **Visibility: Private** ← fondamentale
4. Non inizializzare con README

### Repo pubblico (pages)
1. Vai su github.com → New repository
2. Nome: `anas-safehub-pages`
3. **Visibility: Public** ← deve essere pubblico per Pages gratuito
4. Non inizializzare con README

---

## STEP 2 — Personal Access Token

1. GitHub → Settings (tuo profilo) → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. Nome: `ANAS_DEPLOY_TOKEN`
5. Scadenza: No expiration (oppure 1 anno)
6. Permessi: spunta **repo** (tutte le sotto-opzioni)
7. Copia il token — lo vedrai solo una volta

---

## STEP 3 — Aggiungi il secret al repo privato

1. Vai sul repo `anas-safehub-source`
2. Settings → Secrets and variables → Actions
3. New repository secret
4. Nome: `DEPLOY_TOKEN`
5. Value: incolla il token copiato prima
6. Add secret

---

## STEP 4 — Modifica deploy.yml

Apri `.github/workflows/deploy.yml` e modifica:

```yaml
env:
  PAGES_REPO: 'TUO_USERNAME/anas-safehub-pages'  # ← metti il tuo username
```

E alla fine del file:
```yaml
echo "🌐 URL: https://TUO_USERNAME.github.io/anas-safehub-pages/"
```

---

## STEP 5 — Primo push del sorgente

```bash
# Nella cartella del progetto
git init
git add .
git commit -m "Initial commit - ANAS SafeHub v1.2"
git branch -M main
git remote add origin https://github.com/TUO_USERNAME/anas-safehub-source.git
git push -u origin main
```

Il push triggera automaticamente GitHub Actions che:
1. Installa le dipendenze npm
2. Esegue `npm run build` (offusca tutto)
3. Fa push del dist/ sul repo pubblico
4. Attiva GitHub Pages

---

## STEP 6 — Abilita GitHub Pages sul repo pubblico

1. Vai su `anas-safehub-pages`
2. Settings → Pages
3. Source: **Deploy from a branch**
4. Branch: `gh-pages` / `/ (root)`
5. Save

Dopo ~60 secondi l'app è live su:
`https://TUO_USERNAME.github.io/anas-safehub-pages/`

---

## STEP 7 — Verifica che funzioni

1. Apri l'URL GitHub Pages
2. Tasto destro → Visualizza sorgente
3. Dovresti vedere qualcosa tipo:
```js
/* ANAS SafeHub v1.2 | © 2025 Geom. Dogano Casella | Tutti i diritti riservati */
var _0x1a2b=['0x3f','base64',...];(function(_0x4c5d,...
```
   Invece del codice leggibile originale ✅

---

## Come aggiornare il software

Ogni volta che modifichi un file sorgente:

```bash
git add .
git commit -m "Fix: descrizione della modifica"
git push
```

GitHub Actions fa tutto in automatico in ~2 minuti.

---

## Build locale (per test)

```bash
# Prima volta
npm install

# Genera dist/ offuscata
npm run build

# Test in locale (apri dist/index.html)
cd dist
python -m http.server 8080
# Apri http://localhost:8080
```

---

## Cosa viene offuscato vs cosa no

| File | Trattamento |
|------|-------------|
| `.js` (tutti) | Offuscati con javascript-obfuscator |
| `.html` (tutti) | Minificati, commenti rimossi |
| `sw.js` | Copiato invariato (il browser lo richiede leggibile) |
| `manifest.json` | Copiato invariato |
| `data/database.json` | Copiato invariato |
| `icons/*.png` | Copiati invariati |

---

## Quanto è difficile copiare il codice offuscato?

**Prima (sorgente leggibile):**
```js
function renderNCCard(nc) {
  const livello = nc.livello || 'media';
  // ... logica chiara e comprensibile
}
```

**Dopo (offuscato):**
```js
/* ANAS SafeHub v1.2 | © 2025 Geom. Dogano Casella */
const _0x3f2a=['0x1b','c3Rl','c3RhdG8','YXBlcnRh'];
(function(_0x4b2c,_0x1a3d){const _0x5e2f=function(_0x3a1b)
{while(--_0x3a1b){_0x4b2c['push'](_0x4b2c['shift']());}};
_0x5e2f(++_0x1a3d);}(_0x3f2a,0x1b4));
```

Un developer esperto con settimane di lavoro potrebbe parzialmente
ricostruire la logica — ma non otterrebbe mai il sorgente originale.
Per un uso commerciale è protezione più che sufficiente.

---

## Dominio personalizzato (opzionale)

Per usare `app.tuodominio.it` invece del link GitHub:

1. Acquista il dominio (Aruba, Register.it, Namecheap)
2. Nel repo pubblico → Settings → Pages → Custom domain
3. Inserisci: `app.tuodominio.it`
4. Nel tuo DNS provider aggiungi un CNAME:
   ```
   app  →  TUO_USERNAME.github.io
   ```
5. Spunta "Enforce HTTPS"

---

*Geom. Dogano Casella — ANAS SafeHub © 2025*
