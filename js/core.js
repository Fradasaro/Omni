/* ==========================================================================
   CORE: utilità, stato, persistenza, migrazione, calcoli nutrizionali.
   ========================================================================== */
'use strict';

const APP_NAME = 'Omni';
const APP_STORE_NAME = 'Omni: Dieta flessibile';
const APP_TAGLINE = 'Mangia bene, senza ossessioni';
const STORAGE_KEY = 'omni_state_v2';
const LEGACY_KEYS = ['omni_v1_state', 'exa_v3_state', 'exa_v2_state', 'exa_v1_state'];
const SCHEMA_VERSION = 2;

/* Tolleranze "in linea con il piano" (coerenti con le Linee guida). */
const TOL = { macro: 10, kcal: 100 };

/* ---------------- Utilità ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim();
}
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const fmt0 = n => nf0.format(Math.round(n || 0));
const fmt1 = n => nf1.format(Math.round((n || 0) * 10) / 10);
function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/* ---------------- Date (sempre in ora locale) ---------------- */
const pad2 = n => String(n).padStart(2, '0');
function isoLocal(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
function todayISO() { return isoLocal(new Date()); }
function fmtDate(iso, opts = { day: 'numeric', month: 'short' }) { return parseISO(iso).toLocaleDateString('it-IT', opts); }

/* ---------------- Biometria e obiettivi ---------------- */
const ACTIVITY = [
  { v: 1.2, name: 'Sedentario', desc: 'Lavoro da scrivania, poco movimento' },
  { v: 1.375, name: 'Leggero', desc: '1-2 allenamenti a settimana' },
  { v: 1.55, name: 'Moderato', desc: '3-4 allenamenti a settimana' },
  { v: 1.725, name: 'Intenso', desc: '5-6 allenamenti a settimana' },
  { v: 1.9, name: 'Molto intenso', desc: 'Allenamenti quotidiani o lavoro fisico' }
];
const GOALS = [
  { v: '-500', name: 'Definizione', off: -500 },
  { v: '-250', name: 'Ricomposizione', off: -250 },
  { v: '0', name: 'Mantenimento', off: 0 },
  { v: '250', name: 'Massa pulita', off: 250 },
  { v: '450', name: 'Massa', off: 450 },
  { v: 'custom', name: 'Personalizzato', off: 0 }
];
const PREFS = [
  { v: 'bal', name: 'Bilanciata', share: 0.5, desc: 'Energia residua divisa a metà tra carboidrati e grassi.' },
  { v: 'hc', name: 'Più carboidrati', share: 0.7, desc: 'Ideale per sport di resistenza: 70% dell’energia residua ai carboidrati.' },
  { v: 'lc', name: 'Più grassi', share: 0.3, desc: 'Per chi preferisce cibi più densi: 30% ai carboidrati, 70% ai grassi.' },
  { v: 'manual', name: 'Manuale', share: null, desc: 'Inserisci tu i grammi di carboidrati e grassi.' }
];
const goalName = v => (GOALS.find(g => g.v === String(v)) || GOALS[2]).name;

function computeBiometrics(p) {
  const w = p.weight, h = p.height, a = p.age;
  const bmi = w / Math.pow(h / 100, 2);
  const lbm = p.bf > 0 ? w * (1 - p.bf / 100) : null;
  const bmr = (p.formula === 'katch' && lbm)
    ? 370 + 21.6 * lbm
    : 10 * w + 6.25 * h - 5 * a + (p.sex === 'M' ? 5 : -161);
  return { bmi: Math.round(bmi * 10) / 10, lbm: lbm ? Math.round(lbm * 10) / 10 : null, bmr: Math.round(bmr), tdee: Math.round(bmr * p.pal) };
}

/* Calcolo dei target: le kcal guidano, le proteine sono fissate dall'utente,
   la preferenza energetica divide il resto. Un minimo di grassi protegge la salute. */
function computeTargets(profile, cfg) {
  const bio = computeBiometrics(profile);
  const notes = [];
  const fatFloor = Math.round(profile.weight * 0.7);
  let p = cfg.pro.mode === 'gkg' ? Math.round(profile.weight * cfg.pro.gkg) : Math.round(cfg.pro.grams);
  p = clamp(p, 30, 400);
  let c, g, kcal;

  if (cfg.pref === 'manual') {
    c = clamp(Math.round(cfg.manualC), 0, 900);
    g = clamp(Math.round(cfg.manualG), 0, 300);
    kcal = 4 * p + 4 * c + 9 * g;
    if (g < fatFloor) notes.push({ t: 'warn', d: `Sotto ${fatFloor} g di grassi (0,7 g/kg) l'apporto potrebbe essere insufficiente per l'equilibrio ormonale.` });
  } else {
    const goal = GOALS.find(x => x.v === String(cfg.goal)) || GOALS[2];
    const want = goal.v === 'custom' ? Math.round(cfg.customKcal) : bio.tdee + goal.off;
    const kcalIn = clamp(want, 1000, 6000);
    const share = (PREFS.find(x => x.v === cfg.pref) || PREFS[0]).share;
    const rest = kcalIn - 4 * p;
    if (rest <= 0) {
      g = fatFloor; c = 0;
      notes.push({ t: 'warn', d: 'Le proteine impostate superano le calorie disponibili: riduci le proteine o aumenta le calorie.' });
    } else {
      g = Math.round((1 - share) * rest / 9);
      if (g < fatFloor) {
        g = fatFloor;
        notes.push({ t: 'info', d: `Grassi portati al minimo consigliato di ${fatFloor} g (0,7 g/kg): sotto questa soglia l'apporto rischia di essere insufficiente.` });
      }
      c = Math.max(0, Math.round((rest - 9 * g) / 4));
    }
    kcal = 4 * p + 4 * c + 9 * g;
    if (c < 60 && rest > 0) notes.push({ t: 'info', d: 'Carboidrati molto bassi: se ti alleni con intensità potresti sentirne la mancanza.' });
  }
  if (kcal < bio.bmr) notes.push({ t: 'warn', d: `Le calorie sono sotto il tuo metabolismo basale stimato (${fmt0(bio.bmr)} kcal). Valuta questa scelta con un professionista.` });
  return { kcal, p, c, g, tdee: bio.tdee, bmr: bio.bmr, notes };
}

/* ---------------- Struttura pasti ---------------- */
const DEFAULT_SLOTS = [
  { id: 'colazione', name: 'Colazione', on: true, share: 0.22, main: false, c: 'avena', p: 'ygreco0', g: 'burro_arachidi', veg: false },
  { id: 'spuntino', name: 'Spuntino', on: true, share: 0.09, main: false, c: 'gallette_riso', p: 'bresaola', g: 'mandorle', veg: false },
  { id: 'pranzo', name: 'Pranzo', on: true, share: 0.3, main: true, c: 'riso', p: 'pollo', g: 'olio', veg: true },
  { id: 'merenda', name: 'Merenda', on: true, share: 0.1, main: false, c: 'banana', p: 'skyr', g: null, veg: false },
  { id: 'cena', name: 'Cena', on: true, share: 0.29, main: true, c: 'patate', p: 'merluzzo', g: 'olio', veg: true },
  { id: 'prenanna', name: 'Pre-nanna', on: false, share: 0.07, main: false, c: null, p: 'fiocchi', g: 'noci', veg: false }
];
const VEG_PORTION = 200;

function defaultPlanCfg() {
  return {
    goal: '0', customKcal: 2200,
    pro: { mode: 'gkg', gkg: 2.0, grams: 150 },
    pref: 'hc', manualC: 250, manualG: 70,
    symPro: true,
    slots: clone(DEFAULT_SLOTS)
  };
}

/* ---------------- Stato ---------------- */
function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'system', round5: true, lastBackup: null, coachSkip: 0 },
    profile: null,
    plan: null,          // { cfg, meals, target, basis, savedAt }
    customFoods: [],
    days: {},
    weightLogs: [],
    pantry: {},          // foodId -> true (alimenti in casa)
    cart: {},            // chiave voce lista spesa -> true (preso)
    shopExtra: []
  };
}
let state = defaultState();

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error(e); if (typeof toast === 'function') toast('Spazio di archiviazione pieno: scarica un backup dal Profilo.', { icon: 'alert' }); }
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
  } catch (e) { console.error(e); }
  if (!raw) return;
  try { state = migrate(JSON.parse(raw)); saveState(); }
  catch (e) { console.error('Dati salvati non leggibili', e); }
}

