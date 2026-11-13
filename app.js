/* 달력 배우기 — 하루 · 일주일 · 한 달 · 1년 · 달력 보기
   오픈 소스: canvas-confetti (ISC), Pretendard (OFL), holidays-kr 공휴일 API */
(() => {
'use strict';

/* ───────── 날짜 도구 ───────── */
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const QS = new URLSearchParams(location.search);
/* 주소 뒤에 ?date=2026-10-05 를 붙이면 그 날짜를 '오늘'로 삼습니다. */
const TODAY = (() => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(QS.get('date') || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(); })();
const Y = TODAY.getFullYear(), M = TODAY.getMonth() + 1, D = TODAY.getDate(), W = TODAY.getDay();
const addDays = n => new Date(Y, M - 1, D + n);
const md = d => `${d.getMonth() + 1}월 ${d.getDate()}일`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const wdOf = (y, m, d) => new Date(y, m - 1, d).getDay();
const wrapM = m => ((m - 1 + 120) % 12) + 1;
const wcls = w => (w === 0 ? 'sun' : w === 6 ? 'sat' : '');
const CIRC = ['①', '②', '③', '④', '⑤'];
const $ = s => document.querySelector(s);
const main = $('#main');

/* ───────── 무작위 (같은 번호면 같은 문제가 나오도록 씨앗 사용) ───────── */
function rng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const newSeed = () => 1000 + Math.floor(Math.random() * 9000);
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuffle = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (r, arr, n) => shuffle(r, arr).slice(0, n);
const numSort = (a, b) => parseInt(a, 10) - parseInt(b, 10);
/* 고르기 문제: 정답 1개 + 틀린 보기 (n-1)개를 섞는다 */
function mc(r, q, ans, wrongs, x = {}) {
  const n = x.n || 3;
  let opts = shuffle(r, [ans, ...sample(r, [...new Set(wrongs)].filter(w => w !== ans), n - 1)]);
  if (x.sort) opts.sort(x.sort);
  if (x.fixed) opts = x.fixed;
  return { type: 'choice', q, opts, a: opts.indexOf(ans), ...x };
}

/* ───────── 설정 저장 ───────── */
const KEY = 'cal-learn-v2';
const FS_STEPS = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75];
const ZM_MIN = 0.6, ZM_MAX = 1.6;
const store = { fs: 1, zoom: 1, sound: true, stars: {} };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장소 없음 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ } };

/* ───────── 공휴일 (무료 공개 API) ─────────
   holidays-kr (github.com/hyunbinseo/holidays-kr) — 월력요항 기반, 키 없이 사용.
   인터넷이 안 되면 공휴일 표시 없이 그대로 동작합니다. */
const HOL_URL = 'https://holidays.hyunbin.page/basic.json';
const HOL_KEY = 'cal-learn-holidays';
let HOL = {};
const easyName = n => (/^대체공휴일/.test(n) ? '대체 휴일' : ({ '1월 1일': '새해 첫날', '기독탄신일': '크리스마스', '전국동시지방선거': '선거일' })[n] || n.replace('ㆍ', '·'));
const dkey = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const holOf = (y, m, d) => HOL[dkey(y, m, d)];
function setHolidays(raw) {
  const out = {};
  Object.values(raw || {}).forEach(yr => Object.entries(yr || {}).forEach(([k, v]) => { out[k] = easyName(String([].concat(v)[0])); }));
  HOL = out;
}
let holCache = null;
try { holCache = JSON.parse(localStorage.getItem(HOL_KEY) || 'null'); if (holCache) setHolidays(holCache.data); } catch (e) { /* 무시 */ }
function loadHolidays() {
  if (holCache && Date.now() - holCache.at < 864e5) return;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 7000);
  fetch(HOL_URL, { signal: ctl.signal }).then(r => (r.ok ? r.json() : Promise.reject())).then(data => {
    const before = JSON.stringify(HOL);
    setHolidays(data);
    try { localStorage.setItem(HOL_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* 무시 */ }
    if (JSON.stringify(HOL) === before) return;
    if (!cur || cur.phase !== 'quiz') route(); // 문제 푸는 중에는 화면을 바꾸지 않음
  }).catch(() => { /* 인터넷 없음 */ }).finally(() => clearTimeout(timer));
}

/* ───────── 그림 도우미 ───────── */
function calHTML(y, m, o = {}) {
  const first = wdOf(y, m, 1), L = lastDay(y, m);
  const hi = o.hi || [], hols = [];
  const rowOf = d => Math.floor((first + d - 1) / 7);
  const hiRow = o.row ? rowOf(o.row) : -1;
  const isNow = y === Y && m === M;
  let h = `<div class="cal ${o.cls || ''}"><div class="cal-head"><span class="cal-m">${m}월</span><span class="cal-y">${y}년</span></div><div class="cal-grid">`;
  WD.forEach((w, i) => { h += `<div class="cal-wd ${wcls(i)}${o.col === i ? ' col' : ''}">${w}</div>`; });
  for (let k = 0; k < first; k++) h += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= L; d++) {
    const w = (first + d - 1) % 7;
    const c = ['cal-cell', wcls(w)];
    const hn = holOf(y, m, d);
    if (hn) { c.push('hol'); hols.push(`<span><b>${d}일</b> ${hn}</span>`); }
    if (hi.includes(d)) c.push('hi');
    if (o.col === w) c.push('col');
    if (rowOf(d) === hiRow) c.push('row');
    if (o.today && isNow && d === D) c.push('today');
    const cls = c.filter(Boolean).join(' ');
    h += o.click
      ? `<button type="button" class="${cls}" data-act="day" data-d="${d}" aria-label="${d}일"><span>${d}</span></button>`
      : `<div class="${cls}"><span>${d}</span></div>`;
  }
  const tail = (7 - ((first + L) % 7)) % 7;
  for (let k = 0; k < tail; k++) h += '<div class="cal-cell empty"></div>';
  return h + '</div>' + (hols.length && !o.noHol ? `<div class="cal-hol"><i>쉬는 날</i>${hols.join('')}</div>` : '') + '</div>';
}
/* 달력 넘겨 보기: 달 단추를 누르면 그 달 달력이 나온다 */
function explorerHTML(y, m, bind = '') {
  return `<div class="ex" data-y="${y}" data-m="${m}" data-bind="${bind}">
    <div class="ex-bar">
      <button type="button" class="rb" data-act="ex-prev" aria-label="이전 달">‹</button>
      <div class="ex-t" aria-live="polite"><b>${m}월</b><small>${y}년</small></div>
      <button type="button" class="rb" data-act="ex-next" aria-label="다음 달">›</button>
      <button type="button" class="ex-now" data-act="ex-now">이번 달</button>
    </div>
    <div class="ex-months" role="group" aria-label="달 고르기">${Array.from({ length: 12 }, (_, i) =>
      `<button type="button" class="${i + 1 === m ? 'on' : ''}${y === Y && i + 1 === M ? ' cur' : ''}" data-act="ex-m" data-m="${i + 1}" aria-pressed="${i + 1 === m}">${i + 1}월</button>`).join('')}</div>
    ${calHTML(y, m, { today: true, cls: 'nohead' })}
  </div>`;
}
const flow = (items, arrows = true) => `<div class="flow">${items.map(([e, t, c]) =>
  `<div class="fi ${c || ''}">${e ? `<span class="fe">${e}</span>` : ''}${t ? `<span>${t}</span>` : ''}</div>`).join(arrows ? '<span class="ar">→</span>' : '')}</div>`;
