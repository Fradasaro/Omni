/* ==========================================================================
   SPESA: lista della spesa (spunte "preso") e dispensa ("in casa"),
   due concetti separati. Catalogo e alimenti personalizzati.
   ========================================================================== */
'use strict';

const Shop = { tab: 'lista', source: 'plan', mult: 7, hideDone: false, q: '', cat: 'all' };

function shopExtras() {
  state.shopExtra = (state.shopExtra || []).map(x => typeof x === 'string' ? { id: uid('x'), label: x } : x);
  return state.shopExtra;
}

function shoppingItems() {
  const totals = {};
  const addMeals = (meals, k = 1) => meals.forEach(m => m.items.forEach(it => {
    if (it.type && it.type !== 'food') return;
    totals[it.foodId] = (totals[it.foodId] || 0) + (it.grams || 0) * k;
  }));
  if (Shop.source === 'plan') addMeals((state.plan && state.plan.meals) || [], Shop.mult);
  else if (Shop.source === 'day') addMeals(getDay(Today.date).meals, Shop.mult);
  else for (let i = 0; i < 7; i++) { const d = state.days[addDays(todayISO(), i)]; if (d) addMeals(d.meals); }

  const byAisle = {};
  Object.entries(totals).forEach(([id, g]) => {
    const f = getFood(id);
    if (f.missing) return;
    const unitTxt = f.u ? ` · circa ${fmt0(g / f.u[1])} ${f.u[0]}` : '';
    (byAisle[f.aisle] = byAisle[f.aisle] || []).push({ key: 'f_' + id, foodId: id, label: f.name, qty: (g >= 1000 ? `${fmt1(g / 1000)} kg` : `${fmt0(g)} g`) + unitTxt });
  });
  const order = Object.values(AISLES);
  const groups = Object.entries(byAisle).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  groups.forEach(([, arr]) => arr.sort((a, b) => a.label.localeCompare(b.label, 'it')));
  const extras = shopExtras();
  if (extras.length) groups.push(['Altre voci', extras.map(x => ({ key: x.id, label: x.label, qty: '', extra: true }))]);
  return groups;
}

function renderShop() {
  $('#view-spesa').innerHTML = `
    <div class="seg subtabs" role="tablist">
      <button type="button" data-action="shop-tab" data-v="lista" aria-pressed="${Shop.tab === 'lista'}">Lista spesa</button>
      <button type="button" data-action="shop-tab" data-v="alimenti" aria-pressed="${Shop.tab === 'alimenti'}">Alimenti</button>
      <button type="button" data-action="shop-tab" data-v="ricette" aria-pressed="${Shop.tab === 'ricette'}">Ricette</button>
    </div>
    <div data-shop-body></div>`;
  if (Shop.tab === 'lista') renderShopList(); else if (Shop.tab === 'ricette') renderRecipes(); else renderFoods();
}