/* Porta qualsiasi versione salvata (v1 "Omni", vecchie "exa") allo schema attuale.
   Non elimina mai le chiavi legacy: restano come copia di sicurezza. */
function migrate(src) {
  if (!src || typeof src !== 'object') return defaultState();
  if (src.schemaVersion === SCHEMA_VERSION) {
    const base = defaultState();
    const out = Object.assign(base, src);
    out.settings = Object.assign(defaultState().settings, src.settings || {});
    (out.customFoods || []).forEach(f => { f.tags = f.tags || []; });
    Object.values(out.days || {}).forEach(normalizeDay);
    return out;
  }

  const s = defaultState();
  s.settings.theme = src.theme === 'light' ? 'light' : src.theme === 'dark' ? 'dark' : 'system';
  const op = src.profile;
  if (!op) return s;
  s.settings.round5 = op.round5 !== false;

  s.profile = {
    name: op.name || '',
    sex: op.sex || 'M', age: op.age || 30, height: op.height || 175, weight: op.weight || 70,
    targetWeight: op.targetWeight || op.weight || 70, bf: op.bf || 0,
    formula: op.formula || 'mifflin', pal: op.pal || 1.55,
    water: (op.target && op.target.water) || 2500
  };

  /* Target identici a prima: ripartizione manuale con gli stessi grammi. */
  const cfg = defaultPlanCfg();
  const t = op.target || {};
  cfg.goal = op.goal != null ? String(op.goal) : '0';
  cfg.pro = { mode: 'grams', gkg: op.proMult || 2.0, grams: t.p || 150 };
  cfg.pref = 'manual';
  cfg.manualC = t.c || 250;
  cfg.manualG = t.g || 70;
  cfg.customKcal = t.kcal || 2200;
  const st = src.staples || {};
  cfg.symPro = st.symPro !== false;
  const mc = op.mealsCount || 5;
  const byId = Object.fromEntries(cfg.slots.map(x => [x.id, x]));
  byId.colazione.c = st.bfC || 'avena'; byId.colazione.p = st.bfP || 'ygreco0';
  byId.pranzo.c = st.luC || 'riso'; byId.pranzo.p = st.luP || 'pollo';
  byId.cena.c = st.diC || 'patate'; byId.cena.p = st.diP || 'pollo';
  byId.spuntino.c = 'gallette_riso'; byId.spuntino.p = 'tacchino'; byId.spuntino.g = 'mandorle';
  byId.merenda.c = 'banana'; byId.merenda.p = 'albume'; byId.merenda.g = null;
  byId.spuntino.on = mc >= 4;
  byId.merenda.on = mc >= 5;
  byId.pranzo.veg = false; byId.cena.veg = false; // il vecchio piano non conteggiava le verdure
  s.plan = { cfg, meals: null, target: null, basis: null, savedAt: null };

  const nameToSlot = n => {
    const k = norm(n);
    if (k.startsWith('colazione')) return 'colazione';
    if (k.startsWith('spuntino')) return 'spuntino';
    if (k.startsWith('pranzo')) return 'pranzo';
    if (k.startsWith('merenda')) return 'merenda';
    if (k.startsWith('cena')) return 'cena';
    return null;
  };
  if (Array.isArray(src.dayTemplate) && src.dayTemplate.length) {
    s.plan.meals = src.dayTemplate.map(m => ({
      slotId: nameToSlot(m.name) || uid('slot'), name: m.name,
      items: (m.items || []).map(it => ({ foodId: it.foodId, grams: it.grams }))
    }));
  }

  s.customFoods = (src.customFoods || []).map(f => Object.assign({ tags: [] }, f, { custom: true }));
  s.days = {};
  Object.entries(src.days || {}).forEach(([d, rec]) => {
    s.days[d] = {
      water: rec.water || 0,
      meals: (rec.meals || []).map(m => ({ id: m.id || uid('m'), slotId: nameToSlot(m.name), name: m.name, items: (m.items || []).map(it => ({ type: 'food', foodId: it.foodId, grams: it.grams })) }))
    };
  });
  s.weightLogs = (src.weightLogs || []).filter(l => l && l.date && l.weight);
  Object.entries(src.shopChecks || {}).forEach(([k, v]) => {
    if (!v) return;
    if (k.startsWith('f_')) s.pantry[k.slice(2)] = true;
  });
  s.shopExtra = Array.isArray(src.shopExtra) ? src.shopExtra : [];
  return s;
}

