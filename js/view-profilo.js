/* ==========================================================================
   PROFILO: dati fisici, peso con trend, linee guida, impostazioni, backup.
   Una pesata non modifica mai il piano da sola: lo propone.
   ========================================================================== */
'use strict';

function profileFromForm(root) {
  const v = (s, d) => num(root.querySelector(s).value, d);
  const p = state.profile;
  return {
    name: root.querySelector('#pf-name').value.trim(),
    sex: root.querySelector('[data-pf-sex] [aria-pressed="true"]').dataset.v,
    age: clamp(Math.round(v('#pf-age', p.age)), 14, 99),
    height: clamp(Math.round(v('#pf-h', p.height)), 120, 230),
    weight: clamp(v('#pf-w', p.weight), 30, 300),
    targetWeight: clamp(v('#pf-tw', p.targetWeight), 30, 300),
    bf: clamp(v('#pf-bf', 0), 0, 60),
    formula: root.querySelector('#pf-formula').value,
    pal: Number(root.querySelector('#pf-pal').value),
    water: clamp(Math.round(v('#pf-water', p.water)), 500, 6000)
  };
}

/* Il piano dipende dai dati fisici? (no se kcal e macro sono tutti fissati a mano) */
function planDependsOnProfile() {
  const c = state.plan && state.plan.cfg;
  if (!c) return false;
  const fixed = c.pro.mode === 'grams' && (c.pref === 'manual' || c.goal === 'custom');
  return !fixed;
}
function planOutdated() {
  if (!state.plan || !state.plan.basis || !planDependsOnProfile()) return false;
  const b = state.plan.basis, p = state.profile;
  return Math.abs(b.weight - p.weight) >= 1 || b.pal !== p.pal || b.age !== p.age || b.height !== p.height || b.sex !== p.sex || b.formula !== p.formula || (b.formula === 'katch' && b.bf !== p.bf);
}

