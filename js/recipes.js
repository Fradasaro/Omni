/* ==========================================================================
   RICETTE: piatti composti da alimenti del catalogo, divisi in porzioni.
   Nel diario una ricetta entra come i suoi ingredienti (grammi già divisi
   per porzione): scambi, lista della spesa e totali continuano a funzionare.
   ========================================================================== */
'use strict';

const recipes = () => (state.recipes = state.recipes || []);
function recipeTotals(r, portions = r.servings) {
  const k = portions / Math.max(1, r.servings);
  return sumMacros(r.items.map(it => ({ type: 'food', foodId: it.foodId, grams: it.grams * k })));
}

function renderRecipes() {
  const list = recipes();
  $('[data-shop-body]').innerHTML = `
  <div class="split-wide">
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('chef')} Le tue ricette <span class="badge">${list.length}</span></div>
        <button class="btn btn-soft btn-sm" data-action="recipe-new">${icon('plus', 'ic-sm')} Nuova ricetta</button></div>
      ${list.length ? list.map(r => {
        const m = recipeTotals(r, 1);
        return `<div class="food-row">
          <div class="item-main">
            <div class="item-name">${esc(r.name)}</div>
            <div class="item-meta">${fmt0(m.kcal)} kcal a porzione · ${macroTxt(m)} · ${r.items.length} ${r.items.length === 1 ? 'ingrediente' : 'ingredienti'} · ${r.servings} ${r.servings === 1 ? 'porzione' : 'porzioni'}</div>
          </div>
          <button class="icon-btn sm" data-action="recipe-log" data-r="${esc(r.id)}" aria-label="Aggiungi ${esc(r.name)} al diario" title="Aggiungi al diario">${icon('plus', 'ic-sm')}</button>
          <button class="icon-btn sm" data-action="recipe-edit" data-r="${esc(r.id)}" aria-label="Modifica">${icon('pencil', 'ic-sm')}</button>
          <button class="icon-btn sm" data-action="recipe-del" data-r="${esc(r.id)}" aria-label="Elimina">${icon('trash', 'ic-sm')}</button>
        </div>`;
      }).join('') : `<div class="empty">${icon('chef')}<b>Nessuna ricetta</b>Crea la prima: la lasagna della domenica, il tuo porridge, la torta salata…</div>`}
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:8px">${icon('info')} Come funziona</div>
      <p class="small muted">Inserisci gli ingredienti della ricetta intera e in quante porzioni la dividi: calcoliamo calorie e macro di ogni porzione.</p>
      <p class="small muted" style="margin-top:8px">Quando la aggiungi a un pasto, entrano i suoi ingredienti già divisi: puoi ancora correggere i grammi o scambiarli.</p>
      <p class="small muted" style="margin-top:8px">Hai già composto un pasto in Oggi? Dal suo menu ⋯ scegli «Salva come ricetta».</p>
    </div>
  </div>`;
}