const trio = items => `<div class="trio">${items.map(([s, b, e], i) =>
  `<div class="tb${i === 1 ? ' now' : ''}"><small>${s}</small><b>${b}</b>${e ? `<em>${e}</em>` : ''}</div>`).join('<span class="ar">→</span>')}</div>`;
const eq = parts => `<div class="eq">${parts.map(p => `<span>${p}</span>`).join('<i>=</i>')}</div>`;
const cap = t => `<p class="cap">${t}</p>`;
const monthGrid = withDays => `<div class="mgrid">${Array.from({ length: 12 }, (_, i) =>
  `<button type="button" class="mc${i + 1 === M ? ' now' : ''}" data-act="month" data-m="${i + 1}"><b>${i + 1}월</b>${withDays ? `<small>${lastDay(Y, i + 1)}일</small>` : ''}</button>`).join('')}</div>`;
const wchips = sub => `<div class="wchips">${WD.map((w, i) => `<div class="wc ${wcls(i)}"><b>${w}</b><small>${sub(i)}</small></div>`).join('')}</div>`;

/* ───────── 단원 내용 ───────── */
const TIMES = [['🌅', '아침'], ['☀️', '낮'], ['🌇', '저녁'], ['🌙', '밤']];
const SEASONS = [['🌸', '봄', '3 · 4 · 5월'], ['🌻', '여름', '6 · 7 · 8월'], ['🍁', '가을', '9 · 10 · 11월'], ['⛄', '겨울', '12 · 1 · 2월']];
const seasonIdx = m => (m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3);
const NTH = ['첫', '두', '세'];
let calYM = [Y, M]; // 달력 보기 단원에서 고른 달

