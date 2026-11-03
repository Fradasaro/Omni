/* ==========================================================================
   OGGI: calendario, nota del coach, riepilogo, acqua, pasti.
   Principi: nessun rosso sui numeri, nessuna compensazione punitiva,
   un pasto libero non "rompe" niente.
   ========================================================================== */
'use strict';

const Today = {
  date: todayISO(),
  openSwap: null,        // 'mIdx:iIdx'
  forceGeneralTip: false
};

/* ---------------- Nota del coach ---------------- */
function coachTip(day, iso) {
  const isToday = iso === todayISO();
  const hour = new Date().getHours();
  if (dayHasFree(day)) {
    return { calm: true, icon: 'heart', t: 'Hai goduto di un pasto fuori piano 🍕',
      d: 'Un singolo pasto non rovina i tuoi progressi. Goditelo e riprendi normalmente il tuo piano dal prossimo pasto, senza digiuni o tagli punitivi.' };
  }
  if (isToday && !Today.forceGeneralTip) {
    const mealHasVeg = slot => {
      const m = day.meals.find(x => x.slotId === slot || norm(x.name) === slot);
      return m && m.items.length ? m.items.some(it => it.type === 'food' && getFood(it.foodId).cat === 'V') : null;
    };
    const anyFood = day.meals.some(m => m.items.length);
    if (hour >= 11 && day.water === 0) return { icon: 'drop', t: 'Un bicchiere d’acqua?', d: 'Non hai ancora segnato acqua oggi. Bere con regolarità aiuta energia, concentrazione e sazietà.' };
    if (hour >= 13 && mealHasVeg('pranzo') === false) return { icon: 'leaf', t: 'Hai aggiunto le verdure a pranzo?', d: 'Pesano pochissimo nei macro, ma sono essenziali per sazietà, fibre e micronutrienti. Puoi registrarle dal pulsante Aggiungi.' };
    if (hour >= 20 && mealHasVeg('cena') === false) return { icon: 'leaf', t: 'Verdure anche a cena', d: 'Un contorno di verdure a cena completa la giornata: fibre, vitamine e volume nel piatto con poche calorie.' };
    if (hour >= 17 && anyFood && !day.meals.some(m => m.items.some(it => it.type === 'food' && getFood(it.foodId).aisle === A.FRUTTA))) {
      return { icon: 'leaf', t: 'Frutta oggi?', d: 'Due o tre porzioni di frutta al giorno portano vitamine e fibre. Va benissimo anche come spuntino.' };
    }
    const last = state.weightLogs[state.weightLogs.length - 1];
    if (!last || daysBetween(last.date, iso) >= 8) return { icon: 'scale', t: 'Pesata settimanale', d: 'Se ti va, pesati a digiuno e registra il valore nel Profilo. Conta il trend delle settimane, non il singolo numero.' };
    const lb = state.settings.lastBackup;
    if (Object.keys(state.days).length > 14 && (!lb || daysBetween(lb.slice(0, 10), iso) > 30)) {
      return { icon: 'download', t: 'Fai un backup', d: 'I tuoi dati sono salvati solo su questo dispositivo. Scarica un backup dal Profilo per sicurezza.' };
    }
  }
  const doy = Math.floor((parseISO(iso) - new Date(parseISO(iso).getFullYear(), 0, 0)) / 864e5);
  const tip = GENERAL_TIPS[(doy + (state.settings.coachSkip || 0)) % GENERAL_TIPS.length];
  return { icon: 'bulb', t: tip.t, d: tip.d, general: true };
}

/* ---------------- Banner "Aggiungi alla Home" ----------------
   Compare solo su telefono, se l'app è aperta nel browser e non installata. */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  if (typeof currentTab !== 'undefined' && currentTab === 'oggi' && state.profile) renderToday();
});
window.addEventListener('appinstalled', () => { deferredInstall = null; state.settings.installHidden = true; saveState(); });
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /Android/i.test(navigator.userAgent);

function installBannerHtml() {
  if (state.settings.installHidden || isStandalone() || !isMobile()) return '';
  let how;
  if (isIOS()) how = `Apri questa pagina con <b style="display:inline">Safari</b>, tocca Condividi ${icon('share', 'ic-sm')} e poi «Aggiungi alla schermata Home».`;
  else if (deferredInstall) how = 'Si apre a schermo intero, funziona anche offline e i tuoi dati restano più al sicuro.';
  else how = 'Nel menu ⋮ di Chrome scegli «Installa app» o «Aggiungi a schermata Home».';
  return `<div class="install" role="note">
    <span class="ic-wrap">${icon('phone')}</span>
    <div style="flex:1"><b>Installa ${esc(APP_NAME)} sul telefono</b><p>${how}</p>
      ${deferredInstall ? `<button class="btn btn-primary btn-sm" data-action="install-app">${icon('download', 'ic-sm')} Installa</button>` : ''}</div>
    <button class="icon-btn sm" data-action="install-hide" aria-label="Nascondi">${icon('x', 'ic-sm')}</button>
  </div>`;
}
ACTIONS['install-app'] = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch (e) { /* ignora */ }
  deferredInstall = null;
  renderToday();
};
ACTIONS['install-hide'] = () => { state.settings.installHidden = true; saveState(); renderToday(); };