function normalizeDay(day) {
  day.water = day.water || 0;
  day.meals = (day.meals || []).map(m => ({
    id: m.id || uid('m'), slotId: m.slotId || null, name: m.name || 'Pasto',
    items: (m.items || []).map(it => it.type ? it : Object.assign({ type: 'food' }, it))
  }));
  return day;
}

/* ---------------- Alimenti ---------------- */
let _foodIndex = null;
function foodIndex() {
  if (!_foodIndex) {
    _foodIndex = new Map();
    DEFAULT_FOODS.forEach(f => _foodIndex.set(f.id, f));
    (state.customFoods || []).forEach(f => _foodIndex.set(f.id, f));
  }
  return _foodIndex;
}
function invalidateFoods() { _foodIndex = null; }
function allFoods({ includeArchived = false } = {}) {
  return [...foodIndex().values()].filter(f => includeArchived || !f.archived);
}
/* Mai un fallback silenzioso su un altro alimento: i dati storici restano veri. */
function getFood(id) {
  return foodIndex().get(id) || { id, name: 'Alimento non disponibile', cat: 'C', aisle: A.DISP, kcal: 0, p: 0, c: 0, g: 0, tags: [], missing: true };
}
const inPantry = id => !!state.pantry[id];
const CAT_LABEL = { P: 'Proteine', C: 'Carboidrati', G: 'Grassi', V: 'Verdure' };
const CAT_CLASS = { P: 'pro', C: 'cho', G: 'fat', V: 'veg' };
const catVar = cat => `var(--${CAT_CLASS[cat] || 'text-3'})`;
const ST_LABEL = { r: 'a crudo', s: 'a secco', k: '' };

