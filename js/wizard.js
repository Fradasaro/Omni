/* ==========================================================================
   PRIMO AVVIO: tre passi brevi. Usa gli stessi calcoli del Piano
   (nessuna logica duplicata). I dettagli si rifiniscono poi nel Piano.
   ========================================================================== */
'use strict';

const Wiz = { step: 1, p: null, cfg: null, water: 2500 };

function startWizard() {
  Wiz.step = 1;
  Wiz.p = { name: '', sex: 'M', age: 30, height: 175, weight: 72, targetWeight: 70, bf: 0, formula: 'mifflin', pal: 1.55, water: 2500 };
  Wiz.cfg = defaultPlanCfg();
  renderWizard();
}

function renderWizard() {
  const p = Wiz.p, cfg = Wiz.cfg;
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= Wiz.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (Wiz.step === 1) {
    body = `<h2>Parliamo di te</h2><p class="lead">Servono solo per stimare il tuo fabbisogno. Restano su questo dispositivo.</p>
      <div class="field"><label for="wz-name">Come ti chiami?</label><input id="wz-name" class="input" maxlength="40" value="${esc(p.name)}" placeholder="Il tuo nome" autofocus></div>
      <div class="field"><span class="field-label">Sesso biologico</span>
        <div class="seg" data-wz-sex><button type="button" data-v="M" aria-pressed="${p.sex === 'M'}">Uomo</button><button type="button" data-v="F" aria-pressed="${p.sex === 'F'}">Donna</button></div></div>
      <div class="grid-2">
        <div class="field"><label for="wz-age">Età</label><div class="input-suffix"><input id="wz-age" class="input" type="number" inputmode="numeric" min="14" max="99" value="${p.age}"><span class="suffix">anni</span></div></div>
        <div class="field"><label for="wz-h">Altezza</label><div class="input-suffix"><input id="wz-h" class="input" type="number" inputmode="numeric" min="120" max="230" value="${p.height}"><span class="suffix">cm</span></div></div>
        <div class="field"><label for="wz-w">Peso</label><div class="input-suffix"><input id="wz-w" class="input" type="number" inputmode="decimal" step="0.1" value="${p.weight}"><span class="suffix">kg</span></div></div>
        <div class="field"><label for="wz-tw">Peso obiettivo</label><div class="input-suffix"><input id="wz-tw" class="input" type="number" inputmode="decimal" step="0.1" value="${p.targetWeight}"><span class="suffix">kg</span></div></div>
      </div>
      <div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn btn-primary" data-action="wz-next">Avanti ${icon('right', 'ic-sm')}</button></div>`;
  } else if (Wiz.step === 2) {
    const T = computeTargets(p, cfg);
    body = `<h2>Il tuo obiettivo</h2><p class="lead">Calcoliamo calorie e macronutrienti. Potrai cambiare tutto quando vuoi nella sezione Piano.</p>
      <div class="field"><label for="wz-pal">Quanto ti muovi?</label>
        <select id="wz-pal" class="input" data-change="wz-pal">${ACTIVITY.map(a => `<option value="${a.v}" ${p.pal === a.v ? 'selected' : ''}>${a.name} · ${a.desc}</option>`).join('')}</select></div>
      <div class="field"><span class="field-label">Fase</span>
        <div class="chips">${GOALS.filter(g => g.v !== 'custom').map(g => `<button class="chip" data-action="wz-goal" data-v="${g.v}" aria-pressed="${String(cfg.goal) === g.v}">${esc(g.name)}</button>`).join('')}</div></div>
      <div class="field"><span class="field-label">Proteine</span>
        <div class="chips">${[1.6, 1.8, 2.0, 2.2].map(v => `<button class="chip" data-action="wz-gkg" data-v="${v}" aria-pressed="${cfg.pro.gkg === v}">${fmt1(v)} g/kg</button>`).join('')}</div>
        <span class="help">Tra 1,6 e 2,2 g per kg è l'intervallo tipico per chi si allena.</span></div>
      <div class="field"><span class="field-label">Preferenza energetica</span>
        <div class="seg">${PREFS.filter(x => x.v !== 'manual').map(x => `<button type="button" data-action="wz-pref" data-v="${x.v}" aria-pressed="${cfg.pref === x.v}">${esc(x.name)}</button>`).join('')}</div>
        <span class="help">${esc((PREFS.find(x => x.v === cfg.pref) || PREFS[0]).desc)}</span></div>
      <div class="target-grid">
        <div class="target"><small>Calorie</small><b>${fmt0(T.kcal)}</b></div>
        <div class="target"><small class="c-pro">Proteine</small><b>${fmt0(T.p)}<span> g</span></b></div>
        <div class="target"><small class="c-cho">Carbo</small><b>${fmt0(T.c)}<span> g</span></b></div>
        <div class="target"><small class="c-fat">Grassi</small><b>${fmt0(T.g)}<span> g</span></b></div>
      </div>
      ${T.notes.map(n => `<div class="note">${icon(n.t === 'warn' ? 'alert' : 'info')}<span>${esc(n.d)}</span></div>`).join('')}
      <p class="help" style="margin-top:8px">Dispendio stimato: ${fmt0(T.tdee)} kcal · metabolismo basale ${fmt0(T.bmr)} kcal.</p>
      <div class="row" style="margin-top:16px"><button class="btn btn-ghost" data-action="wz-back">Indietro</button><span class="spacer"></span><button class="btn btn-primary" data-action="wz-next">Avanti ${icon('right', 'ic-sm')}</button></div>`;
  } else {
    body = `<h2>La tua giornata</h2><p class="lead">Quali pasti fai di solito? Gli alimenti di ogni pasto li scegli e cambi nella sezione Piano.</p>
      <div>${cfg.slots.map((s, i) => `<div class="slot-toggle"><b>${esc(s.name)}</b>
        <label class="switch"><input type="checkbox" data-change="wz-slot" data-s="${i}" ${s.on ? 'checked' : ''} aria-label="${esc(s.name)}"><span></span></label></div>`).join('')}</div>
      <hr class="divider">
      <label class="check" style="margin-bottom:14px"><input type="checkbox" data-change="wz-veg" ${cfg.slots.find(s => s.id === 'pranzo').veg ? 'checked' : ''}><span><b>Verdure a pranzo e cena</b><br><span class="muted xs">200 g a pasto, già conteggiate nel piano.</span></span></label>
      <div class="field"><label for="wz-water">Acqua al giorno</label><div class="input-suffix"><input id="wz-water" class="input" type="number" inputmode="numeric" step="250" value="${Wiz.water}"><span class="suffix">ml</span></div></div>
      <div class="row" style="margin-top:16px"><button class="btn btn-ghost" data-action="wz-back">Indietro</button><span class="spacer"></span><button class="btn btn-primary" data-action="wz-finish">${icon('check', 'ic-sm')} Inizia</button></div>`;
  }
  $('#wizard-root').innerHTML = `<div class="wizard"><div class="wizard-card">
    <div class="wizard-brand"><div class="brand">${esc(APP_NAME)}<span class="dot">.</span></div><p>${esc(APP_TAGLINE)}</p></div>
    <div class="card">${steps}${body}</div>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>
  </div></div>`;

  const sex = $('[data-wz-sex]');
  if (sex) sex.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    Wiz.p.sex = b.dataset.v;
    sex.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  const f = $('#wizard-root [autofocus]');
  if (f) f.focus();
}

