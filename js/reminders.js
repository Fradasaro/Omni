/* ==========================================================================
   PROMEMORIA: senza server una web app non può mandare notifiche ad app
   chiusa. Generiamo un file calendario (.ics) con eventi ricorrenti e
   avviso: è il calendario del telefono a ricordare pasti, acqua e pesata.
   ========================================================================== */
'use strict';

const REMINDER_TIMES = { colazione: '07:30', spuntino: '10:30', pranzo: '13:00', merenda: '16:30', cena: '20:00', prenanna: '22:30' };
const WATER_TIMES = ['10:00', '15:00', '18:00'];
const WEEKDAYS = [['MO', 'Lunedì'], ['TU', 'Martedì'], ['WE', 'Mercoledì'], ['TH', 'Giovedì'], ['FR', 'Venerdì'], ['SA', 'Sabato'], ['SU', 'Domenica']];

function reminderSettings() {
  const r = state.settings.reminders = state.settings.reminders || { meals: {}, water: false, weigh: 'MO' };
  planSlots().forEach(s => { if (!(s.id in r.meals)) r.meals[s.id] = REMINDER_TIMES[s.id] || '12:00'; });
  return r;
}

function openReminders() {
  const r = reminderSettings();
  const slots = planSlots();
  openSheet({
    title: 'Promemoria',
    body: `
      <p class="small muted" style="margin-bottom:14px">Scegli cosa ricordarti: creiamo un file da aprire con il calendario del telefono, che ti avviserà anche ad app chiusa.</p>
      <div class="section-label">Pasti del piano</div>
      ${slots.map(s => `<div class="setting"><label class="check" style="flex:1"><input type="checkbox" data-rm-on="${esc(s.id)}" ${r.meals[s.id] ? 'checked' : ''}><span>${esc(s.name)}</span></label>
        <input class="input" type="time" style="width:120px" data-rm-time="${esc(s.id)}" value="${esc(r.meals[s.id] || REMINDER_TIMES[s.id] || '12:00')}" aria-label="Orario ${esc(s.name)}"></div>`).join('')}
      <div class="section-label" style="margin-top:14px">Altro</div>
      <div class="setting"><label class="check" style="flex:1"><input type="checkbox" data-rm-water ${r.water ? 'checked' : ''}><span>Acqua<small class="faint" style="display:block">Alle ${WATER_TIMES.join(', ')}</small></span></label></div>
      <div class="setting"><span style="flex:1;font-weight:600">Pesata settimanale</span>
        <select class="input" style="width:150px" data-rm-weigh aria-label="Giorno della pesata">
          <option value="" ${!r.weigh ? 'selected' : ''}>Nessuna</option>
          ${WEEKDAYS.map(([v, l]) => `<option value="${v}" ${r.weigh === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      <p class="help" style="margin-top:12px">iPhone: apri il file e tocca «Aggiungi tutto». Android: aprilo con l'app Calendario, oppure importalo da calendar.google.com › Impostazioni › Importa. Se cambi gli orari, elimina prima i vecchi eventi «${esc(APP_NAME)}».</p>`,
    foot: `<button class="btn btn-primary" data-ok>${icon('calendar', 'ic-sm')} Aggiungi al calendario</button>`,
    onMount: (root, close) => {
      root.querySelector('[data-ok]').addEventListener('click', () => {
        slots.forEach(s => {
          const on = root.querySelector(`[data-rm-on="${s.id}"]`).checked;
          r.meals[s.id] = on ? (root.querySelector(`[data-rm-time="${s.id}"]`).value || REMINDER_TIMES[s.id] || '12:00') : null;
        });
        r.water = root.querySelector('[data-rm-water]').checked;
        r.weigh = root.querySelector('[data-rm-weigh]').value || null;
        saveState();
        const events = reminderEvents(r, slots);
        if (!events.length) return toast('Scegli almeno un promemoria', { icon: 'info' });
        downloadFile(`${APP_NAME.toLowerCase()}-promemoria.ics`, buildIcs(events), 'text/calendar');
        close();
        toast('File scaricato: aprilo per aggiungere i promemoria al calendario', { icon: 'calendar', duration: 6000 });
      });
    }
  });
}

function reminderEvents(r, slots) {
  const ev = [];
  slots.forEach(s => {
    const pm = state.plan && state.plan.meals && state.plan.meals.find(m => m.slotId === s.id);
    const what = pm && pm.items.length ? pm.items.map(i => `${fmt0(i.grams)} g ${getFood(i.foodId).name}`).join(', ') : '';
    if (r.meals[s.id]) ev.push({ uid: 'meal-' + s.id, time: r.meals[s.id], freq: 'DAILY', title: `${s.name} · ${APP_NAME}`, desc: what ? `Dal piano: ${what}` : 'Registra il pasto nel diario.' });
  });
  if (r.water) WATER_TIMES.forEach((t, i) => ev.push({ uid: 'water-' + i, time: t, freq: 'DAILY', title: `Un bicchiere d'acqua · ${APP_NAME}`, desc: `Obiettivo: ${fmt1((state.profile.water || 2500) / 1000)} L al giorno.` }));
  if (r.weigh) ev.push({ uid: 'weigh', time: '07:30', freq: 'WEEKLY', day: r.weigh, title: `Pesata settimanale · ${APP_NAME}`, desc: 'A digiuno, dopo il bagno. Conta il trend, non il singolo numero.' });
  return ev;
}

function buildIcs(events) {
  const escTxt = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const appUrl = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
  const firstDate = day => {
    let iso = todayISO();
    if (day) { const target = WEEKDAYS.findIndex(w => w[0] === day); while ((parseISO(iso).getDay() + 6) % 7 !== target) iso = addDays(iso, 1); }
    return iso.replace(/-/g, '');
  };
  /* Orari "fluttuanti" (senza fuso): il calendario li tiene all'ora locale. */
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP_NAME}//Promemoria//IT`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escTxt(APP_NAME)}`];
  events.forEach(e => {
    lines.push('BEGIN:VEVENT', `UID:${APP_NAME.toLowerCase()}-${e.uid}@promemoria`, `DTSTAMP:${stamp}`,
      `DTSTART:${firstDate(e.day)}T${e.time.replace(':', '')}00`, 'DURATION:PT15M',
      `RRULE:FREQ=${e.freq}${e.day ? ';BYDAY=' + e.day : ''}`,
      `SUMMARY:${escTxt(e.title)}`, `DESCRIPTION:${escTxt(e.desc)}`);
    if (appUrl) lines.push(`URL:${appUrl}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escTxt(e.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  /* Righe lunghe spezzate come chiede lo standard (max 75 byte, la continuazione inizia con uno spazio). */
  const fold = l => l.length <= 60 ? l : l.match(/.{1,60}/gu).join('\r\n ');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

ACTIONS['reminders'] = () => openReminders();
