/* ==========================================================================
   UI: componenti condivisi (azioni, toast con Annulla, sheet, conferme,
   ricerca alimenti unica per tutta l'app).
   ========================================================================== */
'use strict';

/* ---------------- Dispatcher eventi (niente onclick inline) ---------------- */
const ACTIONS = {};   // click su [data-action]
const CHANGES = {};   // change su [data-change]
const INPUTS = {};    // input su [data-input]

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
});

/* ---------------- Toast ---------------- */
let _toastTimer = null;
function toast(msg, { icon: ic = 'check', action = null, duration = 3600 } = {}) {
  const root = $('#toast-root');
  clearTimeout(_toastTimer);
  root.innerHTML = `<div class="toast" role="status">${icon(ic, 'ic-sm')}<span>${esc(msg)}</span>${action ? `<button type="button" data-toast-act>${esc(action.label)}</button>` : ''}</div>`;
  if (action) {
    root.querySelector('[data-toast-act]').addEventListener('click', () => { root.innerHTML = ''; action.fn(); });
  }
  _toastTimer = setTimeout(() => { root.innerHTML = ''; }, action ? Math.max(duration, 5500) : duration);
}

/* Esegue una modifica distruttiva e offre "Annulla" invece di chiedere conferma. */
function withUndo(msg, mutate, refresh) {
  const snapshot = clone(state);
  mutate();
  saveState();
  refresh();
  toast(msg, {
    icon: 'undo',
    action: { label: 'Annulla', fn: () => { state = snapshot; invalidateFoods(); saveState(); refreshAll(); } }
  });
}