function renderShopList() {
  const groups = shoppingItems();
  const all = groups.flatMap(g => g[1]);
  const done = all.filter(i => state.cart[i.key]).length;
  $('[data-shop-body]').innerHTML = `
  <div class="split-wide">
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('shop')} Lista della spesa</div><span class="small muted num">${done} di ${all.length} presi</span></div>
      <div class="bar" style="margin-bottom:16px"><i style="width:${all.length ? done / all.length * 100 : 0}%"></i></div>
      <div class="grid-2">
        <div class="field"><label for="sh-src">Calcola da</label>
          <select id="sh-src" class="input" data-change="sh-src">
            <option value="plan" ${Shop.source === 'plan' ? 'selected' : ''}>Il mio piano</option>
            <option value="day" ${Shop.source === 'day' ? 'selected' : ''}>La giornata selezionata in Oggi</option>
            <option value="week" ${Shop.source === 'week' ? 'selected' : ''}>I prossimi 7 giorni del diario</option>
          </select></div>
        <div class="field"><label for="sh-mult">Per quanti giorni</label>
          <select id="sh-mult" class="input" data-change="sh-mult" ${Shop.source === 'week' ? 'disabled' : ''}>
            ${[1, 3, 5, 7, 14].map(n => `<option value="${n}" ${Shop.mult === n ? 'selected' : ''}>${n === 1 ? '1 giorno' : n + ' giorni'}</option>`).join('')}
          </select></div>
      </div>
      <div class="row" style="margin-bottom:14px">
        <input class="input" placeholder="Aggiungi una voce (es. caffè, spezie…)" data-shop-extra maxlength="60" aria-label="Nuova voce">
        <button class="btn btn-secondary" data-action="sh-extra">${icon('plus', 'ic-sm')}</button>
      </div>
      <label class="check" style="margin-bottom:12px"><input type="checkbox" data-change="sh-hide" ${Shop.hideDone ? 'checked' : ''}><span>Nascondi quello che ho già preso</span></label>
      ${all.length ? groups.map(([aisle, items]) => {
        const vis = Shop.hideDone ? items.filter(i => !state.cart[i.key]) : items;
        if (!vis.length) return '';
        return `<div class="aisle"><div class="aisle-title">${esc(aisle)}</div>
          ${vis.map(i => `<div class="row" style="gap:6px">
            <button class="shop-item ${state.cart[i.key] ? 'done' : ''}" data-action="sh-toggle" data-k="${esc(i.key)}" ${i.foodId ? `data-f="${esc(i.foodId)}"` : ''} aria-pressed="${!!state.cart[i.key]}">
              <span class="box">${state.cart[i.key] ? icon('check', 'ic-sm') : ''}</span>
              <span class="lbl">${esc(i.label)}</span>
              <span class="qty">${esc(i.qty)}</span>
            </button>
            ${i.extra ? `<button class="icon-btn sm" data-action="sh-extra-del" data-k="${esc(i.key)}" aria-label="Rimuovi ${esc(i.label)}">${icon('x', 'ic-sm')}</button>` : ''}
          </div>`).join('')}</div>`;
      }).join('') : `<div class="empty">${icon('shop')}<b>Lista vuota</b>${Shop.source === 'plan' ? 'Salva un piano nella sezione Piano.' : 'Nessun alimento nel periodo scelto.'}</div>`}
      <div class="row-wrap" style="margin-top:12px">
        <button class="btn btn-secondary btn-sm" data-action="sh-copy">${icon('copy', 'ic-sm')} Copia lista</button>
        <button class="btn btn-ghost btn-sm" data-action="sh-reset">${icon('undo', 'ic-sm')} Togli le spunte</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:8px">${icon('home')} Come funziona</div>
      <p class="small muted">Spuntando un alimento lo segni come preso e lo aggiungiamo a ciò che hai <b>in casa</b>: negli scambi gli alimenti in casa compaiono per primi.</p>
      <p class="small muted" style="margin-top:8px">«Togli le spunte» azzera solo la lista, non la dispensa. Gestisci la dispensa nella scheda «Dispensa e alimenti».</p>
      <p class="small muted" style="margin-top:8px">Le quantità sono a crudo, per i giorni scelti. Pasti liberi e aggiunte rapide non entrano nella lista.</p>
    </div>
  </div>`;
}

