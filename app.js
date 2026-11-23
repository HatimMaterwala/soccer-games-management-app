(() => {
  'use strict';

  /* ======================= Data layer ======================= */
  const CFG = window.LEAGUE_CONFIG || {};
  const LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const sb = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
  const TABLES = ['teams', 'players', 'events', 'announcements', 'payments'];
  const keyOf = table => (table === 'payments' ? 'player_id' : 'id');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  const Demo = {
    key: 'league-demo-v1',
    read() {
      try { const s = localStorage.getItem(this.key); if (s) return JSON.parse(s); } catch (e) {}
      const d = demoSeed(); this.write(d); return d;
    },
    write(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
  };

  const api = {
    async session() {
      if (LIVE) { const { data } = await sb.auth.getSession(); return data.session; }
      try { return sessionStorage.getItem('league-demo-coach') === '1' ? { user: { email: 'demo coach' } } : null; } catch (e) { return null; }
    },
    async signIn(email, password) {
      if (LIVE) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data.session; }
      if (password.trim().toLowerCase() !== 'coach') throw new Error('That password didn\'t match. Try again.');
      try { sessionStorage.setItem('league-demo-coach', '1'); } catch (e) {}
      return { user: { email: 'demo coach' } };
    },
    async signOut() {
      if (LIVE) await sb.auth.signOut();
      try { sessionStorage.removeItem('league-demo-coach'); } catch (e) {}
    },
    async load(withPrivate) {
      if (LIVE) {
        const run = async q => { const { data, error } = await q; if (error) throw error; return data; };
        const [settings, teams, players, events, announcements] = await Promise.all([
          run(sb.from('settings').select('*').eq('id', 1).maybeSingle()),
          run(sb.from('teams').select('*').order('sort').order('age')),
          run(sb.from('players').select('*')),
          run(sb.from('events').select('*').order('starts_at')),
          run(sb.from('announcements').select('*').order('created_at', { ascending: false })),
        ]);
        const payments = withPrivate ? await run(sb.from('payments').select('*')) : [];
        return { settings: settings || {}, teams, players, events, announcements, payments };
      }
      const d = Demo.read();
      return { ...d, payments: withPrivate ? d.payments : [] };
    },
    async save(table, row) {
      row = { ...row };
      if (LIVE) {
        if (table !== 'settings' && table !== 'payments' && !row.id) delete row.id;
        const { data, error } = await sb.from(table).upsert(row).select();
        if (error) throw error;
        return data && data[0];
      }
      const d = Demo.read();
      if (table === 'settings') { d.settings = { ...d.settings, ...row }; Demo.write(d); return d.settings; }
      const k = keyOf(table);
      if (!row[k]) row[k] = uid();
      if (table === 'announcements' && !row.created_at) row.created_at = new Date().toISOString();
      const i = d[table].findIndex(x => x[k] === row[k]);
      if (i >= 0) d[table][i] = { ...d[table][i], ...row }; else d[table].push(row);
      Demo.write(d);
      return row;
    },
    async insertMany(table, rows) {
      if (LIVE) { const { error } = await sb.from(table).insert(rows); if (error) throw error; return; }
      const d = Demo.read();
      rows.forEach(r => d[table].push({ ...r, id: uid() }));
      Demo.write(d);
    },
    async remove(table, id) {
      if (LIVE) { const { error } = await sb.from(table).delete().eq(keyOf(table), id); if (error) throw error; return; }
      const d = Demo.read();
      d[table] = d[table].filter(x => x[keyOf(table)] !== id);
      if (table === 'teams') { d.events = d.events.filter(e => e.team_id !== id); d.players.forEach(p => { if (p.team_id === id) p.team_id = null; }); }
      if (table === 'players') d.payments = d.payments.filter(p => p.player_id !== id);
      Demo.write(d);
    },
  };

  /* Demo data so the site is usable before the database is connected. */
  function demoSeed() {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
    const teams = [
      { age: 'U8', name: 'Falcons', coach: 'Coach Amina R.', coach_phone: '(555) 201-4410', practice_note: 'Tue 5:30 PM, Field 1', sort: 1, days: [[2, '17:30', 'Field 1']] },
      { age: 'U10', name: 'Lions', coach: 'Coach Daniel K.', coach_phone: '(555) 201-4422', practice_note: 'Tue & Thu 6:00 PM, Field 2', sort: 2, days: [[2, '18:00', 'Field 2'], [4, '18:00', 'Field 2']] },
      { age: 'U12', name: 'Strikers', coach: 'Coach Sofia M.', coach_phone: '(555) 201-4437', practice_note: 'Mon & Wed 6:00 PM, Field 3', sort: 3, days: [[1, '18:00', 'Field 3'], [3, '18:00', 'Field 3']] },
      { age: 'U14', name: 'Thunder', coach: 'Coach Omar H.', coach_phone: '(555) 201-4459', practice_note: 'Wed 7:00 PM & Fri 6:30 PM, Field 1', sort: 4, days: [[3, '19:00', 'Field 1'], [5, '18:30', 'Field 1']] },
    ].map(t => ({ ...t, id: uid() }));
    const FIRST = ['Aaliyah','Ben','Carlos','Dina','Elias','Fatima','Gabe','Hana','Isaac','Jada','Kofi','Leila','Mateo','Nora','Owen','Priya','Quinn','Rami','Sara','Theo','Uma','Victor','Wren','Yusuf','Zara','Adam','Bella','Caleb','Dev','Emma','Farah','Grant','Hugo','Iris','Jonah','Kai','Luca','Maya','Noah','Olivia','Pablo','Ruby','Sami','Tess','Ali','Bilal','Chloe','Diego','Eva','Finn','Grace','Hassan','Ivy','Jamal','Kira','Liam','Mila','Nate','Omar','Rosa'];
    const LAST = ['Ahmed','Brooks','Castillo','Diallo','Evans','Farah','Garcia','Hussein','Ito','Johnson','Khan','Lopez','Mensah','Nguyen','Okafor','Patel','Reyes','Silva','Turner','Walker','Yilmaz','Kim','Bauer','Moreno'];
    const POS = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD','FWD','DEF','MID','FWD'];
    const players = [], payments = [], events = [];
    teams.forEach((t, ti) => {
      const used = new Set();
      const base = 52 + ti * 5;
      for (let i = 0; i < 15; i++) {
        let n; do { n = between(1, 30); } while (used.has(n)); used.add(n);
        const r = () => Math.min(97, between(base - 8, base + 22));
        const last = pick(LAST);
        const p = { id: uid(), team_id: t.id, first: FIRST[ti * 15 + i], last, number: n, position: POS[i], age: 6 + ti * 2 + between(0, 1),
          stats: { SPD: r(), SHO: r(), PAS: r(), DRI: r(), DEF: r(), TEM: r() } };
        players.push(p);
        const roll = rnd();
        payments.push({ player_id: p.id, paid: roll < .68 ? 150 : roll < .84 ? 75 : 0, guardian: `${pick(['Ms.', 'Mr.'])} ${last}`, guardian_phone: '', note: '' });
      }
    });
    const OPP = ['Riverside FC', 'Eastgate United', 'Maple Park SC', 'Lakeview Rovers', 'Hillcrest Athletic', 'Westend Wolves'];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let d = -7; d < 28; d++) {
      const day = new Date(start); day.setDate(day.getDate() + d);
      const at = hm => { const x = new Date(day); const [h, m] = hm.split(':').map(Number); x.setHours(h, m, 0, 0); return x.toISOString(); };
      teams.forEach((t, ti) => {
        t.days.forEach(([dow, hm, field]) => { if (day.getDay() === dow) events.push({ id: uid(), team_id: t.id, kind: 'practice', starts_at: at(hm), location: `Northside Park, ${field}`, title: '', opponent: '', home: true, notes: '', result: '' }); });
        if (day.getDay() === 6) {
          const home = (d + ti) % 2 === 0; const opp = OPP[(d + 14 + ti) % OPP.length];
          events.push({ id: uid(), team_id: t.id, kind: 'game', starts_at: at(['09:00', '10:30', '12:00', '13:30'][ti]), opponent: opp, home,
            location: home ? `Northside Park, Field ${ti + 1}` : `${opp.split(' ')[0]} Fields`, title: '', notes: '', result: d < 0 ? pick(['W 3-1', 'L 1-2', 'D 2-2', 'W 4-0']) : '' });
        }
      });
    }
    teams.forEach(t => delete t.days);
    const ago = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString(); };
    const announcements = [
      { id: uid(), title: 'Picture day is this Saturday', body: 'Arrive 20 minutes before your game in full uniform. Team and individual photos will be taken by the snack stand.', tag: 'Important', pinned: true, created_at: ago(0) },
      { id: uid(), title: 'Season fee reminder', body: 'The $150 season fee covers uniform, field rental and referees. Pay any coach in person.', tag: 'Payments', pinned: false, created_at: ago(2) },
      { id: uid(), title: 'Field 3 lights fixed', body: 'U12 Strikers practices are back on Field 3 starting this week.', tag: 'Fields', pinned: false, created_at: ago(5) },
    ];
    return {
      settings: { id: 1, league_name: 'Northside Youth Soccer', season: 'Fall season 2026', fee: 150, show_last_names: false, welcome: 'Schedules, rosters and team news in one place. Bookmark this page on your phone.' },
      teams, players, payments, events, announcements,
    };
  }

  /* ======================= Helpers ======================= */
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const DAY = 864e5;
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dayLabel = d => { const diff = Math.round((dayStart(d) - startOfToday()) / DAY); return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : DOW[d.getDay()]; };
  const timeStr = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateStr = d => `${MON[d.getMonth()]} ${d.getDate()}`;
  const pad = n => String(n).padStart(2, '0');
  const toDateInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeInput = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const STAT_LABEL = { SPD: 'Speed', SHO: 'Shoot', PAS: 'Pass', DRI: 'Dribble', DEF: 'Defend', TEM: 'Team' };
  const POS_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const ICON = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.7-2 3-4 3s-3.5-1.3-4-3z"/></svg>',
  };

  let DB = null;           // loaded data
  let SESSION = null;      // coach session
  const ui = { schedTeam: 'all', schedPast: false, rosterTeam: null, cardTeam: 'all', coachTab: 'news', payFilter: 'all', paySearch: '' };

  const team = id => DB.teams.find(t => t.id === id);
  const teamLabel = t => (t ? `${t.age} ${t.name}` : 'Whole league');
  const fee = () => Number(DB.settings.fee || 0);
  const payOf = pid => DB.payments.find(p => p.player_id === pid) || { player_id: pid, paid: 0, guardian: '', guardian_phone: '', note: '' };
  const lastShown = p => (DB.settings.show_last_names || SESSION ? (p.last || '') : (p.last ? p.last[0] + '.' : ''));
  const ovr = p => { const v = Object.values(p.stats || {}).map(Number).filter(n => !isNaN(n)); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const eventTitle = e => {
    const t = team(e.team_id);
    if (e.kind === 'game') return `${t ? t.name : 'Game'} ${e.home ? 'vs' : 'at'} ${e.opponent || 'TBD'}`;
    if (e.kind === 'practice') return e.title || `${t ? t.name : 'Team'} practice`;
    return e.title || 'League event';
  };
  const KIND_LABEL = { practice: 'Practice', game: 'Game', event: 'Event' };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function refresh() {
    DB = await api.load(!!SESSION);
    $('#brandName').textContent = DB.settings.league_name || 'Youth Soccer';
    document.title = DB.settings.league_name || 'Youth Soccer';
    if (!ui.rosterTeam || !team(ui.rosterTeam)) ui.rosterTeam = DB.teams[0] && DB.teams[0].id;
  }

  /* ======================= Public views ======================= */
  const pageHead = (eyebrow, title, lede) => `<section class="page-head"><div class="wrap"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>${lede ? `<p>${esc(lede)}</p>` : ''}</div></section>`;
  const teamChips = (key, withAll) => DB.teams.length ? `<div class="chips" role="group" aria-label="Choose team">${withAll ? `<button class="chip" data-chip="${key}" data-val="all" aria-pressed="${ui[key] === 'all'}">All teams</button>` : ''}${DB.teams.map(t => `<button class="chip" data-chip="${key}" data-val="${t.id}" aria-pressed="${ui[key] === t.id}">${esc(teamLabel(t))}</button>`).join('')}</div>` : '';
  const emptyBox = (msg, cta) => `<div class="empty">${esc(msg)}${cta ? `<div style="margin-top:16px"><a class="btn small light" href="#coach">${esc(cta)}</a></div>` : ''}</div>`;

  function viewHome() {
    const now = Date.now();
    const upcoming = DB.events.filter(e => new Date(e.starts_at).getTime() >= now - 2 * 3600e3);
    const next = upcoming.find(e => e.kind === 'game') || upcoming[0];
    const s = DB.settings;
    let nextHtml = `<article class="next-up"><span class="eyebrow">Next up</span><p style="color:var(--muted)">No games or practices scheduled yet.</p></article>`;
    if (next) {
      const d = new Date(next.starts_at); const t = team(next.team_id);
      const days = Math.round((dayStart(d) - startOfToday()) / DAY);
      const head = next.kind === 'game'
        ? `<div class="matchup">${esc(t ? t.name : 'Game')}<span class="vs">${next.home ? 'vs' : 'at'}</span>${esc(next.opponent || 'TBD')}</div>`
        : `<div class="matchup">${esc(eventTitle(next))}</div>`;
      nextHtml = `
      <article class="next-up" aria-label="Next up">
        <div class="next-up-top">
          <div style="display:grid;gap:8px"><span class="eyebrow">Next ${next.kind === 'game' ? 'game' : KIND_LABEL[next.kind].toLowerCase()} · ${esc(t ? t.age : 'All teams')}</span>${head}</div>
          <div class="countdown num">${days <= 0 ? '<b>Today</b><small>kickoff</small>' : `<b>${days}</b><small>${days === 1 ? 'day' : 'days'} away</small>`}</div>
        </div>
        <div class="meta-row">
          <span>${ICON.clock}${dayLabel(d)}, ${dateStr(d)} · ${timeStr(d)}</span>
          ${next.location ? `<span>${ICON.pin}${esc(next.location)}</span>` : ''}
          ${next.kind === 'game' ? `<span>${ICON.shirt}${next.home ? 'Home kit' : 'Away kit'}</span>` : ''}
        </div>
        <a class="btn" href="#schedule">See full schedule</a>
      </article>`;
    }
    const news = [...DB.announcements].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)));
    const results = DB.events.filter(e => e.kind === 'game' && e.result).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)).slice(0, 4);
    return `
    <section class="page-head hero"><div class="wrap">
      <div style="display:grid;gap:16px">
        <span class="eyebrow">${esc(s.season || '')}</span>
        <h1>${esc(s.league_name || 'Youth Soccer')}</h1>
        <p class="hero-lede">${esc(s.welcome || '')}</p>
      </div>
      ${nextHtml}
    </div></section>
    <div class="wrap">
      <section class="section">
        <div class="section-title"><h2>Announcements</h2></div>
        ${news.length ? `<div class="news">${news.map(n => { const d = new Date(n.created_at); return `
          <article class="news-item${n.pinned ? ' pinned' : ''}">
            <div class="news-date num"><small>${MON[d.getMonth()]}</small><b>${d.getDate()}</b></div>
            <div><span class="tag${n.pinned ? ' gold' : ''}">${esc(n.tag || 'News')}</span><h3 style="margin-top:8px">${esc(n.title)}</h3><p style="white-space:pre-line">${esc(n.body)}</p></div>
          </article>`; }).join('')}</div>` : emptyBox('No announcements yet.')}
      </section>
      ${results.length ? `<section class="section">
        <div class="section-title"><h2>Recent results</h2><a href="#schedule">Schedule</a></div>
        <div class="list">${results.map(e => { const d = new Date(e.starts_at); const t = team(e.team_id); return `
          <div class="list-row"><div><strong>${esc(eventTitle(e))}</strong><span>${esc(t ? t.age : '')} · ${dateStr(d)}</span></div><span class="result num">${esc(e.result)}</span></div>`; }).join('')}</div>
      </section>` : ''}
      <section class="section">
        <div class="section-title"><h2>Teams</h2><a href="#roster">All rosters</a></div>
        ${DB.teams.length ? `<div class="team-grid">${DB.teams.map(t => `
          <a class="team-tile" href="#roster" data-team="${t.id}"><span class="age">${esc(t.age)}</span><strong>${esc(t.name)}</strong><span>${esc(t.coach)}</span></a>`).join('')}</div>` : emptyBox('No teams yet.')}
      </section>
    </div>`;
  }

  function viewSchedule() {
    const cutoff = startOfToday().getTime();
    const list = DB.events
      .filter(e => ui.schedTeam === 'all' || e.team_id === ui.schedTeam || !e.team_id)
      .filter(e => (ui.schedPast ? new Date(e.starts_at).getTime() < cutoff : new Date(e.starts_at).getTime() >= cutoff))
      .sort((a, b) => (ui.schedPast ? -1 : 1) * (new Date(a.starts_at) - new Date(b.starts_at)));
    const groups = [];
    list.forEach(e => { const d = dayStart(new Date(e.starts_at)); const k = d.getTime(); let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, d, items: [] }); g.items.push(e); });
    return pageHead(DB.settings.season || 'Season', 'Schedule', 'Practices and games for every team. Games are marked in gold.') + `
    <div class="wrap"><section class="section">
      ${teamChips('schedTeam', true)}
      <div class="chips" role="group" aria-label="When">
        <button class="chip" data-past="0" aria-pressed="${!ui.schedPast}">Upcoming</button>
        <button class="chip" data-past="1" aria-pressed="${ui.schedPast}">Past &amp; results</button>
      </div>
      <div style="display:grid;gap:8px">${groups.length ? groups.map(g => `
        <div class="day">
          <div class="day-head"><h3>${dayLabel(g.d)}</h3><span class="num">${dateStr(g.d)}</span></div>
          ${g.items.map(e => { const d = new Date(e.starts_at); const t = team(e.team_id); const tm = timeStr(d).split(' '); return `
          <div class="event${e.kind === 'game' ? ' game' : ''}">
            <div class="event-time num">${esc(tm[0])}<small>${esc(tm[1] || '')}</small></div>
            <div class="event-body"><strong>${esc(eventTitle(e))}</strong><span>${esc(t ? t.age : 'All teams')}${e.location ? ' · ' + esc(e.location) : ''}</span>${e.notes ? `<span>${esc(e.notes)}</span>` : ''}</div>
            ${e.result ? `<span class="result num">${esc(e.result)}</span>` : `<span class="tag${e.kind === 'game' ? ' gold' : ''}">${KIND_LABEL[e.kind] || 'Event'}</span>`}
          </div>`; }).join('')}
        </div>`).join('') : emptyBox(ui.schedPast ? 'No past events yet.' : 'Nothing scheduled yet.')}
      </div>
    </section></div>`;
  }

  function viewRoster() {
    if (!DB.teams.length) return pageHead(DB.settings.season || '', 'Roster', '') + `<div class="wrap"><section class="section">${emptyBox('No teams yet.')}</section></div>`;
    const t = team(ui.rosterTeam) || DB.teams[0];
    const list = DB.players.filter(p => p.team_id === t.id).sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || (a.number || 99) - (b.number || 99));
    return pageHead(DB.settings.season || '', 'Roster', `${DB.players.length} players across ${DB.teams.length} teams.`) + `
    <div class="wrap"><section class="section">
      ${teamChips('rosterTeam', false)}
      <div class="coach-strip">
        <div><span class="eyebrow">Head coach</span><strong>${esc(t.coach || 'To be announced')}</strong>${t.coach_phone ? `<span class="num">${esc(t.coach_phone)}</span>` : ''}</div>
        ${t.practice_note ? `<div><span class="eyebrow">Practice</span><strong>${esc(t.practice_note)}</strong></div>` : ''}
      </div>
      ${list.length ? `<div class="roster">${list.map(p => `
        <div class="player-row"><span class="jersey num">${p.number ?? ''}</span><div><strong>${esc(p.first)} ${esc(lastShown(p))}</strong>${p.age ? `<span>Age ${esc(p.age)}</span>` : ''}</div><span class="pos">${esc(p.position || '')}</span></div>`).join('')}</div>` : emptyBox('No players on this team yet.')}
    </section></div>`;
  }

  function viewCards() {
    const list = DB.players.filter(p => ui.cardTeam === 'all' || p.team_id === ui.cardTeam).sort((a, b) => ovr(b) - ovr(a));
    return pageHead('Just for fun', 'Player Cards', 'Coach ratings out of 99. Gold cards go to players rated 75 and up.') + `
    <div class="wrap"><section class="section">
      ${teamChips('cardTeam', true)}
      ${list.length ? `<div class="cards">${list.map(p => { const t = team(p.team_id); const o = ovr(p); return `
        <article class="pcard${o >= 75 ? ' elite' : ''}" aria-label="${esc(p.first)}, rated ${o}">
          <div class="pc-top"><div><div class="pc-ovr num">${o}</div><div class="pc-pos">${esc(p.position || '')}</div></div><div class="pc-team">${esc(t ? t.age : '')}<br>${esc(t ? t.name : '')}<br>${p.number != null ? '#' + esc(p.number) : ''}</div></div>
          <div class="pc-avatar">${esc((p.first || '?')[0])}${esc((p.last || '')[0] || '')}</div>
          <div class="pc-name">${esc(p.first)}<br>${esc(lastShown(p))}</div>
          <div class="pc-stats num">${Object.keys(STAT_LABEL).map(k => `<div><span>${STAT_LABEL[k]}</span><b>${esc((p.stats || {})[k] ?? '')}</b></div>`).join('')}</div>
        </article>`; }).join('')}</div>` : emptyBox('No players yet.')}
    </section></div>`;
  }

  /* ======================= Coach area ======================= */
  function viewCoach() {
    if (!SESSION) return pageHead('Coaches only', 'Coach sign in', 'Manage news, the schedule, rosters and payments.') + `
    <div class="wrap"><form class="gate" id="signin" novalidate>
      <h2>Sign in</h2>
      <p>Parents don't need to sign in. This area is for coaches only.</p>
      ${LIVE ? `<div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" required></div>` : ''}
      <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
      <p class="error" id="signinErr" hidden></p>
      <button class="btn" type="submit">Sign in</button>
      ${LIVE ? '<p class="hint">Forgot your password or need an account? Ask the league admin to add you in Supabase.</p>' : '<p class="hint">Demo mode: the password is <strong>coach</strong>.</p>'}
    </form></div>`;

    const tabs = [['news', 'News'], ['schedule', 'Schedule'], ['teams', 'Teams'], ['players', 'Players'], ['payments', 'Payments'], ['settings', 'Settings']];
    const body = { news: coachNews, schedule: coachSchedule, teams: coachTeams, players: coachPlayers, payments: coachPayments, settings: coachSettings }[ui.coachTab]();
    return pageHead('Coaches only', 'Manage league', `Signed in as ${SESSION.user.email}.`) + `
    <div class="wrap"><section class="section">
      <div class="coach-head">
        <div class="chips" role="group" aria-label="Section">${tabs.map(([k, l]) => `<button class="chip" data-coachtab="${k}" aria-pressed="${ui.coachTab === k}">${l}</button>`).join('')}</div>
        <button class="btn ghost" data-act="signout" type="button">Sign out</button>
      </div>
      ${body}
    </section></div>`;
  }

  const addBar = (title, act, label) => `<div class="section-title"><h2>${title}</h2><button class="btn small" data-act="${act}" type="button">+ ${label}</button></div>`;

  function coachNews() {
    const list = [...DB.announcements].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)));
    return addBar('News', 'new-news', 'Announcement') + (list.length ? `<div class="list">${list.map(n => `
      <div class="list-row"><div><strong>${esc(n.title)}</strong><span>${n.pinned ? 'Pinned · ' : ''}${esc(n.tag || 'News')} · ${dateStr(new Date(n.created_at))}</span></div>
      <div class="row-actions"><button class="btn small ghost" data-act="edit-news" data-id="${n.id}">Edit</button></div></div>`).join('')}</div>` : emptyBox('No announcements yet. Add the first one.'));
  }

  function coachSchedule() {
    const cutoff = startOfToday().getTime() - 14 * DAY;
    const list = DB.events.filter(e => new Date(e.starts_at).getTime() >= cutoff).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    let lastDay = '';
    return addBar('Schedule', 'new-event', 'Event') + `<p style="font-size:14px;color:var(--muted)">Showing the last 2 weeks and everything coming up. Add a result to a past game to show it on the home page.</p>` +
      (list.length ? `<div class="list">${list.map(e => { const d = new Date(e.starts_at); const dl = `${dayLabel(d)}, ${dateStr(d)}`; const head = dl !== lastDay ? `<div class="list-group">${dl}</div>` : ''; lastDay = dl; const t = team(e.team_id); return head + `
        <div class="list-row"><div><strong>${esc(eventTitle(e))}</strong><span>${timeStr(d)} · ${esc(t ? t.age : 'All teams')} · ${KIND_LABEL[e.kind] || 'Event'}${e.result ? ' · ' + esc(e.result) : ''}</span></div>
        <div class="row-actions"><button class="btn small ghost" data-act="edit-event" data-id="${e.id}">Edit</button></div></div>`; }).join('')}</div>` : emptyBox('Nothing scheduled yet. Add practices and games.'));
  }

  function coachTeams() {
    return addBar('Teams', 'new-team', 'Team') + (DB.teams.length ? `<div class="list">${DB.teams.map(t => `
      <div class="list-row"><div><strong>${esc(teamLabel(t))}</strong><span>${esc(t.coach || 'No coach set')} · ${(n => n + (n === 1 ? ' player' : ' players'))(DB.players.filter(p => p.team_id === t.id).length)}</span></div>
      <div class="row-actions"><button class="btn small ghost" data-act="edit-team" data-id="${t.id}">Edit</button></div></div>`).join('')}</div>` : emptyBox('No teams yet. Add your first age group.'));
  }

  function coachPlayers() {
    const groups = [...DB.teams.map(t => ({ t, ps: DB.players.filter(p => p.team_id === t.id) })), { t: null, ps: DB.players.filter(p => !team(p.team_id)) }].filter(g => g.ps.length);
    return addBar(`Players (${DB.players.length})`, 'new-player', 'Player') + (DB.teams.length ? '' : '<p class="hint">Add a team first, then add players to it.</p>') +
      (groups.length ? `<div class="list">${groups.map(g => `<div class="list-group">${esc(g.t ? teamLabel(g.t) : 'No team')}</div>` + g.ps.sort((a, b) => (a.number || 99) - (b.number || 99)).map(p => `
        <div class="list-row"><div><strong>${p.number != null ? '#' + esc(p.number) + ' ' : ''}${esc(p.first)} ${esc(p.last)}</strong><span>${esc(p.position || '')}${p.age ? ' · Age ' + esc(p.age) : ''} · Rated ${ovr(p)}</span></div>
        <div class="row-actions"><button class="btn small ghost" data-act="edit-player" data-id="${p.id}">Edit</button></div></div>`).join('')).join('')}</div>` : emptyBox('No players yet.'));
  }

  const statusOf = p => { const paid = Number(payOf(p.id).paid || 0); return paid >= fee() ? 'paid' : paid > 0 ? 'partial' : 'unpaid'; };
  function coachPayments() {
    const F = fee();
    const total = DB.players.length * F;
    const paidOf = p => Math.min(Number(payOf(p.id).paid || 0), F);
    const collected = DB.players.reduce((a, p) => a + paidOf(p), 0);
    const full = DB.players.filter(p => statusOf(p) === 'paid');
    const part = DB.players.filter(p => statusOf(p) === 'partial');
    const none = DB.players.length - full.length - part.length;
    const q = ui.paySearch.toLowerCase();
    const rows = DB.players.filter(p => (ui.payFilter === 'all' || statusOf(p) === ui.payFilter) && (!q || `${p.first} ${p.last} ${payOf(p.id).guardian}`.toLowerCase().includes(q)))
      .sort((a, b) => paidOf(a) - paidOf(b) || (a.last || '').localeCompare(b.last || ''));
    const partSum = part.reduce((a, p) => a + paidOf(p), 0);
    const pct = total ? Math.round(collected / total * 100) : 0;
    const filt = [['all', 'Everyone'], ['unpaid', `Not paid (${none})`], ['partial', `Partly paid (${part.length})`], ['paid', `Paid (${full.length})`]];
    return `<div class="section-title"><h2>Payments</h2><button class="btn small light" data-act="copy-owing" type="button">Copy who still owes</button></div>
      <div class="money">
        <div class="money-top">
          <div style="display:grid;gap:4px"><span class="eyebrow">Collected · ${money(F)} per player</span><b class="num">${money(collected)} <small>of ${money(total)}</small></b></div>
          <div style="display:grid;gap:4px;text-align:right"><span class="eyebrow">Still owed</span><b class="num" style="font-size:32px;color:var(--secondary-ink)">${money(total - collected)}</b></div>
        </div>
        <div class="bar" role="img" aria-label="${pct} percent collected"><i class="paid" style="width:${total ? full.length * F / total * 100 : 0}%"></i><i class="part" style="width:${total ? partSum / total * 100 : 0}%"></i></div>
        <div class="legend num">
          <span><i style="background:var(--primary)"></i>${full.length} paid in full</span>
          <span><i style="background:var(--secondary)"></i>${part.length} partly paid</span>
          <span><i style="background:var(--paper);border:1px solid var(--line)"></i>${none} not paid</span>
        </div>
      </div>
      <div class="toolbar"><input class="input" id="paysearch" type="search" placeholder="Search player or parent" value="${esc(ui.paySearch)}" aria-label="Search players"></div>
      <div class="chips" role="group" aria-label="Filter by status">${filt.map(([v, l]) => `<button class="chip" data-chip="payFilter" data-val="${v}" aria-pressed="${ui.payFilter === v}">${l}</button>`).join('')}</div>
      <div class="pay-table-wrap"><table>
        <thead><tr><th>Player</th><th>Team</th><th>Status</th><th class="r">Paid</th><th class="r">Owes</th><th class="r">Action</th></tr></thead>
        <tbody>${rows.map(p => { const t = team(p.team_id); const s = statusOf(p); const pay = payOf(p.id); return `
          <tr><td><strong>${esc(p.first)} ${esc(p.last)}</strong>${pay.guardian || pay.guardian_phone ? `<br><span style="color:var(--muted);font-size:12px">${esc(pay.guardian)}${pay.guardian_phone ? ' · ' + esc(pay.guardian_phone) : ''}</span>` : ''}${pay.note ? `<br><span style="color:var(--muted);font-size:12px">${esc(pay.note)}</span>` : ''}</td>
            <td>${esc(t ? teamLabel(t) : '—')}</td>
            <td><span class="status ${s}">${s === 'paid' ? 'Paid' : s === 'partial' ? 'Partly paid' : 'Not paid'}</span></td>
            <td class="r num">${money(pay.paid)}</td>
            <td class="r num">${s === 'paid' ? '—' : money(F - Number(pay.paid || 0))}</td>
            <td class="r"><div style="display:flex;gap:8px;justify-content:flex-end">${s === 'paid' ? '' : `<button class="mark-btn" data-act="mark-paid" data-id="${p.id}">Mark paid</button>`}<button class="mark-btn" data-act="edit-pay" data-id="${p.id}" style="color:var(--muted)">Edit</button></div></td></tr>`; }).join('') || `<tr><td colspan="6"><div class="empty" style="border:0">No players match.</div></td></tr>`}
        </tbody></table></div>
      <p class="footnote">Only signed-in coaches can see this page and parent contact details.</p>`;
  }

  function coachSettings() {
    const s = DB.settings;
    return `<div class="section-title"><h2>Settings</h2></div>
      <form class="money" id="settingsForm" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="s_name">League name</label><input class="input" id="s_name" name="league_name" value="${esc(s.league_name)}" required></div>
          <div class="field"><label for="s_season">Season</label><input class="input" id="s_season" name="season" value="${esc(s.season)}"></div>
          <div class="field"><label for="s_fee">Season fee per player ($)</label><input class="input" id="s_fee" name="fee" type="number" min="0" step="1" value="${esc(s.fee)}"></div>
          <div class="field full"><label for="s_welcome">Welcome message on the home page</label><textarea class="input" id="s_welcome" name="welcome">${esc(s.welcome)}</textarea></div>
          <label class="check full"><input type="checkbox" id="s_last" name="show_last_names" ${s.show_last_names ? 'checked' : ''}> Show players' full last names to the public (off shows only an initial)</label>
        </div>
        <div><button class="btn" type="submit">Save settings</button></div>
      </form>`;
  }

  /* ======================= Forms (modal sheet) ======================= */
  const sheet = $('#sheet');
  let sheetSubmit = null, sheetDelete = null;

  function field(f) {
    const id = 'f_' + f.name;
    const v = f.value == null ? '' : f.value;
    const cls = f.full ? 'field full' : 'field';
    if (f.type === 'section') return `<div class="form-section eyebrow">${esc(f.label)}</div>`;
    if (f.type === 'checkbox') return `<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    if (f.type === 'select') return `<div class="${cls}"><label for="${id}">${esc(f.label)}</label><select class="input" id="${id}" name="${f.name}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
    if (f.type === 'textarea') return `<div class="${cls}"><label for="${id}">${esc(f.label)}</label><textarea class="input" id="${id}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea></div>`;
    return `<div class="${cls}" ${f.showIf ? `data-showif="${f.showIf}"` : ''}><label for="${id}">${esc(f.label)}</label><input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.type === 'number' ? 'step="any" inputmode="decimal"' : ''}>${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
  }

  function openForm({ title, fields, onSubmit, onDelete, deleteLabel, afterRender }) {
    sheetSubmit = onSubmit; sheetDelete = onDelete;
    const stats = fields.filter(f => f.stat);
    const normal = fields.filter(f => !f.stat);
    sheet.innerHTML = `<form id="sheetForm" novalidate>
      <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">×</button></div>
      <div class="form-grid">${normal.map(field).join('')}${stats.length ? `<div class="form-section eyebrow">Ratings out of 99</div><div class="third-row">${stats.map(field).join('')}</div>` : ''}</div>
      <p class="error" id="sheetErr" hidden></p>
      <div class="sheet-actions">
        ${onDelete ? `<button type="button" class="btn small danger" data-act="sheet-delete">${esc(deleteLabel || 'Delete')}</button>` : ''}
        <div class="right"><button type="button" class="btn ghost" data-act="close">Cancel</button><button type="submit" class="btn">Save</button></div>
      </div>
    </form>`;
    if (afterRender) afterRender(sheet);
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    const first = sheet.querySelector('input:not([type=checkbox]), select, textarea'); if (first) first.focus();
  }
  const closeForm = () => { if (sheet.open) sheet.close(); sheet.removeAttribute('open'); };
  const formValues = form => { const o = {}; form.querySelectorAll('[name]').forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
  const numOrNull = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const teamOptions = withLeague => [...(withLeague ? [['', 'Whole league']] : []), ...DB.teams.map(t => [t.id, teamLabel(t)])];

  function formNews(n) {
    n = n || { title: '', body: '', tag: 'News', pinned: false };
    openForm({
      title: n.id ? 'Edit announcement' : 'New announcement',
      fields: [
        { name: 'title', label: 'Headline', value: n.title, full: true, required: true, placeholder: 'e.g. No practice Thursday' },
        { name: 'tag', label: 'Label', type: 'select', value: n.tag, options: ['News', 'Important', 'Schedule change', 'Weather', 'Payments', 'Fields', 'Event'].map(x => [x, x]) },
        { name: 'pinned', label: 'Pin to top', type: 'checkbox', value: n.pinned },
        { name: 'body', label: 'Details', type: 'textarea', value: n.body, full: true },
      ],
      onSubmit: async v => { if (!v.title) throw new Error('Add a headline.'); await api.save('announcements', { ...(n.id ? { id: n.id } : {}), title: v.title, body: v.body, tag: v.tag, pinned: v.pinned }); return 'Announcement saved'; },
      onDelete: n.id ? async () => { await api.remove('announcements', n.id); return 'Announcement deleted'; } : null,
    });
  }

  function formEvent(e) {
    const isNew = !e;
    const d0 = e ? new Date(e.starts_at) : (() => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(18, 0, 0, 0); return x; })();
    e = e || { kind: 'practice', team_id: DB.teams[0] ? DB.teams[0].id : '', opponent: '', home: true, location: '', title: '', notes: '', result: '' };
    const fields = [
      { name: 'kind', label: 'Type', type: 'select', value: e.kind, options: [['practice', 'Practice'], ['game', 'Game'], ['event', 'Other event']] },
      { name: 'team_id', label: 'Team', type: 'select', value: e.team_id || '', options: teamOptions(true) },
      { name: 'date', label: 'Date', type: 'date', value: toDateInput(d0), required: true },
      { name: 'time', label: 'Start time', type: 'time', value: toTimeInput(d0), required: true },
      { name: 'opponent', label: 'Opponent', value: e.opponent, placeholder: 'e.g. Riverside FC', showIf: 'game' },
      { name: 'home', label: 'Home game', type: 'checkbox', value: e.home },
      { name: 'title', label: 'Title (optional)', value: e.title, full: true, placeholder: 'e.g. End of season party', showIf: 'event' },
      { name: 'location', label: 'Location', value: e.location, full: true, placeholder: 'e.g. Northside Park, Field 2' },
      { name: 'notes', label: 'Notes for parents (optional)', value: e.notes, full: true, placeholder: 'e.g. Bring water and shin guards' },
    ];
    if (!isNew) fields.push({ name: 'result', label: 'Result (after the game)', value: e.result, placeholder: 'e.g. W 3-1', showIf: 'game' });
    if (isNew) fields.push({ name: 'repeat', label: 'Repeat weekly', type: 'number', value: 1, min: 1, max: 30, help: 'How many weeks in a row, counting this one. Use this for regular practices.' });
    openForm({
      title: isNew ? 'New event' : 'Edit event', fields,
      afterRender: root => {
        const sync = () => {
          const k = root.querySelector('[name=kind]').value;
          root.querySelector('[name=opponent]').closest('.field').hidden = k !== 'game';
          root.querySelector('[name=home]').closest('.check').hidden = k !== 'game';
          root.querySelector('[name=title]').closest('.field').hidden = k === 'game';
          const r = root.querySelector('[name=result]'); if (r) r.closest('.field').hidden = k !== 'game';
        };
        root.querySelector('[name=kind]').addEventListener('change', sync); sync();
      },
      onSubmit: async v => {
        if (!v.date || !v.time) throw new Error('Pick a date and start time.');
        const start = new Date(`${v.date}T${v.time}`);
        if (isNaN(start)) throw new Error('That date or time isn\'t valid.');
        const row = { kind: v.kind, team_id: v.team_id || null, opponent: v.kind === 'game' ? v.opponent : '', home: v.kind === 'game' ? v.home : true,
          title: v.kind === 'game' ? '' : v.title, location: v.location, notes: v.notes, result: v.kind === 'game' ? (v.result || '') : '' };
        if (!isNew) { await api.save('events', { id: e.id, ...row, starts_at: start.toISOString() }); return 'Event saved'; }
        const n = Math.max(1, Math.min(30, parseInt(v.repeat, 10) || 1));
        const rows = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return { ...row, starts_at: d.toISOString() }; });
        await api.insertMany('events', rows);
        return n > 1 ? `${n} events added` : 'Event added';
      },
      onDelete: !isNew ? async () => { await api.remove('events', e.id); return 'Event deleted'; } : null,
    });
  }

  function formTeam(t) {
    t = t || { age: '', name: '', coach: '', coach_phone: '', practice_note: '', sort: DB.teams.length + 1 };
    openForm({
      title: t.id ? 'Edit team' : 'New team',
      fields: [
        { name: 'age', label: 'Age group', value: t.age, required: true, placeholder: 'e.g. U10' },
        { name: 'name', label: 'Team name', value: t.name, required: true, placeholder: 'e.g. Lions' },
        { name: 'coach', label: 'Coach name', value: t.coach, placeholder: 'e.g. Coach Daniel' },
        { name: 'coach_phone', label: 'Coach phone (shown to parents)', value: t.coach_phone, type: 'tel' },
        { name: 'practice_note', label: 'Usual practice time', value: t.practice_note, full: true, placeholder: 'e.g. Tue & Thu 6:00 PM, Field 2' },
        { name: 'sort', label: 'Order on the site', type: 'number', value: t.sort, help: 'Lower numbers show first.' },
      ],
      onSubmit: async v => { if (!v.age || !v.name) throw new Error('Add an age group and team name.'); await api.save('teams', { ...(t.id ? { id: t.id } : {}), age: v.age, name: v.name, coach: v.coach, coach_phone: v.coach_phone, practice_note: v.practice_note, sort: numOrNull(v.sort) || 0 }); return 'Team saved'; },
      onDelete: t.id ? async () => { await api.remove('teams', t.id); return 'Team deleted'; } : null,
      deleteLabel: 'Delete team and its events',
    });
  }

  function formPlayer(p) {
    p = p || { first: '', last: '', team_id: ui.rosterTeam || (DB.teams[0] && DB.teams[0].id) || '', number: '', position: 'MID', age: '', stats: { SPD: 60, SHO: 60, PAS: 60, DRI: 60, DEF: 60, TEM: 60 } };
    const pay = p.id ? payOf(p.id) : { guardian: '', guardian_phone: '' };
    openForm({
      title: p.id ? 'Edit player' : 'New player',
      fields: [
        { name: 'first', label: 'First name', value: p.first, required: true },
        { name: 'last', label: 'Last name', value: p.last },
        { name: 'team_id', label: 'Team', type: 'select', value: p.team_id || '', options: [['', 'No team'], ...teamOptions(false)] },
        { name: 'number', label: 'Jersey number', type: 'number', value: p.number ?? '', min: 0, max: 99 },
        { name: 'position', label: 'Position', type: 'select', value: p.position, options: [['GK', 'Goalkeeper (GK)'], ['DEF', 'Defender (DEF)'], ['MID', 'Midfielder (MID)'], ['FWD', 'Forward (FWD)']] },
        { name: 'age', label: 'Age', type: 'number', value: p.age ?? '', min: 3, max: 19 },
        { type: 'section', name: 'privsec', label: 'Private: only coaches see this' },
        { name: 'guardian', label: 'Parent or guardian', value: pay.guardian },
        { name: 'guardian_phone', label: 'Parent phone', type: 'tel', value: pay.guardian_phone },
        ...Object.keys(STAT_LABEL).map(k => ({ name: 'stat_' + k, label: STAT_LABEL[k], type: 'number', value: (p.stats || {})[k] ?? 60, min: 1, max: 99, stat: true })),
      ],
      onSubmit: async v => {
        if (!v.first) throw new Error('Add a first name.');
        const stats = {}; Object.keys(STAT_LABEL).forEach(k => { stats[k] = Math.max(1, Math.min(99, Math.round(numOrNull(v['stat_' + k]) ?? 60))); });
        const saved = await api.save('players', { ...(p.id ? { id: p.id } : {}), first: v.first, last: v.last, team_id: v.team_id || null, number: numOrNull(v.number), position: v.position, age: numOrNull(v.age), stats });
        const pid = (saved && saved.id) || p.id;
        if (pid) { const cur = payOf(pid); await api.save('payments', { player_id: pid, paid: Number(cur.paid || 0), note: cur.note || '', guardian: v.guardian, guardian_phone: v.guardian_phone, updated_at: new Date().toISOString() }); }
        return 'Player saved';
      },
      onDelete: p.id ? async () => { await api.remove('players', p.id); return 'Player removed'; } : null,
      deleteLabel: 'Remove player',
    });
  }

  function formPay(p) {
    const pay = payOf(p.id);
    openForm({
      title: `${p.first} ${p.last}`.trim(),
      fields: [
        { name: 'paid', label: `Amount paid ($) of ${money(fee())}`, type: 'number', value: Number(pay.paid || 0), min: 0, full: true },
        { name: 'note', label: 'Note', value: pay.note, full: true, placeholder: 'e.g. Paid cash to Coach Omar, Nov 12' },
      ],
      onSubmit: async v => { await api.save('payments', { player_id: p.id, paid: Math.max(0, numOrNull(v.paid) || 0), note: v.note, guardian: pay.guardian || '', guardian_phone: pay.guardian_phone || '', updated_at: new Date().toISOString() }); return 'Payment saved'; },
    });
  }

  /* ======================= Router & events ======================= */
  const VIEWS = { home: viewHome, schedule: viewSchedule, roster: viewRoster, cards: viewCards, coach: viewCoach };
  function render(keepScroll) {
    const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
    const y = window.scrollY;
    try { app.innerHTML = VIEWS[key](); }
    catch (err) { console.error(err); app.innerHTML = `<div class="wrap"><div class="loading">Something went wrong showing this page. Try reloading.</div></div>`; }
    document.querySelectorAll('.topnav a, .tabs a').forEach(a => (a.getAttribute('href') === '#' + key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    window.scrollTo(0, keepScroll ? y : 0);
  }
  async function reloadAndRender(msg) {
    await refresh(); render(true); if (msg) toast(msg);
  }
  window.addEventListener('hashchange', () => render(false));

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (er) {} ta.remove(); return ok;
    }
  }

  document.addEventListener('click', async e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) { ui[chip.dataset.chip] = chip.dataset.val; render(true); return; }
    const past = e.target.closest('[data-past]');
    if (past) { ui.schedPast = past.dataset.past === '1'; render(true); return; }
    const ct = e.target.closest('[data-coachtab]');
    if (ct) { ui.coachTab = ct.dataset.coachtab; render(true); return; }
    const tile = e.target.closest('[data-team]');
    if (tile) ui.rosterTeam = tile.dataset.team;

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.act) {
      case 'close': closeForm(); break;
      case 'signout': await api.signOut(); SESSION = null; await refresh(); render(false); toast('Signed out'); break;
      case 'new-news': formNews(); break;
      case 'edit-news': formNews(DB.announcements.find(x => x.id === id)); break;
      case 'new-event': formEvent(); break;
      case 'edit-event': formEvent(DB.events.find(x => x.id === id)); break;
      case 'new-team': formTeam(); break;
      case 'edit-team': formTeam(DB.teams.find(x => x.id === id)); break;
      case 'new-player': formPlayer(); break;
      case 'edit-player': formPlayer(DB.players.find(x => x.id === id)); break;
      case 'edit-pay': formPay(DB.players.find(x => x.id === id)); break;
      case 'mark-paid': {
        const pay = payOf(id); btn.disabled = true;
        try { await api.save('payments', { player_id: id, paid: fee(), note: pay.note || '', guardian: pay.guardian || '', guardian_phone: pay.guardian_phone || '', updated_at: new Date().toISOString() }); await reloadAndRender('Marked as paid'); }
        catch (err) { btn.disabled = false; toast(err.message || 'Could not save. Check your connection.'); }
        break;
      }
      case 'copy-owing': {
        const lines = DB.players.filter(p => statusOf(p) !== 'paid').map(p => { const t = team(p.team_id); const pay = payOf(p.id); return `${p.first} ${p.last} (${t ? t.age : 'no team'}): owes ${money(fee() - Number(pay.paid || 0))}${pay.guardian ? ', ' + pay.guardian : ''}${pay.guardian_phone ? ' ' + pay.guardian_phone : ''}`; });
        const ok = await copyText(lines.length ? lines.join('\n') : 'Everyone has paid.');
        toast(ok ? `Copied ${lines.length} names` : 'Copy didn\'t work on this device');
        break;
      }
      case 'sheet-delete': {
        if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Tap again to confirm'; return; }
        btn.disabled = true;
        try { const msg = await sheetDelete(); closeForm(); await reloadAndRender(msg); }
        catch (err) { btn.disabled = false; const el = $('#sheetErr'); el.textContent = err.message || 'Could not delete.'; el.hidden = false; }
        break;
      }
    }
  });

  document.addEventListener('submit', async e => {
    const form = e.target;
    if (form.id === 'sheetForm') {
      e.preventDefault();
      const submit = form.querySelector('[type=submit]'); submit.disabled = true;
      try { const msg = await sheetSubmit(formValues(form)); closeForm(); await reloadAndRender(msg); }
      catch (err) { const el = $('#sheetErr'); el.textContent = err.message || 'Could not save. Check your connection.'; el.hidden = false; submit.disabled = false; }
    }
    if (form.id === 'signin') {
      e.preventDefault();
      const err = $('#signinErr'); err.hidden = true;
      const submit = form.querySelector('[type=submit]'); submit.disabled = true;
      try {
        SESSION = await api.signIn(LIVE ? $('#email').value.trim() : '', $('#pw').value);
        await refresh(); render(false); toast('Signed in');
      } catch (ex) {
        err.textContent = LIVE && /invalid/i.test(ex.message || '') ? 'Email or password didn\'t match. Try again.' : (ex.message || 'Could not sign in.');
        err.hidden = false; submit.disabled = false;
      }
    }
    if (form.id === 'settingsForm') {
      e.preventDefault();
      const v = formValues(form);
      if (!v.league_name) { toast('Add a league name.'); return; }
      try { await api.save('settings', { id: 1, league_name: v.league_name, season: v.season, fee: numOrNull(v.fee) || 0, welcome: v.welcome, show_last_names: v.show_last_names }); await reloadAndRender('Settings saved'); }
      catch (err) { toast(err.message || 'Could not save.'); }
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'paysearch') return;
    ui.paySearch = e.target.value;
    const pos = e.target.selectionStart;
    render(true);
    const el = $('#paysearch'); el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) {}
  });

  /* ======================= Start ======================= */
  (async function start() {
    if (!LIVE) $('#demoBar').hidden = false;
    try {
      SESSION = await api.session();
      if (LIVE) sb.auth.onAuthStateChange((_evt, s) => { const had = !!SESSION; SESSION = s; if (had !== !!s) reloadAndRender(); });
      await refresh();
      render(false);
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="wrap"><div class="loading">Couldn't load the league data. Check your internet connection and reload.<br><small>${esc(err.message || '')}</small></div></div>`;
    }
  })();
})();
