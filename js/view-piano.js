/* ==========================================================================
   PIANO: obiettivo, ripartizione energetica, struttura dei pasti.
   Un'unica azione di salvataggio; l'anteprima si aggiorna in tempo reale.
   ========================================================================== */
'use strict';

const Plan = {
  draft: null,        // copia di lavoro della configurazione
  dirty: false,
  open: new Set(['pranzo']),
  preview: null       // { T, meals }
};

function planDraft() {
  if (!Plan.draft) Plan.draft = clone((state.plan && state.plan.cfg) || defaultPlanCfg());
  return Plan.draft;
}
function computePreview() {
  const cfg = planDraft();
  const T = computeTargets(state.profile, cfg);
  const meals = solvePlan(T, cfg, state.settings.round5);
  Plan.preview = { T, meals };
  return Plan.preview;
}
function touchPlan() { Plan.dirty = true; renderPlan(); }

function renderPlan() {
  const cfg = planDraft();
  const { T, meals } = computePreview();
  const bio = computeBiometrics(state.profile);
  const tot = sumMacros(meals.flatMap(m => m.items));
  const manual = cfg.pref === 'manual';
  const kcalEditable = cfg.goal === 'custom' && !manual;
  const gkgNow = Math.round(T.p / state.profile.weight * 10) / 10;
  const pref = PREFS.find(p => p.v === cfg.pref) || PREFS[0];

  $('#view-piano').innerHTML = `
  <div class="split">
    <div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('target')} Obiettivo</div></div>
        <div class="field">
          <label for="pl-goal">Fase</label>
          <select id="pl-goal" class="input" data-change="pl-goal">
            ${GOALS.map(g => `<option value="${g.v}" ${String(cfg.goal) === g.v ? 'selected' : ''}>${esc(g.name)}${g.v !== 'custom' ? ` (${g.off > 0 ? '+' : g.off < 0 ? '−' : '±'}${Math.abs(g.off)} kcal)` : ''}</option>`).join('')}
          </select>
          <span class="help">Il tuo dispendio stimato (TDEE) è ${fmt0(bio.tdee)} kcal al giorno.</span>
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="pl-kcal">Calorie</label>
            <div class="input-suffix"><input id="pl-kcal" class="input input-num" type="number" inputmode="numeric" min="1000" max="6000" step="10" value="${kcalEditable ? Math.round(cfg.customKcal) : T.kcal}" ${kcalEditable ? '' : 'readonly'} data-change="pl-kcal"><span class="suffix">kcal</span></div>
            <span class="help">${kcalEditable ? 'Modificabili: sei in Personalizzato' : manual ? 'Somma dei grammi inseriti' : 'Per modificarle scegli Personalizzato'}</span>
          </div>
          <div class="field">
            <label for="pl-pro">Proteine</label>
            <div class="input-suffix"><input id="pl-pro" class="input input-num" type="number" inputmode="numeric" min="30" max="400" value="${T.p}" data-change="pl-pro"><span class="suffix">g</span></div>
            <span class="help">${fmt1(gkgNow)} g per kg di peso</span>
          </div>
        </div>
        <div class="chips" style="margin:-4px 0 16px" aria-label="Proteine per kg">
          ${[1.6, 1.8, 2.0, 2.2, 2.5].map(v => `<button class="chip" data-action="pl-gkg" data-v="${v}" aria-pressed="${cfg.pro.mode === 'gkg' && cfg.pro.gkg === v}">${fmt1(v)} g/kg</button>`).join('')}
        </div>

        <div class="field">
          <span class="field-label">Preferenza energetica</span>
          <div class="seg wrap4" role="group">
            ${PREFS.map(p => `<button type="button" data-action="pl-pref" data-v="${p.v}" aria-pressed="${cfg.pref === p.v}">${esc(p.name)}</button>`).join('')}
          </div>
          <span class="help">${esc(pref.desc)}</span>
        </div>
        ${manual ? `<div class="grid-2">
          <div class="field"><label for="pl-mc" class="c-cho">Carboidrati</label><div class="input-suffix"><input id="pl-mc" class="input input-num" type="number" inputmode="numeric" min="0" max="900" value="${Math.round(cfg.manualC)}" data-change="pl-mc"><span class="suffix">g</span></div></div>
          <div class="field"><label for="pl-mg" class="c-fat">Grassi</label><div class="input-suffix"><input id="pl-mg" class="input input-num" type="number" inputmode="numeric" min="0" max="300" value="${Math.round(cfg.manualG)}" data-change="pl-mg"><span class="suffix">g</span></div></div>
        </div>` : ''}

        <div class="target-grid">
          <div class="target"><small>Calorie</small><b>${fmt0(T.kcal)}</b></div>
          <div class="target"><small class="c-pro">Proteine</small><b>${fmt0(T.p)}<span> g</span></b></div>
          <div class="target"><small class="c-cho">Carboidrati</small><b>${fmt0(T.c)}<span> g</span></b></div>
          <div class="target"><small class="c-fat">Grassi</small><b>${fmt0(T.g)}<span> g</span></b></div>
        </div>
        ${T.notes.map(n => `<div class="note">${icon(n.t === 'warn' ? 'alert' : 'info')}<span>${esc(n.d)}</span></div>`).join('')}
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('utensils')} Pasti</div></div>
        <p class="card-sub">Accendi i pasti che fai davvero, mettili nell'ordine che preferisci e scegli i tuoi alimenti.</p>
        ${cfg.slots.map((s, i) => slotHtml(s, i, cfg.slots.length)).join('')}
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="slot-add">${icon('plus', 'ic-sm')} Aggiungi un pasto</button>
        <hr class="divider">
        <label class="check"><input type="checkbox" data-change="pl-sym" ${cfg.symPro ? 'checked' : ''}>
          <span><b>Stesse proteine a pranzo e cena</b><br><span class="muted xs">Quota proteica uguale nei due pasti principali.</span></span></label>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">${icon('plan')} Il tuo piano</div>
        <button class="btn btn-ghost btn-sm" data-action="go" data-tab="spesa">${icon('shop', 'ic-sm')} Lista spesa</button>
      </div>
      <div class="plan-totals num">
        <span><b>${fmt0(tot.kcal)}</b> kcal</span>
        <span class="c-pro"><b>${fmt0(tot.p)}</b>/${fmt0(T.p)} g P</span>
        <span class="c-cho"><b>${fmt0(tot.c)}</b>/${fmt0(T.c)} g C</span>
        <span class="c-fat"><b>${fmt0(tot.g)}</b>/${fmt0(T.g)} g G</span>
      </div>
      ${meals.length ? meals.map(m => {
        const mt = sumMacros(m.items);
        return `<div class="plan-meal">
          <div class="plan-meal-head"><b>${esc(m.name)}</b><span class="xs muted num">${fmt0(mt.kcal)} kcal · ${macroTxt(mt)}</span></div>
          ${m.items.length ? m.items.map(it => {
            const f = getFood(it.foodId), mm = itemMacros({ type: 'food', ...it });
            const eq = f.cat !== 'V' ? computeEquivalents(f, it.grams, { limit: 2 }) : [];
            const hint = cookedHint(f, it.grams);
            return `<div class="plan-item"><span class="g">${fmt0(it.grams)} g</span>
              <span class="nm">${esc(f.name)}${hint ? ` <span class="xs faint">(${hint})</span>` : ''}
                ${eq.length ? `<span class="eq">oppure ${eq.map(e => `${fmt0(e.grams)} g ${esc(e.food.name)}`).join(' · ')}</span>` : ''}</span>
              <span class="kc">${fmt0(mm.kcal)} kcal</span></div>`;
          }).join('') : `<div class="small muted">Scegli almeno un alimento per questo pasto.</div>`}
        </div>`;
      }).join('') : `<div class="empty">${icon('utensils')}<b>Nessun pasto attivo</b>Accendi almeno un pasto a sinistra.</div>`}
      <p class="help" style="margin-top:12px">Grammi a crudo o a secco, salvo dove indicato. I valori sono indicativi; le kcal seguono le etichette e possono differire leggermente dalla somma dei macro.</p>
    </div>
  </div>
  ${Plan.dirty ? `<div class="savebar"><p>Modifiche non salvate al piano</p>
    <button class="btn btn-ghost btn-sm" data-action="plan-discard">Annulla</button>
    <button class="btn btn-primary btn-sm" data-action="plan-save">${icon('check', 'ic-sm')} Salva piano</button></div>`
    : (state.plan && state.plan.savedAt ? `<p class="help" style="text-align:center;margin-top:16px">Piano salvato il ${esc(new Date(state.plan.savedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }))}.</p>` : '')}`;

  /* monta i selettori di ricerca nei pasti aperti */
  cfg.slots.forEach((s, i) => {
    if (!Plan.open.has(s.id) || !s.on) return;
    [['c', 'C'], ['p', 'P'], ['g', 'G']].forEach(([role, cat]) => {
      const host = document.querySelector(`[data-slot-picker="${i}-${role}"]`);
      if (!host) return;
      createPicker(host, {
        value: s[role], allowNone: true, noneLabel: 'Nessuno',
        placeholder: `Cerca ${CAT_LABEL[cat].toLowerCase()}…`,
        filter: f => f.cat === cat,
        onSelect: f => { s[role] = f ? f.id : null; touchPlan(); }
      });
    });
  });
}