const UNITS = [
  /* 1. 하루 */
  {
    id: 'day', title: '하루', sub: '어제 · 오늘 · 내일',
    learn: () => [
      { t: '하루란?', b: '아침에 일어나서 밤에 잘 때까지, <b>하루</b>가 지나가요.', v: flow(TIMES) },
      { t: '하루는 24시간', b: '하루는 <b>24시간</b>이에요.<br>시계의 짧은 바늘이 <b>두 바퀴</b> 돌면 하루예요.', v: eq(['하루', '24시간']) },
      { t: '어제 · 오늘 · 내일', b: '오늘의 <b>하루 전</b>은 <b>어제</b>예요.<br>오늘의 <b>하루 뒤</b>는 <b>내일</b>이에요.',
        v: trio([['어제', md(addDays(-1)), WD[addDays(-1).getDay()] + '요일'], ['오늘', md(TODAY), WD[W] + '요일'], ['내일', md(addDays(1)), WD[addDays(1).getDay()] + '요일']]) },
      { t: '달력의 한 칸은 하루', b: '달력에서 숫자 <b>한 칸</b>이 <b>하루</b>예요.<br>색칠한 칸이 <b>오늘</b>이에요.', v: calHTML(Y, M, { today: true }) },
    ],
    gen(r) {
      const dm = (m, d) => `${m}월 ${d}일`;
      const k = ri(r, 1, 3);
      const rel = sample(r, [['오늘의 다음 날', '내일', '하루 뒤는 내일이에요.'], ['오늘의 하루 전날', '어제', '하루 전은 어제예요.'],
        ['어제의 다음 날', '오늘', '어제 → 오늘 → 내일'], ['내일의 하루 전날', '오늘', '어제 → 오늘 → 내일']], 2);
      const hm = ri(r, 1, 12), hd = ri(r, 3, 26), fw = r() < 0.5;
      const real = r() < 0.5
        ? mc(r, `오늘은 ${md(TODAY)}이에요. 내일은 며칠인가요?`, md(addDays(1)), [md(addDays(-1)), md(addDays(2)), md(addDays(-2))], { hint: '내일은 오늘보다 하루 뒤예요.' })
        : mc(r, `오늘은 ${md(TODAY)}이에요. 어제는 며칠이었나요?`, md(addDays(-1)), [md(addDays(1)), md(addDays(2)), md(addDays(-2))], { hint: '어제는 오늘보다 하루 전이에요.' });
      const calQ = pick(r, [
        { a: D, q: `오늘은 ${md(TODAY)}이에요. 달력에서 오늘을 찾아 눌러 보세요.`, p: `오늘은 ${md(TODAY)}이에요. 달력에서 오늘을 찾아 ○표 하세요.`, hint: `${D}일을 찾아보세요.` },
        ...(D < lastDay(Y, M) ? [{ a: D + 1, q: `오늘은 ${md(TODAY)}이에요. 달력에서 내일을 찾아 눌러 보세요.`, p: `오늘은 ${md(TODAY)}이에요. 달력에서 내일을 찾아 ○표 하세요.`, hint: '내일은 오늘의 바로 다음 칸이에요.' }] : []),
        ...(D > 1 ? [{ a: D - 1, q: `오늘은 ${md(TODAY)}이에요. 달력에서 어제를 찾아 눌러 보세요.`, p: `오늘은 ${md(TODAY)}이에요. 달력에서 어제를 찾아 ○표 하세요.`, hint: '어제는 오늘의 바로 앞 칸이에요.' }] : []),
      ]);
      const fact = r() < 0.5
        ? mc(r, '하루는 몇 시간인가요?', '24시간', ['7시간', '10시간', '12시간', '30시간'], { sort: numSort, hint: '하루 = 24시간' })
        : mc(r, '달력에서 숫자 한 칸은 무엇인가요?', '하루', ['일주일', '한 달', '1년'], { hint: '한 칸이 하루예요.' });
      return [
        mc(r, '빈칸에 들어갈 때는 언제일까요?', `${TIMES[k][0]} ${TIMES[k][1]}`, TIMES.filter((_, i) => i !== k).map(t => `${t[0]} ${t[1]}`),
          { visual: flow(TIMES.map((t, i) => (i === k ? ['❓', '', 'q'] : t))), hint: '아침 → 낮 → 저녁 → 밤 순서예요.' }),
        ...rel.map(([a, ans, hint]) => mc(r, `${a}을 무엇이라고 하나요?`, ans, ['어제', '오늘', '내일'], { hint })),
        real,
        fw ? mc(r, `오늘이 ${dm(hm, hd)}이라면, 내일은 며칠일까요?`, dm(hm, hd + 1), [dm(hm, hd - 1), dm(hm, hd + 2), dm(hm, hd - 2)], { hint: '내일은 숫자가 1 커져요.' })
           : mc(r, `오늘이 ${dm(hm, hd)}이라면, 어제는 며칠일까요?`, dm(hm, hd - 1), [dm(hm, hd + 1), dm(hm, hd + 2), dm(hm, hd - 2)], { hint: '어제는 숫자가 1 작아져요.' }),
        fact,
        { type: 'cal', y: Y, m: M, ...calQ },
      ];
    },
  },
  /* 2. 일주일 */
  {
    id: 'week', title: '일주일', sub: '요일 · 평일 · 주말',
    learn: () => [
      { t: '일주일은 7일', b: '<b>7일</b>이 모이면 <b>일주일</b>이에요.<br>날마다 이름이 있어요. 이 이름이 <b>요일</b>이에요.', v: eq(['일주일', '7일']) },
      { t: '요일의 순서', b: '일 · 월 · 화 · 수 · 목 · 금 · 토 순서예요.<br><b>토요일 다음은 다시 일요일</b>이에요.', v: wchips(() => '요일') },
      { t: '달력의 한 줄은 일주일', b: '달력에서 <b>옆으로 한 줄</b>이 <b>일주일</b>이에요.<br>색칠한 줄이 <b>이번 주</b>예요.', v: calHTML(Y, M, { row: D, today: true }) },
      { t: '평일과 주말', b: '<b>월요일~금요일</b>은 <b>평일</b>이에요. 학교에 가요.<br><b>토요일, 일요일</b>은 <b>주말</b>이에요. 쉬는 날이에요.', v: wchips(i => (i === 0 || i === 6 ? '쉬는 날' : '학교')) },
    ],
    gen(r) {
      const days = WD.map(w => w + '요일');
      const [x1, x2] = sample(r, [0, 1, 2, 3, 4, 5, 6], 2);
      const s = ri(r, 0, 2), seq = [0, 1, 2, 3, 4].map(i => days[s + i]);
      const xd = ri(r, 0, 6), kind = xd === 0 || xd === 6 ? '주말 (쉬는 날)' : '평일 (학교 가는 날)';
      return [
        mc(r, '일주일은 며칠인가요?', '7일', ['5일', '6일', '8일', '10일'], { sort: numSort, hint: '일 월 화 수 목 금 토, 세어 보세요.' }),
        mc(r, `${days[x1]}의 다음 날은 무슨 요일인가요?`, days[(x1 + 1) % 7], days, { hint: '일 → 월 → 화 → 수 → 목 → 금 → 토' }),
        mc(r, `${days[x2]}의 하루 전날은 무슨 요일인가요?`, days[(x2 + 6) % 7], days, { hint: '일 → 월 → 화 → 수 → 목 → 금 → 토' }),
        mc(r, `오늘은 ${md(TODAY)}이에요. 달력을 보세요. 오늘은 무슨 요일인가요?`, days[W], days, { visual: calHTML(Y, M, { today: true, noHol: true }), hint: '색칠한 칸에서 위로 쭉 올라가 보세요.' }),
        { type: 'order', q: '요일을 순서대로 눌러 보세요.', p: '요일의 순서대로 1~5 번호를 쓰세요.', items: seq, mix: shuffle(r, [0, 1, 2, 3, 4]), hint: seq.map(d => d[0]).join(' → ') },
        r() < 0.5
          ? mc(r, `${days[xd]}은 평일일까요, 주말일까요?`, kind, [], { fixed: ['평일 (학교 가는 날)', '주말 (쉬는 날)'], hint: '토요일과 일요일이 주말이에요.' })
          : mc(r, '학교에 가지 않고 쉬는 주말은 언제인가요?', '토요일, 일요일', ['월요일, 화요일', '수요일, 목요일', '금요일, 토요일', '일요일, 월요일'], { hint: '달력에서 파란색, 빨간색 요일이에요.' }),
        mc(r, '달력에서 옆으로 한 줄은 무엇인가요?', '일주일', ['하루', '한 달', '1년'], { hint: '한 줄에 7칸이 있어요.' }),
      ];
    },
  },
  /* 3. 한 달 */
  {
    id: 'month', title: '한 달', sub: '지난달 · 이번 달 · 다음 달', sharedCal: true,
    learn: () => [
      { t: '한 달이란?', b: '달력 <b>한 장</b>이 <b>한 달</b>이에요.<br>한 달은 <b>1일</b>부터 시작해요.', v: calHTML(Y, M, {}) },
      { t: '한 달은 30일쯤', b: '한 달은 <b>30일</b> 또는 <b>31일</b>이에요. <b>2월</b>만 28일로 짧아요.', note: '달을 누르면 그 달 달력을 볼 수 있어요.', v: monthGrid(true) },
      { t: '1년에는 열두 달', b: '<b>1월</b>부터 <b>12월</b>까지 있어요.<br><b>12월 다음은 다시 1월</b>이에요.', v: flow([['', '11월'], ['', '12월'], ['', '1월', 'on'], ['', '2월']]) },
      { t: '지난달 · 이번 달 · 다음 달', b: '이번 달의 <b>앞 달</b>은 <b>지난달</b>,<br><b>뒤 달</b>은 <b>다음 달</b>이에요.',
        v: trio([['지난달', wrapM(M - 1) + '월'], ['이번 달', M + '월'], ['다음 달', wrapM(M + 1) + '월']]) },
    ],
    gen(r) {
      const mo = n => wrapM(n) + '월';
      const n1 = r() < 0.25 ? 12 : ri(r, 1, 11), n2 = r() < 0.25 ? 1 : ri(r, 2, 12);
      const L = lastDay(Y, M);
      return [
        mc(r, '한 달은 며칠쯤 되나요?', '30일', ['7일', '12일', '100일', '365일'], { sort: numSort, hint: '한 달은 30일 또는 31일이에요.' }),
        mc(r, '달력을 보세요. 몇 월 달력인가요?', mo(M), [mo(M - 1), mo(M + 1), mo(M + 2)], { visual: calHTML(Y, M, { noHol: true }), hint: '달력 맨 위에 쓰여 있어요.' }),
        mc(r, `${n1}월의 다음 달은 몇 월인가요?`, mo(n1 + 1), [mo(n1 - 1), mo(n1 + 2), mo(n1 + 3)], { hint: n1 === 12 ? '12월 다음은 다시 1월이에요.' : `${n1} 다음 숫자를 생각해 보세요.` }),
        mc(r, `${n2}월의 지난달은 몇 월인가요?`, mo(n2 - 1), [mo(n2 + 1), mo(n2 - 2), mo(n2 + 2)], { hint: n2 === 1 ? '1월의 앞은 12월이에요.' : `${n2} 바로 앞 숫자를 생각해 보세요.` }),
        mc(r, '1년에는 달이 모두 몇 개 있나요?', '12달', ['7달', '10달', '24달', '30달'], { sort: numSort, hint: '1월부터 12월까지 있어요.' }),
        mc(r, '달력 한 장은 무엇인가요?', '한 달', ['하루', '일주일', '1년'], { hint: '달력 한 장이 한 달이에요.' }),
        r() < 0.5
          ? { type: 'cal', y: Y, m: M, a: L, q: `${M}월의 마지막 날을 찾아 눌러 보세요.`, p: `${M}월의 마지막 날을 찾아 ○표 하세요.`, hint: '가장 큰 숫자를 찾아보세요.' }
          : { type: 'cal', y: Y, m: M, a: 1, q: `${M}월의 첫째 날을 찾아 눌러 보세요.`, p: `${M}월의 첫째 날을 찾아 ○표 하세요.`, hint: '한 달은 1일부터 시작해요.' },
      ];
    },
  },
  /* 4. 1년 */
  {
    id: 'year', title: '1년', sub: '작년 · 올해 · 내년',
    learn: () => [
      { t: '1년이란?', b: '<b>열두 달</b>이 모이면 <b>1년</b>이에요.<br><b>1월 1일</b>에 시작하고 <b>12월 31일</b>에 끝나요.', note: '달을 누르면 그 달 달력을 볼 수 있어요.', v: monthGrid(false) },
      { t: '1년은 365일', b: '1년은 <b>365일</b>이에요.<br>달력 <b>12장</b>을 모두 넘기면 1년이 지나가요.', v: eq(['1년', '12달', '365일']) },
      { t: '작년 · 올해 · 내년', b: '올해의 <b>1년 전</b>은 <b>작년</b>이에요.<br>올해의 <b>1년 뒤</b>는 <b>내년</b>이에요.', v: trio([['작년', (Y - 1) + '년'], ['올해', Y + '년'], ['내년', (Y + 1) + '년']]) },
      { t: '1년에는 네 계절', b: '1년 동안 <b>봄, 여름, 가을, 겨울</b>이 차례로 와요.',
        v: `<div class="seasons">${SEASONS.map(([e, n, t], i) => `<div class="sc${i === seasonIdx(M) ? ' now' : ''}"><span class="fe">${e}</span><b>${n}</b><small>${t}</small></div>`).join('')}</div>` },
      { t: '1년에 한 번 오는 날', b: '<b>생일</b>은 1년에 <b>한 번</b> 와요.<br>설날, 추석, 크리스마스도 1년에 한 번이에요.', v: flow([['🎂', '생일'], ['🎍', '설날'], ['🌕', '추석'], ['🎄', '크리스마스']], false) },
    ],
    gen(r) {
      const yr = n => n + '년', sn = SEASONS.map(([e, n]) => `${e} ${n}`);
      const sm = ri(r, 1, 12), si = ri(r, 0, 3);
      return [
        mc(r, '1년은 몇 달인가요?', '12달', ['7달', '10달', '24달', '30달'], { sort: numSort, hint: '1월부터 12월까지예요.' }),
        mc(r, '1년은 며칠인가요?', '365일', ['7일', '12일', '30일', '100일'], { sort: numSort, hint: '1년 = 365일' }),
        mc(r, '올해는 몇 년인가요?', yr(Y), [yr(Y - 1), yr(Y + 1), yr(Y - 2), yr(Y + 2)], { sort: numSort, visual: calHTML(Y, M, { cls: 'headonly' }), hint: '달력 맨 위에 쓰여 있어요.' }),
        r() < 0.5
          ? mc(r, `올해는 ${Y}년이에요. 내년은 몇 년인가요?`, yr(Y + 1), [yr(Y - 1), yr(Y), yr(Y + 2)], { hint: '내년은 올해보다 1 큰 숫자예요.' })
          : mc(r, `올해는 ${Y}년이에요. 작년은 몇 년이었나요?`, yr(Y - 1), [yr(Y + 1), yr(Y), yr(Y - 2)], { hint: '작년은 올해보다 1 작은 숫자예요.' }),
        r() < 0.5
          ? mc(r, '1년 중 첫 번째 달은 몇 월인가요?', '1월', ['2월', '3월', '10월', '12월'], { hint: '새해는 1월 1일에 시작해요.' })
          : mc(r, '1년 중 마지막 달은 몇 월인가요?', '12월', ['1월', '10월', '11월', '13월'], { hint: '1년은 12월 31일에 끝나요.' }),
        r() < 0.5
          ? mc(r, '내 생일은 1년에 몇 번 오나요?', '한 번', ['날마다', '열두 번', '두 번'], { hint: '생일은 1년에 딱 한 번이에요.' })
          : mc(r, '12월 31일의 다음 날은 언제인가요?', '1월 1일', ['12월 32일', '12월 30일', '1월 31일'], { hint: '12월이 끝나면 새해 1월 1일이에요.' }),
        mc(r, `${sm}월은 어느 계절인가요?`, sn[seasonIdx(sm)], [], { fixed: sn, n: 4, hint: `${SEASONS[seasonIdx(sm)][2]}은 ${SEASONS[seasonIdx(sm)][1]}이에요.` }),
        mc(r, `${SEASONS[si][1]} 다음에 오는 계절은 무엇인가요?`, sn[(si + 1) % 4], sn, { hint: '봄 → 여름 → 가을 → 겨울 → 다시 봄' }),
      ];
    },
  },
  /* 5. 달력 보기 */
  {
    id: 'cal', title: '달력 보기', sub: '날짜와 요일 찾기', sharedCal: true,
    learn() {
      const [y, m] = calYM, d0 = y === Y && m === M ? D : 15, w0 = wdOf(y, m, d0);
      return [
        { t: '달력 넘겨 보기', b: '<b>달</b>을 누르면 그 달 달력이 나와요.<br>보고 싶은 달을 눌러 보세요.', v: explorerHTML(y, m, 'cal'), screenOnly: true },
        { t: '달력에 있는 것', b: '맨 위에는 <b>년과 월</b>, 그 아래에는 <b>요일</b>,<br>칸 안에는 <b>날짜</b>(숫자)가 있어요.', v: calHTML(y, m, { cls: 'anno', noHol: true }) },
        { t: '무슨 요일인지 찾기', b: '① 날짜 숫자를 찾아요.<br>② 그 칸에서 <b>위로 쭉</b> 올라가요.<br>③ 맨 위의 <b>요일</b>을 읽어요.',
          v: calHTML(y, m, { hi: [d0], col: w0, noHol: true }) + cap(`${d0}일은 <b>${WD[w0]}요일</b>이에요.`) },
        { t: '빨간 날, 파란 날', b: '<b class="sun">일요일</b>과 <b class="sun">공휴일</b>은 빨간색이에요. 쉬는 날이에요.<br><b class="sat">토요일</b>은 파란색이에요.', v: calHTML(y, m, {}) },
        { t: '일주일 뒤는 바로 아래 칸', b: '달력에서 <b>바로 아래 칸</b>은 <b>7일 뒤</b>, 일주일 뒤예요.',
          v: calHTML(y, m, { hi: [10, 17], noHol: true }) + cap('10일의 일주일 뒤는 <b>17일</b>이에요.') },
      ];
    },
    gen(r, ctx) {
      const [y, m] = ctx.ym, L = lastDay(y, m), f = wdOf(y, m, 1);
      const days = WD.map(w => w + '요일'), mo = n => wrapM(n) + '월';
      const nth = (k, w) => 1 + (w - f + 7) % 7 + (k - 1) * 7;
      const count = w => Array.from({ length: L }, (_, i) => i + 1).filter(d => wdOf(y, m, d) === w).length;
      const [d1, d2, d3] = sample(r, Array.from({ length: L - 1 }, (_, i) => i + 2), 3);
      const k = ri(r, 1, 3), w = ri(r, 0, 6), cw = ri(r, 0, 6);
      const fwd = r() < 0.6, base = fwd ? ri(r, 1, L - 7) : ri(r, 8, L);
      const hols = []; for (let d = 1; d <= L; d++) { const n = holOf(y, m, d); if (n && n !== '대체 휴일') hols.push([d, n]); }
      const uniq = hols.filter(([, n]) => hols.filter(h => h[1] === n).length === 1);
      const lastOpts = [...new Set([L, 28, 30, 31])].map(n => n + '일');
      const qLast = mc(r, '이 달은 며칠까지 있나요?', L + '일', lastOpts, { sort: numSort, visual: calHTML(y, m, { noHol: true }), hint: '달력에서 가장 큰 숫자를 찾아보세요.' });
      const qCount = mc(r, `이 달에는 ${days[cw]}이 모두 몇 번 있나요?`, count(cw) + '번', [], { fixed: ['3번', '4번', '5번'], visual: calHTML(y, m, { col: cw, noHol: true }), hint: `‘${WD[cw]}’ 아래 숫자를 세어 보세요.` });
      const nx = d3 === L ? d3 - 1 : d3;
      const flip = r() < 0.5;
      const hq = uniq.length ? pick(r, uniq) : null;
      return [
        mc(r, '이 달력은 몇 월 달력인가요?', mo(m), [mo(m - 1), mo(m + 1), mo(m + 2)], { visual: calHTML(y, m, { noHol: true }), hint: '달력 맨 위를 보세요.' }),
        { type: 'cal', y, m, a: d1, q: `${d1}일을 찾아 눌러 보세요.`, p: `${d1}일을 찾아 ○표 하세요.`, hint: `${d1}일을 찾아보세요.` },
        mc(r, `${d2}일은 무슨 요일인가요?`, days[wdOf(y, m, d2)], days, { visual: calHTML(y, m, { hi: [d2], noHol: true }), hint: `${d2}일에서 위로 쭉 올라가 보세요.` }),
        { type: 'cal', y, m, a: nth(k, w), q: `${NTH[k - 1]} 번째 ${days[w]}을 찾아 눌러 보세요.`, p: `${NTH[k - 1]} 번째 ${days[w]}은 며칠인가요?`, write: true,
          hint: `‘${WD[w]}’ 아래에서 위에서 ${NTH[k - 1]} 번째 숫자예요.` },
        flip ? qLast : qCount,
        { type: 'cal', y, m, a: fwd ? base + 7 : base - 7, mark: [base], q: `${base}일에서 일주일 ${fwd ? '뒤' : '전'}는 며칠인가요? 찾아 눌러 보세요.`,
          p: `${base}일에서 일주일 ${fwd ? '뒤' : '전'}는 며칠인가요?`, write: true, hint: `${base}일의 바로 ${fwd ? '아래' : '위'} 칸이에요.` },
        mc(r, `${nx}일의 다음 날은 무슨 요일인가요?`, days[wdOf(y, m, nx + 1)], days, { visual: calHTML(y, m, { hi: [nx], noHol: true }), hint: `${nx + 1}일에서 위로 쭉 올라가 보세요.` }),
        hq ? { type: 'cal', y, m, a: hq[0], showHol: true, q: `‘${hq[1]}’ 날짜를 찾아 눌러 보세요.`, p: `‘${hq[1]}’ 날짜는 며칠인가요?`, write: true, hint: '달력 아래 ‘쉬는 날’을 읽어 보세요.' }
           : (flip ? qCount : qLast),
      ];
    },
  },
];
UNITS.forEach((u, i) => { u.no = i + 1; });
const unitById = id => UNITS.find(u => u.id === id);