/* Editor: id per modificare, oppure draft per una ricetta nuova già compilata. */
function openRecipeForm(id = null, draft = null) {
  const r = id ? clone(recipes().find(x => x.id === id)) : Object.assign({ name: '', servings: 1, items: [] }, draft || {});
  openSheet({
    title: id ? 'Modifica ricetta' : 'Nuova ricetta',
    wide: true,
    body: `
      <div class="grid-2">
        <div class="field"><label for="rc-name">Nome</label><input id="rc-name" class="input" maxlength="50" value="${esc(r.name)}" placeholder="Es. Pasta al pesto" ${r.name ? '' : 'autofocus'}></div>
        <div class="field"><label for="rc-serv">Porzioni</label><input id="rc-serv" class="input input-num" type="number" inputmode="numeric" min="1" max="50" value="${r.servings}"></div>
      </div>
      <div class="section-label">Ingredienti (ricetta intera)</div>
      <div data-rc-items></div>
      <div class="field" style="margin-top:10px"><div data-rc-picker></div></div>
      <div class="preview-box num" data-rc-tot></div>`,
    foot: `<button class="btn btn-secondary" data-cancel>Annulla</button><button class="btn btn-primary" data-ok>${icon('check', 'ic-sm')} Salva</button>`,
    onMount: (root, close) => {
      const servIn = root.querySelector('#rc-serv');
      const servings = () => clamp(Math.round(num(servIn.value, 1)), 1, 50);
      const draw = () => {
        root.querySelector('[data-rc-items]').innerHTML = r.items.length ? r.items.map((it, i) => {
          const f = getFood(it.foodId);
          return `<div class="item">${dot(f.cat)}
            <div class="item-main"><div class="item-name">${esc(f.name)}</div><div class="item-meta">${fmt0(itemMacros({ type: 'food', ...it }).kcal)} kcal</div></div>
            <div class="item-grams-wrap"><input class="input item-grams" type="number" inputmode="decimal" min="1" max="5000" value="${it.grams}" data-rc-g="${i}" aria-label="Grammi di ${esc(f.name)}"></div>
            <button class="icon-btn sm" data-rc-del="${i}" aria-label="Rimuovi">${icon('x', 'ic-sm')}</button></div>`;
        }).join('') : `<p class="small muted">Cerca qui sotto il primo ingrediente.</p>`;
        totals();
      };
      const totals = () => {
        r.servings = servings();
        const all = recipeTotals(r), one = recipeTotals(r, 1);
        root.querySelector('[data-rc-tot]').innerHTML = r.items.length
          ? `<b>${fmt0(one.kcal)} kcal a porzione</b><span class="muted">${macroTxt(one)}</span><span class="faint" style="width:100%">Ricetta intera: ${fmt0(all.kcal)} kcal</span>`
          : `<span class="muted">Nessun ingrediente</span>`;
      };
      const picker = createPicker(root.querySelector('[data-rc-picker]'), {
        inline: true, placeholder: 'Aggiungi un ingrediente…',
        onSelect: f => {
          if (!f) return;
          r.items.push({ foodId: f.id, grams: f.u ? f.u[1] : f.cat === 'G' ? 10 : 100 });
          picker.setValue(null);
          draw();
          const inputs = root.querySelectorAll('[data-rc-g]');
          if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
        }
      });
      root.querySelector('[data-rc-items]').addEventListener('change', e => {
        const i = e.target.dataset.rcG;
        if (i == null) return;
        r.items[Number(i)].grams = clamp(Math.round(num(e.target.value, 1)), 1, 5000);
        draw();
      });
      root.querySelector('[data-rc-items]').addEventListener('click', e => {
        const b = e.target.closest('[data-rc-del]');
        if (b) { r.items.splice(Number(b.dataset.rcDel), 1); draw(); }
      });
      servIn.addEventListener('input', totals);
      root.querySelector('[data-cancel]').addEventListener('click', close);
      root.querySelector('[data-ok]').addEventListener('click', () => {
        const name = root.querySelector('#rc-name').value.trim();
        if (!name) return toast('Dai un nome alla ricetta', { icon: 'info' });
        if (!r.items.length) return toast('Aggiungi almeno un ingrediente', { icon: 'info' });
        const item = { id: id || uid('rcp'), name, servings: servings(), items: r.items.map(it => ({ foodId: it.foodId, grams: it.grams })) };
        if (id) recipes()[recipes().findIndex(x => x.id === id)] = item;
        else recipes().unshift(item);
        saveState();
        close();
        if (currentTab === 'spesa' && Shop.tab === 'ricette') renderRecipes();
        toast(`${name} salvata`, { icon: 'chef' });
      });
      draw();
    }
  });
}