/* ---------------- Render ---------------- */
function renderToday() {
  const iso = Today.date;
  const day = getDay(iso);
  const T = target();
  const tot = dayTotals(day);
  const free = dayHasFree(day);
  const hasFood = day.meals.some(m => m.items.length);
  const tip = coachTip(day, iso);

  /* settimana (lun-dom) che contiene la data attiva */
  const d0 = parseISO(iso);
  const monday = addDays(iso, -((d0.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = todayISO();
  const monthLbl = d0.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  /* stato giornata */
  const inLine = hasFood && !free && Math.abs(tot.kcal - T.kcal) <= TOL.kcal &&
    Math.abs(tot.p - T.p) <= TOL.macro && Math.abs(tot.c - T.c) <= TOL.macro && Math.abs(tot.g - T.g) <= TOL.macro;
  const status = free ? `<span class="status-pill calm">Pasto libero</span>` : inLine ? `<span class="status-pill ok">In linea con il piano</span>` : '';
  const dk = T.kcal - tot.kcal;
  const kcalNote = !hasFood ? `Obiettivo ${fmt0(T.kcal)} kcal`
    : free ? 'Riprendi il piano dal prossimo pasto'
    : Math.abs(dk) <= TOL.kcal ? 'In linea'
    : dk > 0 ? `Restano ${fmt0(dk)} kcal` : `+${fmt0(-dk)} kcal rispetto al piano`;

  /* media 7 giorni */
  let s7 = 0, n7 = 0;
  for (let i = 0; i < 7; i++) {
    const dd = state.days[addDays(iso, -i)];
    if (dd) { const t = dayTotals(dd); if (t.kcal > 0) { s7 += t.kcal; n7++; } }
  }

  /* completa la giornata */
  const emptyWithPlan = day.meals.filter((m, i) => !m.items.length && planMealFor(m, i)).length;
  const completeBox = (!free && hasFood && emptyWithPlan)
    ? `<div class="complete-day"><p><b>Completa la giornata</b>${emptyWithPlan === 1 ? 'Il pasto che manca viene compilato' : `I ${emptyWithPlan} pasti che mancano vengono compilati`} dal piano e adattati a quello che hai già mangiato. I pasti registrati non vengono toccati.</p>
       <button class="btn btn-soft btn-sm" data-action="complete-day">${icon('sparkles', 'ic-sm')} Completa</button></div>`
    : '';

  const macro = (key, name, cls, val, tgt) => {
    const diff = tgt - val;
    const dTxt = !hasFood || free ? '&nbsp;' : Math.abs(diff) <= TOL.macro ? 'In linea' : diff > 0 ? `Mancano ${fmt0(diff)} g` : `+${fmt0(-diff)} g`;
    const ok = hasFood && !free && Math.abs(diff) <= TOL.macro;
    return `<div class="macro">
      <div class="macro-top"><span class="macro-name c-${cls}">${name}</span></div>
      <div class="macro-val">${fmt0(val)}<span> / ${fmt0(tgt)} g</span></div>
      <div class="bar"><i class="bg-${cls}" style="width:${Math.min(100, val / Math.max(1, tgt) * 100)}%"></i></div>
      <div class="macro-delta ${ok ? 'ok' : ''}">${dTxt}</div></div>`;
  };

  const first = (state.profile.name || '').trim().split(/\s+/)[0];
  $('#view-oggi').innerHTML = `
  <div class="today-wrap">
    <div class="today-greet"><h1>${esc(first ? 'Ciao, ' + first : 'Ciao')}</h1><small>${esc(state.plan ? goalName(state.plan.cfg.goal) : '')} · ${fmt0(T.kcal)} kcal</small></div>
    ${installBannerHtml()}
    <div class="datebar">
      <button class="icon-btn" data-action="week-shift" data-d="-7" aria-label="Settimana precedente">${icon('left')}</button>
      <label class="month-btn">${esc(monthLbl)} ${icon('down', 'ic-sm')}
        <input type="date" value="${iso}" data-change="pick-date" aria-label="Scegli una data">
      </label>
      <button class="icon-btn" data-action="week-shift" data-d="7" aria-label="Settimana successiva">${icon('right')}</button>
      <span class="spacer"></span>
      ${iso !== today ? `<button class="btn btn-soft btn-sm" data-action="go-today">Oggi</button>` : ''}
    </div>
    <div class="days">
      ${week.map(d => {
        const dd = parseISO(d);
        return `<button class="day ${dayLogged(state.days[d]) ? 'logged' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}" data-action="select-day" data-d="${d}" ${d === iso ? 'aria-current="date"' : ''} aria-label="${esc(dd.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}">
          <small>${d === today ? 'Oggi' : esc(dd.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''))}</small><b>${dd.getDate()}</b><i></i></button>`;
      }).join('')}
    </div>

    <div class="coach ${tip.calm ? 'calm' : ''}">
      ${icon(tip.icon)}
      <div><b>${esc(tip.t)}</b><p>${esc(tip.d)}</p></div>
      ${tip.calm ? '' : `<button class="icon-btn sm" data-action="coach-next" aria-label="Un altro consiglio" title="Un altro consiglio">${icon('refresh', 'ic-sm')}</button>`}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">${iso === today ? 'Oggi' : esc(d0.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        ${status}
        <button class="icon-btn sm" data-action="day-menu" aria-label="Altre azioni sulla giornata">${icon('more')}</button>
      </div>
      <div class="kcal-hero">
        <div class="kcal-num">${fmt0(tot.kcal)} <span>/ ${fmt0(T.kcal)} kcal</span></div>
        <div class="small muted">${kcalNote}</div>
      </div>
      <div class="bar lg" style="margin-bottom:14px"><i style="width:${Math.min(100, tot.kcal / Math.max(1, T.kcal) * 100)}%;${free ? 'background:var(--calm)' : ''}"></i></div>
      <div class="grid-3">
        ${macro('p', 'Proteine', 'pro', tot.p, T.p)}
        ${macro('c', 'Carboidrati', 'cho', tot.c, T.c)}
        ${macro('g', 'Grassi', 'fat', tot.g, T.g)}
      </div>
      ${completeBox}
      <button type="button" class="week-link" data-action="week-open">
        <span>${icon('chart', 'ic-sm')} Media 7 giorni: ${n7 ? `${fmt0(s7 / n7)} kcal · ${n7} ${n7 === 1 ? 'giorno registrato' : 'giorni registrati'}` : 'nessun giorno registrato'}</span>
        <b>La settimana ${icon('right', 'ic-sm')}</b></button>
    </div>

    <div class="card water" style="margin-top:16px">
      <div class="water-info">
        <div class="between"><span class="row" style="gap:8px;font-weight:700">${icon('drop', 'ic-sm c-pro')} Acqua</span><span class="small muted num">${fmt1(day.water / 1000)} / ${fmt1((state.profile.water || 2500) / 1000)} L</span></div>
        <div class="bar"><i style="width:${Math.min(100, day.water / (state.profile.water || 2500) * 100)}%"></i></div>
      </div>
      <div class="water-btns">
        <button class="btn btn-secondary btn-sm" data-action="water" data-ml="-250" aria-label="Togli 250 ml">−</button>
        <button class="btn btn-secondary btn-sm" data-action="water" data-ml="250">+250 ml</button>
        <button class="btn btn-secondary btn-sm" data-action="water" data-ml="500">+500 ml</button>
      </div>
    </div>

    <div style="margin-top:16px">${day.meals.map((m, i) => mealHtml(m, i)).join('')}</div>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="add-meal">${icon('plus', 'ic-sm')} Aggiungi un pasto</button>
  </div>`;
  tourAfterRender();
}

function mealHtml(meal, mIdx) {
  const t = sumMacros(meal.items);
  const pm = planMealFor(meal, mIdx);
  const preview = pm ? pm.items.map(i => `${fmt0(i.grams)} g ${getFood(i.foodId).name}`).join(' · ') : '';
  let body;
  if (!meal.items.length) {
    body = `<div class="ghost">
      ${pm ? `<button class="ghost-load" data-action="load-plan-meal" data-m="${mIdx}"><b>${icon('zap', 'ic-sm')} Inserisci dal piano</b><small>${esc(preview)}</small></button>` : `<span class="small muted" style="flex:1">Ancora nessun alimento</span>`}
      <button class="btn btn-secondary btn-sm" data-action="add-food" data-m="${mIdx}">${icon('search', 'ic-sm')} Cerca</button>
    </div>`;
  } else {
    body = meal.items.map((it, iIdx) => itemHtml(it, mIdx, iIdx)).join('') + `
      <div class="meal-foot">
        <button class="btn btn-ghost btn-sm" data-action="add-food" data-m="${mIdx}">${icon('plus', 'ic-sm')} Alimento</button>
        ${pm ? `<button class="btn btn-ghost btn-sm" data-action="load-plan-meal" data-m="${mIdx}">${icon('undo', 'ic-sm')} Ripristina dal piano</button>` : ''}
      </div>`;
  }
  return `<article class="meal">
    <div class="meal-head">
      <input class="meal-name" value="${esc(meal.name)}" data-change="rename-meal" data-m="${mIdx}" aria-label="Nome del pasto" maxlength="40">
      <span class="meal-kcal">${meal.items.length ? `${fmt0(t.kcal)} kcal` : ''}</span>
      <button class="icon-btn sm" data-action="meal-menu" data-m="${mIdx}" aria-label="Azioni per ${esc(meal.name)}">${icon('more')}</button>
    </div>
    ${meal.items.length ? `<div class="xs faint num" style="margin:-2px 0 4px">${macroTxt(t)}</div>` : ''}
    ${body}
  </article>`;
}

function itemHtml(it, mIdx, iIdx) {
  const rm = `<button class="icon-btn" data-action="item-remove" data-m="${mIdx}" data-i="${iIdx}" aria-label="Rimuovi">${icon('x', 'ic-sm')}</button>`;
  if (it.type === 'free' || it.type === 'quick') {
    const pre = it.type === 'free' ? FREE_MEAL_PRESETS.find(p => p.id === it.presetId) : null;
    return `<div class="item free">
      <span style="font-size:20px;width:22px;text-align:center">${pre ? pre.emoji : it.type === 'free' ? '🍽️' : ''}</span>
      ${it.type === 'quick' ? icon('zap', 'ic-sm faint') : ''}
      <div class="item-main"><div class="item-name">${esc(it.label)}</div>
        <div class="item-meta">${it.type === 'free' ? `<span class="badge calm">Pasto libero</span> ≈ ${fmt0(it.kcal)} kcal` : `Aggiunta rapida · ${fmt0(it.kcal)} kcal · ${macroTxt(it)}`}</div></div>
      ${rm}</div>`;
  }
  const f = getFood(it.foodId);
  const m = itemMacros(it);
  const key = `${mIdx}:${iIdx}`;
  const hint = cookedHint(f, it.grams);
  const swapOpen = Today.openSwap === key;
  const step = state.settings.round5 ? 5 : 1;
  const at = `data-m="${mIdx}" data-i="${iIdx}"`;
  const main = `<div class="item-name">${esc(f.name)} ${inPantry(f.id) ? '<span class="badge home">In casa</span>' : ''}</div>
        <div class="item-meta">${fmt0(m.kcal)} kcal${hint ? ` · ${hint}` : ''}${f.missing ? '' : ` · <span class="item-swap-hint">${icon('swap', 'ic-xs')} scambia</span>`}</div>`;
  /* Tocco sul nome = scambi (l'azione più usata); rimuovi sta nel menu ⋯,
     lontano dai grammi, così non si tocca per sbaglio. */
  return `<div class="item">
      ${dot(f.cat)}
      ${f.missing ? `<div class="item-main">${main}</div>`
        : `<button type="button" class="item-main item-tap" data-action="item-swap" ${at} aria-expanded="${swapOpen}" aria-label="Scambia ${esc(f.name)}">${main}</button>`}
      <div class="stepper">
        <button type="button" class="step-btn" data-action="item-step" ${at} data-d="-${step}" aria-label="Togli ${step} g di ${esc(f.name)}">−</button>
        <div class="item-grams-wrap"><input class="input item-grams" type="number" inputmode="decimal" min="1" max="3000" step="${step}" value="${it.grams}" data-change="item-grams" ${at} aria-label="Grammi di ${esc(f.name)}"></div>
        <button type="button" class="step-btn" data-action="item-step" ${at} data-d="${step}" aria-label="Aggiungi ${step} g di ${esc(f.name)}">+</button>
      </div>
      <button class="icon-btn" data-action="item-menu" ${at} aria-label="Altre azioni per ${esc(f.name)}">${icon('more')}</button>
    </div>
    ${swapOpen ? swapDrawerHtml(it, f, mIdx, iIdx) : ''}`;
}

function swapDrawerHtml(it, f, mIdx, iIdx) {
  const alts = computeEquivalents(f, it.grams, { limit: 6 });
  const m = itemMacros(it);
  return `<div class="swap-drawer">
    <div class="xs muted">Equivalenti a ${fmt0(it.grams)} g di ${esc(f.name)} (${macroTxt(m)}), prima quelli in casa:</div>
    ${alts.length ? `<div class="swap-list">${alts.map(a => `
      <button class="swap-opt" data-action="swap-apply" data-m="${mIdx}" data-i="${iIdx}" data-f="${esc(a.food.id)}" data-g="${a.grams}">
        <span><b>${esc(a.food.name)}</b><small>${fmt0(a.kcal)} kcal · ${macroTxt(a)}${a.home ? ' · in casa' : ''}</small></span>
        <span class="g">${fmt0(a.grams)} g</span></button>`).join('')}</div>`
      : `<div class="small muted" style="margin-top:6px">Nessun equivalente realistico per questo alimento.</div>`}
  </div>`;
}

/* ---------------- Azioni ---------------- */
const curDay = () => getDay(Today.date);
const commitToday = () => { saveState(); renderToday(); };

function setDate(iso) { Today.date = iso; Today.openSwap = null; Today.forceGeneralTip = false; getDay(iso); renderToday(); }
ACTIONS['select-day'] = el => setDate(el.dataset.d);
ACTIONS['week-shift'] = el => setDate(addDays(Today.date, Number(el.dataset.d)));
ACTIONS['go-today'] = () => setDate(todayISO());
CHANGES['pick-date'] = el => { if (el.value) setDate(el.value); };
ACTIONS['coach-next'] = () => { state.settings.coachSkip = (state.settings.coachSkip || 0) + 1; Today.forceGeneralTip = true; commitToday(); };

ACTIONS['water'] = el => {
  const day = curDay(), before = day.water, goal = state.profile.water || 2500;
  day.water = Math.max(0, day.water + Number(el.dataset.ml));
  commitToday();
  if (before < goal && day.water >= goal) toast('Obiettivo acqua raggiunto', { icon: 'drop' });
};

CHANGES['rename-meal'] = el => {
  const v = el.value.trim();
  const meal = curDay().meals[Number(el.dataset.m)];
  if (!v) { el.value = meal.name; return; }
  meal.name = v.slice(0, 40);
  saveState();
};
CHANGES['item-grams'] = el => {
  const it = curDay().meals[Number(el.dataset.m)].items[Number(el.dataset.i)];
  it.grams = clamp(Math.round(num(el.value, it.grams)), 1, 3000);
  commitToday();
};
ACTIONS['item-remove'] = el => {
  const m = Number(el.dataset.m), i = Number(el.dataset.i);
  const it = curDay().meals[m].items[i];
  const name = it.type === 'food' ? getFood(it.foodId).name : it.label;
  Today.openSwap = null;
  withUndo(`${name} rimosso`, () => curDay().meals[m].items.splice(i, 1), renderToday);
};
/* ± a passi di 5 g (o 1 g), agganciati alla griglia: 103 g + 5 → 105 g. */
ACTIONS['item-step'] = el => {
  const it = curDay().meals[Number(el.dataset.m)].items[Number(el.dataset.i)];
  const d = Number(el.dataset.d), step = Math.abs(d);
  const next = d > 0 ? Math.floor(it.grams / step) * step + step : Math.ceil(it.grams / step) * step - step;
  it.grams = clamp(next, step, 3000);
  commitToday();
};
ACTIONS['item-menu'] = el => {
  const m = Number(el.dataset.m), i = Number(el.dataset.i);
  const f = getFood(curDay().meals[m].items[i].foodId);
  openSheet({
    title: f.name,
    body: `<div class="action-list">
      ${f.missing ? '' : `<button class="action brand" data-it-act="swap"><span class="ic-wrap">${icon('swap')}</span><span><b>Scambia con un equivalente</b><small>Stessi macro, prima quello che hai in casa</small></span></button>`}
      <button class="action danger" data-it-act="remove"><span class="ic-wrap">${icon('trash')}</span><span><b>Rimuovi dal pasto</b><small>Puoi annullare subito dopo</small></span></button>
    </div>`,
    onMount: (root, close) => root.addEventListener('click', e => {
      const b = e.target.closest('[data-it-act]');
      if (!b) return;
      close();
      const ds = { dataset: { m, i } };
      if (b.dataset.itAct === 'swap') { Today.openSwap = null; ACTIONS['item-swap'](ds); }
      else ACTIONS['item-remove'](ds);
    })
  });
};
ACTIONS['item-swap'] = el => {
  const key = `${el.dataset.m}:${el.dataset.i}`;
  Today.openSwap = Today.openSwap === key ? null : key;
  renderToday();
};
ACTIONS['swap-apply'] = el => {
  const meal = curDay().meals[Number(el.dataset.m)];
  meal.items[Number(el.dataset.i)] = { type: 'food', foodId: el.dataset.f, grams: Number(el.dataset.g) };
  Today.openSwap = null;
  commitToday();
  toast(`Sostituito con ${el.dataset.g} g di ${getFood(el.dataset.f).name}`, { icon: 'swap' });
};

ACTIONS['load-plan-meal'] = el => {
  const mIdx = Number(el.dataset.m), meal = curDay().meals[mIdx];
  const pm = planMealFor(meal, mIdx);
  if (!pm) return;
  const apply = () => { meal.items = pm.items.map(i => ({ type: 'food', foodId: i.foodId, grams: i.grams })); };
  if (meal.items.length) withUndo(`${meal.name} ripristinato dal piano`, apply, renderToday);
  else { apply(); commitToday(); }
};

/* Completa i pasti vuoti adattandoli a ciò che è già stato mangiato.
   Non tocca mai i pasti registrati e non scende sotto il 60% del piano:
   niente cene "punitive". */
ACTIONS['complete-day'] = () => {
  const day = curDay(), T = target();
  if (dayHasFree(day)) return;
  const eaten = dayTotals(day);
  const empty = day.meals.map((m, i) => ({ m, pm: !m.items.length ? planMealFor(m, i) : null })).filter(x => x.pm);
  if (!empty.length) return;
  const tpl = { p: 0, c: 0, g: 0 };
  empty.forEach(x => x.pm.items.forEach(it => { const mm = itemMacros({ type: 'food', ...it }); tpl.p += mm.p; tpl.c += mm.c; tpl.g += mm.g; }));
  const ratio = (rem, have) => have > 2 ? clamp(Math.max(0, rem) / have, 0.6, 1.5) : 1;
  const k = { P: ratio(T.p - eaten.p, tpl.p), C: ratio(T.c - eaten.c, tpl.c), G: ratio(T.g - eaten.g, tpl.g), V: 1 };
  const floored = [k.P, k.C, k.G].some(v => v === 0.6);
  empty.forEach(x => {
    x.m.items = x.pm.items.map(it => {
      const f = getFood(it.foodId);
      return { type: 'food', foodId: it.foodId, grams: roundGrams(it.grams * (k[f.cat] || 1)) };
    });
  });
  commitToday();
  toast(floored ? 'Pasti completati. Non li riduciamo oltre: un giorno sopra il piano va benissimo.' : 'Pasti completati e adattati alla giornata', { icon: 'sparkles' });
};

ACTIONS['add-meal'] = () => {
  const day = curDay();
  day.meals.push({ id: uid('m'), slotId: null, name: `Pasto ${day.meals.length + 1}`, items: [] });
  commitToday();
  const inputs = $$('#view-oggi .meal-name');
  const last = inputs[inputs.length - 1];
  if (last) { last.focus(); last.select(); }
};

ACTIONS['meal-menu'] = el => {
  const mIdx = Number(el.dataset.m), day = curDay(), meal = day.meals[mIdx];
  const pm = planMealFor(meal, mIdx);
  const acts = [
    { a: 'rename', ic: 'pencil', t: 'Rinomina' },
    pm ? { a: 'plan', ic: 'zap', t: 'Inserisci dal piano', s: meal.items.length ? 'Sostituisce gli alimenti attuali' : '' } : null,
    mIdx > 0 ? { a: 'up', ic: 'arrowUp', t: 'Sposta su' } : null,
    mIdx < day.meals.length - 1 ? { a: 'down', ic: 'arrowDown', t: 'Sposta giù' } : null,
    meal.items.length ? { a: 'recipe', ic: 'chef', t: 'Salva come ricetta', s: 'Per riaggiungerlo in un tocco' } : null,
    meal.items.length ? { a: 'clear', ic: 'rotate', t: 'Svuota il pasto' } : null,
    { a: 'delete', ic: 'trash', t: 'Elimina il pasto', danger: true }
  ].filter(Boolean);
  openSheet({
    title: meal.name,
    body: `<div class="action-list">${acts.map(x => `<button class="action ${x.danger ? 'danger' : ''}" data-m-act="${x.a}"><span class="ic-wrap">${icon(x.ic === 'rotate' ? 'undo' : x.ic)}</span><span><b>${esc(x.t)}</b>${x.s ? `<small>${esc(x.s)}</small>` : ''}</span></button>`).join('')}</div>`,
    onMount: (root, close) => root.addEventListener('click', e => {
      const b = e.target.closest('[data-m-act]');
      if (!b) return;
      close();
      const a = b.dataset.mAct;
      if (a === 'rename') { const inp = $$('#view-oggi .meal-name')[mIdx]; if (inp) { inp.focus(); inp.select(); } }
      if (a === 'plan') ACTIONS['load-plan-meal']({ dataset: { m: mIdx } });
      if (a === 'up' || a === 'down') { const j = a === 'up' ? mIdx - 1 : mIdx + 1; [day.meals[mIdx], day.meals[j]] = [day.meals[j], day.meals[mIdx]]; commitToday(); }
      if (a === 'recipe') recipeFromMeal(meal);
      if (a === 'clear') withUndo(`${meal.name} svuotato`, () => { meal.items = []; }, renderToday);
      if (a === 'delete') withUndo(`${meal.name} eliminato`, () => day.meals.splice(mIdx, 1), renderToday);
    })
  });
};

ACTIONS['day-menu'] = () => {
  const day = curDay();
  openSheet({
    title: 'Giornata',
    body: `<div class="action-list">
      <button class="action brand" data-d-act="plan"><span class="ic-wrap">${icon('zap')}</span><span><b>Carica tutto il piano</b><small>Sostituisce i pasti di questa giornata</small></span></button>
      <button class="action" data-d-act="copy"><span class="ic-wrap">${icon('copy')}</span><span><b>Copia i pasti del giorno prima</b></span></button>
      <button class="action danger" data-d-act="clear"><span class="ic-wrap">${icon('trash')}</span><span><b>Svuota la giornata</b><small>Puoi annullare subito dopo</small></span></button>
    </div>`,
    onMount: (root, close) => root.addEventListener('click', e => {
      const b = e.target.closest('[data-d-act]');
      if (!b) return;
      close();
      if (b.dataset.dAct === 'plan') loadWholePlan();
      if (b.dataset.dAct === 'copy') copyPrevDay();
      if (b.dataset.dAct === 'clear') withUndo('Giornata svuotata', () => { state.days[Today.date] = newDayRecord(); }, renderToday);
    })
  });
};

function loadWholePlan() {
  if (!state.plan || !state.plan.meals) return toast('Salva prima il tuo piano nella sezione Piano', { icon: 'info' });
  const apply = () => {
    getDay(Today.date).meals = state.plan.meals.map(m => ({ id: uid('m'), slotId: m.slotId, name: m.name, items: m.items.map(i => ({ type: 'food', foodId: i.foodId, grams: i.grams })) }));
  };
  if (curDay().meals.some(m => m.items.length)) withUndo('Piano caricato nella giornata', apply, renderToday);
  else { apply(); commitToday(); toast('Piano caricato nella giornata', { icon: 'zap' }); }
}
function copyPrevDay() {
  const prev = state.days[addDays(Today.date, -1)];
  if (!prev || !prev.meals.some(m => m.items.length)) return toast('Il giorno prima non ha pasti registrati', { icon: 'info' });
  withUndo('Pasti copiati dal giorno prima', () => {
    curDay().meals = clone(prev.meals).map(m => Object.assign(m, { id: uid('m') }));
  }, renderToday);
}

/* ---------------- Menu "Aggiungi" (FAB) ---------------- */
ACTIONS['open-add-menu'] = () => {
  openSheet({
    title: 'Aggiungi',
    /* Le due azioni più frequenti in grande, il resto in una lista compatta. */
    body: `<div class="add-main">
        <button class="add-tile brand" data-add="food">${icon('search')}<b>Cerca</b><small>Un alimento</small></button>
        <button class="add-tile" data-add="scan">${icon('barcode')}<b>Scansiona</b><small>Codice a barre</small></button>
      </div>
      <div class="add-more">
        <button class="add-row" data-add="recipe">${icon('chef', 'ic-sm')}<span>Una ricetta</span></button>
        <button class="add-row calm" data-add="free">${icon('pizza', 'ic-sm')}<span>Pasto libero</span></button>
        <button class="add-row" data-add="quick">${icon('zap', 'ic-sm')}<span>Aggiunta rapida</span></button>
        <button class="add-row" data-add="water">${icon('drop', 'ic-sm')}<span>Acqua +250 ml</span></button>
        <button class="add-row wide" data-add="plan">${icon('list', 'ic-sm')}<span>Carica tutto il piano</span></button>
      </div>`,
    onMount: (root, close) => root.addEventListener('click', e => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      close();
      const a = b.dataset.add, m = suggestMealIdx();
      if (a === 'food') openAddFood(m);
      if (a === 'scan') openScanner(m);
      if (a === 'recipe') openRecipeLog(null, m);
      if (a === 'free') openFreeMeal(m);
      if (a === 'quick') openQuickAdd(m);
      if (a === 'water') ACTIONS.water({ dataset: { ml: 250 } });
      if (a === 'plan') loadWholePlan();
    })
  });
};
ACTIONS['add-food'] = el => openAddFood(Number(el.dataset.m));

/* Primo pasto ancora vuoto, altrimenti l'ultimo. */
function suggestMealIdx() {
  const meals = curDay().meals;
  const i = meals.findIndex(m => !m.items.length);
  return i >= 0 ? i : Math.max(0, meals.length - 1);
}
function mealChips(sel) {
  const meals = curDay().meals;
  if (!meals.length) curDay().meals.push({ id: uid('m'), slotId: null, name: 'Pasto 1', items: [] });
  return `<div class="field"><span class="field-label">Pasto</span><div class="chips" data-meal-chips>
    ${curDay().meals.map((m, i) => `<button type="button" class="chip" data-meal="${i}" aria-pressed="${i === sel}">${esc(m.name)}</button>`).join('')}</div></div>`;
}
function bindMealChips(root, get, set) {
  root.querySelector('[data-meal-chips]').addEventListener('click', e => {
    const b = e.target.closest('[data-meal]');
    if (!b) return;
    set(Number(b.dataset.meal));
    root.querySelectorAll('[data-meal]').forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.meal) === get())));
  });
}

