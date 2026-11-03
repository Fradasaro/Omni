/* ==========================================================================
   LETTURA ETICHETTA: foto della tabella nutrizionale → valori per 100 g.
   Riconoscimento del testo con Tesseract (incluso nell'app, lingua italiana),
   tutto sul dispositivo: la foto non viene inviata a nessuno.
   Il lettore (~6 MB) si scarica solo la prima volta che serve.
   ========================================================================== */
'use strict';

const OCR_DIR = 'js/vendor/tesseract/';
let _ocrWorker = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Script non caricato: ' + src));
    document.head.appendChild(s);
  });
}

/* Percorsi assoluti: il worker risolve quelli relativi rispetto a sé stesso. */
async function ocrWorker() {
  if (!_ocrWorker) {
    _ocrWorker = (async () => {
      if (!window.Tesseract) await loadScript(OCR_DIR + 'tesseract.min.js');
      const base = new URL(OCR_DIR, location.href).href;
      return Tesseract.createWorker('ita', 1, {
        workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''),
        gzip: true, cacheMethod: 'none', workerBlobURL: false
      });
    })().catch(e => { _ocrWorker = null; throw e; });
  }
  return _ocrWorker;
}

/* Ridimensiona, porta in scala di grigi e aumenta il contrasto: il testo
   piccolo delle etichette si legge molto meglio. */
async function prepareLabelImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Immagine non leggibile'));
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const mean = sum / (px.length / 4);
    /* Etichette scure con testo chiaro (come molte confezioni): si invertono. */
    const invert = mean < 110;
    for (let i = 0; i < px.length; i += 4) {
      let y = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      if (invert) y = 255 - y;
      y = clamp((y - 128) * 1.6 + 128, 0, 255);
      px[i] = px[i + 1] = px[i + 2] = y;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

async function readLabelPhoto(file, onStatus = () => {}) {
  onStatus(_ocrWorker ? 'Leggo l’etichetta…' : 'Preparo il lettore (solo la prima volta, circa 6 MB)…');
  const worker = await ocrWorker();
  onStatus('Leggo l’etichetta…');
  const canvas = await prepareLabelImage(file);
  const { data } = await worker.recognize(canvas);
  return Object.assign(parseNutritionText(data.text || ''), { text: data.text || '' });
}

/* Dal testo riconosciuto ai valori per 100 g. Prende il primo numero dopo
   ogni voce: nelle tabelle a due colonne il primo è quello per 100 g. */
function parseNutritionText(raw) {
  const t = String(raw).toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*[,.]\s*(\d)/g, '$1.$2')          // 5,2 → 5.2
    .replace(/(\d)\s+(?=\d{3}\b)/g, '$1');            // "1 969" → "1969"
  const N = '(<\\s*)?(\\d{1,3}(?:\\.\\d{1,2})?)';
  const grab = (re, skip) => {
    for (const m of t.matchAll(re)) {
      if (skip && skip.test(t.slice(Math.max(0, m.index - 12), m.index))) continue;
      const v = parseFloat(m[2]);
      if (Number.isFinite(v)) return v;
    }
    return null;
  };
  const p = grab(new RegExp(`(?:proteine|protein[ei]?)[^0-9<]{0,14}${N}\\s*g`, 'g'));
  const c = grab(new RegExp(`(?:carboidrati|carbohydrates?)[^0-9<]{0,14}${N}\\s*g`, 'g'));
  /* Mai i "grassi saturi": l'OCR spesso storpia "acidi", quindi si guarda anche dopo. */
  const g = grab(new RegExp(`(?:grassi|\\bfat)(?!\\s*sat)[^0-9<]{0,14}${N}\\s*g`, 'g'), /acidi\s*$|di cui\s*$/);
  let kcal = null;
  const kc = t.match(/(\d{1,4}(?:\.\d)?)\s*kcal/) || t.match(/kcal[^0-9]{0,6}(\d{1,4}(?:\.\d)?)/);
  if (kc) kcal = parseFloat(kc[1]);
  if (kcal == null) {
    const kj = t.match(/(\d{2,4}(?:\.\d)?)\s*kj/);
    if (kj) kcal = Math.round(parseFloat(kj[1]) / 4.184);
  }
  const ok = v => v != null && v >= 0 && v <= 100;
  const out = {
    p: ok(p) ? p : null, c: ok(c) ? c : null, g: ok(g) ? g : null,
    kcal: kcal != null && kcal >= 0 && kcal <= 950 ? kcal : null, estimated: null
  };
  /* Se manca un solo macro ma ci sono le calorie, si ricava dagli altri (da confermare). */
  const missing = ['p', 'c', 'g'].filter(k => out[k] == null);
  if (out.kcal != null && missing.length === 1) {
    const k = missing[0], perG = k === 'g' ? 9 : 4;
    const rest = out.kcal - ['p', 'c', 'g'].filter(x => x !== k).reduce((s, x) => s + out[x] * (x === 'g' ? 9 : 4), 0);
    const v = Math.round(rest / perG * 10) / 10;
    if (v >= 0 && v <= 100) { out[k] = v; out.estimated = k; }
  }
  return out;
}

/* Calorie dichiarate e macro devono tornare (4·4·9 kcal/g, con margine per fibre e polioli). */
function macroMismatch(kcal, p, c, g) {
  if (!kcal) return null;
  const est = p * 4 + c * 4 + g * 9;
  const diff = kcal - est;
  return Math.abs(diff) > Math.max(25, kcal * 0.12) ? { est: Math.round(est), diff: Math.round(diff) } : null;
}