/* Aggiunge una ricetta a un pasto di Oggi. Senza recipeId si sceglie dall'elenco. */
function openRecipeLog(recipeId = null, mealIdx = suggestMealIdx()) {
  if (!recipes().length) {
    toast('Crea prima una ricetta in Spesa › Ricette', { icon: 'chef' });
    Shop.tab = 'ricette';
    return switchTab('spesa');
  }
  let sel = mealIdx, rid = recipeId || recipes()[0].id, portions = 1;
  openSheet({
    title: Today.date === todayISO() ? 'Ricetta a oggi' : `Ricetta al ${fmtDate(Today.date, { day: 'numeric', month: 'long' })}`,
    body: `${recipeId ? '' : `<div class="field"><span class="field-label">Ricetta</span><div class="chips" data-rl-recipes>
        ${recipes().map(r => `<button type="button" class="chip" data-r="${esc(r.id)}" aria-pressed="${r.id === rid}">${esc(r.name)}</button>`).join('')}</div></div>`}
      ${mealChips(sel)}
      <div class="field"><span class="field-label">Quante porzioni</span><div class="chips" data-rl-portions>
        ${[0.5, 1, 1.5, 2].map(n => `<button type="button" class="chip" data-p="${n}" aria-pressed="${n === portions}">${fmt1(n)}</button>`).join('')}</div></div>
      <div class="preview-box num" data-rl-prev></div>`,
    foot: `<button class="btn btn-primary" data-ok>${icon('plus', 'ic-sm')} Aggiungi</button>`,
    onMount: (root, close) => {
      bindMealChips(root, () => sel, v => { sel = v; });
      const prev = () => {
        const r = recipes().find(x => x.id === rid), m = recipeTotals(r, portions);
        root.querySelector('[data-rl-prev]').innerHTML = `<b>${fmt0(m.kcal)} kcal</b><span class="muted">${macroTxt(m)}</span><span class="faint" style="width:100%">${esc(r.name)} · ${fmt1(portions)} ${portions === 1 ? 'porzione' : 'porzioni'}</span>`;
      };
      const pick = (attr, set) => e => {
        const b = e.target.closest(`[${attr}]`);
        if (!b) return;
        set(b.getAttribute(attr));
        b.parentElement.querySelectorAll(`[${attr}]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        prev();
      };
      const rl = root.querySelector('[data-rl-recipes]');
      if (rl) rl.addEventListener('click', pick('data-r', v => { rid = v; }));
      root.querySelector('[data-rl-portions]').addEventListener('click', pick('data-p', v => { portions = Number(v); }));
      root.querySelector('[data-ok]').addEventListener('click', () => {
        const r = recipes().find(x => x.id === rid), meal = curDay().meals[sel];
        const k = portions / Math.max(1, r.servings);
        /* Sotto i 20 g (olio, burro…) l'arrotondamento a 5 g sbaglierebbe troppo. */
        r.items.forEach(it => { const g = it.grams * k; meal.items.push({ type: 'food', foodId: it.foodId, grams: g < 20 ? Math.max(1, Math.round(g)) : roundGrams(g) }); });
        close();
        saveState();
        if (currentTab === 'oggi') renderToday();
        toast(`${r.name} aggiunta a ${meal.name}`, currentTab === 'oggi' ? { icon: 'chef' } : { icon: 'chef', action: { label: 'Vai a Oggi', fn: () => switchTab('oggi') } });
      });
      prev();
    }
  });
}

/* Dal menu di un pasto: i suoi alimenti diventano una ricetta da una porzione. */
function recipeFromMeal(meal) {
  const items = meal.items.filter(it => it.type === 'food' && !getFood(it.foodId).missing).map(it => ({ foodId: it.foodId, grams: it.grams }));
  if (!items.length) return toast('Il pasto non ha alimenti dal catalogo da salvare', { icon: 'info' });
  openRecipeForm(null, { name: meal.name, servings: 1, items });
}

ACTIONS['recipe-new'] = () => openRecipeForm();
ACTIONS['recipe-edit'] = el => openRecipeForm(el.dataset.r);
ACTIONS['recipe-log'] = el => openRecipeLog(el.dataset.r);
ACTIONS['recipe-del'] = el => {
  const r = recipes().find(x => x.id === el.dataset.r);
  if (!r) return;
  /* I pasti già registrati non cambiano: contengono gli ingredienti, non la ricetta. */
  withUndo(`${r.name} eliminata`, () => { state.recipes = recipes().filter(x => x.id !== r.id); }, renderRecipes);
};
