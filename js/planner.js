/* ==========================================================================
   PLANNER: calcola i grammi del Piano.
   Ogni pasto attivo ha fino a tre alimenti scelti dall'utente (carbo, proteine,
   grassi) più eventuali verdure a porzione fissa. I grammi sono trovati con
   minimi quadrati non negativi (discesa per coordinate) su:
   - totali giornalieri P/C/G (peso alto)
   - quota di ciascun pasto (peso basso: distribuisce senza irrigidire)
   - simmetria proteica pranzo/cena (opzionale)
   Gli errori sono pesati in kcal (4/4/9) così un grammo di grasso conta il giusto.
   Dopo l'arrotondamento alla bilancia (5 g o 1 g) una ricerca locale
   recupera l'errore introdotto dall'arrotondamento.
   ========================================================================== */
'use strict';

const MACROS = [['p', 4], ['c', 4], ['g', 9]];

function upperBound(food, role) {
  if (food.max) return food.max;
  const k = Math.max(1, food.kcal);
  if (role === 'g') return clamp(380 / k * 100, 10, 200);
  if (role === 'p') return Math.min(450, 900 / k * 100);
  return Math.min(600, 1000 / k * 100);
}

/* Porzione minima: un alimento scelto dall'utente non deve sparire dal piano. */
function lowerBound(food, role, round5) {
  const step = round5 ? 5 : 1;
  let lb = role === 'g' ? 5 : role === 'p' ? (food.kcal < 200 ? 40 : 15) : (food.u ? Math.min(food.u[1], 30) : 15);
  if (food.max) lb = Math.min(lb, food.max / 2);
  return Math.max(step, Math.round(lb / step) * step);
}

function solvePlan(T, cfg, round5 = true) {
  const slots = cfg.slots.filter(s => s.on);
  if (!slots.length) return [];
  const totShare = slots.reduce((a, s) => a + (s.share || 0.1), 0) || 1;
  const veg = getFood('verdure_miste');

  const vars = [];         // { slot, role, food, ub }
  const fixed = slots.map(() => ({ p: 0, c: 0, g: 0 }));
  slots.forEach((s, i) => {
    ['c', 'p', 'g'].forEach(role => {
      if (!s[role]) return;
      const f = getFood(s[role]);
      if (f.missing || f.archived) return;
      const ub = upperBound(f, role) / 100;
      vars.push({ slot: i, role, food: f, ub, lb: Math.min(ub, lowerBound(f, role, round5) / 100) });
    });
    if (s.veg) MACROS.forEach(([m]) => { fixed[i][m] += veg[m] * VEG_PORTION / 100; });
  });

  /* Righe del sistema: coeff per variabile, target, peso */
  const rows = [];
  const fixedTot = { p: 0, c: 0, g: 0 };
  fixed.forEach(f => MACROS.forEach(([m]) => { fixedTot[m] += f[m]; }));
  MACROS.forEach(([m, k]) => {
    rows.push({ w: 8, b: (T[m] - fixedTot[m]) * k, a: vars.map(v => v.food[m] * k) });
  });
  slots.forEach((s, i) => {
    const share = (s.share || 0.1) / totShare;
    MACROS.forEach(([m, k]) => {
      rows.push({ w: 1, b: (T[m] * share - fixed[i][m]) * k, a: vars.map(v => v.slot === i ? v.food[m] * k : 0) });
    });
  });
  if (cfg.symPro) {
    const mains = slots.map((s, i) => s.main ? i : -1).filter(i => i >= 0);
    if (mains.length >= 2) {
      const [L, D] = mains;
      rows.push({ w: 4, b: -(fixed[L].p - fixed[D].p) * 4, a: vars.map(v => v.role === 'p' ? (v.slot === L ? v.food.p * 4 : v.slot === D ? -v.food.p * 4 : 0) : 0) });
    }
  }

  const n = vars.length;
  const x = new Array(n).fill(0);
  const res = rows.map(r => -r.b);           // residuo = A·x − b
  const lb = vars.map(v => v.lb);
  const H = vars.map((_, j) => rows.reduce((acc, r) => acc + r.w * r.a[j] * r.a[j], 0));

  function setX(j, val) {
    const d = val - x[j];
    if (!d) return;
    rows.forEach((r, ri) => { if (r.a[j]) res[ri] += r.a[j] * d; });
    x[j] = val;
  }
  vars.forEach((v, j) => setX(j, v.lb));
  const objective = () => rows.reduce((acc, r, ri) => acc + r.w * res[ri] * res[ri], 0);

  for (let sweep = 0; sweep < 400; sweep++) {
    let moved = 0;
    for (let j = 0; j < n; j++) {
      if (!H[j]) continue;
      let grad = 0;
      rows.forEach((r, ri) => { if (r.a[j]) grad += r.w * r.a[j] * res[ri]; });
      const nx = clamp(x[j] - grad / H[j], lb[j], vars[j].ub);
      moved += Math.abs(nx - x[j]);
      setX(j, nx);
    }
    if (moved < 1e-6) break;
  }

  /* Arrotondamento alla bilancia + ricerca locale */
  const step = (round5 ? 5 : 1) / 100;
  for (let j = 0; j < n; j++) setX(j, clamp(Math.round(x[j] / step) * step, lb[j], vars[j].ub));
  for (let pass = 0; pass < 6; pass++) {
    let improved = false;
    for (let j = 0; j < n; j++) {
      for (const d of [step, -step, 2 * step, -2 * step]) {
        const nx = x[j] + d;
        if (nx < lb[j] - 1e-9 || nx > vars[j].ub + 1e-9) continue;
        const before = objective(), old = x[j];
        setX(j, nx);
        if (objective() < before - 1e-6) improved = true;
        else setX(j, old);
      }
    }
    if (!improved) break;
  }

  return slots.map((s, i) => {
    const items = [];
    ['c', 'p', 'g'].forEach(role => {
      const j = vars.findIndex(v => v.slot === i && v.role === role);
      if (j < 0) return;
      const grams = Math.round(x[j] * 100);
      if (grams >= (round5 ? 5 : 1)) items.push({ foodId: vars[j].food.id, grams });
    });
    if (s.veg) items.push({ foodId: 'verdure_miste', grams: VEG_PORTION });
    return { slotId: s.id, name: s.name, items };
  });
}