function slotHtml(s, i, n) {
  const open = Plan.open.has(s.id) && s.on;
  const custom = !DEFAULT_SLOTS.some(d => d.id === s.id);
  const summary = ['c', 'p', 'g'].map(r => s[r] ? getFood(s[r]).name : null).filter(Boolean).join(' · ') || 'Nessun alimento scelto';
  return `<div class="slot ${s.on ? '' : 'off'}">
    <div class="slot-head">
      <label class="switch" title="${s.on ? 'Disattiva' : 'Attiva'} ${esc(s.name)}"><input type="checkbox" data-change="slot-toggle" data-s="${i}" ${s.on ? 'checked' : ''} aria-label="Pasto ${esc(s.name)} attivo"><span></span></label>
      <input class="slot-name" value="${esc(s.name)}" data-change="slot-name" data-s="${i}" maxlength="30" aria-label="Nome del pasto">
      <button class="icon-btn sm" data-action="slot-move" data-s="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">${icon('arrowUp', 'ic-sm')}</button>
      <button class="icon-btn sm" data-action="slot-move" data-s="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Sposta giù">${icon('arrowDown', 'ic-sm')}</button>
      ${custom ? `<button class="icon-btn sm" data-action="slot-del" data-s="${i}" aria-label="Elimina pasto">${icon('trash', 'ic-sm')}</button>` : ''}
      <button class="icon-btn sm" data-action="slot-open" data-s="${i}" ${s.on ? '' : 'disabled'} aria-expanded="${open}" aria-label="Scegli gli alimenti">${icon(open ? 'up' : 'down', 'ic-sm')}</button>
    </div>
    ${open ? `<div class="slot-body">
      <div class="slot-role"><span class="c-cho">Carbo</span><div data-slot-picker="${i}-c"></div></div>
      <div class="slot-role"><span class="c-pro">Proteine</span><div data-slot-picker="${i}-p"></div></div>
      <div class="slot-role"><span class="c-fat">Grassi</span><div data-slot-picker="${i}-g"></div></div>
      <label class="check"><input type="checkbox" data-change="slot-veg" data-s="${i}" ${s.veg ? 'checked' : ''}><span>Verdure a piacere (${VEG_PORTION} g, conteggiate)</span></label>
    </div>` : (s.on ? `<div class="xs muted" style="padding:0 12px 10px 60px">${esc(summary)}${s.veg ? ' · verdure' : ''}</div>` : '')}
  </div>`;
}