/* ───────── 소리 ───────── */
let actx = null;
function audio() {
  if (!store.sound) return null;
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) { return null; }
}
function tone(freq, at, dur, type = 'triangle', vol = 0.22) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
const PRAISE = ['참 잘했어요!', '정답이에요!', '멋져요!', '최고예요!', '훌륭해요!', '아주 잘했어요!'];
function speak(text, rate = 0.9) {
  if (!store.sound || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = rate; u.pitch = 1.1;
    const v = speechSynthesis.getVoices().find(x => /^ko/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* 무시 */ }
}
function soundPraise(msg) {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.35));
  tone(1318.5, 0.38, 0.5, 'sine', 0.16); tone(1568, 0.46, 0.6, 'sine', 0.12);
  setTimeout(() => speak(msg, 1), 450);
}
function soundRetry() { tone(392, 0, 0.22, 'sine', 0.16); tone(329.63, 0.16, 0.3, 'sine', 0.16); }
function soundFanfare() {
  [[523.25, 0], [523.25, 0.14], [523.25, 0.28], [659.25, 0.42], [783.99, 0.6], [1046.5, 0.78]].forEach(([f, t]) => tone(f, t, 0.4));
  [523.25, 659.25, 783.99].forEach(f => tone(f, 1.0, 0.9, 'sine', 0.14));
}
function party(big) {
  if (typeof confetti !== 'function') return;
  const base = { disableForReducedMotion: true, zIndex: 50, colors: ['#5B4BFF', '#FFB020', '#12B981', '#FF5A5F', '#38BDF8'] };
  if (!big) return confetti({ ...base, particleCount: 70, spread: 75, startVelocity: 38, origin: { y: 0.72 } });
  confetti({ ...base, particleCount: 120, spread: 90, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  confetti({ ...base, particleCount: 120, spread: 90, origin: { x: 0.8, y: 0.7 }, angle: 120 });
  setTimeout(() => confetti({ ...base, particleCount: 150, spread: 120, origin: { y: 0.5 } }), 350);
}

/* ───────── 화면 설정 (글자 · 비율) ───────── */
function applySettings() {
  document.documentElement.style.setProperty('--scale', store.fs);
  $('#app').style.zoom = store.zoom;
  $('#fsVal').textContent = Math.round(store.fs * 100) + '%';
  $('#zmVal').textContent = Math.round(store.zoom * 100) + '%';
  const b = $('#sndBtn');
  b.textContent = store.sound ? '소리 켬' : '소리 끔';
  b.setAttribute('aria-pressed', store.sound);
  save();
  fitPages();
}
function stepFs(dir) {
  let i = FS_STEPS.findIndex(v => Math.abs(v - store.fs) < 0.01); if (i < 0) i = 2;
  store.fs = FS_STEPS[Math.max(0, Math.min(FS_STEPS.length - 1, i + dir))]; applySettings();
}
function stepZoom(dir) {
  store.zoom = Math.max(ZM_MIN, Math.min(ZM_MAX, Math.round((store.zoom + dir * 0.1) * 10) / 10)); applySettings();
}

/* ───────── 화면 그리기 ───────── */
const session = {}; // 단원별 { seed, qs, res } — 풀 때마다 새 문제
function startSession(u) { const seed = newSeed(); return (session[u.id] = { seed, qs: u.gen(rng(seed), { ym: calYM }), res: [] }); }
const getSession = u => session[u.id] || startSession(u);
let cur = null;
const go = h => { if (location.hash.slice(1) === h) route(); else location.hash = h; };
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const strip = html => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function renderTabs(active) {
  $('#tabs').innerHTML = `<div class="tabs-in">${UNITS.map(u =>
    `<button type="button" class="tab${active === u.id ? ' on' : ''}" data-act="open" data-id="${u.id}" ${active === u.id ? 'aria-current="page"' : ''}><i>${u.no}</i>${u.title}${store.stars[u.id] ? '<s aria-label="마침">✓</s>' : ''}</button>`).join('')}
    <button type="button" class="tab mk${active === 'sheet' ? ' on' : ''}" data-act="sheet">학습지 만들기</button></div>`;
}

function renderHome() {
  cur = null;
  const hn = holOf(Y, M, D);
  main.innerHTML = `
  <section class="hero">
    <div class="hero-txt">
      <p class="eyebrow">오늘은</p>
      <h1><span>${M}월 ${D}일</span> <span class="${hn ? 'sun' : wcls(W)}">${WD[W]}요일</span></h1>
      <p class="lead">${Y}년${hn ? ` · ${hn}` : ''}</p>
      <p class="guide">위에서 <b>1번부터 차례대로</b> 눌러 배워요.<br>달력에서 <b>달</b>을 누르면 그 달 달력이 나와요.</p>
      <button type="button" class="btn primary" data-act="open" data-id="day">하루부터 시작하기 ›</button>
    </div>
    <div class="hero-cal">${explorerHTML(Y, M)}</div>
  </section>
  <ol class="units">
    ${UNITS.map(u => `
    <li><button type="button" class="ucard" data-act="open" data-id="${u.id}">
      <span class="u-no">${u.no}</span>
      <b>${u.title}</b><small>${u.sub}</small>
      <span class="u-star${store.stars[u.id] ? ' got' : ''}">${store.stars[u.id] ? starStr(store.stars[u.id]) : '시작 ›'}</span>
    </button></li>`).join('')}
  </ol>`;
}

function shell(u, phase, i, n, inner) {
  const dots = Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('');
  return `
  <div class="uhead">
    <div class="utitle"><span class="u-no">${u.no}</span><h1>${u.title}</h1></div>
    <div class="phase"><button type="button" class="${phase === 'learn' ? 'on' : ''}" data-act="to-learn">배워요</button><button type="button" class="${phase === 'quiz' ? 'on' : ''}" data-act="to-quiz">풀어요</button></div>
  </div>
  <div class="dots" aria-label="${n}개 중 ${i + 1}번째">${dots}</div>
  ${inner}`;
}

function renderLearn(u, i) {
  const cards = u.learn(); i = Math.max(0, Math.min(cards.length - 1, i));
  const c = cards[i];
  cur = { u, phase: 'learn', i, n: cards.length, say: `${c.t}. ${strip(c.b)}` };
  main.innerHTML = shell(u, 'learn', i, cards.length, `
  <article class="card learn">
    <div class="q-top"><span class="pill">배워요 ${i + 1} / ${cards.length}</span><button type="button" class="say" data-act="say">읽어 주기</button></div>
    <h2>${c.t}</h2>
    <p class="body">${c.b}</p>
    <div class="vis">${c.v || ''}</div>
    ${c.note ? `<p class="note">${c.note}</p>` : ''}
  </article>
  <div class="nav">
    <button type="button" class="btn ghost" data-act="prev">‹ 이전</button>
    <button type="button" class="btn primary" data-act="next">${i === cards.length - 1 ? '문제 풀러 가기 ›' : '다음 ›'}</button>
  </div>`);
}

function renderQuiz(u, i) {
  const ses = getSession(u), qs = ses.qs; i = Math.max(0, Math.min(qs.length - 1, i));
  const q = qs[i];
  cur = { u, phase: 'quiz', i, n: qs.length, q, wrongs: 0, solved: false, ord: 0 };
  let body = '';
  if (q.type === 'choice') {
    cur.say = `${q.q} ${q.opts.map((o, k) => `${k + 1}번, ${strip(o).replace(/[^\w가-힣\s,·~()]/g, '')}`).join('. ')}`;
    body = `<div class="opts n${q.opts.length}">${q.opts.map((o, k) => `<button type="button" class="opt" data-act="opt" data-i="${k}"><span class="num">${k + 1}</span><span>${o}</span></button>`).join('')}</div>`;
  } else if (q.type === 'cal') {
    cur.say = q.q;
    body = `<div class="vis">${calHTML(q.y, q.m, { click: true, hi: q.mark || [], cls: 'play', noHol: !q.showHol })}</div>`;
  } else {
    cur.say = q.q;
    body = `<div class="slots">${q.items.map((_, k) => `<div class="slot" data-k="${k}"><small>${k + 1}</small><b></b></div>`).join('')}</div>
    <div class="pool">${q.mix.map(k => `<button type="button" class="opt ord" data-act="ord" data-k="${k}">${q.items[k]}</button>`).join('')}</div>`;
  }
  main.innerHTML = shell(u, 'quiz', i, qs.length, `
  <article class="card quiz">
    <div class="q-top"><span class="pill">문제 ${i + 1} / ${qs.length}</span><button type="button" class="say" data-act="say">읽어 주기</button></div>
    <h2>${q.q}</h2>
    ${q.visual ? `<div class="vis">${q.visual}</div>` : ''}
    ${body}
    <div class="fb" id="fb" role="status" aria-live="polite"></div>
  </article>
  <div class="nav">
    <button type="button" class="btn ghost" data-act="prev">‹ 이전</button>
    <button type="button" class="btn primary" id="nextBtn" data-act="next" disabled>${i === qs.length - 1 ? '끝내기 ›' : '다음 ›'}</button>
  </div>`);
}

function renderDone(u) {
  const ses = getSession(u), qs = ses.qs;
  const first = qs.filter((_, k) => ses.res[k] === 'first').length;
  const ratio = first / qs.length;
  const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
  store.stars[u.id] = Math.max(store.stars[u.id] || 0, stars); save();
  const next = UNITS[u.no];
  cur = { u, phase: 'done' };
  main.innerHTML = `
  <article class="card done">
    <p class="pill">${u.no}. ${u.title}</p>
    <h2>공부를 마쳤어요!</h2>
    <div class="stars" aria-label="별 ${stars}개">${starStr(stars)}</div>
    <p class="body">${qs.length}문제 중 <b>${first}문제</b>를 한 번에 맞혔어요.</p>
    <div class="done-btns">
      ${next ? `<button type="button" class="btn primary" data-act="open" data-id="${next.id}">다음: ${next.no}. ${next.title} ›</button>` : ''}
      <button type="button" class="btn ${next ? 'ghost' : 'primary'}" data-act="retry">새 문제로 또 풀기</button>
      <button type="button" class="btn ghost" data-act="sheet">학습지 만들기</button>
    </div>
  </article>`;
  renderTabs(u.id);
  soundFanfare(); party(true);
  setTimeout(() => speak(`${u.title} 공부를 마쳤어요. 정말 잘했어요!`, 1), 1300);
}

function route() {
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ } }
  const [id, phase, idx] = location.hash.slice(1).split('/');
  const u = unitById(id);
  document.body.dataset.view = id === 'sheet' ? 'sheet' : u ? 'unit' : 'home';
  renderTabs(id === 'sheet' ? 'sheet' : u ? u.id : '');
  if (id === 'sheet') renderSheet();
  else if (!u) renderHome();
  else if (phase === 'quiz') renderQuiz(u, +idx || 0);
  else if (phase === 'done') renderDone(u);
  else renderLearn(u, +idx || 0);
  window.scrollTo(0, 0);
}