function renderProfile() {
  const p = state.profile, bio = computeBiometrics(p), T = target();
  const logs = state.weightLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = logs[logs.length - 1];
  const theme = state.settings.theme;
  const lb = state.settings.lastBackup;

  $('#view-profilo').innerHTML = `
  <div class="split-wide">
    <div>
      <div class="card" data-pf>
        <div class="card-head"><div class="card-title">${icon('user')} I tuoi dati</div></div>
        <div class="field"><label for="pf-name">Nome</label><input id="pf-name" class="input" maxlength="40" value="${esc(p.name)}"></div>
        <div class="field"><span class="field-label">Sesso biologico</span>
          <div class="seg" data-pf-sex><button type="button" data-v="M" aria-pressed="${p.sex === 'M'}">Uomo</button><button type="button" data-v="F" aria-pressed="${p.sex === 'F'}">Donna</button></div>
          <span class="help">Serve solo alla formula del metabolismo basale.</span></div>
        <div class="grid-2">
          <div class="field"><label for="pf-age">Età</label><div class="input-suffix"><input id="pf-age" class="input" type="number" inputmode="numeric" value="${p.age}" data-input="pf-live"><span class="suffix">anni</span></div></div>
          <div class="field"><label for="pf-h">Altezza</label><div class="input-suffix"><input id="pf-h" class="input" type="number" inputmode="numeric" value="${p.height}" data-input="pf-live"><span class="suffix">cm</span></div></div>
          <div class="field"><label for="pf-w">Peso attuale</label><div class="input-suffix"><input id="pf-w" class="input" type="number" inputmode="decimal" step="0.1" value="${p.weight}" data-input="pf-live"><span class="suffix">kg</span></div></div>
          <div class="field"><label for="pf-tw">Peso obiettivo</label><div class="input-suffix"><input id="pf-tw" class="input" type="number" inputmode="decimal" step="0.1" value="${p.targetWeight}"><span class="suffix">kg</span></div></div>
          <div class="field"><label for="pf-bf">Massa grassa (facoltativa)</label><div class="input-suffix"><input id="pf-bf" class="input" type="number" inputmode="decimal" step="0.5" value="${p.bf || ''}" placeholder="—" data-input="pf-live"><span class="suffix">%</span></div></div>
          <div class="field"><label for="pf-water">Acqua al giorno</label><div class="input-suffix"><input id="pf-water" class="input" type="number" inputmode="numeric" step="50" value="${p.water}"><span class="suffix">ml</span></div></div>
        </div>
        <div class="field"><label for="pf-pal">Attività fisica</label>
          <select id="pf-pal" class="input" data-change="pf-live">${ACTIVITY.map(a => `<option value="${a.v}" ${p.pal === a.v ? 'selected' : ''}>${a.name} · ${a.desc}</option>`).join('')}</select></div>
        <div class="field"><label for="pf-formula">Formula del metabolismo basale</label>
          <select id="pf-formula" class="input" data-change="pf-live"><option value="mifflin" ${p.formula !== 'katch' ? 'selected' : ''}>Mifflin-St Jeor (standard)</option><option value="katch" ${p.formula === 'katch' ? 'selected' : ''}>Katch-McArdle (usa la massa grassa)</option></select></div>
        <div class="stat-grid" data-pf-stats style="margin-bottom:16px">${statsHtml(bio)}</div>
        <button class="btn btn-primary btn-block" data-action="pf-save">${icon('check', 'ic-sm')} Salva i dati</button>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('target')} Piano attivo</div>
          <button class="btn btn-ghost btn-sm" data-action="go" data-tab="piano">Modifica</button></div>
        <div class="target-grid">
          <div class="target"><small>Calorie</small><b>${fmt0(T.kcal)}</b></div>
          <div class="target"><small class="c-pro">Proteine</small><b>${fmt0(T.p)}<span> g</span></b></div>
          <div class="target"><small class="c-cho">Carbo</small><b>${fmt0(T.c)}<span> g</span></b></div>
          <div class="target"><small class="c-fat">Grassi</small><b>${fmt0(T.g)}<span> g</span></b></div>
        </div>
        <p class="help" style="margin-top:8px">${esc(state.plan ? goalName(state.plan.cfg.goal) : '')}${state.plan && state.plan.cfg.pref ? ' · ' + esc((PREFS.find(x => x.v === state.plan.cfg.pref) || {}).name || '') : ''}</p>
        ${planOutdated() ? `<div class="callout" style="margin-top:12px">${icon('refresh')}<div style="flex:1"><b>I tuoi dati sono cambiati</b><br><span class="muted">Il piano è calcolato su ${fmt1(state.plan.basis.weight)} kg. Vuoi ricalcolare i target con i dati attuali? I giorni già registrati non cambiano.</span>
          <div style="margin-top:10px"><button class="btn btn-primary btn-sm" data-action="pf-replan">Aggiorna il piano</button></div></div></div>` : ''}
      </div>
    </div>

    <div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('chart')} Peso</div>
          <span class="small muted num">${last ? `${fmt1(last.weight)} kg · obiettivo ${fmt1(p.targetWeight)} kg` : ''}</span></div>
        <div class="row-wrap" style="margin-bottom:12px">
          <input class="input" type="date" value="${todayISO()}" max="${todayISO()}" data-w-date style="flex:1;min-width:140px" aria-label="Data">
          <div class="input-suffix" style="width:120px"><input class="input input-num" type="number" inputmode="decimal" step="0.1" placeholder="${last ? fmt1(last.weight) : '70,0'}" data-w-val aria-label="Peso"><span class="suffix">kg</span></div>
          <button class="btn btn-primary" data-action="w-add">Registra</button>
        </div>
        <div class="chart">${weightChart(logs, p.targetWeight)}</div>
        <div class="legend"><span><i></i>Trend (media 7 giorni)</span><span><i class="raw"></i>Pesate</span></div>
        <div style="margin-top:12px;max-height:220px;overflow-y:auto">
          ${logs.slice().reverse().slice(0, 30).map(l => `<div class="log-row"><b class="num">${fmt1(l.weight)} kg</b><span class="muted">${esc(fmtDate(l.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>${l.note ? `<span class="faint xs">${esc(l.note)}</span>` : ''}<span class="spacer"></span>
            <button class="icon-btn sm" data-action="w-del" data-d="${l.date}" aria-label="Elimina pesata">${icon('x', 'ic-sm')}</button></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('book')} Linee guida ${esc(APP_NAME)}</div></div>
        <p class="small muted" style="margin-bottom:12px">Le regole d'oro per usare l'app in modo sano e sostenibile.</p>
        <button class="btn btn-secondary btn-block" data-action="guidelines">Leggi le linee guida</button>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('settings')} Impostazioni</div></div>
        <div class="setting"><div class="setting-txt"><b>Tema</b><small>Segue il telefono, oppure fisso</small></div>
          <div class="seg" style="min-width:210px">
            ${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([v, l]) => `<button type="button" data-action="set-theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}
          </div></div>
        <div class="setting"><div class="setting-txt"><b>Arrotondamento grammi</b><small>Per piano e scambi</small></div>
          <div class="seg" style="min-width:170px">
            <button type="button" data-action="set-round" data-v="5" aria-pressed="${state.settings.round5}">5 g</button>
            <button type="button" data-action="set-round" data-v="1" aria-pressed="${!state.settings.round5}">1 g</button>
          </div></div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('shield')} I tuoi dati restano qui</div></div>
        <p class="small muted">Tutto è salvato solo su questo dispositivo: nessun account, nessun server. Su iPhone il browser può cancellare i dati dei siti non usati per settimane: installa l'app sulla schermata Home e scarica un backup ogni tanto.</p>
        <p class="xs faint" style="margin:8px 0 12px">Ultimo backup: ${lb ? esc(new Date(lb).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })) : 'mai'}</p>
        <div class="row-wrap">
          <button class="btn btn-secondary" data-action="backup-export">${icon('download', 'ic-sm')} Scarica backup</button>
          <label class="btn btn-secondary">${icon('upload', 'ic-sm')} Ripristina<input type="file" accept=".json,application/json" class="sr-only" data-change="backup-import"></label>
        </div>
        <hr class="divider">
        <button class="btn btn-danger btn-block" data-action="app-reset">Cancella tutto e ricomincia</button>
      </div>
    </div>
  </div>
  <p class="disclaimer">${esc(DISCLAIMER)}</p>`;

  const pf = $('[data-pf]');
  pf.querySelector('[data-pf-sex]').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    pf.querySelectorAll('[data-pf-sex] [data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    INPUTS['pf-live']();
  });
}

function statsHtml(bio) {
  return `<div class="stat"><small>BMI</small><b>${fmt1(bio.bmi)}</b></div>
    <div class="stat"><small>Metabolismo basale</small><b>${fmt0(bio.bmr)}</b></div>
    <div class="stat"><small>Dispendio (TDEE)</small><b>${fmt0(bio.tdee)}</b></div>`;
}

/* Grafico: punti delle pesate + trend come media mobile su 7 giorni, asse dei tempi reale. */
function weightChart(logs, goal) {
  if (!logs.length) return `<div class="empty" style="padding:20px">Nessuna pesata. Registra la prima qui sopra.</div>`;
  const W = 480, H = 190, L = 34, R = 14, Tp = 14, B = 24;
  const t = l => parseISO(l.date).getTime();
  const trend = logs.map((l, i) => {
    const win = logs.slice(0, i + 1).filter(x => t(l) - t(x) <= 6 * 864e5);
    return win.reduce((a, x) => a + x.weight, 0) / win.length;
  });
  const vals = logs.map(l => l.weight).concat(goal ? [goal] : []);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = t(logs[0]), t1 = Math.max(t(logs[logs.length - 1]), t0 + 6 * 864e5);
  const X = ms => L + (ms - t0) / (t1 - t0) * (W - L - R);
  const Y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const dates = [t0, (t0 + t1) / 2, t1].map(ms => isoLocal(new Date(ms)));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">
    <g class="grid">${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    ${ticks.map(v => `<text class="lbl" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
    ${dates.map((d, i) => `<text class="lbl" x="${X(parseISO(d).getTime())}" y="${H - 6}" text-anchor="${['start', 'middle', 'end'][i]}">${esc(fmtDate(d))}</text>`).join('')}
    ${goal ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}"/><text class="goal-lbl" x="${W - R}" y="${Y(goal) - 5}" text-anchor="end">Obiettivo ${fmt1(goal)} kg</text>` : ''}
    ${logs.map(l => `<circle class="raw" cx="${X(t(l))}" cy="${Y(l.weight)}" r="3"/>`).join('')}
    ${logs.length > 1 ? `<polyline class="trend" points="${logs.map((l, i) => `${X(t(l))},${Y(trend[i])}`).join(' ')}"/>` : ''}
    <circle class="dot-last" cx="${X(t(logs[logs.length - 1]))}" cy="${Y(trend[trend.length - 1])}" r="4.5"/>
  </svg>`;
}

/* ---------------- Azioni ---------------- */
INPUTS['pf-live'] = () => {
  const pf = $('[data-pf]'); if (!pf) return;
  const box = pf.querySelector('[data-pf-stats]');
  box.innerHTML = statsHtml(computeBiometrics(profileFromForm(pf)));
};
CHANGES['pf-live'] = INPUTS['pf-live'];

ACTIONS['pf-save'] = () => {
  const np = profileFromForm($('[data-pf]'));
  Object.assign(state.profile, np);
  saveState();
  refreshAll();
  toast(planOutdated() ? 'Dati salvati. Puoi aggiornare il piano qui sotto.' : 'Dati salvati');
};
ACTIONS['pf-replan'] = () => {
  const cfg = state.plan.cfg;
  const T = computeTargets(state.profile, cfg);
  const p = state.profile;
  state.plan = Object.assign(state.plan, {
    meals: solvePlan(T, cfg, state.settings.round5),
    target: { kcal: T.kcal, p: T.p, c: T.c, g: T.g },
    basis: { weight: p.weight, pal: p.pal, age: p.age, height: p.height, sex: p.sex, bf: p.bf, formula: p.formula },
    savedAt: new Date().toISOString()
  });
  Plan.draft = null; Plan.dirty = false;
  saveState();
  refreshAll();
  toast(`Piano aggiornato: ${fmt0(T.kcal)} kcal al giorno`);
};

ACTIONS['w-add'] = () => {
  const date = $('[data-w-date]').value || todayISO();
  const w = num($('[data-w-val]').value, 0);
  if (w < 30 || w > 300) return toast('Inserisci un peso valido in kg', { icon: 'info' });
  state.weightLogs = state.weightLogs.filter(l => l.date !== date);
  state.weightLogs.push({ date, weight: Math.round(w * 10) / 10 });
  state.weightLogs.sort((a, b) => a.date.localeCompare(b.date));
  state.profile.weight = state.weightLogs[state.weightLogs.length - 1].weight;
  saveState();
  renderProfile();
  toast(planOutdated() ? 'Pesata registrata. Il piano resta invariato finché non lo aggiorni.' : 'Pesata registrata', { icon: 'scale' });
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-w-val]')) ACTIONS['w-add'](); });
ACTIONS['w-del'] = el => withUndo('Pesata eliminata', () => {
  state.weightLogs = state.weightLogs.filter(l => l.date !== el.dataset.d);
  if (state.weightLogs.length) state.profile.weight = state.weightLogs[state.weightLogs.length - 1].weight;
}, renderProfile);

ACTIONS['guidelines'] = () => openSheet({
  title: `Linee guida ${APP_NAME}`,
  body: GUIDELINES.map(g => `<div class="guide"><span class="ic-wrap">${icon(g.icon)}</span><div><b>${esc(g.t)}</b><p>${esc(g.d)}</p></div></div>`).join('') +
    `<p class="disclaimer" style="margin-top:16px">${esc(DISCLAIMER)}</p>`
});
ACTIONS['set-theme'] = el => { state.settings.theme = el.dataset.v; applyTheme(); saveState(); renderProfile(); };
ACTIONS['set-round'] = el => {
  state.settings.round5 = el.dataset.v === '5';
  Swap.round5 = state.settings.round5;
  saveState(); renderProfile();
  toast('Arrotondamento aggiornato. Salva di nuovo il piano per ricalcolare i grammi.', { icon: 'info' });
};

ACTIONS['backup-export'] = () => {
  state.settings.lastBackup = new Date().toISOString();
  saveState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${APP_NAME.toLowerCase()}-backup-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  renderProfile();
  toast('Backup scaricato', { icon: 'download' });
};
CHANGES['backup-import'] = el => {
  const file = el.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const next = migrate(JSON.parse(reader.result));
      if (!next.profile) throw new Error('profilo mancante');
      const ok = await confirmDialog({ title: 'Ripristinare il backup?', text: 'I dati attuali su questo dispositivo verranno sostituiti da quelli del file.', ok: 'Ripristina' });
      if (!ok) return;
      state = next; invalidateFoods(); Plan.draft = null; Plan.dirty = false;
      saveState(); applyTheme(); refreshAll();
      toast('Backup ripristinato', { icon: 'upload' });
    } catch (e) { toast('Il file non è un backup valido', { icon: 'alert' }); }
  };
  reader.readAsText(file);
  el.value = '';
};
ACTIONS['app-reset'] = async () => {
  const ok = await confirmDialog({ title: 'Cancellare tutto?', text: 'Profilo, piano, diario e pesate verranno eliminati da questo dispositivo. Se vuoi conservarli, scarica prima un backup.', ok: 'Cancella tutto', danger: true });
  if (!ok) return;
  [STORAGE_KEY, ...LEGACY_KEYS].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } });
  location.reload();
};