/* ---------------- Azioni ---------------- */
CHANGES['pl-goal'] = el => {
  const cfg = planDraft();
  const prevKcal = Plan.preview ? Plan.preview.T.kcal : 2200;
  cfg.goal = el.value;
  if (cfg.goal === 'custom') cfg.customKcal = prevKcal;
  else if (cfg.pref === 'manual') cfg.pref = 'hc';
  touchPlan();
};
CHANGES['pl-kcal'] = el => { planDraft().customKcal = clamp(Math.round(num(el.value, 2000)), 1000, 6000); touchPlan(); };
CHANGES['pl-pro'] = el => { const c = planDraft(); c.pro = { mode: 'grams', grams: clamp(Math.round(num(el.value, 150)), 30, 400), gkg: c.pro.gkg }; touchPlan(); };
ACTIONS['pl-gkg'] = el => { const c = planDraft(); c.pro = { mode: 'gkg', gkg: Number(el.dataset.v), grams: c.pro.grams }; touchPlan(); };
ACTIONS['pl-pref'] = el => {
  const c = planDraft();
  if (el.dataset.v === 'manual' && c.pref !== 'manual' && Plan.preview) { c.manualC = Plan.preview.T.c; c.manualG = Plan.preview.T.g; }
  c.pref = el.dataset.v;
  touchPlan();
};
CHANGES['pl-mc'] = el => { planDraft().manualC = clamp(Math.round(num(el.value, 200)), 0, 900); touchPlan(); };
CHANGES['pl-mg'] = el => { planDraft().manualG = clamp(Math.round(num(el.value, 60)), 0, 300); touchPlan(); };
CHANGES['pl-sym'] = el => { planDraft().symPro = el.checked; touchPlan(); };