/* ───────── 문제 채점 ───────── */
function feedback(ok, text) {
  const fb = $('#fb'); if (!fb) return;
  fb.className = 'fb show ' + (ok ? 'ok' : 'retry');
  fb.innerHTML = `<span class="fb-ico">${ok ? '○' : '!'}</span><span>${text}</span>`;
}
function correct(el) {
  cur.solved = true;
  getSession(cur.u).res[cur.i] = cur.wrongs === 0 ? 'first' : 'retry';
  if (el) el.classList.add('yes');
  main.querySelectorAll('.opt, .cal.play .cal-cell').forEach(b => { if (b !== el) b.disabled = true; });
  const msg = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  feedback(true, msg);
  soundPraise(msg); party(false);
  const nb = $('#nextBtn'); nb.disabled = false; nb.focus({ preventScroll: true });
}
function wrong(el) {
  cur.wrongs++;
  if (el) { el.classList.add('no'); el.disabled = true; }
  const q = cur.q;
  feedback(false, '괜찮아요. 다시 한번 해 볼까요?' + (q.hint ? `<small>도움말: ${q.hint}</small>` : ''));
  soundRetry();
  if (q.type === 'cal' && cur.wrongs >= 2) {
    const t = main.querySelector(`.cal.play [data-d="${q.a}"]`); if (t) t.classList.add('hint');
  }
}

