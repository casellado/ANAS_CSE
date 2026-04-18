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

// File JS da offuscare: tutti i .js in root, esclusi script di build/SW
const JS_FILES = fs.readdirSync(SRC)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => !['build.js', 'sw.js'].includes(f));

// File HTML da minificare: tutti gli .html in root
const HTML_FILES = fs.readdirSync(SRC)
  .filter((f) => f.endsWith('.html'));

// File statici da copiare invariati
const STATIC_FILES = [
  'manifest.json',
  'sw.js',
  'database.json'
];

// Cartelle da copiare
const STATIC_DIRS = [
  'data',
  'icons'
];

// Altri file statici in root (es. CSS, immagini, PDF, DOCX)
const ROOT_STATIC_EXTENSIONS = ['.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.pdf', '.docx'];

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
  const blocks = [];
  const protect = (source, regex, prefix) =>
    source.replace(regex, (m) => {
      const token = `___${prefix}_${blocks.length}___`;
      blocks.push({ token, value: m });
      return token;
    });

  let safe = html;
  // Proteggi contenuti sensibili: script/style/pre/textarea
  safe = protect(safe, /<script\b[\s\S]*?<\/script>/gi, 'SCRIPT');
  safe = protect(safe, /<style\b[\s\S]*?<\/style>/gi, 'STYLE');
  safe = protect(safe, /<pre\b[\s\S]*?<\/pre>/gi, 'PRE');
  safe = protect(safe, /<textarea\b[\s\S]*?<\/textarea>/gi, 'TEXTAREA');

  safe = safe
    // Rimuovi commenti HTML (ma NON i commenti condizionali IE)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    // Rimuovi spazi multipli
    .replace(/\s{2,}/g, ' ')
    // Rimuovi spazi tra tag HTML
    .replace(/>\s+</g, '><')
    // Trim righe
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  for (const b of blocks) {
    safe = safe.replace(b.token, b.value);
  }
  return safe;
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

  // 6. Copia file statici extra dalla root (css, immagini, allegati)
  log('\n🧩', 'Copia statici root...');
  const rootEntries = fs.readdirSync(SRC, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ROOT_STATIC_EXTENSIONS.includes(ext)) continue;

    const srcFile = path.join(SRC, entry.name);
    const distFile = path.join(DIST, entry.name);
    await fse.copy(srcFile, distFile);
    log('✅', `  ${entry.name}`);
  }

  // 7. Fallback: se manca data/database.json ma esiste database.json in root, crealo in data/
  const distDataDir = path.join(DIST, 'data');
  const distRootDb = path.join(DIST, 'database.json');
  const distDataDb = path.join(distDataDir, 'database.json');
  if (!fs.existsSync(distDataDb) && fs.existsSync(distRootDb)) {
    await fse.ensureDir(distDataDir);
    await fse.copy(distRootDb, distDataDb);
    log('🔁', '  creato data/database.json da database.json');
  }

  // 8. Aggiorna sw.js nella dist — lista cache aggiornata
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

  // 9. Riepilogo
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