function openAddFood(mealIdx, preset = null) {
  let sel = mealIdx, food = null;
  openSheet({
    title: Today.date === todayISO() ? 'Aggiungi a oggi' : `Aggiungi al ${fmtDate(Today.date, { day: 'numeric', month: 'long' })}`,
    body: `${mealChips(sel)}
      <div class="field"><span class="field-label">Alimento</span><div data-picker></div></div>
      <div data-detail class="hidden">
        <div class="field"><span class="field-label" data-grams-lbl>Quantità</span>
          <div class="input-suffix"><input class="input input-num" type="number" inputmode="decimal" min="1" max="3000" data-grams><span class="suffix">g</span></div>
          <div class="chips" data-units style="margin-top:8px"></div>
        </div>
        <div class="preview-box num" data-preview></div>
      </div>`,
    foot: `<button class="btn btn-primary" data-ok disabled>${icon('plus', 'ic-sm')} Aggiungi</button>`,
    onMount: (root, close) => {
      bindMealChips(root, () => sel, v => { sel = v; });
      const gIn = root.querySelector('[data-grams]');
      const okBtn = root.querySelector('[data-ok]');
      const upd = () => {
        if (!food) return;
        const g = num(gIn.value, 0);
        const m = itemMacros({ type: 'food', foodId: food.id, grams: g });
        const hint = cookedHint(food, g);
        root.querySelector('[data-preview]').innerHTML = `<b>${fmt0(m.kcal)} kcal</b><span class="muted">${macroTxt(m, 1)}</span>${hint ? `<span class="faint" style="width:100%">${hint}</span>` : ''}`;
        okBtn.disabled = g <= 0;
      };
      const picker = createPicker(root.querySelector('[data-picker]'), {
        inline: true,
        onSelect: f => {
          food = f;
          root.querySelector('[data-detail]').classList.toggle('hidden', !f);
          if (!f) return;
          let g = 100;
          const pg = (state.plan && state.plan.meals || []).flatMap(m => m.items).find(i => i.foodId === f.id);
          if (preset && preset.foodId === f.id) g = preset.grams;
          else if (pg) g = pg.grams; else if (f.u) g = f.u[1]; else g = f.cat === 'G' ? 10 : f.cat === 'P' ? 150 : f.cat === 'V' ? 200 : 80;
          gIn.value = Math.round(g);
          gIn.step = state.settings.round5 ? 5 : 1;
          root.querySelector('[data-grams-lbl]').textContent = `Quantità${ST_LABEL[f.st] ? ' (' + ST_LABEL[f.st] + ')' : ''}`;
          root.querySelector('[data-units]').innerHTML = f.u
            ? [1, 2, 3].map(n => `<button type="button" class="chip" data-u="${n * f.u[1]}">${n} ${esc(f.u[0])}${n > 1 ? ' ×' + n : ''} · ${fmt0(n * f.u[1])} g</button>`).join('')
            : [50, 100, 150, 200].map(n => `<button type="button" class="chip" data-u="${n}">${n} g</button>`).join('');
          upd();
          gIn.focus(); gIn.select();
        }
      });
      if (preset) {
        const f = getFood(preset.foodId);
        picker.setValue(f.id);
        food = f;
        root.querySelector('[data-detail]').classList.remove('hidden');
        gIn.value = preset.grams;
        root.querySelector('[data-units]').innerHTML = '';
        setTimeout(() => { upd(); gIn.focus(); }, 60);
      } else setTimeout(() => picker.focus(), 80);
      root.querySelector('[data-units]').addEventListener('click', e => {
        const b = e.target.closest('[data-u]');
        if (b) { gIn.value = b.dataset.u; upd(); }
      });
      gIn.addEventListener('input', upd);
      gIn.addEventListener('keydown', e => { if (e.key === 'Enter') okBtn.click(); });
      okBtn.addEventListener('click', () => {
        const g = clamp(Math.round(num(gIn.value, 0)), 1, 3000);
        if (!food || !g) return;
        const meal = curDay().meals[sel];
        meal.items.push({ type: 'food', foodId: food.id, grams: g });
        close();
        commitToday();
        toast(`${food.name} aggiunto a ${meal.name}`);
      });
    }
  });
}