function readWizStep1() {
  const v = (s, d) => num($(s).value, d);
  Object.assign(Wiz.p, {
    name: $('#wz-name').value.trim(),
    age: clamp(Math.round(v('#wz-age', 30)), 14, 99),
    height: clamp(Math.round(v('#wz-h', 175)), 120, 230),
    weight: clamp(v('#wz-w', 70), 30, 300),
    targetWeight: clamp(v('#wz-tw', 70), 30, 300)
  });
}

ACTIONS['wz-next'] = () => { if (Wiz.step === 1) readWizStep1(); Wiz.step++; renderWizard(); window.scrollTo(0, 0); };
ACTIONS['wz-back'] = () => { Wiz.step--; renderWizard(); };
CHANGES['wz-pal'] = el => { Wiz.p.pal = Number(el.value); renderWizard(); };
ACTIONS['wz-goal'] = el => { Wiz.cfg.goal = el.dataset.v; renderWizard(); };
ACTIONS['wz-gkg'] = el => { Wiz.cfg.pro = { mode: 'gkg', gkg: Number(el.dataset.v), grams: 150 }; renderWizard(); };
ACTIONS['wz-pref'] = el => { Wiz.cfg.pref = el.dataset.v; renderWizard(); };
CHANGES['wz-slot'] = el => {
  const s = Wiz.cfg.slots[Number(el.dataset.s)];
  s.on = el.checked;
  if (!Wiz.cfg.slots.some(x => x.on)) { s.on = true; el.checked = true; }
};
CHANGES['wz-veg'] = el => { Wiz.cfg.slots.forEach(s => { if (s.main) s.veg = el.checked; }); };

ACTIONS['wz-finish'] = () => {
  Wiz.water = clamp(Math.round(num($('#wz-water').value, 2500)), 500, 6000);
  const p = Object.assign({}, Wiz.p, { water: Wiz.water });
  const cfg = Wiz.cfg;
  const T = computeTargets(p, cfg);
  state.profile = p;
  state.plan = {
    cfg, meals: solvePlan(T, cfg, state.settings.round5),
    target: { kcal: T.kcal, p: T.p, c: T.c, g: T.g },
    basis: { weight: p.weight, pal: p.pal, age: p.age, height: p.height, sex: p.sex, bf: p.bf, formula: p.formula },
    savedAt: new Date().toISOString()
  };
  state.weightLogs = [{ date: todayISO(), weight: p.weight }];
  state.days = {};
  saveState();
  $('#wizard-root').innerHTML = '';
  bootApp();
  toast(`Benvenuto${p.name ? ', ' + p.name : ''}! Il tuo piano è pronto.`, { icon: 'sparkles' });
};
