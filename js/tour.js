/* ==========================================================================
   GUIDA: al primo avvio un breve giro della schermata Oggi, un fumetto alla
   volta sopra l'elemento evidenziato. Poi suggerimenti singoli, una volta
   sola, quando l'elemento compare (es. il primo alimento nel diario).
   Si salta sempre con "Salta" o Esc; non torna più.
   ========================================================================== */
'use strict';

const TOUR_STEPS = [
  { sel: '.ghost-load', t: 'Il pasto dal tuo piano', d: 'Un tocco e il pasto si compila con i grammi del tuo piano. Poi puoi cambiarli come vuoi.' },
  { sel: '#fab', t: 'Aggiungi quello che mangi', d: 'Cerca un alimento, scansiona il codice a barre, aggiungi una ricetta o un pasto libero.' },
  { sel: '.days', t: 'I tuoi giorni', d: 'Tocca un giorno per vederlo o compilarlo. Il puntino indica quelli già registrati.' },
  { sel: '.week-link', t: 'La tua settimana', d: 'Medie e andamento degli ultimi 7 giorni: conta la media, non il singolo giorno.' },
  { sel: '#tab-scambi', t: 'Scambi', d: 'Ti manca un alimento? Trova un equivalente con gli stessi macro, prima tra quelli che hai in casa.' },
  { sel: '#tab-profilo', t: 'Il tuo profilo', d: 'Peso, promemoria, aspetto e backup dei tuoi dati.' }
];
const TIPS = [
  { key: 'swapTap', sel: '#view-oggi .item-tap', t: 'Tocca un alimento per scambiarlo', d: 'Vedi subito gli equivalenti con gli stessi macro. Con − e + cambi i grammi; dal menu ⋯ lo rimuovi.' }
];

const Tour = { steps: [], i: 0, active: false, scheduled: false, onDone: null };

function tourRoot() {
  let r = $('#tour-root');
  if (!r) { r = document.createElement('div'); r.id = 'tour-root'; document.body.appendChild(r); }
  return r;
}

function runTour(steps, onDone) {
  Tour.steps = steps.filter(s => { const el = $(s.sel); return el && el.getClientRects().length; });
  if (!Tour.steps.length) return onDone && onDone();
  Tour.i = 0; Tour.active = true; Tour.onDone = onDone;
  tourRoot().innerHTML = `<div class="tour-catch"></div><div class="tour-spot"></div>
    <div class="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tour-t"></div>`;
  document.addEventListener('keydown', tourKey);
  window.addEventListener('resize', placeTour);
  window.addEventListener('scroll', placeTour, { passive: true });
  showTourStep();
}

function showTourStep() {
  const s = Tour.steps[Tour.i], n = Tour.steps.length, lastStep = Tour.i === n - 1;
  const el = $(s.sel);
  if (!el) return nextTourStep();
  const b = $('#tour-root .tour-bubble');
  b.innerHTML = `<b id="tour-t">${esc(s.t)}</b><p>${esc(s.d)}</p>
    <div class="tour-foot">
      ${n > 1 ? `<span class="xs faint">${Tour.i + 1} di ${n}</span>` : ''}
      <span class="spacer"></span>
      ${n > 1 && !lastStep ? `<button type="button" class="btn btn-ghost btn-sm" data-tour="skip">Salta</button>` : ''}
      <button type="button" class="btn btn-primary btn-sm" data-tour="next">${lastStep ? 'Ho capito' : 'Avanti'}</button>
    </div>`;
  b.querySelector('[data-tour="next"]').addEventListener('click', nextTourStep);
  const skip = b.querySelector('[data-tour="skip"]');
  if (skip) skip.addEventListener('click', endTour);
  const fixed = getComputedStyle(el).position === 'fixed' || el.closest('.tabbar');
  if (!fixed) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => { placeTour(); b.querySelector('[data-tour="next"]').focus({ preventScroll: true }); }, fixed ? 0 : 350);
  /* Lo scorrimento morbido può finire dopo: si riallinea comunque. */
  if (!fixed) setTimeout(placeTour, 900);
}

function placeTour() {
  if (!Tour.active) return;
  const s = Tour.steps[Tour.i], el = s && $(s.sel);
  if (!el) return;
  const r = el.getBoundingClientRect(), pad = 6;
  const spot = $('#tour-root .tour-spot'), b = $('#tour-root .tour-bubble');
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const vw = window.innerWidth, vh = window.innerHeight, bw = Math.min(320, vw - 32), bh = b.offsetHeight;
  const left = clamp(r.left + r.width / 2 - bw / 2, 16, vw - bw - 16);
  const below = r.bottom + pad + 12;
  const top = below + bh < vh - 12 ? below : Math.max(12, r.top - pad - 12 - bh);
  Object.assign(b.style, { width: `${bw}px`, left: `${left}px`, top: `${top}px` });
}

function nextTourStep() {
  if (Tour.i < Tour.steps.length - 1) { Tour.i++; showTourStep(); } else endTour();
}
function endTour() {
  Tour.active = false;
  tourRoot().innerHTML = '';
  document.removeEventListener('keydown', tourKey);
  window.removeEventListener('resize', placeTour);
  window.removeEventListener('scroll', placeTour);
  const done = Tour.onDone; Tour.onDone = null;
  if (done) done();
}
function tourKey(e) { if (e.key === 'Escape') { e.preventDefault(); endTour(); } }

/* Chiamata dopo ogni disegno di Oggi: avvia il giro una volta, poi i suggerimenti. */
function tourAfterRender() {
  if (Tour.active || Tour.scheduled || !state.profile || currentTab !== 'oggi') return;
  const st = state.settings;
  const pending = !st.tourDone ? 'tour' : TIPS.find(t => !(st.tipsSeen || {})[t.key] && $(t.sel));
  if (!pending) return;
  Tour.scheduled = true;
  setTimeout(() => {
    Tour.scheduled = false;
    if (Tour.active || currentTab !== 'oggi' || _sheet || $('#wizard-root').children.length) return;
    if (pending === 'tour') runTour(TOUR_STEPS, () => { st.tourDone = true; saveState(); });
    else runTour([pending], () => { st.tipsSeen = Object.assign({}, st.tipsSeen, { [pending.key]: true }); saveState(); });
  }, 800);
}

/* Per rivederla dal Profilo › Linee guida. */
ACTIONS['tour-replay'] = () => {
  closeSheet();
  state.settings.tourDone = false;
  state.settings.tipsSeen = {};
  saveState();
  if (currentTab !== 'oggi') switchTab('oggi'); else renderToday();
};