function openFreeMeal(mealIdx) {
  let sel = mealIdx, preset = null;
  openSheet({
    title: 'Pasto libero',
    body: `<div class="callout calm" style="margin-bottom:14px">${icon('heart')}<span>Nessun calcolo da fare: scegli la voce più vicina. Il piano riprende dal pasto successivo, senza compensazioni.</span></div>
      ${mealChips(sel)}
      <div class="preset-grid">${FREE_MEAL_PRESETS.map(p => `
        <button type="button" class="preset" data-p="${p.id}" aria-pressed="false"><span class="em">${p.emoji}</span><b>${esc(p.name)}</b><small>circa ${fmt0(p.kcal)} kcal</small></button>`).join('')}
      </div>`,
    foot: `<button class="btn btn-primary" data-ok disabled>Registra pasto libero</button>`,
    onMount: (root, close) => {
      bindMealChips(root, () => sel, v => { sel = v; });
      const ok = root.querySelector('[data-ok]');
      root.querySelector('.preset-grid').addEventListener('click', e => {
        const b = e.target.closest('[data-p]');
        if (!b) return;
        preset = FREE_MEAL_PRESETS.find(p => p.id === b.dataset.p);
        root.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        ok.disabled = false;
      });
      ok.addEventListener('click', () => {
        if (!preset) return;
        const meal = curDay().meals[sel];
        meal.items.push({ type: 'free', presetId: preset.id, label: preset.name, kcal: preset.kcal, p: preset.p, c: preset.c, g: preset.g });
        close();
        commitToday();
        toast('Buon appetito! Il piano riprende dal prossimo pasto.', { icon: 'heart' });
      });
    }
  });
}