/* ---------------- Sheet / dialog ---------------- */
let _sheet = null;
function openSheet({ title, body, foot = '', onMount = null, onClose = null, wide = false }) {
  closeSheet();
  const root = $('#overlay-root');
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="max-width:640px"' : ''}>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Chiudi">${icon('x')}</button></div>
      <div class="sheet-body">${body}</div>
      ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}
    </div>`;
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const sheetEl = wrap.querySelector('.sheet');
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (_sheet && _sheet.wrap === wrap) _sheet = null;
    if (onClose) onClose();
  };
  const onKey = e => { if (e.key === 'Escape' && !e.defaultPrevented) close(); };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  _sheet = { wrap, close };
  if (onMount) onMount(sheetEl, close);
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  return { root: sheetEl, close };
}
function closeSheet() { if (_sheet) _sheet.close(); }

function confirmDialog({ title, text, ok = 'Conferma', danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="muted">${esc(text)}</p>`,
      foot: `<button class="btn btn-secondary" data-no>Annulla</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(ok)}</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-no]').addEventListener('click', () => { answered = true; close(); resolve(false); });
        el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; close(); resolve(true); });
      },
      onClose: () => { if (!answered) resolve(false); }
    });
  });
}

/* ---------------- Piccoli frammenti ---------------- */
const dot = cat => `<span class="item-dot" style="background:${catVar(cat)}"></span>`;
function macroTxt(m, digits = 0) {
  const f = digits ? fmt1 : fmt0;
  return `P ${f(m.p)} · C ${f(m.c)} · G ${f(m.g)}`;
}
function planFoodIds() {
  const s = new Set();
  ((state.plan && state.plan.meals) || []).forEach(m => m.items.forEach(it => s.add(it.foodId)));
  return s;
}

/* ---------------- Ricerca alimenti (componente unico) ----------------
   createPicker(host, { value, placeholder, filter, onSelect, allowNone, noneLabel, inline })
   - digiti per cercare, frecce + invio da tastiera
   - in cima: alimenti del Piano e In casa
   ------------------------------------------------------------------- */
function createPicker(host, opts = {}) {
  const o = Object.assign({ value: null, placeholder: 'Cerca un alimento…', filter: null, onSelect: () => {}, allowNone: false, noneLabel: 'Nessuno', inline: false }, opts);
  let value = o.value, open = false, hl = 0, results = [];
  host.classList.add('picker');
  host.innerHTML = `
    ${icon('search', 'ic-search')}
    <input class="input" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(o.placeholder)}" aria-autocomplete="list" role="combobox" aria-expanded="false">
    <button type="button" class="icon-btn sm picker-clear hidden" tabindex="-1" aria-label="Cancella ricerca">${icon('x', 'ic-sm')}</button>
    <div class="picker-list ${o.inline ? 'inline' : ''} hidden" role="listbox"></div>`;
  const input = host.querySelector('input');
  const list = host.querySelector('.picker-list');
  const clearBtn = host.querySelector('.picker-clear');

  const label = () => (value ? getFood(value).name : (o.allowNone ? o.noneLabel : ''));
  const showLabel = () => { input.value = label(); clearBtn.classList.add('hidden'); };

  function compute(q) {
    const plan = planFoodIds();
    Object.keys(state.pantry).forEach(id => plan.add(id));
    const found = searchFoods(q, { filter: o.filter, limit: 80, boost: q.trim() ? plan : null });
    if (q.trim()) return [{ sec: null, items: found }];
    const top = found.filter(f => plan.has(f.id) || inPantry(f.id));
    const rest = found.filter(f => !plan.has(f.id) && !inPantry(f.id));
    const out = [];
    if (top.length) out.push({ sec: 'Nel tuo piano e in casa', items: top });
    out.push({ sec: top.length ? 'Tutti gli alimenti' : null, items: rest });
    return out;
  }

  function render() {
    const q = input.value === label() ? '' : input.value;
    const groups = compute(q);
    results = [];
    if (o.allowNone && !q.trim()) results.push(null);
    groups.forEach(g => g.items.forEach(f => results.push(f)));
    hl = clamp(hl, 0, Math.max(0, results.length - 1));
    if (!results.length) { list.innerHTML = `<div class="picker-empty">Nessun alimento trovato. Puoi crearlo da Spesa › Alimenti.</div>`; return; }
    let idx = 0, html = '';
    if (o.allowNone && !q.trim()) { html += optHtml(null, idx++); }
    groups.forEach(g => {
      if (!g.items.length) return;
      if (g.sec) html += `<div class="picker-sec">${esc(g.sec)}</div>`;
      g.items.forEach(f => { html += optHtml(f, idx++); });
    });
    list.innerHTML = html;
  }
  function optHtml(f, i) {
    if (!f) return `<button type="button" class="picker-opt ${i === hl ? 'hl' : ''}" data-i="${i}" role="option"><span class="item-dot" style="background:var(--surface-3)"></span><span><b>${esc(o.noneLabel)}</b></span></button>`;
    const st = ST_LABEL[f.st] ? ` · ${ST_LABEL[f.st]}` : '';
    return `<button type="button" class="picker-opt ${i === hl ? 'hl' : ''}" data-i="${i}" role="option">${dot(f.cat)}
      <span style="flex:1;min-width:0"><b>${esc(f.name)}</b><small>${fmt0(f.kcal)} kcal · P ${fmt1(f.p)} C ${fmt1(f.c)} G ${fmt1(f.g)} per 100 g${st}</small></span>
      ${inPantry(f.id) ? `<span class="badge home">In casa</span>` : ''}</button>`;
  }
  function setOpen(v) {
    open = v;
    list.classList.toggle('hidden', !v);
    input.setAttribute('aria-expanded', String(v));
    if (v) render();
  }
  function choose(i) {
    const f = results[i];
    value = f ? f.id : null;
    showLabel();
    setOpen(false);
    o.onSelect(f || null);
  }
  function scrollHl() {
    const el = list.querySelector(`[data-i="${hl}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => { hl = 0; setOpen(true); requestAnimationFrame(() => input.select()); });
  input.addEventListener('input', () => { hl = 0; clearBtn.classList.toggle('hidden', !input.value); render(); if (!open) setOpen(true); });
  input.addEventListener('blur', () => setTimeout(() => { if (!host.contains(document.activeElement)) { setOpen(false); showLabel(); } }, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); hl = Math.min(results.length - 1, hl + 1); render(); scrollHl(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, hl - 1); render(); scrollHl(); }
    else if (e.key === 'Enter') { if (open && results.length) { e.preventDefault(); choose(hl); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); showLabel(); input.blur(); } }
  });
  list.addEventListener('mousedown', e => e.preventDefault());
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) choose(Number(b.dataset.i));
  });
  clearBtn.addEventListener('mousedown', e => e.preventDefault());
  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); render(); input.focus(); });

  showLabel();
  return {
    get value() { return value; },
    setValue(id) { value = id; showLabel(); },
    focus() { input.focus(); }
  };
}

/* ---------------- Tema ---------------- */
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
