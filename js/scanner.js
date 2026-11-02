/* ==========================================================================
   SCANNER: codice a barre → alimento, tramite Open Food Facts.
   - Fotocamera ovunque: BarcodeDetector del browser dove c'è (Chrome/Android),
     altrimenti la libreria ZXing inclusa nell'app (Safari/iPhone), caricata
     solo all'apertura dello scanner. Ultima risorsa: le cifre a mano.
   - Si invia a Open Food Facts solo il numero del codice a barre,
     mai dati personali. Il prodotto diventa un alimento "Mio" con il suo
     codice: la seconda volta si trova subito, anche offline.
   ========================================================================== */
'use strict';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const canScanCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

/* Restituisce { detect(video) → [{ rawValue }] }, nativo se possibile. */
async function getBarcodeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = BARCODE_FORMATS.filter(f => supported.includes(f));
      if (formats.length) return new BarcodeDetector({ formats });
    } catch (e) { /* passa a ZXing */ }
  }
  return zxingDetector(await loadZxing());
}

let _zxingLoad = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!_zxingLoad) {
    _zxingLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/zxing.min.js';
      s.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing assente'));
      s.onerror = () => { _zxingLoad = null; reject(new Error('ZXing non caricato')); };
      document.head.appendChild(s);
    });
  }
  return _zxingLoad;
}

/* Legge solo la fascia centrale dell'inquadratura: più veloce e più preciso. */
function zxingDetector(Z) {
  const reader = new Z.MultiFormatReader();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    async detect(video) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return [];
      const w = Math.round(vw * 0.8), h = Math.round(vh * 0.45);
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, w, h);
      try {
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return [{ rawValue: reader.decodeWithState(bitmap).getText() }];
      } catch (e) { return []; } // nessun codice in questo fotogramma
    }
  };
}

/* mealIdx: pasto di Oggi a cui aggiungere il prodotto; null = solo catalogo. */
function openScanner(mealIdx = null) {
  let stream = null, stopped = false, busy = false;
  const stop = () => { stopped = true; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  openSheet({
    title: 'Scansiona un prodotto',
    body: `
      ${canScanCamera() ? `<div class="scan-box"><video playsinline muted data-scan-video></video><div class="scan-frame" aria-hidden="true"></div></div>
        <p class="help" data-scan-msg style="margin:8px 0 14px">Inquadra il codice a barre sulla confezione.</p>`
        : `<div class="callout" style="margin-bottom:14px">${icon('info')}<span>Su questo browser la fotocamera non è disponibile: digita le cifre sotto il codice.</span></div>`}
      <div class="field"><label for="scan-code">Codice a barre</label>
        <div class="row"><input id="scan-code" class="input input-num" inputmode="numeric" maxlength="14" placeholder="Es. 8001234567890" autocomplete="off" ${canScanCamera() ? '' : 'autofocus'}>
        <button class="btn btn-primary" data-scan-go>${icon('search', 'ic-sm')} Cerca</button></div></div>
      <p class="xs faint">Dati da Open Food Facts, database aperto e collaborativo: controlla sempre con l'etichetta.</p>`,
    onClose: stop,
    onMount: async (root, close) => {
      const input = root.querySelector('#scan-code');
      const go = async code => {
        code = String(code || '').replace(/\D/g, '');
        if (!/^\d{8,14}$/.test(code)) return toast('Il codice a barre ha da 8 a 14 cifre', { icon: 'info' });
        if (busy) return;
        busy = true;
        stop();
        root.querySelector('[data-scan-go]').disabled = true;
        await handleBarcode(code, mealIdx, close);
        busy = false;
      };
      root.querySelector('[data-scan-go]').addEventListener('click', () => go(input.value));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(input.value); });

      if (!canScanCamera()) return;
      const video = root.querySelector('[data-scan-video]');
      const msg = root.querySelector('[data-scan-msg]');
      try {
        const detector = await getBarcodeDetector();
        if (stopped) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) return stop();
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length) { if (navigator.vibrate) navigator.vibrate(60); input.value = codes[0].rawValue; return go(codes[0].rawValue); }
          } catch (e) { /* frame non pronto: riprova */ }
          setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        stop();
        root.querySelector('.scan-box').classList.add('hidden');
        msg.textContent = 'Fotocamera non disponibile: digita il codice qui sotto.';
        input.focus();
      }
    }
  });
}