/* ───────── 학습지 (A4, 만들 때마다 문제가 바뀜) ───────── */
const sheet = { units: QS.get('units') ? QS.get('units').split(',') : UNITS.map(u => u.id), learn: !QS.has('nolearn'), quiz: true, key: QS.has('key'), big: QS.has('big'), month: QS.get('month') || 'now', seed: +QS.get('seed') || newSeed() };
function sheetYM() {
  if (sheet.month === 'now') return [Y, M];
  if (sheet.month === 'rand') return [Y, 1 + Math.floor(rng(sheet.seed * 7 + 3)() * 12)];
  return [Y, +sheet.month];
}
const sheetQs = u => u.gen(rng(sheet.seed * 31 + u.no * 1013), { ym: sheetYM() });
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

function sheetHead(u, kind) {
  return `<header class="sh">
    <div class="sh-l"><span class="sh-no">${u.no}</span><div><small>${kind}</small><h1>${u.title}</h1></div></div>
    <div class="sh-r"><span>이름</span><i class="ln"></i><span>날짜</span><i class="ln s"></i><span>월</span><i class="ln s"></i><span>일</span></div>
  </header>`;
}
const sheetFoot = (u, t) => `<p class="sh-foot"><span>달력 배우기 · ${u ? `${u.no}. ${u.title} · ` : ''}${t}</span><span>학습지 번호 ${sheet.seed}</span></p>`;
function sheetLearn(u) {
  const saved = calYM; if (u.id === 'cal') calYM = sheetYM();
  const cards = u.learn().filter(c => !c.screenOnly); calYM = saved;
  return chunk(cards.map((c, i) => ({ c, i })), sheet.big ? 2 : 6).map(part =>
    `<section class="sheet"><div class="sheet-in">${sheetHead(u, '배워요')}
    <div class="pl-grid n${part.length}${sheet.big ? ' one' : ''}">${part.map(({ c, i }) => `
      <article class="pl"><h3><span>${i + 1}</span>${c.t}</h3><p>${c.b}</p><div class="vis">${c.v || ''}</div></article>`).join('')}
    </div>${sheetFoot(u, '소리 내어 읽어 보세요.')}</div></section>`).join('');
}
function sheetQuiz(u) {
  const qs = sheetQs(u), [y, m] = u.id === 'cal' ? sheetYM() : [Y, M];
  const shared = u.sharedCal ? `<div class="p-shared"><p>아래 달력을 보고 문제를 풀어 보세요.</p>${calHTML(y, m, { cls: 'big' })}</div>` : '';
  const item = (q, i) => {
    let b = '';
    if (q.type === 'choice') {
      const isCal = q.visual && /class="cal /.test(q.visual) && !/headonly/.test(q.visual);
      b = (q.visual && !(u.sharedCal && isCal) ? `<div class="vis">${q.visual}</div>` : '') +
        `<ul class="po">${q.opts.map((o, k) => `<li><span>${CIRC[k]}</span>${o}</li>`).join('')}</ul>`;
    } else if (q.type === 'cal') {
      b = (u.sharedCal ? '' : `<div class="vis">${calHTML(q.y, q.m, { noHol: true })}</div>`) + (q.write ? '<p class="wr">답: <i class="ln s"></i> 일</p>' : '');
    } else {
      b = `<ul class="po ord">${q.mix.map(k => `<li><span class="bx"></span>${q.items[k]}</li>`).join('')}</ul>`;
    }
    return `<li class="pq"><p class="pq-q"><span class="pq-n">${i + 1}</span><span>${q.p || q.q}</span></p>${b}</li>`;
  };
  return chunk(qs.map((q, i) => ({ q, i })), sheet.big ? 4 : 8).map(part =>
    `<section class="sheet"><div class="sheet-in">${sheetHead(u, '풀어요')}${shared}
    <ol class="pq-grid">${part.map(({ q, i }) => item(q, i)).join('')}</ol>${sheetFoot(u, '알맞은 답에 ○표 하세요.')}</div></section>`).join('');
}
function answerOf(q) {
  if (q.type === 'choice') return `${CIRC[q.a]} ${strip(q.opts[q.a])}`;
  if (q.type === 'cal') return `${q.a}일`;
  return q.items.map(s => s[0]).join(' → ');
}
function sheetKey(units) {
  return `<section class="sheet key"><div class="sheet-in"><header class="sh"><div class="sh-l"><span class="sh-no">✓</span><div><small>교사용</small><h1>정답지</h1></div></div>
    <div class="sh-r"><span>만든 날: ${Y}년 ${M}월 ${D}일</span></div></header>
    ${units.map(u => `<div class="kb"><h3>${u.no}. ${u.title}</h3><ol>${sheetQs(u).map(q => `<li>${answerOf(q)}</li>`).join('')}</ol></div>`).join('')}
    ${sheetFoot(null, '학습지 번호가 같은 학습지의 정답입니다.')}</div></section>`;
}
function pagesHTML() {
  const units = UNITS.filter(u => sheet.units.includes(u.id));
  return units.map(u => (sheet.learn ? sheetLearn(u) : '') + (sheet.quiz ? sheetQuiz(u) : '')).join('') + (sheet.key && sheet.quiz ? sheetKey(units) : '');
}
function renderSheet() {
  cur = { phase: 'sheet' };
  const tg = (k, label) => `<button type="button" class="chip${sheet[k] ? ' on' : ''}" data-act="sh-tg" data-k="${k}" aria-pressed="${sheet[k]}">${label}</button>`;
  main.innerHTML = `
  <section class="sp">
    <div class="sp-bar">
      <div class="sp-row">
        <h1>학습지 만들기</h1>
        <div class="sp-act">
          <button type="button" class="btn ghost" data-act="sh-new">새 문제로 바꾸기</button>
          <button type="button" class="btn primary" data-act="sh-print">A4로 인쇄하기</button>
        </div>
      </div>
      <div class="sp-opts">
        <div class="sp-g"><span>단원</span>${UNITS.map(u => `<button type="button" class="chip${sheet.units.includes(u.id) ? ' on' : ''}" data-act="sh-unit" data-id="${u.id}" aria-pressed="${sheet.units.includes(u.id)}">${u.no}. ${u.title}</button>`).join('')}</div>
        <div class="sp-g"><span>내용</span>${tg('learn', '배워요')}${tg('quiz', '풀어요')}${tg('key', '정답지')}${tg('big', '큰 글씨')}</div>
        <div class="sp-g"><span>달력 보기의 달</span><select id="shMonth" aria-label="달력 보기 단원에 쓸 달">
          <option value="now"${sheet.month === 'now' ? ' selected' : ''}>이번 달 (${M}월)</option>
          <option value="rand"${sheet.month === 'rand' ? ' selected' : ''}>아무 달이나</option>
          ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${String(sheet.month) === String(i + 1) ? ' selected' : ''}>${i + 1}월</option>`).join('')}
        </select></div>
      </div>
      <p class="sp-info" id="spInfo"></p>
    </div>
    <div class="pages-wrap"><div class="pages" id="pages"></div></div>
  </section>`;
  drawPages();
}
function drawPages() {
  const pages = $('#pages'); if (!pages) return;
  pages.className = 'pages' + (sheet.big ? ' big' : '');
  pages.innerHTML = pagesHTML() || '<p class="sp-empty">단원과 내용을 골라 주세요.</p>';
  const n = pages.querySelectorAll('.sheet').length;
  $('#spInfo').innerHTML = `A4 <b>${n}장</b> · 학습지 번호 <b>${sheet.seed}</b> · ‘새 문제로 바꾸기’를 누를 때마다 문제가 바뀝니다. 아래는 인쇄될 모습 그대로입니다.`;
  fitPages(); fitSheets();
}
/* 화면 폭에 맞춰 A4 미리보기를 줄여서 보여 준다 */
function fitPages() {
  const pages = $('#pages'); if (!pages) return;
  pages.style.zoom = 1;
  const first = pages.querySelector('.sheet'); if (!first) return;
  const avail = pages.parentElement.clientWidth, w = first.offsetWidth;
  if (avail > 0 && w > 0) pages.style.zoom = Math.min(1, avail / w);
}
/* 달(6주짜리 달, 공휴일 많은 달)에 따라 내용이 길어져도 A4 한 장에 들어가도록 조금 줄인다 */
function fitSheets() {
  document.querySelectorAll('#pages .sheet').forEach(sh => {
    const inner = sh.querySelector('.sheet-in'); inner.style.zoom = '';
    const probe = document.createElement('div'); probe.className = 'sheet-probe'; sh.appendChild(probe);
    const avail = probe.getBoundingClientRect().height; probe.remove();
    let z = 1;
    for (let k = 0; k < 10; k++) {
      const h = inner.getBoundingClientRect().height;
      if (h <= avail) break;
      z = Math.max(0.5, z * Math.min(0.98, avail / h)); inner.style.zoom = z;
    }
  });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if ($('#pages')) fitSheets(); });
window.addEventListener('resize', fitPages);
window.addEventListener('beforeprint', () => { if ($('#pages')) fitSheets(); });

/* ───────── 달력 넘겨 보기 처리 ───────── */
function exSet(el, y, m) {
  const d = new Date(y, m - 1, 1), bind = el.dataset.bind;
  const tmp = document.createElement('div'); tmp.innerHTML = explorerHTML(d.getFullYear(), d.getMonth() + 1, bind);
  el.replaceWith(tmp.firstElementChild);
  if (bind === 'cal') { calYM = [d.getFullYear(), d.getMonth() + 1]; delete session.cal; }
  tone(660, 0, 0.08, 'sine', 0.08);
}
function openMonth(m) {
  $('#monthDlgBody').innerHTML = explorerHTML(Y, m);
  $('#monthDlg').showModal();
}

/* ───────── 누르기 처리 ───────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  const ex = el.closest('.ex');
  switch (act) {
    case 'home': go(''); break;
    case 'open': audio(); go(el.dataset.id + '/learn/0'); break;
    case 'sheet': go('sheet'); break;
    case 'fs-': stepFs(-1); break;
    case 'fs+': stepFs(1); break;
    case 'zm-': stepZoom(-1); break;
    case 'zm+': stepZoom(1); break;
    case 'reset': store.fs = 1; store.zoom = 1; applySettings(); break;
    case 'sound':
      store.sound = !store.sound; applySettings();
      if (store.sound) soundPraise('소리를 켰어요'); else if ('speechSynthesis' in window) speechSynthesis.cancel();
      break;
    case 'say': if (cur && cur.say) { audio(); speak(cur.say); } break;
    case 'ex-prev': exSet(ex, +ex.dataset.y, +ex.dataset.m - 1); break;
    case 'ex-next': exSet(ex, +ex.dataset.y, +ex.dataset.m + 1); break;
    case 'ex-now': exSet(ex, Y, M); break;
    case 'ex-m': exSet(ex, +ex.dataset.y, +el.dataset.m); break;
    case 'month': openMonth(+el.dataset.m); break;
    case 'to-learn': if (cur && cur.u) go(`${cur.u.id}/learn/0`); break;
    case 'to-quiz': if (cur && cur.u && cur.phase !== 'quiz') { startSession(cur.u); go(`${cur.u.id}/quiz/0`); } break;
    case 'prev':
      if (!cur) break;
      if (cur.phase === 'learn') cur.i === 0 ? go('') : go(`${cur.u.id}/learn/${cur.i - 1}`);
      else if (cur.phase === 'quiz') cur.i === 0 ? go(`${cur.u.id}/learn/${cur.u.learn().length - 1}`) : go(`${cur.u.id}/quiz/${cur.i - 1}`);
      break;
    case 'next':
      if (!cur) break;
      if (cur.phase === 'learn') cur.i === cur.n - 1 ? (startSession(cur.u), go(`${cur.u.id}/quiz/0`)) : go(`${cur.u.id}/learn/${cur.i + 1}`);
      else if (cur.phase === 'quiz' && cur.solved) cur.i === cur.n - 1 ? go(`${cur.u.id}/done`) : go(`${cur.u.id}/quiz/${cur.i + 1}`);
      break;
    case 'retry': startSession(cur.u); go(`${cur.u.id}/quiz/0`); break;
    case 'opt':
      if (!cur || cur.solved) break;
      (+el.dataset.i === cur.q.a) ? correct(el) : wrong(el);
      break;
    case 'day':
      if (!cur || cur.solved || cur.phase !== 'quiz') break;
      (+el.dataset.d === cur.q.a) ? correct(el) : wrong(el);
      break;
    case 'ord': {
      if (!cur || cur.solved) break;
      const k = +el.dataset.k;
      if (k === cur.ord) {
        const slot = main.querySelector(`.slot[data-k="${k}"]`);
        slot.classList.add('fill'); slot.querySelector('b').textContent = cur.q.items[k];
        el.classList.add('used'); el.disabled = true; cur.ord++;
        if (cur.ord === cur.q.items.length) correct(null); else tone(523.25 + k * 90, 0, 0.18);
      } else {
        cur.wrongs++; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 450);
        feedback(false, `괜찮아요. ${cur.ord + 1}번째 요일을 찾아보세요.<small>도움말: ${cur.q.hint}</small>`); soundRetry();
      }
      break;
    }
    case 'sh-unit': {
      const id = el.dataset.id;
      sheet.units = sheet.units.includes(id) ? sheet.units.filter(x => x !== id) : [...sheet.units, id];
      renderSheet(); break;
    }
    case 'sh-tg': sheet[el.dataset.k] = !sheet[el.dataset.k]; renderSheet(); break;
    case 'sh-new': sheet.seed = newSeed(); drawPages(); break;
    case 'sh-print': fitSheets(); window.print(); break;
  }
});
document.addEventListener('change', e => { if (e.target.id === 'shMonth') { sheet.month = e.target.value; drawPages(); } });
window.addEventListener('hashchange', route);

$('#logo').textContent = D;
applySettings();
route();
loadHolidays();
})();
