/* ==========================================================================
   SCAMBI: alimento + grammi → equivalenti. Opzioni avanzate chiuse di base.
   ========================================================================== */
'use strict';

const Swap = { baseId: 'pollo', grams: 150, mode: 'auto', sameCat: true, diet: 'all', filter: '', round5: null, picker: null };

function renderSwap() {
  if (Swap.round5 === null) Swap.round5 = state.settings.round5;
  $('#view-scambi').innerHTML = `
  <div class="split">
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('swap')} Cosa vuoi sostituire?</div></div>
      <div class="field"><span class="field-label">Alimento</span><div data-swap-picker></div></div>
      <div class="field"><span class="field-label">Quantità</span>
        <div class="grams-row">
          <button class="btn btn-secondary" data-action="sw-step" data-d="-10" aria-label="Meno 10 grammi">−</button>
          <div class="input-suffix"><input class="input" type="number" inputmode="decimal" min="1" max="1500" value="${Swap.grams}" data-input="sw-grams" aria-label="Grammi"><span class="suffix">g</span></div>
          <button class="btn btn-secondary" data-action="sw-step" data-d="10" aria-label="Più 10 grammi">+</button>
        </div>
        <div class="chips" data-sw-chips style="margin-top:8px"></div>
      </div>
      <details class="adv">
        <summary>${icon('sliders', 'ic-sm')} Opzioni avanzate ${icon('down', 'ic-sm')}</summary>
        <div class="field"><label for="sw-mode">Cosa pareggiare</label>
          <select id="sw-mode" class="input" data-change="sw-mode">
            ${[['auto', 'Il macro principale (consigliato)'], ['kcal', 'Le calorie totali'], ['P', 'Le proteine'], ['C', 'I carboidrati'], ['G', 'I grassi']].map(([v, l]) => `<option value="${v}" ${Swap.mode === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><span class="field-label">Arrotondamento</span>
          <div class="seg"><button type="button" data-action="sw-round" data-v="5" aria-pressed="${Swap.round5}">Multipli di 5 g</button><button type="button" data-action="sw-round" data-v="1" aria-pressed="${!Swap.round5}">Grammo esatto</button></div></div>
        <div class="field"><label for="sw-diet">Regime</label>
          <select id="sw-diet" class="input" data-change="sw-diet">
            ${[['all', 'Tutti gli alimenti'], ['pantry', 'Solo quelli in casa'], ['veg', 'Vegetariano'], ['vegan', 'Vegano'], ['nolact', 'Senza lattosio']].map(([v, l]) => `<option value="${v}" ${Swap.diet === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" data-change="sw-samecat" ${Swap.sameCat ? 'checked' : ''}><span>Solo alimenti della stessa categoria</span></label>
      </details>
      <div class="ref-box" data-sw-ref style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Equivalenti <span class="badge" data-sw-count>0</span></div>
        <input class="input" style="max-width:200px;min-height:38px" placeholder="Filtra…" value="${esc(Swap.filter)}" data-input="sw-filter" aria-label="Filtra gli equivalenti">
      </div>
      <p class="card-sub">Prima gli alimenti che hai in casa. Le porzioni oltre 1 kg vengono escluse.</p>
      <div class="alt-grid" data-sw-results></div>
    </div>
  </div>`;

  Swap.picker = createPicker($('[data-swap-picker]'), {
    value: Swap.baseId,
    onSelect: f => { if (f) { Swap.baseId = f.id; if (f.u && Swap.grams === 150 && f.cat !== 'P') Swap.grams = f.u[1]; } updateSwap(); }
  });
  updateSwap();
}

function updateSwap() {
  const base = getFood(Swap.baseId);
  const r = Swap.grams / 100;
  const ref = { kcal: base.kcal * r, p: base.p * r, c: base.c * r, g: base.g * r };
  const key = Swap.mode === 'auto' ? (base.cat === 'V' ? 'kcal' : base.cat) : Swap.mode;
  const head = key === 'kcal' ? `${fmt0(ref.kcal)} kcal` : `${fmt1(ref[key.toLowerCase()])} g di ${CAT_LABEL[key].toLowerCase()}`;
  const gIn = $('[data-input="sw-grams"]');
  if (gIn && document.activeElement !== gIn) gIn.value = Swap.grams;

  $('[data-sw-chips]').innerHTML = (base.u
    ? [1, 2, 3].map(n => [n * base.u[1], `${n} ${base.u[0]}`])
    : [[50], [80], [100], [150], [200]].map(([g]) => [g, `${g} g`])
  ).map(([g, l]) => `<button class="chip" data-action="sw-set" data-g="${g}" aria-pressed="${Swap.grams === g}">${esc(l)}</button>`).join('');

  const hint = cookedHint(base, Swap.grams);
  $('[data-sw-ref]').innerHTML = `
    <div class="between"><span class="xs muted" style="font-weight:700">Da pareggiare</span>
      <button class="btn btn-soft btn-sm" data-action="sw-add" data-f="${esc(base.id)}" data-g="${Swap.grams}">${icon('plus', 'ic-sm')} Al diario</button></div>
    <div class="ref-head num">${head}</div>
    <div class="ref-macros">
      <div><span class="muted">Kcal</span><b>${fmt0(ref.kcal)}</b></div>
      <div><span class="c-pro">Prot.</span><b>${fmt1(ref.p)}</b></div>
      <div><span class="c-cho">Carbo</span><b>${fmt1(ref.c)}</b></div>
      <div><span class="c-fat">Grassi</span><b>${fmt1(ref.g)}</b></div>
    </div>
    ${hint ? `<div class="xs faint" style="margin-top:8px;text-align:center">${hint}</div>` : ''}`;

  let alts = computeEquivalents(base, Swap.grams, { mode: Swap.mode, sameCat: Swap.sameCat, diet: Swap.diet, round5: Swap.round5 });
  const q = norm(Swap.filter);
  if (q) alts = alts.filter(a => norm(a.food.name).includes(q));
  $('[data-sw-count]').textContent = alts.length;
  $('[data-sw-results]').innerHTML = alts.length ? alts.map(a => `
    <div class="alt ${a.home ? 'home' : ''}">
      <div class="alt-top">
        <div><div class="alt-name">${esc(a.food.name)}</div>
          <div class="row-wrap" style="margin-top:6px">${a.home ? '<span class="badge home">In casa</span>' : ''}<span class="badge">${a.dK >= 0 ? '+' : '−'}${fmt0(Math.abs(a.dK))} kcal</span></div></div>
        <div class="alt-g">${fmt0(a.grams)}<span> g</span>${ST_LABEL[a.food.st] ? `<small>${ST_LABEL[a.food.st]}</small>` : ''}</div>
      </div>
      <div class="alt-macros">${fmt0(a.kcal)} kcal · ${macroTxt(a, 1)}</div>
      <div class="alt-actions">
        <button class="btn btn-secondary btn-sm" data-action="sw-ref" data-f="${esc(a.food.id)}" data-g="${a.grams}">${icon('swap', 'ic-sm')} Riferimento</button>
        <button class="btn btn-soft btn-sm" data-action="sw-add" data-f="${esc(a.food.id)}" data-g="${a.grams}">${icon('plus', 'ic-sm')} Al diario</button>
      </div>
    </div>`).join('')
    : `<div class="empty" style="grid-column:1/-1">${icon('scale')}<b>Nessun equivalente realistico</b>I profili nutrizionali sono troppo diversi per questo criterio, oppure il filtro è troppo stretto. Prova «il macro principale».</div>`;
}

INPUTS['sw-grams'] = el => { const g = Math.round(num(el.value, 0)); if (g > 0) { Swap.grams = clamp(g, 1, 1500); updateSwap(); } };
INPUTS['sw-filter'] = el => { Swap.filter = el.value; updateSwap(); };
ACTIONS['sw-step'] = el => { Swap.grams = clamp(Swap.grams + Number(el.dataset.d), 5, 1500); updateSwap(); };
ACTIONS['sw-set'] = el => { Swap.grams = Number(el.dataset.g); updateSwap(); };
ACTIONS['sw-round'] = el => { Swap.round5 = el.dataset.v === '5'; $$('[data-action="sw-round"]').forEach(b => b.setAttribute('aria-pressed', String(b === el))); updateSwap(); };
CHANGES['sw-mode'] = el => { Swap.mode = el.value; updateSwap(); };
CHANGES['sw-diet'] = el => { Swap.diet = el.value; updateSwap(); };
CHANGES['sw-samecat'] = el => { Swap.sameCat = el.checked; updateSwap(); };
ACTIONS['sw-ref'] = el => {
  Swap.baseId = el.dataset.f; Swap.grams = Number(el.dataset.g);
  if (Swap.picker) Swap.picker.setValue(Swap.baseId);
  updateSwap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
ACTIONS['sw-add'] = el => openAddFood(suggestMealIdx(), { foodId: el.dataset.f, grams: Number(el.dataset.g) });
