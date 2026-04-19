/**
 * build.js — Pipeline di build ANAS SafeHub
 * Geom. Dogano Casella © 2025 — Tutti i diritti riservati
 *
 * Cosa fa:
 *  1. Crea la cartella dist/
 *  2. Offusca tutti i file JS con javascript-obfuscator
 *  3. Minifica gli HTML rimuovendo commenti e spazi
 *  4. Copia i file statici (JSON, immagini, manifest, sw.js)
 *  5. Inietta il banner di copyright in ogni file
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fse   = require('fs-extra');
const fs    = require('fs');
const path  = require('path');

// ─────────────────────────────────────────────
// CONFIGURAZIONE
// ─────────────────────────────────────────────
const SRC  = path.resolve(__dirname, '.');
const DIST = path.resolve(__dirname, 'dist');

const COPYRIGHT = `/* ANAS SafeHub v1.2 | © ${new Date().getFullYear()} Geom. Dogano Casella | Tutti i diritti riservati | Licenza commerciale richiesta */`;

// File JS da offuscare (in ordine di dipendenza)
const JS_FILES = [
  'db.js',
  'storage.js',
  'ui.js',
  'firma.js',
  'impostazioni.js',
  'foto.js',
  'documenti-indexeddb.js',
  'documenti-preview.js',
  'documenti-collegamento.js',
  'documenti-popup.js',
  'documenti-imprese-lavoratori.js',
  'documenti.js',
  'nc.js',
  'verbali.js',
  'verbali-list.js',
  'imprese-list.js',
  'imprese-assegnazione.js',
  'lavoratori.js',
  'dashboard-cantiere.js',
  'dashboard-docs.js',
  'scadenze-documenti.js',
  'ui-dashboard.js',
  'nc-foto-dashboard.js',
  'export.js',
  'salvataggio.js',
  'email.js',
  'verbali-riunione.js',
  'verbali-pos.js',
  'smart-memory.js',
  'ricerca-normativa.js',
  'navigation.js',
  'app.js',
  'ai-assistente.js',
  'documenti-fondamentali.js',
  'lettera-sospensione.js',
  'ods-inviati.js',
  'ods-ricevuti.js',
  'report-giornaliero.js',
  'salva-file.js',
  'scorciatoie.js'
  // NOTA: sw.js NON va offuscato — il browser lo richiede leggibile per il Service Worker
];

// File HTML da minificare
const HTML_FILES = [
  'index.html',
  'ANAS_CSE_html.html',
  'dashboard-cantiere.html',
  'impresa-dettaglio.html',
  'lavoratore-dettaglio.html',
  'verbale-dettaglio.html'
];

// File statici da copiare invariati
const STATIC_FILES = [
  'manifest.json',
  'sw.js',          // il SW deve restare leggibile per funzionare
  'animazioni.css',
  'mobile.css'
];

// Cartelle da copiare
const STATIC_DIRS = [
  'data',
  'icons'
];

// ─────────────────────────────────────────────
// OPZIONI OBFUSCATOR
// Bilanciamento: protezione alta vs performance
// ─────────────────────────────────────────────
const OBFUSCATOR_OPTIONS = {
  compact:                          true,
  controlFlowFlattening:            true,
  controlFlowFlatteningThreshold:   0.4,   // 0.4 = buon bilanciamento
  deadCodeInjection:                true,
  deadCodeInjectionThreshold:       0.2,
  debugProtection:                  false, // true bloccherebbe DevTools ma rompe PWA
  disableConsoleOutput:             true,  // rimuove tutti i console.log/warn
  identifierNamesGenerator:         'hexadecimal',
  log:                              false,
  numbersToExpressions:             true,
  renameGlobals:                    false, // IMPORTANTE: false perché le funzioni globali
                                           // devono restare raggiungibili tra file diversi
  selfDefending:                    true,  // il codice resiste alla formattazione
  simplify:                         true,
  splitStrings:                     true,
  splitStringsChunkLength:          8,
  stringArray:                      true,
  stringArrayCallsTransform:        true,
  stringArrayEncoding:              ['base64'],
  stringArrayIndexShift:            true,
  stringArrayRotate:                true,
  stringArrayShuffle:               true,
  stringArrayWrappersCount:         2,
  stringArrayWrappersChainedCalls:  true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType:          'function',
  stringArrayThreshold:             0.75,
  transformObjectKeys:              true,
  unicodeEscapeSequence:            false  // false = file più piccoli
};

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

function minifyHTML(html) {
  // ── Strategia: estrarre i blocchi <script> e <style> PRIMA di minificare,
  //    minificare solo l'HTML puro, poi reinserirli intatti.
  //    Questo evita che la compressione degli spazi rompa il JS inline
  //    (es. commenti // che diventano commenti di tutta la riga compressa).

  const placeholders = [];

  // 1. Estrai tutti i blocchi <script ...>...</script> e <style ...>...</style>
  const protectedHtml = html.replace(
    /(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/gi,
    (match) => {
      const idx = placeholders.length;
      placeholders.push(match);
      return `<!--PLACEHOLDER_${idx}-->`;
    }
  );

  // 2. Minifica solo la parte HTML (senza script/style)
  let minified = protectedHtml
    // Rimuovi commenti HTML normali (ma NON i placeholder e NON i commenti condizionali IE)
    .replace(/<!--(?!PLACEHOLDER_|(?:\[if))[\s\S]*?-->/g, '')
    // Rimuovi spazi multipli orizzontali
    .replace(/[ \t]{2,}/g, ' ')
    // Rimuovi spazi e a capo tra tag HTML
    .replace(/>\s+</g, '><')
    // Rimuovi spazi a inizio/fine riga
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();

  // 3. Reinserisci i blocchi script/style protetti
  minified = minified.replace(
    /<!--PLACEHOLDER_(\d+)-->/g,
    (_, idx) => placeholders[parseInt(idx, 10)]
  );

  return minified;
}

// ─────────────────────────────────────────────
// MAIN BUILD
// ─────────────────────────────────────────────
async function build() {
  const start = Date.now();
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║    ANAS SafeHub — Build Pipeline       ║');
  console.log('║    Geom. Dogano Casella © 2025         ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. Pulisci e crea dist/
  log('🗑️', 'Pulizia dist/...');
  await fse.emptyDir(DIST);

  // 2. Offusca JS
  log('🔒', `Offuscazione ${JS_FILES.length} file JS...`);
  let jsOk = 0, jsErr = 0;

  for (const file of JS_FILES) {
    const srcPath  = path.join(SRC, file);
    const distPath = path.join(DIST, file);

    if (!fs.existsSync(srcPath)) {
      log('⚠️', `  SALTATO (non trovato): ${file}`);
      continue;
    }

    try {
      const source    = fs.readFileSync(srcPath, 'utf8');
      const obfResult = JavaScriptObfuscator.obfuscate(source, {
        ...OBFUSCATOR_OPTIONS,
        // Seed fisso per output deterministico (utile per cache browser)
        seed: 42
      });

      const output = COPYRIGHT + '\n' + obfResult.getObfuscatedCode();
      fs.writeFileSync(distPath, output, 'utf8');

      const srcSize  = (source.length  / 1024).toFixed(1);
      const outSize  = (output.length  / 1024).toFixed(1);
      log('✅', `  ${file.padEnd(38)} ${srcSize.padStart(6)}KB → ${outSize.padStart(6)}KB`);
      jsOk++;
    } catch (err) {
      log('❌', `  ERRORE ${file}: ${err.message}`);
      jsErr++;
    }
  }

  // 3. Minifica HTML
  log('\n📄', `Minificazione ${HTML_FILES.length} file HTML...`);

  for (const file of HTML_FILES) {
    const srcPath  = path.join(SRC, file);
    const distPath = path.join(DIST, file);

    if (!fs.existsSync(srcPath)) {
      log('⚠️', `  SALTATO (non trovato): ${file}`);
      continue;
    }

    const source  = fs.readFileSync(srcPath, 'utf8');

    // Aggiungi meta copyright nell'HTML
    const withCopyright = source.replace(
      '<head>',
      `<head>\n<!-- © ${new Date().getFullYear()} Geom. Dogano Casella - Tutti i diritti riservati -->`
    );

    const minified = minifyHTML(withCopyright);
    fs.writeFileSync(distPath, minified, 'utf8');

    const srcSize = (source.length   / 1024).toFixed(1);
    const outSize = (minified.length / 1024).toFixed(1);
    log('✅', `  ${file.padEnd(38)} ${srcSize.padStart(6)}KB → ${outSize.padStart(6)}KB`);
  }

  // 4. Copia file statici
  log('\n📋', 'Copia file statici...');

  for (const file of STATIC_FILES) {
    const srcPath  = path.join(SRC, file);
    const distPath = path.join(DIST, file);

    if (!fs.existsSync(srcPath)) {
      log('⚠️', `  SALTATO (non trovato): ${file}`);
      continue;
    }

    await fse.copy(srcPath, distPath);
    log('✅', `  ${file}`);
  }

  // 5. Copia cartelle statiche
  log('\n📁', 'Copia cartelle...');

  for (const dir of STATIC_DIRS) {
    const srcDir  = path.join(SRC, dir);
    const distDir = path.join(DIST, dir);

    if (!fs.existsSync(srcDir)) {
      log('⚠️', `  SALTATA (non trovata): ${dir}/`);
      continue;
    }

    await fse.copy(srcDir, distDir);
    log('✅', `  ${dir}/`);
  }

  // 6. Aggiorna sw.js nella dist — lista cache aggiornata
  // (il sw.js viene copiato invariato perché deve essere leggibile dal browser)
  const swPath = path.join(DIST, 'sw.js');
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8');
    // Aggiorna il CACHE_NAME con timestamp di build per forzare aggiornamento
    const buildDate = new Date().toISOString().slice(0, 10);
    sw = sw.replace(
      /const CACHE_NAME\s*=\s*'[^']+'/,
      `const CACHE_NAME = 'anas-safehub-${buildDate}'`
    );
    fs.writeFileSync(swPath, sw, 'utf8');
    log('🔄', `  sw.js aggiornato con cache: anas-safehub-${buildDate}`);
  }

  // 7. Riepilogo
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const distFiles = fs.readdirSync(DIST);

  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  ✅ Build completata in ${elapsed}s`.padEnd(42) + '║');
  console.log(`║  📦 File in dist/: ${distFiles.length}`.padEnd(42) + '║');
  console.log(`║  ❌ Errori JS: ${jsErr}`.padEnd(42) + '║');
  console.log('╚════════════════════════════════════════╝\n');

  if (jsErr > 0) {
    process.exit(1);
  }
}

build().catch(err => {
  console.error('\n❌ Build fallita:', err);
  process.exit(1);
});