function renderFoods() {
  const pantry = allFoods().filter(f => inPantry(f.id));
  $('[data-shop-body]').innerHTML = `
  <div class="split-wide">
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('book')} Catalogo <span class="badge" data-food-count></span></div>
        <div class="row" style="gap:6px"><button class="btn btn-secondary btn-sm" data-action="scan-food">${icon('barcode', 'ic-sm')} Scansiona</button>
        <button class="btn btn-soft btn-sm" data-action="food-new">${icon('plus', 'ic-sm')} Nuovo alimento</button></div></div>
      <div class="row" style="margin-bottom:10px">
        <input class="input" placeholder="Cerca…" value="${esc(Shop.q)}" data-input="food-q" aria-label="Cerca nel catalogo">
        <select class="input" style="max-width:170px" data-change="food-cat" aria-label="Categoria">
          ${[['all', 'Tutti'], ['P', 'Proteine'], ['C', 'Carboidrati'], ['G', 'Grassi'], ['V', 'Verdure'], ['home', 'In casa'], ['custom', 'Creati da me']].map(([v, l]) => `<option value="${v}" ${Shop.cat === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="food-list" data-food-list></div>
      <p class="help" style="margin-top:10px">Valori per 100 g. Alimenti di base dalle tabelle CREA (Centro di ricerca Alimenti e Nutrizione, alimentinutrizione.it); prodotti confezionati da etichette medie: per questi fa fede la confezione che hai in mano.</p>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('home')} In casa</div><span class="small muted">${pantry.length}</span></div>
      ${pantry.length ? `<div class="chips">${pantry.map(f => `<button class="chip" data-action="pantry-toggle" data-f="${esc(f.id)}" aria-label="Rimuovi ${esc(f.name)} da In casa">${esc(f.name)} ${icon('x', 'ic-sm')}</button>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" data-action="pantry-clear">Svuota la dispensa</button>`
        : `<p class="small muted">Nessun alimento segnato. Usa l'icona casa nel catalogo o spunta gli alimenti nella lista della spesa.</p>`}
    </div>
  </div>`;
  renderFoodList();
}

function renderFoodList() {
  const list = searchFoods(Shop.q, {
    limit: 400,
    filter: f => Shop.cat === 'all' ? true : Shop.cat === 'home' ? inPantry(f.id) : Shop.cat === 'custom' ? !!f.custom : f.cat === Shop.cat
  });
  $('[data-food-count]').textContent = list.length;
  $('[data-food-list]').innerHTML = list.length ? list.map(f => `
    <div class="food-row">
      ${dot(f.cat)}
      <div class="item-main">
        <div class="item-name">${esc(f.name)} ${f.custom ? '<span class="badge">Mio</span>' : ''}</div>
        <div class="item-meta">${fmt0(f.kcal)} kcal · P ${fmt1(f.p)} · C ${fmt1(f.c)} · G ${fmt1(f.g)}${ST_LABEL[f.st] ? ' · ' + ST_LABEL[f.st] : ''} · ${f.custom ? 'tuo' : f.src ? 'fonte ' + f.src : 'da etichetta'}</div>
      </div>
      <button class="icon-btn sm" data-action="pantry-toggle" data-f="${esc(f.id)}" aria-pressed="${inPantry(f.id)}" aria-label="${inPantry(f.id) ? 'Togli da' : 'Segna'} in casa" title="In casa" style="${inPantry(f.id) ? 'color:var(--ok);background:var(--ok-soft)' : ''}">${icon('home', 'ic-sm')}</button>
      ${f.custom ? `<button class="icon-btn sm" data-action="food-edit" data-f="${esc(f.id)}" aria-label="Modifica">${icon('pencil', 'ic-sm')}</button>
        <button class="icon-btn sm" data-action="food-del" data-f="${esc(f.id)}" aria-label="Elimina">${icon('trash', 'ic-sm')}</button>` : ''}
      <button class="icon-btn sm" data-action="food-swap" data-f="${esc(f.id)}" aria-label="Trova equivalenti" title="Scambi">${icon('swap', 'ic-sm')}</button>
    </div>`).join('') : `<div class="empty">Nessun alimento trovato.</div>`;
}

/* ---------------- Azioni ---------------- */
ACTIONS['shop-tab'] = el => { Shop.tab = el.dataset.v; renderShop(); };
CHANGES['sh-src'] = el => { Shop.source = el.value; renderShopList(); };
CHANGES['sh-mult'] = el => { Shop.mult = Number(el.value); renderShopList(); };
CHANGES['sh-hide'] = el => { Shop.hideDone = el.checked; renderShopList(); };
ACTIONS['sh-toggle'] = el => {
  const k = el.dataset.k;
  state.cart[k] = !state.cart[k];
  if (state.cart[k] && el.dataset.f) state.pantry[el.dataset.f] = true;
  saveState(); renderShopList();
};
ACTIONS['sh-extra'] = () => {
  const inp = $('[data-shop-extra]'), v = inp.value.trim();
  if (!v) return;
  shopExtras().push({ id: uid('x'), label: v });
  saveState(); renderShopList();
  $('[data-shop-extra]').focus();
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-shop-extra]')) ACTIONS['sh-extra'](); });
ACTIONS['sh-extra-del'] = el => { state.shopExtra = shopExtras().filter(x => x.id !== el.dataset.k); delete state.cart[el.dataset.k]; saveState(); renderShopList(); };
ACTIONS['sh-reset'] = () => withUndo('Spunte tolte dalla lista', () => { state.cart = {}; }, renderShopList);
ACTIONS['sh-copy'] = async () => {
  const groups = shoppingItems();
  const txt = `Lista della spesa · ${APP_NAME}\n` + groups.map(([a, items]) => `\n${a}\n` + items.map(i => `${state.cart[i.key] ? '✓' : '•'} ${i.label}${i.qty ? ' — ' + i.qty : ''}`).join('\n')).join('\n');
  try { await navigator.clipboard.writeText(txt); toast('Lista copiata negli appunti', { icon: 'copy' }); }
  catch { toast('Copia non disponibile su questo browser', { icon: 'info' }); }
};

INPUTS['food-q'] = el => { Shop.q = el.value; renderFoodList(); };
CHANGES['food-cat'] = el => { Shop.cat = el.value; renderFoodList(); };
ACTIONS['pantry-toggle'] = el => {
  const id = el.dataset.f;
  if (state.pantry[id]) delete state.pantry[id]; else state.pantry[id] = true;
  saveState();
  Shop.tab === 'alimenti' ? renderFoods() : renderShopList();
};
ACTIONS['pantry-clear'] = () => withUndo('Dispensa svuotata', () => { state.pantry = {}; }, renderFoods);
ACTIONS['food-swap'] = el => { Swap.baseId = el.dataset.f; const f = getFood(el.dataset.f); Swap.grams = f.u ? f.u[1] : 100; switchTab('scambi'); };
ACTIONS['food-new'] = () => openFoodForm(null);
ACTIONS['food-edit'] = el => openFoodForm(el.dataset.f);
ACTIONS['food-del'] = el => {
  const f = state.customFoods.find(x => x.id === el.dataset.f);
  if (!f) return;
  /* archiviato, non cancellato: il diario e il piano continuano a mostrarlo correttamente */
  withUndo(`${f.name} eliminato`, () => { f.archived = true; delete state.pantry[f.id]; invalidateFoods(); }, () => { invalidateFoods(); renderFoods(); });
};

/* prefill: valori già pronti (es. dallo scanner); onSaved(alimento) dopo il salvataggio. */
function openFoodForm(id, { prefill = null, onSaved = null } = {}) {
  const f = id ? clone(state.customFoods.find(x => x.id === id))
    : Object.assign({ name: '', cat: 'P', aisle: AISLES.DISP, p: 0, c: 0, g: 0, kcal: 0, tags: [], u: null }, prefill || {});
  let cat = f.cat;
  openSheet({
    title: id ? 'Modifica alimento' : 'Nuovo alimento',
    body: `
      <div class="field"><label for="cf-name">Nome e marca</label><input id="cf-name" class="input" maxlength="60" value="${esc(f.name)}" placeholder="Es. Pane proteico Marca X" autofocus></div>
      <div class="field"><span class="field-label">Categoria principale</span>
        <div class="seg" data-cf-cat>${['P', 'C', 'G', 'V'].map(c => `<button type="button" data-c="${c}" aria-pressed="${cat === c}">${CAT_LABEL[c]}</button>`).join('')}</div></div>
      <div class="field"><label for="cf-aisle">Reparto</label><select id="cf-aisle" class="input">${Object.values(AISLES).map(a => `<option ${f.aisle === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      <div class="section-label">Valori per 100 g (dall'etichetta)</div>
      <div class="grid-2">
        <div class="field"><label for="cf-p" class="c-pro">Proteine (g)</label><input id="cf-p" class="input input-num" type="number" inputmode="decimal" step="0.1" min="0" value="${f.p}"></div>
        <div class="field"><label for="cf-c" class="c-cho">Carboidrati (g)</label><input id="cf-c" class="input input-num" type="number" inputmode="decimal" step="0.1" min="0" value="${f.c}"></div>
        <div class="field"><label for="cf-g" class="c-fat">Grassi (g)</label><input id="cf-g" class="input input-num" type="number" inputmode="decimal" step="0.1" min="0" value="${f.g}"></div>
        <div class="field"><label for="cf-k">Calorie (kcal)</label><input id="cf-k" class="input input-num" type="number" inputmode="decimal" min="0" value="${f.kcal || ''}" placeholder="auto"></div>
      </div>
      <div class="section-label">Porzione (facoltativa)</div>
      <div class="grid-2">
        <div class="field"><input id="cf-un" class="input" maxlength="20" placeholder="Es. fetta, barretta" value="${esc(f.u ? f.u[0] : '')}" aria-label="Nome porzione"></div>
        <div class="field"><div class="input-suffix"><input id="cf-ug" class="input input-num" type="number" inputmode="decimal" min="1" placeholder="Grammi" value="${f.u ? f.u[1] : ''}" aria-label="Grammi per porzione"><span class="suffix">g</span></div></div>
      </div>
      <div class="section-label">Adatto a</div>
      <div class="row-wrap" style="gap:16px">
        ${[['veg', 'Vegetariani'], ['vegan', 'Vegani'], ['nolact', 'Senza lattosio']].map(([t, l]) => `<label class="check"><input type="checkbox" data-tag="${t}" ${(f.tags || []).includes(t) ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>`,
    foot: `<button class="btn btn-secondary" data-cancel>Annulla</button><button class="btn btn-primary" data-ok>${icon('check', 'ic-sm')} Salva</button>`,
    onMount: (root, close) => {
      root.querySelector('[data-cf-cat]').addEventListener('click', e => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        cat = b.dataset.c;
        root.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      });
      const v = s => Math.max(0, num(root.querySelector(s).value, 0));
      const kIn = root.querySelector('#cf-k');
      const autoK = () => { kIn.placeholder = fmt0(v('#cf-p') * 4 + v('#cf-c') * 4 + v('#cf-g') * 9) || 'auto'; };
      ['#cf-p', '#cf-c', '#cf-g'].forEach(s => root.querySelector(s).addEventListener('input', autoK));
      autoK();
      root.querySelector('[data-cancel]').addEventListener('click', close);
      root.querySelector('[data-ok]').addEventListener('click', () => {
        const name = root.querySelector('#cf-name').value.trim();
        if (!name) return toast('Inserisci il nome dell’alimento', { icon: 'info' });
        const p = v('#cf-p'), c = v('#cf-c'), g = v('#cf-g');
        const un = root.querySelector('#cf-un').value.trim(), ug = v('#cf-ug');
        const item = {
          id: id || uid('cust'), name, cat, aisle: root.querySelector('#cf-aisle').value,
          p: Math.round(p * 10) / 10, c: Math.round(c * 10) / 10, g: Math.round(g * 10) / 10,
          kcal: Math.round(kIn.value.trim() ? v('#cf-k') : p * 4 + c * 4 + g * 9),
          tags: $$('[data-tag]', root).filter(x => x.checked).map(x => x.dataset.tag),
          u: un && ug ? [un, ug] : null, st: 'k', custom: true
        };
        if (f.ean) item.ean = f.ean;
        if (id) state.customFoods[state.customFoods.findIndex(x => x.id === id)] = item;
        else { state.customFoods.unshift(item); state.pantry[item.id] = true; }
        invalidateFoods();
        saveState();
        close();
        refreshAll();
        if (onSaved) onSaved(item); else toast(`${name} salvato`);
      });
    }
  });
}