function cookedHint(food, grams) {
  if (!food.ck || food.ck === 1 || !grams) return '';
  return `≈ ${fmt0(roundTo(grams * food.ck, 5))} g da cotto`;
}
function roundTo(n, step) { return Math.round(n / step) * step; }
function roundGrams(g, round5 = state.settings.round5) {
  return round5 ? Math.max(5, roundTo(g, 5)) : Math.max(1, Math.round(g));
}

/* Ricerca: senza accenti, tutte le parole devono comparire, priorità all'inizio del nome. */
function searchFoods(q, { filter = null, limit = 80, boost = null } = {}) {
  const tokens = norm(q).split(' ').filter(Boolean);
  const res = [];
  for (const f of allFoods()) {
    if (filter && !filter(f)) continue;
    if (!tokens.length) { res.push({ f, s: 0 }); continue; }
    const name = norm(f.name), hay = name + ' ' + norm(f.alt || '') + ' ' + norm(f.aisle || '');
    if (!tokens.every(t => hay.includes(t))) continue;
    const t0 = tokens[0];
    let s = name.startsWith(t0) ? 0 : (' ' + name).includes(' ' + t0) ? 1 : name.includes(t0) ? 2 : 3;
    if (boost && boost.has(f.id)) s -= 0.5;
    res.push({ f, s });
  }
  res.sort((a, b) => a.s - b.s || a.f.name.localeCompare(b.f.name, 'it'));
  return res.slice(0, limit).map(r => r.f);
}