async function handleBarcode(code, mealIdx, closeScanner) {
  const known = state.customFoods.find(f => f.ean === code && !f.archived);
  if (known) {
    closeScanner();
    if (mealIdx != null) openAddFood(mealIdx, { foodId: known.id, grams: known.u ? known.u[1] : 100 });
    else { toast(`${known.name} è già nel tuo catalogo`, { icon: 'barcode' }); openFoodForm(known.id); }
    return;
  }
  let prefill;
  try {
    prefill = await fetchOffProduct(code);
  } catch (e) {
    closeScanner();
    toast(navigator.onLine === false ? 'Sei offline: inserisci i valori dall’etichetta' : 'Open Food Facts non risponde: inserisci i valori dall’etichetta', { icon: 'alert' });
    return openScannedForm({ ean: code }, mealIdx);
  }
  closeScanner();
  if (!prefill) {
    toast('Prodotto non trovato: inserisci i valori dall’etichetta', { icon: 'info' });
    return openScannedForm({ ean: code }, mealIdx);
  }
  openScannedForm(prefill, mealIdx);
  toast(prefill.partial ? 'Trovato, ma mancano alcuni valori: completali dall’etichetta' : 'Trovato! Controlla i valori e salva', { icon: 'barcode' });
}

function openScannedForm(prefill, mealIdx) {
  openFoodForm(null, {
    prefill,
    onSaved: item => {
      if (mealIdx != null) openAddFood(mealIdx, { foodId: item.id, grams: item.u ? item.u[1] : 100 });
      else toast(`${item.name} aggiunto al catalogo`, { icon: 'barcode' });
    }
  });
}

/* Restituisce i campi per openFoodForm, oppure null se il prodotto non esiste. */
async function fetchOffProduct(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const fields = 'product_name,product_name_it,brands,nutriments,serving_quantity,categories_tags';
    const res = await fetch(`${OFF_URL}${code}.json?fields=${fields}`, { signal: ctrl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return offToFood(data.product, code);
  } finally { clearTimeout(timer); }
}

function offToFood(pr, code) {
  const n = pr.nutriments || {};
  const val = k => { const v = Number(n[k]); return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null; };
  const p = val('proteins_100g'), c = val('carbohydrates_100g'), g = val('fat_100g');
  let kcal = val('energy-kcal_100g');
  if (kcal == null && val('energy_100g') != null) kcal = Math.round(val('energy_100g') / 4.184);
  const brand = String(pr.brands || '').split(',')[0].trim();
  let name = String(pr.product_name_it || pr.product_name || '').trim() || 'Prodotto';
  if (brand && !norm(name).includes(norm(brand))) name += ' ' + brand;
  const kP = (p || 0) * 4, kC = (c || 0) * 4, kG = (g || 0) * 9;
  const cat = kP >= kC && kP >= kG ? 'P' : kC >= kG ? 'C' : 'G';
  const sq = Number(pr.serving_quantity);
  return {
    name: name.slice(0, 60), cat, aisle: offAisle(pr.categories_tags || []),
    p: p || 0, c: c || 0, g: g || 0, kcal: kcal || 0,
    u: Number.isFinite(sq) && sq > 0 && sq < 1000 ? ['porzione', Math.round(sq)] : null,
    tags: [], ean: code, partial: [p, c, g, kcal].some(v => v == null)
  };
}

function offAisle(tags) {
  const has = (...keys) => tags.some(t => keys.some(k => t.includes(k)));
  if (has('spreads', 'sweets', 'snacks', 'beverages')) return AISLES.DISP;
  if (has('dairies', 'cheeses', 'yogurts', 'eggs', 'milks')) return AISLES.UOVA;
  if (has('meats', 'hams', 'sausages', 'poultry')) return AISLES.CARNE;
  if (has('fishes', 'seafood', 'tunas')) return AISLES.PESCE;
  if (has('legumes', 'beans', 'chickpeas', 'lentils')) return AISLES.LEGUMI;
  if (has('nuts', 'seeds')) return AISLES.SECCA;
  if (has('fruits')) return AISLES.FRUTTA;
  if (has('vegetables')) return AISLES.VERDURA;
  if (has('breads', 'cereals', 'pastas', 'rices', 'biscuits', 'crackers', 'breakfast')) return AISLES.CEREALI;
  if (has('sauces', 'oils', 'condiments', 'dressings')) return AISLES.COND;
  if (has('protein', 'supplements')) return AISLES.INTEG;
  return AISLES.DISP;
}

ACTIONS['scan-food'] = () => openScanner(null);
