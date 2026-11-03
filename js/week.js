/* ==========================================================================
   SETTIMANA: riepilogo degli ultimi 7 giorni (fino al giorno scelto in Oggi).
   Niente serie da non interrompere, niente rossi: conta la media.
   ========================================================================== */
'use strict';

function weekStats(endIso) {
  const T = target();
  const days = Array.from({ length: 7 }, (_, i) => addDays(endIso, i - 6)).map(iso => {
    const d = state.days[iso];
    const tot = d ? dayTotals(d) : { kcal: 0, p: 0, c: 0, g: 0 };
    const free = d ? dayHasFree(d) : false;
    const logged = tot.kcal > 0;
    const inLine = logged && !free && Math.abs(tot.kcal - T.kcal) <= TOL.kcal &&
      ['p', 'c', 'g'].every(k => Math.abs(tot[k] - T[k]) <= TOL.macro);
    return { iso, tot, free, logged, inLine };
  });
  const logged = days.filter(d => d.logged);
  const avg = k => logged.length ? logged.reduce((s, d) => s + d.tot[k], 0) / logged.length : 0;
  const logs = state.weightLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const inWin = logs.filter(l => l.date >= days[0].iso && l.date <= endIso);
  const before = logs.filter(l => l.date < days[0].iso).pop();
  const startW = before || inWin[0], endW = inWin[inWin.length - 1];
  return {
    T, days, n: logged.length, inLine: days.filter(d => d.inLine).length, free: days.filter(d => d.free).length,
    avg: { kcal: avg('kcal'), p: avg('p'), c: avg('c'), g: avg('g') },
    weight: startW && endW && startW !== endW ? { from: startW.weight, to: endW.weight, d: endW.weight - startW.weight } : null
  };
}

function weekChart(s) {
  const W = 480, H = 170, L = 8, R = 8, Tp = 18, B = 26;
  const max = Math.max(s.T.kcal * 1.3, ...s.days.map(d => d.tot.kcal), 1);
  const bw = (W - L - R) / 7;
  const Y = v => Tp + (1 - v / max) * (H - Tp - B);
  const ty = Y(s.T.kcal);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorie degli ultimi 7 giorni rispetto all'obiettivo">
    ${s.days.map((d, i) => {
      const x = L + i * bw + bw * 0.18, w = bw * 0.64, y = Y(d.tot.kcal);
      const cls = !d.logged ? 'wk-empty' : d.free ? 'wk-free' : 'wk-bar';
      const dd = parseISO(d.iso);
      return `${d.logged ? `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${H - B - y}" rx="6"/>` : `<rect class="wk-empty" x="${x}" y="${H - B - 4}" width="${w}" height="4" rx="2"/>`}
        <text class="lbl" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(dd.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''))} ${dd.getDate()}</text>`;
    }).join('')}
    <line class="goal" x1="${L}" x2="${W - R}" y1="${ty}" y2="${ty}"/>
    <text class="goal-lbl" x="${W - R}" y="${ty - 5}" text-anchor="end">Obiettivo ${fmt0(s.T.kcal)} kcal</text>
  </svg>`;
}

function openWeek() {
  const s = weekStats(Today.date);
  const first = s.days[0].iso, last = s.days[6].iso;
  const macro = (k, name, cls) => `<div class="macro">
      <div class="macro-top"><span class="macro-name c-${cls}">${name}</span></div>
      <div class="macro-val">${fmt0(s.avg[k])}<span> / ${fmt0(s.T[k])} g</span></div>
      <div class="bar"><i class="bg-${cls}" style="width:${Math.min(100, s.avg[k] / Math.max(1, s.T[k]) * 100)}%"></i></div></div>`;
  const note = s.n < 3
    ? 'Registra qualche giorno in più per vedere un andamento affidabile.'
    : s.inLine >= 4 ? 'Settimana molto vicina al piano. Continua così, con calma.'
    : 'Conta la media delle settimane, non il singolo giorno: un pasto libero o un giorno diverso non cambiano il risultato.';
  openSheet({
    title: 'La tua settimana',
    wide: true,
    body: `<p class="small muted" style="margin:-4px 0 14px">${esc(fmtDate(first, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(last, { day: 'numeric', month: 'long' }))}</p>
      <div class="stat-grid wk-stats">
        <div class="stat"><small>Giorni registrati</small><b>${s.n}<span class="faint"> / 7</span></b></div>
        <div class="stat"><small>In linea col piano</small><b>${s.inLine}</b></div>
        <div class="stat"><small>Peso</small><b>${s.weight ? `${s.weight.d > 0 ? '+' : ''}${fmt1(s.weight.d)} kg` : '—'}</b></div>
      </div>
      <div class="section-label" style="margin-top:16px">Calorie al giorno</div>
      <div class="chart">${weekChart(s)}</div>
      <div class="legend"><span><i></i>Giorni registrati</span>${s.free ? `<span><i class="free"></i>Con pasto libero</span>` : ''}</div>
      <div class="section-label" style="margin-top:16px">Media dei giorni registrati${s.n ? ` · ${fmt0(s.avg.kcal)} kcal` : ''}</div>
      ${s.n ? `<div class="grid-3">${macro('p', 'Proteine', 'pro')}${macro('c', 'Carboidrati', 'cho')}${macro('g', 'Grassi', 'fat')}</div>` : `<p class="small muted">Nessun giorno registrato in questo periodo.</p>`}
      <div class="callout calm" style="margin-top:16px">${icon('heart')}<span>${esc(note)}</span></div>`
  });
}

ACTIONS['week-open'] = () => openWeek();