function openQuickAdd(mealIdx) {
  let sel = mealIdx;
  openSheet({
    title: 'Aggiunta rapida',
    body: `${mealChips(sel)}
      <div class="field"><label for="qa-name">Descrizione</label><input id="qa-name" class="input" maxlength="50" placeholder="Es. Barretta, piatto pronto…" autofocus></div>
      <div class="grid-2">
        <div class="field"><label for="qa-p" class="c-pro">Proteine (g)</label><input id="qa-p" class="input input-num" type="number" inputmode="decimal" min="0" placeholder="0"></div>
        <div class="field"><label for="qa-c" class="c-cho">Carboidrati (g)</label><input id="qa-c" class="input input-num" type="number" inputmode="decimal" min="0" placeholder="0"></div>
        <div class="field"><label for="qa-g" class="c-fat">Grassi (g)</label><input id="qa-g" class="input input-num" type="number" inputmode="decimal" min="0" placeholder="0"></div>
        <div class="field"><label for="qa-k">Calorie (kcal)</label><input id="qa-k" class="input input-num" type="number" inputmode="decimal" min="0" placeholder="auto"></div>
      </div>
      <p class="help">Se lasci vuote le calorie, le calcoliamo dai macro (4 · 4 · 9 kcal per grammo).</p>`,
    foot: `<button class="btn btn-primary" data-ok>${icon('plus', 'ic-sm')} Aggiungi</button>`,
    onMount: (root, close) => {
      bindMealChips(root, () => sel, v => { sel = v; });
      const v = id => Math.max(0, num(root.querySelector(id).value, 0));
      const kIn = root.querySelector('#qa-k');
      const autoK = () => { kIn.placeholder = fmt0(v('#qa-p') * 4 + v('#qa-c') * 4 + v('#qa-g') * 9) || 'auto'; };
      ['#qa-p', '#qa-c', '#qa-g'].forEach(id => root.querySelector(id).addEventListener('input', autoK));
      root.querySelector('[data-ok]').addEventListener('click', () => {
        const p = v('#qa-p'), c = v('#qa-c'), g = v('#qa-g');
        const kcal = kIn.value.trim() ? v('#qa-k') : p * 4 + c * 4 + g * 9;
        if (!kcal) return toast('Inserisci almeno le calorie o un macro', { icon: 'info' });
        const label = root.querySelector('#qa-name').value.trim() || 'Aggiunta rapida';
        const meal = curDay().meals[sel];
        meal.items.push({ type: 'quick', label, kcal: Math.round(kcal), p, c, g });
        close();
        commitToday();
        toast(`${label} aggiunto a ${meal.name}`, { icon: 'zap' });
      });
    }
  });
}
