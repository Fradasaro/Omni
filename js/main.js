/* ==========================================================================
   AVVIO E NAVIGAZIONE
   ========================================================================== */
'use strict';

const TABS = [
  { id: 'oggi', label: 'Oggi', icon: 'today', render: () => renderToday() },
  { id: 'piano', label: 'Piano', icon: 'plan', render: () => renderPlan() },
  { id: 'scambi', label: 'Scambi', icon: 'swap', render: () => renderSwap() },
  { id: 'spesa', label: 'Spesa', icon: 'shop', render: () => renderShop() },
  { id: 'profilo', label: 'Profilo', icon: 'user', render: () => renderProfile() }
];
let currentTab = 'oggi';
let lastKnownToday = todayISO();

function renderTabbar() {
  $('#tabbar').innerHTML = TABS.map(t => `
    <button class="tab" role="tab" id="tab-${t.id}" aria-controls="view-${t.id}" aria-selected="${t.id === currentTab}" data-action="go" data-tab="${t.id}">
      ${icon(t.icon)}<span>${t.label}</span></button>`).join('');
}

function switchTab(id) {
  if (!TABS.some(t => t.id === id)) id = 'oggi';
  currentTab = id;
  TABS.forEach(t => $(`#view-${t.id}`).classList.toggle('active', t.id === id));
  renderTabbar();
  $('#fab').classList.toggle('hidden', id !== 'oggi');
  TABS.find(t => t.id === id).render();
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  window.scrollTo(0, 0);
}
ACTIONS['go'] = el => switchTab(el.dataset.tab);

function refreshHeader() {
  const p = state.profile;
  if (!p) return;
  const first = (p.name || '').trim().split(/\s+/)[0];
  const initials = (p.name || APP_NAME).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const T = target();
  $('#hdr-greeting').innerHTML = `${esc(first ? 'Ciao, ' + first : 'Ciao')}<small>${esc(state.plan ? goalName(state.plan.cfg.goal) : '')} · ${fmt0(T.kcal)} kcal</small>`;
  $('#hdr-avatar').textContent = initials || 'OM';
}

/* Ridisegna la sezione visibile (le altre si ridisegnano quando vengono aperte). */
function refreshAll() {
  refreshHeader();
  const t = TABS.find(x => x.id === currentTab);
  if (t) t.render();
}

/* Completa piani migrati dalla versione precedente. */
function ensurePlan() {
  if (!state.profile) return;
  if (!state.plan) state.plan = { cfg: defaultPlanCfg(), meals: null, target: null, basis: null, savedAt: null };
  const p = state.profile;
  if (!state.plan.target) {
    const T = computeTargets(p, state.plan.cfg);
    state.plan.target = { kcal: T.kcal, p: T.p, c: T.c, g: T.g };
  }
  if (!state.plan.meals) state.plan.meals = solvePlan(state.plan.target, state.plan.cfg, state.settings.round5);
  if (!state.plan.basis) state.plan.basis = { weight: p.weight, pal: p.pal, age: p.age, height: p.height, sex: p.sex, bf: p.bf, formula: p.formula };
}

function bootApp() {
  ensurePlan();
  saveState();
  applyTheme();
  Today.date = todayISO();
  refreshHeader();
  const fromHash = location.hash.replace('#', '');
  switchTab(TABS.some(t => t.id === fromHash) ? fromHash : 'oggi');
}

/* Se l'app resta aperta oltre la mezzanotte, "Oggi" passa al giorno nuovo. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !state.profile) return;
  const now = todayISO();
  if (now !== lastKnownToday) {
    if (Today.date === lastKnownToday) Today.date = now;
    lastKnownToday = now;
    if (currentTab === 'oggi') renderToday();
  }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

window.addEventListener('DOMContentLoaded', () => {
  document.title = `${APP_NAME} · ${APP_TAGLINE}`;
  $('#brand').innerHTML = `${esc(APP_NAME)}<span class="dot">.</span>`;
  loadState();
  applyTheme();
  renderTabbar();
  if (!state.profile) startWizard();
  else bootApp();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    /* Quando arriva una versione nuova dell'app, la pagina si ricarica da sola una volta. */
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update())
      .catch(err => console.warn('Service worker non registrato', err));
  }
});