/* ---------------- Calcoli nutrizionali ---------------- */
function itemMacros(it) {
  if (it.type === 'free' || it.type === 'quick') return { kcal: it.kcal || 0, p: it.p || 0, c: it.c || 0, g: it.g || 0 };
  const f = getFood(it.foodId), r = (it.grams || 0) / 100;
  return { kcal: f.kcal * r, p: f.p * r, c: f.c * r, g: f.g * r };
}
function sumMacros(items) {
  const t = { kcal: 0, p: 0, c: 0, g: 0 };
  items.forEach(it => { const m = itemMacros(it); t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.g += m.g; });
  return t;
}
function dayTotals(day) { return sumMacros(day.meals.flatMap(m => m.items)); }
const dayHasFree = day => day.meals.some(m => m.items.some(it => it.type === 'free'));
const dayLogged = day => !!day && (day.water > 0 || day.meals.some(m => m.items.length > 0));

function planSlots() {
  return (state.plan && state.plan.cfg ? state.plan.cfg.slots : DEFAULT_SLOTS).filter(s => s.on);
}
function newDayRecord() {
  return { water: 0, meals: planSlots().map(s => ({ id: uid('m'), slotId: s.id, name: s.name, items: [] })) };
}
function getDay(iso, create = true) {
  if (!state.days[iso] && create) state.days[iso] = newDayRecord();
  return state.days[iso];
}
function planMealFor(meal, idx) {
  const pm = state.plan && state.plan.meals;
  if (!pm || !pm.length) return null;
  const m = (meal.slotId && pm.find(x => x.slotId === meal.slotId)) || pm.find(x => norm(x.name) === norm(meal.name)) || null;
  return m && m.items.length ? m : null;
}
function target() { return (state.plan && state.plan.target) || { kcal: 2000, p: 150, c: 200, g: 65 }; }

/* ---------------- Scambi equivalenti ---------------- */
function computeEquivalents(base, grams, { mode = 'auto', sameCat = true, diet = 'all', round5 = state.settings.round5, limit = 999 } = {}) {
  const r = grams / 100;
  const ref = { kcal: base.kcal * r, P: base.p * r, C: base.c * r, G: base.g * r };
  const key = mode === 'auto' ? (base.cat === 'V' ? 'kcal' : base.cat) : mode;
  const out = [];
  for (const f of allFoods()) {
    if (f.id === base.id) continue;
    if (sameCat && f.cat !== base.cat) continue;
    if (diet === 'pantry' && !inPantry(f.id)) continue;
    if (!['all', 'pantry'].includes(diet) && !(f.tags || []).includes(diet)) continue;
    const per = key === 'kcal' ? f.kcal : key === 'P' ? f.p : key === 'C' ? f.c : f.g;
    if (per < (key === 'kcal' ? 5 : 2)) continue;
    const raw = (ref[key] / per) * 100;
    if (!Number.isFinite(raw) || raw < 5 || raw > 1000) continue;
    const g = roundGrams(raw, round5);
    const rr = g / 100;
    const m = { kcal: f.kcal * rr, p: f.p * rr, c: f.c * rr, g: f.g * rr };
    const dK = m.kcal - ref.kcal;
    const score = Math.abs(dK) + (Math.abs(m.p - ref.P) + Math.abs(m.c - ref.C) + Math.abs(m.g - ref.G)) * 4
      + (f.cat === base.cat ? 0 : 80) - (inPantry(f.id) ? 250 : 0);
    out.push({ food: f, grams: g, ...m, dK, home: inPantry(f.id), score });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}