CHANGES['slot-toggle'] = el => {
  const s = planDraft().slots[Number(el.dataset.s)];
  s.on = el.checked;
  if (!planDraft().slots.some(x => x.on)) { s.on = true; el.checked = true; return toast('Serve almeno un pasto attivo', { icon: 'info' }); }
  touchPlan();
};
CHANGES['slot-name'] = el => { const s = planDraft().slots[Number(el.dataset.s)]; const v = el.value.trim(); if (v) s.name = v.slice(0, 30); touchPlan(); };
CHANGES['slot-veg'] = el => { planDraft().slots[Number(el.dataset.s)].veg = el.checked; touchPlan(); };
ACTIONS['slot-move'] = el => {
  const sl = planDraft().slots, i = Number(el.dataset.s), j = i + Number(el.dataset.d);
  if (j < 0 || j >= sl.length) return;
  [sl[i], sl[j]] = [sl[j], sl[i]];
  touchPlan();
};
ACTIONS['slot-open'] = el => {
  const s = planDraft().slots[Number(el.dataset.s)];
  Plan.open.has(s.id) ? Plan.open.delete(s.id) : Plan.open.add(s.id);
  renderPlan();
};
ACTIONS['slot-del'] = el => {
  const sl = planDraft().slots, i = Number(el.dataset.s);
  sl.splice(i, 1);
  if (!sl.some(x => x.on) && sl.length) sl[0].on = true;
  touchPlan();
};
ACTIONS['slot-add'] = () => {
  const s = { id: uid('slot'), name: 'Nuovo pasto', on: true, share: 0.1, main: false, c: null, p: 'ygreco0', g: null, veg: false };
  planDraft().slots.push(s);
  Plan.open.add(s.id);
  touchPlan();
  const names = $$('#view-piano .slot-name');
  const last = names[names.length - 1];
  if (last) { last.focus(); last.select(); }
};
ACTIONS['plan-discard'] = () => { Plan.draft = null; Plan.dirty = false; renderPlan(); };

ACTIONS['plan-save'] = () => {
  const cfg = clone(planDraft());
  const { T, meals } = computePreview();
  const p = state.profile;
  state.plan = {
    cfg, meals,
    target: { kcal: T.kcal, p: T.p, c: T.c, g: T.g },
    basis: { weight: p.weight, pal: p.pal, age: p.age, height: p.height, sex: p.sex, bf: p.bf, formula: p.formula },
    savedAt: new Date().toISOString()
  };
  /* i giorni ancora vuoti adottano la nuova struttura dei pasti; quelli registrati restano com'erano */
  Object.keys(state.days).forEach(d => { if (!dayLogged(state.days[d])) delete state.days[d]; });
  Plan.draft = null;
  Plan.dirty = false;
  saveState();
  refreshAll();
  toast('Piano salvato. I giorni già registrati non cambiano.', {
    action: { label: 'Carica in oggi', fn: () => { Today.date = todayISO(); switchTab('oggi'); loadWholePlan(); } }
  });
};
