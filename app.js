/* 달력 배우기 — 일 · 월 · 주 · 년 개념과 달력 보기
   오픈 소스: canvas-confetti (ISC), Pretendard (OFL) */
(() => {
'use strict';

/* ───────── 날짜 도구 ───────── */
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const QS = new URLSearchParams(location.search);
/* 주소 뒤에 ?date=2026-10-05 를 붙이면 그 날짜를 '오늘'로 삼습니다(미리 만들어 두는 학습지용). */
const TODAY = (() => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(QS.get('date') || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(); })();
const Y = TODAY.getFullYear(), M = TODAY.getMonth() + 1, D = TODAY.getDate(), W = TODAY.getDay();
const addDays = n => new Date(Y, M - 1, D + n);
const md = d => `${d.getMonth() + 1}월 ${d.getDate()}일`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const wdOf = (y, m, d) => new Date(y, m - 1, d).getDay();
const wrapM = m => ((m - 1 + 120) % 12) + 1;
const wcls = w => (w === 0 ? 'sun' : w === 6 ? 'sat' : '');
const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

/* ───────── 설정 저장 ───────── */
const KEY = 'cal-learn-v1';
const FS_STEPS = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const ZM_MIN = 0.7, ZM_MAX = 1.6;
const store = { fs: 1, zoom: 1, sound: true, stars: {} };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장소 없음 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ } };

/* ───────── 공휴일 (무료 공개 API) ─────────
   holidays-kr (github.com/hyunbinseo/holidays-kr) — 우주항공청 월력요항 기반, 키 없이 사용.
   인터넷이 안 되면 공휴일 표시 없이 그대로 동작합니다. */
const HOL_URL = 'https://holidays.hyunbin.page/basic.json';
const HOL_KEY = 'cal-learn-holidays';
let HOL = {}; // { '2026-10-03': '개천절' }
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
  if (holCache && Date.now() - holCache.at < 864e5) return; // 하루에 한 번만 새로 받기
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 7000);
  fetch(HOL_URL, { signal: ctl.signal }).then(r => (r.ok ? r.json() : Promise.reject())).then(data => {
    const before = JSON.stringify(HOL);
    setHolidays(data);
    try { localStorage.setItem(HOL_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* 무시 */ }
    if (JSON.stringify(HOL) === before) return;
    Object.keys(qCache).forEach(k => delete qCache[k]);
    if (QS.has('sheet')) rebuildPreview();
    else if (!cur || cur.phase === 'learn') route(); // 문제 푸는 중에는 화면을 바꾸지 않음
  }).catch(() => { /* 인터넷 없음: 공휴일 없이 사용 */ }).finally(() => clearTimeout(timer));
}

/* ───────── 그림 도우미 ───────── */
function calHTML(y, m, o = {}) {
  const first = wdOf(y, m, 1), L = lastDay(y, m);
  const hi = o.hi || [], hols = [];
  const rowOf = d => Math.floor((first + d - 1) / 7);
  const hiRow = o.row ? rowOf(o.row) : -1;
  const isNow = y === Y && m === M;
  let h = `<div class="cal ${o.cls || ''}"><div class="cal-head"><span class="cal-y">${y}년</span><span class="cal-m">${m}월</span></div><div class="cal-grid">`;
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
      ? `<button type="button" class="${cls}" data-act="day" data-d="${d}" aria-label="${d}일">${d}</button>`
      : `<div class="${cls}">${d}</div>`;
  }
  const tail = (7 - ((first + L) % 7)) % 7;
  for (let k = 0; k < tail; k++) h += '<div class="cal-cell empty"></div>';
  return h + '</div>' + (hols.length ? `<div class="cal-hol"><i>쉬는 날</i>${hols.join('')}</div>` : '') + '</div>';
}
const flow = items => `<div class="flow">${items.map(([e, t, c]) =>
  `<div class="fi ${c || ''}">${e ? `<span class="fe">${e}</span>` : ''}<span>${t}</span></div>`).join('<span class="ar">→</span>')}</div>`;
const trio = items => `<div class="trio">${items.map(([s, b, e], i) =>
  `<div class="tb${i === 1 ? ' now' : ''}"><small>${s}</small><b>${b}</b>${e ? `<em>${e}</em>` : ''}</div>`).join('<span class="ar">→</span>')}</div>`;
const eq = parts => `<div class="eq">${parts.map(p => `<span>${p}</span>`).join('<i>=</i>')}</div>`;
const cap = t => `<p class="cap">${t}</p>`;

/* ───────── 단원 내용 ───────── */
const SEASONS = [['🌸', '봄', '3 · 4 · 5월'], ['🌻', '여름', '6 · 7 · 8월'], ['🍁', '가을', '9 · 10 · 11월'], ['⛄', '겨울', '12 · 1 · 2월']];
const seasonIdx = m => (m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3);
let calOffset = 0; // 달력 보기 단원: 몇 달 뒤 달력으로 연습하는지

const UNITS = [
  /* 1. 일 */
  {
    id: 'day', no: 1, icon: '🌞', title: '하루', tag: '일', sub: '어제 · 오늘 · 내일',
    learn: () => [
      { t: '하루란?', b: '아침에 일어나서 밤에 잘 때까지, <b>하루</b>가 지나가요.',
        v: flow([['🌅', '아침'], ['☀️', '낮'], ['🌇', '저녁'], ['🌙', '밤']]) },
      { t: '하루는 24시간', b: '하루는 <b>24시간</b>이에요. 시계의 짧은 바늘이 <b>두 바퀴</b> 돌면 하루예요.',
        v: eq(['하루', '24시간']) },
      { t: '어제 · 오늘 · 내일', b: '오늘의 <b>하루 전</b>은 <b>어제</b>예요. 오늘의 <b>하루 뒤</b>는 <b>내일</b>이에요.',
        v: trio([['어제', md(addDays(-1)), WD[addDays(-1).getDay()] + '요일'], ['오늘', md(TODAY), WD[W] + '요일'], ['내일', md(addDays(1)), WD[addDays(1).getDay()] + '요일']]) },
      { t: '달력의 한 칸은 하루', b: '달력에서 숫자 <b>한 칸</b>이 <b>하루</b>예요. 색칠한 칸이 <b>오늘</b>이에요.',
        v: calHTML(Y, M, { today: true, cls: 'sm' }) },
    ],
    quiz: () => [
      { type: 'choice', q: '아침 다음에는 무엇이 올까요?', visual: flow([['🌅', '아침'], ['❓', '', 'q'], ['🌇', '저녁'], ['🌙', '밤']]),
        opts: ['🌙 밤', '☀️ 낮', '🌇 저녁'], a: 1, hint: '아침 → 낮 → 저녁 → 밤 순서예요.' },
      { type: 'choice', q: '오늘의 다음 날을 무엇이라고 하나요?', opts: ['어제', '오늘', '내일'], a: 2, hint: '하루 뒤는 내일이에요.' },
      { type: 'choice', q: '오늘의 하루 전날을 무엇이라고 하나요?', opts: ['어제', '내일', '오늘'], a: 0, hint: '하루 전은 어제예요.' },
      { type: 'choice', q: `오늘은 ${md(TODAY)}이에요. 내일은 며칠인가요?`,
        opts: [md(addDays(-1)), md(addDays(2)), md(addDays(1))], a: 2, hint: '내일은 오늘보다 하루 뒤예요.' },
      { type: 'choice', q: `오늘은 ${md(TODAY)}이에요. 어제는 며칠이었나요?`,
        opts: [md(addDays(1)), md(addDays(-1)), md(addDays(-2))], a: 1, hint: '어제는 오늘보다 하루 전이에요.' },
      { type: 'choice', q: '하루는 몇 시간인가요?', opts: ['7시간', '12시간', '24시간'], a: 2, hint: '하루 = 24시간' },
      { type: 'cal', y: Y, m: M, a: D, q: `오늘은 ${md(TODAY)}이에요. 달력에서 오늘을 찾아 눌러 보세요.`,
        p: `오늘은 ${md(TODAY)}이에요. 달력에서 오늘을 찾아 ○표 하세요.`, hint: `숫자 ${D}을(를) 찾아보세요.` },
    ],
  },
  /* 2. 월 */
  {
    id: 'month', no: 2, icon: '🗓️', title: '한 달', tag: '월', sub: '지난달 · 이번 달 · 다음 달', sharedCal: true,
    learn: () => [
      { t: '한 달이란?', b: '달력 <b>한 장</b>이 <b>한 달</b>이에요. 한 달은 <b>1일</b>부터 시작해요.',
        v: calHTML(Y, M, { cls: 'sm' }) },
      { t: '한 달은 30일쯤', b: '한 달은 <b>30일</b> 또는 <b>31일</b>이에요. <b>2월</b>만 28일로 짧아요.',
        v: `<div class="mgrid">${Array.from({ length: 12 }, (_, i) => `<div class="mc${i + 1 === M ? ' now' : ''}"><b>${i + 1}월</b><small>${lastDay(Y, i + 1)}일</small></div>`).join('')}</div>` },
      { t: '1년에는 열두 달', b: '<b>1월</b>부터 <b>12월</b>까지 있어요. <b>12월 다음은 다시 1월</b>이에요.',
        v: flow([['', '11월'], ['', '12월'], ['', '1월', 'on'], ['', '2월']]) },
      { t: '지난달 · 이번 달 · 다음 달', b: '이번 달의 <b>앞 달</b>은 <b>지난달</b>, <b>뒤 달</b>은 <b>다음 달</b>이에요.',
        v: trio([['지난달', wrapM(M - 1) + '월'], ['이번 달', M + '월'], ['다음 달', wrapM(M + 1) + '월']]) },
    ],
    quiz: () => [
      { type: 'choice', q: '한 달은 며칠쯤 되나요?', opts: ['7일', '30일', '365일'], a: 1, hint: '한 달은 30일 또는 31일이에요.' },
      { type: 'choice', q: '달력을 보세요. 지금은 몇 월인가요?', visual: calHTML(Y, M, { cls: 'sm', today: true }),
        opts: [wrapM(M - 1) + '월', M + '월', wrapM(M + 1) + '월'], a: 1, hint: '달력 맨 위에 쓰여 있어요.' },
      { type: 'choice', q: `${M}월의 다음 달은 몇 월인가요?`, opts: [wrapM(M + 1) + '월', wrapM(M - 1) + '월', wrapM(M + 2) + '월'], a: 0,
        hint: M === 12 ? '12월 다음은 다시 1월이에요.' : `${M} 다음 숫자를 생각해 보세요.` },
      { type: 'choice', q: `${M}월의 지난달은 몇 월인가요?`, opts: [wrapM(M + 1) + '월', wrapM(M - 2) + '월', wrapM(M - 1) + '월'], a: 2,
        hint: M === 1 ? '1월의 앞은 12월이에요.' : `${M} 바로 앞 숫자를 생각해 보세요.` },
      { type: 'choice', q: '1년에는 달이 모두 몇 개 있나요?', opts: ['7달', '10달', '12달'], a: 2, hint: '1월부터 12월까지 있어요.' },
      { type: 'choice', q: '12월의 다음 달은 몇 월인가요?', opts: ['13월', '1월', '11월'], a: 1, hint: '12월이 끝나면 다시 1월이에요.' },
      { type: 'cal', y: Y, m: M, a: lastDay(Y, M), q: `${M}월의 마지막 날을 찾아 눌러 보세요.`,
        p: `${M}월의 마지막 날을 찾아 ○표 하세요.`, hint: '가장 큰 숫자를 찾아보세요.' },
    ],
  },
  /* 3. 주 */
  {
    id: 'week', no: 3, icon: '🧩', title: '일주일', tag: '주', sub: '요일 · 평일 · 주말',
    learn: () => [
      { t: '일주일은 7일', b: '<b>7일</b>이 모이면 <b>일주일</b>이에요. 날마다 이름이 있어요. 이 이름이 <b>요일</b>이에요.',
        v: eq(['일주일', '7일']) },
      { t: '요일의 순서', b: '일 · 월 · 화 · 수 · 목 · 금 · 토 순서예요. <b>토요일 다음은 다시 일요일</b>이에요.',
        v: `<div class="wchips">${WD.map((w, i) => `<div class="wc ${wcls(i)}"><b>${w}</b><small>요일</small></div>`).join('')}</div>` },
      { t: '달력의 한 줄은 일주일', b: '달력에서 <b>옆으로 한 줄</b>이 <b>일주일</b>이에요. 색칠한 줄이 <b>이번 주</b>예요.',
        v: calHTML(Y, M, { cls: 'sm', row: D }) },
      { t: '평일과 주말', b: '<b>월요일~금요일</b>은 <b>평일</b>이에요. 학교에 가요.<br><b>토요일, 일요일</b>은 <b>주말</b>이에요. 쉬는 날이에요.',
        v: `<div class="wchips">${WD.map((w, i) => `<div class="wc ${wcls(i)}"><b>${w}</b><small>${i === 0 || i === 6 ? '🏠' : '🏫'}</small></div>`).join('')}</div>` },
    ],
    quiz: () => [
      { type: 'choice', q: '일주일은 며칠인가요?', opts: ['5일', '7일', '10일'], a: 1, hint: '일 월 화 수 목 금 토, 세어 보세요.' },
      { type: 'choice', q: '월요일의 다음 날은 무슨 요일인가요?', opts: ['화요일', '수요일', '일요일'], a: 0, hint: '월 → 화 → 수' },
      { type: 'choice', q: '금요일의 다음 날은 무슨 요일인가요?', opts: ['목요일', '월요일', '토요일'], a: 2, hint: '목 → 금 → 토' },
      { type: 'choice', q: '토요일의 다음 날은 무슨 요일인가요?', opts: ['금요일', '일요일', '월요일'], a: 1, hint: '토요일 다음은 다시 일요일이에요.' },
      { type: 'choice', q: `오늘은 ${md(TODAY)}이에요. 달력을 보세요. 오늘은 무슨 요일인가요?`, visual: calHTML(Y, M, { cls: 'sm', today: true }),
        opts: [WD[(W + 3) % 7] + '요일', WD[W] + '요일', WD[(W + 5) % 7] + '요일'], a: 1, hint: '색칠한 칸에서 위로 쭉 올라가 보세요.' },
      { type: 'order', q: '학교에 가는 요일이에요. 순서대로 눌러 보세요.', p: '학교에 가는 요일이에요. 순서대로 1~5 번호를 쓰세요.',
        items: ['월요일', '화요일', '수요일', '목요일', '금요일'], mix: [2, 0, 4, 1, 3], hint: '월 → 화 → 수 → 목 → 금' },
      { type: 'choice', q: '학교에 가지 않고 쉬는 주말은 언제인가요?', opts: ['월요일, 화요일', '수요일, 목요일', '토요일, 일요일'], a: 2, hint: '달력에서 파란색, 빨간색 요일이에요.' },
    ],
  },
  /* 4. 년 */
  {
    id: 'year', no: 4, icon: '🌳', title: '1년', tag: '년', sub: '작년 · 올해 · 내년',
    learn: () => [
      { t: '1년이란?', b: '<b>열두 달</b>이 모이면 <b>1년</b>이에요. <b>1월 1일</b>에 시작하고 <b>12월 31일</b>에 끝나요.',
        v: `<div class="mgrid">${Array.from({ length: 12 }, (_, i) => `<div class="mc${i + 1 === M ? ' now' : ''}"><b>${i + 1}월</b></div>`).join('')}</div>` },
      { t: '1년은 365일', b: '1년은 <b>365일</b>이에요. 달력 <b>12장</b>을 모두 넘기면 1년이 지나가요.',
        v: eq(['1년', '12달', '365일']) },
      { t: '작년 · 올해 · 내년', b: '올해의 <b>1년 전</b>은 <b>작년</b>이에요. 올해의 <b>1년 뒤</b>는 <b>내년</b>이에요.',
        v: trio([['작년', (Y - 1) + '년'], ['올해', Y + '년'], ['내년', (Y + 1) + '년']]) },
      { t: '1년에는 네 계절', b: '1년 동안 <b>봄, 여름, 가을, 겨울</b>이 차례로 와요.',
        v: `<div class="seasons">${SEASONS.map(([e, n, r], i) => `<div class="sc${i === seasonIdx(M) ? ' now' : ''}"><span class="fe">${e}</span><b>${n}</b><small>${r}</small></div>`).join('')}</div>` },
      { t: '1년에 한 번 오는 날', b: '<b>생일</b>은 1년에 <b>한 번</b> 와요. 설날, 추석, 크리스마스도 1년에 한 번이에요.',
        v: flow([['🎂', '생일'], ['🎍', '설날'], ['🌕', '추석'], ['🎄', '크리스마스']]).replace(/<span class="ar">→<\/span>/g, '') },
    ],
    quiz: () => [
      { type: 'choice', q: '1년은 몇 달인가요?', opts: ['7달', '12달', '30달'], a: 1, hint: '1월부터 12월까지예요.' },
      { type: 'choice', q: '1년은 며칠인가요?', opts: ['30일', '100일', '365일'], a: 2, hint: '1년 = 365일' },
      { type: 'choice', q: '올해는 몇 년인가요?', visual: calHTML(Y, M, { cls: 'sm headonly' }),
        opts: [(Y - 1) + '년', Y + '년', (Y + 1) + '년'], a: 1, hint: '달력 맨 위에 쓰여 있어요.' },
      { type: 'choice', q: `올해는 ${Y}년이에요. 내년은 몇 년인가요?`, opts: [(Y + 1) + '년', (Y - 1) + '년', Y + '년'], a: 0, hint: '내년은 올해보다 1 큰 숫자예요.' },
      { type: 'choice', q: `올해는 ${Y}년이에요. 작년은 몇 년이었나요?`, opts: [Y + '년', (Y + 1) + '년', (Y - 1) + '년'], a: 2, hint: '작년은 올해보다 1 작은 숫자예요.' },
      { type: 'choice', q: '1년 중 첫 번째 달은 몇 월인가요?', opts: ['1월', '3월', '12월'], a: 0, hint: '새해는 1월 1일에 시작해요.' },
      { type: 'choice', q: '내 생일은 1년에 몇 번 오나요?', opts: ['날마다', '한 번', '열두 번'], a: 1, hint: '생일은 1년에 딱 한 번이에요.' },
      { type: 'choice', q: `지금은 ${M}월이에요. 어느 계절인가요?`, opts: SEASONS.map(([e, n]) => `${e} ${n}`), a: seasonIdx(M),
        hint: `${SEASONS[seasonIdx(M)][2]}은 ${SEASONS[seasonIdx(M)][1]}이에요.` },
    ],
  },
  /* 5. 달력 보기 */
  {
    id: 'cal', no: 5, icon: '📅', title: '달력 보기', tag: '달력', sub: '날짜와 요일 찾기', sharedCal: true,
    ym: () => { const d = new Date(Y, M - 1 + calOffset, 1); return [d.getFullYear(), d.getMonth() + 1]; },
    learn() {
      const [y, m] = [Y, M];
      return [
        { t: '달력에 있는 것', b: '맨 위에는 <b>년과 월</b>, 그 아래에는 <b>요일</b>, 칸 안에는 <b>날짜</b>(숫자)가 있어요.',
          v: calHTML(y, m, { cls: 'sm anno' }) },
        { t: '무슨 요일인지 찾기', b: '① 날짜 숫자를 찾아요.<br>② 그 칸에서 <b>위로 쭉</b> 올라가요.<br>③ 맨 위의 <b>요일</b>을 읽어요.',
          v: calHTML(y, m, { cls: 'sm', hi: [D], col: W }) + cap(`${D}일은 <b>${WD[W]}요일</b>이에요.`) },
        { t: '빨간 날, 파란 날', b: '<b class="sun">일요일</b>과 <b class="sun">공휴일</b>은 빨간색이에요. 쉬는 날이에요.<br><b class="sat">토요일</b>은 파란색이에요.',
          v: calHTML(y, m, { cls: 'sm' }) },
        { t: '일주일 뒤는 바로 아래 칸', b: '달력에서 <b>바로 아래 칸</b>은 <b>7일 뒤</b>, 일주일 뒤예요.',
          v: calHTML(y, m, { cls: 'sm', hi: [10, 17] }) + cap('10일의 일주일 뒤는 <b>17일</b>이에요.') },
      ];
    },
    quiz() {
      const [y, m] = this.ym();
      const L = lastDay(y, m), f = wdOf(y, m, 1);
      const w15 = wdOf(y, m, 15);
      const firstSat = 1 + (6 - f + 7) % 7;
      const secondWed = 1 + (3 - f + 7) % 7 + 7;
      const suns = Array.from({ length: L }, (_, i) => i + 1).filter(d => wdOf(y, m, d) === 0).length;
      const lastOpts = L === 29 ? [28, 29, 30] : L === 28 ? [28, 30, 31] : [29, 30, 31];
      return [
        { type: 'choice', q: '이 달력은 몇 월 달력인가요?', visual: calHTML(y, m, { cls: 'sm' }),
          opts: [wrapM(m + 1) + '월', m + '월', wrapM(m - 1) + '월'], a: 1, hint: '달력 맨 위를 보세요.' },
        { type: 'cal', y, m, a: 9, q: '9일을 찾아 눌러 보세요.', p: '9일을 찾아 ○표 하세요.', hint: '숫자 9를 찾아보세요.' },
        { type: 'choice', q: '15일은 무슨 요일인가요?', visual: calHTML(y, m, { cls: 'sm', hi: [15] }),
          opts: [WD[(w15 + 2) % 7] + '요일', WD[(w15 + 5) % 7] + '요일', WD[w15] + '요일'], a: 2, hint: '15에서 위로 쭉 올라가 보세요.' },
        { type: 'cal', y, m, a: firstSat, q: '첫 번째 토요일을 찾아 눌러 보세요.', p: '첫 번째 토요일을 찾아 △표 하세요.',
          ans: `${firstSat}일`, hint: '파란색 ‘토’ 아래에서 맨 위 숫자예요.' },
        { type: 'choice', q: '이 달에는 일요일이 모두 몇 번 있나요?', visual: calHTML(y, m, { cls: 'sm', col: 0 }),
          opts: ['3번', '4번', '5번'], a: suns - 3, hint: '빨간색 ‘일’ 아래 숫자를 세어 보세요.' },
        { type: 'choice', q: '이 달은 며칠까지 있나요?', visual: calHTML(y, m, { cls: 'sm' }),
          opts: lastOpts.map(n => n + '일'), a: lastOpts.indexOf(L), hint: '달력에서 가장 큰 숫자를 찾아보세요.' },
        { type: 'cal', y, m, a: 17, mark: [10], q: '10일에서 일주일 뒤는 며칠인가요? 찾아 눌러 보세요.',
          p: '10일에서 일주일 뒤는 며칠인가요?', write: true, hint: '10일의 바로 아래 칸이에요.' },
        { type: 'cal', y, m, a: secondWed, q: '두 번째 수요일을 찾아 눌러 보세요.', p: '두 번째 수요일은 며칠인가요?', write: true,
          hint: '‘수’ 아래에서 위에서 두 번째 숫자예요.' },
      ];
    },
  },
];
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
  const base = { disableForReducedMotion: true, zIndex: 50 };
  if (!big) return confetti({ ...base, particleCount: 70, spread: 75, startVelocity: 38, origin: { y: 0.72 } });
  confetti({ ...base, particleCount: 120, spread: 90, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  confetti({ ...base, particleCount: 120, spread: 90, origin: { x: 0.8, y: 0.7 }, angle: 120 });
  setTimeout(() => confetti({ ...base, particleCount: 150, spread: 120, origin: { y: 0.5 } }), 350);
}

/* ───────── 화면 설정 (글자 · 비율) ───────── */
const $ = s => document.querySelector(s);
const main = $('#main');
function applySettings() {
  document.documentElement.style.setProperty('--scale', store.fs);
  $('#app').style.zoom = store.zoom;
  $('#fsVal').textContent = Math.round(store.fs * 100) + '%';
  $('#zmVal').textContent = Math.round(store.zoom * 100) + '%';
  const b = $('#sndBtn');
  b.textContent = store.sound ? '🔊 소리 켬' : '🔇 소리 끔';
  b.setAttribute('aria-pressed', store.sound);
  save();
}
function stepFs(dir) {
  let i = FS_STEPS.findIndex(v => Math.abs(v - store.fs) < 0.01); if (i < 0) i = 1;
  store.fs = FS_STEPS[Math.max(0, Math.min(FS_STEPS.length - 1, i + dir))]; applySettings();
}
function stepZoom(dir) {
  store.zoom = Math.max(ZM_MIN, Math.min(ZM_MAX, Math.round((store.zoom + dir * 0.1) * 10) / 10)); applySettings();
}

/* ───────── 화면 그리기 ───────── */
const session = {}; // 단원별 결과 { id: ['first' | 'retry', ...] }
const qCache = {};
function getQs(u) { const k = u.id + ':' + (u.id === 'cal' ? calOffset : 0); return qCache[k] || (qCache[k] = u.quiz()); }
let cur = null;
const go = h => { if (location.hash.slice(1) === h) route(); else location.hash = h; };
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const strip = html => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function renderHome() {
  cur = null;
  document.body.dataset.unit = '';
  main.innerHTML = `
  <section class="hero">
    <div class="hero-txt">
      <p class="eyebrow">차례대로 배워요</p>
      <h1>달력 배우기</h1>
      <p class="lead">하루, 한 달, 일주일, 1년을 배우고<br>달력 보는 법을 익혀요.</p>
    </div>
    <div class="todaycard" aria-label="오늘 날짜">
      <div class="tc-top">${Y}년 ${M}월</div>
      <div class="tc-day">${D}</div>
      <div class="tc-wd ${holOf(Y, M, D) ? 'sun' : wcls(W)}">${WD[W]}요일</div>
      ${holOf(Y, M, D) ? `<div class="tc-hol">${holOf(Y, M, D)}</div>` : ''}
      <div class="tc-cap">오늘</div>
    </div>
  </section>
  <ol class="units">
    ${UNITS.map(u => `
    <li><button type="button" class="ucard" data-unit="${u.id}" data-act="open" data-id="${u.id}">
      <span class="u-no">${u.no}</span>
      <span class="u-ico" aria-hidden="true">${u.icon}</span>
      <span class="u-txt"><b>${u.title}</b><small>${u.sub}</small></span>
      <span class="u-star${store.stars[u.id] ? ' got' : ''}" aria-label="${store.stars[u.id] ? '별 ' + store.stars[u.id] + '개' : '아직 안 했어요'}">${store.stars[u.id] ? starStr(store.stars[u.id]) : '시작 ›'}</span>
    </button></li>`).join('')}
  </ol>
  <p class="teacher">선생님께: 위쪽의 <b>글자 · 화면</b> 버튼으로 크기를 조절할 수 있습니다. <b>학습지 인쇄</b>를 누르면 A4 학습지가 만들어집니다.</p>`;
}

function shell(u, phase, i, n, inner) {
  document.body.dataset.unit = u.id;
  const dots = Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('');
  return `
  <div class="uhead">
    <button type="button" class="back" data-act="home">‹ 처음으로</button>
    <div class="utitle"><span class="u-no">${u.no}</span><span>${u.icon} ${u.title}</span></div>
    <div class="phase"><span class="${phase === 'learn' ? 'on' : ''}">배워요</span><span class="${phase === 'quiz' ? 'on' : ''}">풀어요</span></div>
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
    <div class="q-top"><span class="pill">배워요 ${i + 1} / ${cards.length}</span><button type="button" class="say" data-act="say">🔊 읽어 주기</button></div>
    <h2>${c.t}</h2>
    <p class="body">${c.b}</p>
    <div class="vis">${c.v || ''}</div>
  </article>
  <div class="nav">
    <button type="button" class="btn ghost" data-act="prev">‹ 이전</button>
    <button type="button" class="btn primary" data-act="next">${i === cards.length - 1 ? '문제 풀러 가기 ›' : '다음 ›'}</button>
  </div>`);
}

function renderQuiz(u, i) {
  const qs = getQs(u); i = Math.max(0, Math.min(qs.length - 1, i));
  const q = qs[i];
  cur = { u, phase: 'quiz', i, n: qs.length, q, wrongs: 0, solved: false, ord: 0 };
  let body = '';
  if (q.type === 'choice') {
    cur.say = `${q.q} ${q.opts.map((o, k) => `${k + 1}번, ${strip(o).replace(/[^\w가-힣\s,·~]/g, '')}`).join('. ')}`;
    body = `<div class="opts">${q.opts.map((o, k) => `<button type="button" class="opt" data-act="opt" data-i="${k}"><span class="num">${k + 1}</span><span>${o}</span></button>`).join('')}</div>`;
  } else if (q.type === 'cal') {
    cur.say = q.q;
    body = calHTML(q.y, q.m, { click: true, hi: q.mark || [], cls: 'play' });
  } else {
    cur.say = q.q;
    body = `<div class="slots">${q.items.map((_, k) => `<div class="slot" data-k="${k}"><small>${k + 1}</small><b></b></div>`).join('')}</div>
    <div class="pool">${q.mix.map(k => `<button type="button" class="opt ord" data-act="ord" data-k="${k}">${q.items[k]}</button>`).join('')}</div>`;
  }
  main.innerHTML = shell(u, 'quiz', i, qs.length, `
  <article class="card quiz">
    <div class="q-top"><span class="pill">문제 ${i + 1} / ${qs.length}</span><button type="button" class="say" data-act="say">🔊 읽어 주기</button></div>
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
  const qs = getQs(u), res = session[u.id] || [];
  const first = qs.filter((_, k) => res[k] === 'first').length;
  const ratio = first / qs.length;
  const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
  store.stars[u.id] = Math.max(store.stars[u.id] || 0, stars); save();
  const next = UNITS[u.no]; // 다음 단원
  cur = { u, phase: 'done' };
  document.body.dataset.unit = u.id;
  main.innerHTML = `
  <article class="card done">
    <div class="big-ico" aria-hidden="true">🎉</div>
    <h2>${u.title} 공부를 마쳤어요!</h2>
    <div class="stars" aria-label="별 ${stars}개">${starStr(stars)}</div>
    <p class="body">${qs.length}문제 중 <b>${first}문제</b>를 한 번에 맞혔어요.</p>
    <div class="done-btns">
      ${next ? `<button type="button" class="btn primary" data-act="open" data-id="${next.id}">다음: ${next.icon} ${next.title} ›</button>` : ''}
      ${u.id === 'cal' ? '<button type="button" class="btn primary" data-act="nextmonth">다음 달 달력으로 또 연습 ›</button>' : ''}
      <button type="button" class="btn ghost" data-act="retry">다시 풀기</button>
      <button type="button" class="btn ghost" data-act="print-open">🖨 이 단원 학습지 인쇄</button>
      <button type="button" class="btn ghost" data-act="home">처음으로</button>
    </div>
  </article>`;
  soundFanfare(); party(true);
  setTimeout(() => speak(`${u.title} 공부를 마쳤어요. 정말 잘했어요!`, 1), 1300);
}

function route() {
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ } }
  const [id, phase, idx] = location.hash.slice(1).split('/');
  const u = unitById(id);
  if (!u) renderHome();
  else if (phase === 'quiz') renderQuiz(u, +idx || 0);
  else if (phase === 'done') renderDone(u);
  else renderLearn(u, +idx || 0);
  window.scrollTo(0, 0);
}

/* ───────── 문제 채점 ───────── */
function feedback(ok, text) {
  const fb = $('#fb'); if (!fb) return;
  fb.className = 'fb show ' + (ok ? 'ok' : 'retry');
  fb.innerHTML = `<span class="fb-ico">${ok ? '⭕' : '💪'}</span><span>${text}</span>`;
}
function correct(el) {
  cur.solved = true;
  (session[cur.u.id] = session[cur.u.id] || [])[cur.i] = cur.wrongs === 0 ? 'first' : 'retry';
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

/* ───────── 인쇄용 학습지 ───────── */
function sheetHead(u, kind) {
  return `<header class="sh">
    <div class="sh-l"><span class="sh-no">${u.no}</span><div><small>${kind}</small><h1>${u.title}</h1></div></div>
    <div class="sh-r"><span>이름</span><i class="ln"></i><span>날짜</span><i class="ln s"></i><span>월</span><i class="ln s"></i><span>일</span></div>
  </header>`;
}
function sheetLearn(u) {
  const cards = u.learn();
  return `<section class="sheet" data-unit="${u.id}">${sheetHead(u, '배워요')}
    <div class="pl-grid n${cards.length}">${cards.map((c, i) => `
      <article class="pl"><h3><span>${i + 1}</span>${c.t}</h3><p>${c.b}</p><div class="vis">${c.v || ''}</div></article>`).join('')}
    </div>
    <p class="sh-foot">달력 배우기 · ${u.no}. ${u.title} · 소리 내어 읽어 보세요.</p></section>`;
}
function sheetQuiz(u) {
  const qs = getQs(u);
  const shared = u.sharedCal ? (() => { const [y, m] = u.ym ? u.ym() : [Y, M]; return `<div class="p-shared"><p>아래 달력을 보고 문제를 풀어 보세요.</p>${calHTML(y, m, { cls: 'big' })}</div>`; })() : '';
  const items = qs.map((q, i) => {
    let b = '';
    if (q.type === 'choice') {
      b = (q.visual && !u.sharedCal ? `<div class="vis">${q.visual}</div>` : '') +
        `<ul class="po">${q.opts.map((o, k) => `<li><span>${CIRC[k]}</span>${o}</li>`).join('')}</ul>`;
    } else if (q.type === 'cal') {
      b = (u.sharedCal ? '' : `<div class="vis">${calHTML(q.y, q.m, { cls: 'sm' })}</div>`) +
        (q.write ? '<p class="wr">답: <i class="ln s"></i> 일</p>' : '');
    } else {
      b = `<ul class="po ord">${q.mix.map(k => `<li><span class="bx"></span>${q.items[k]}</li>`).join('')}</ul>`;
    }
    return `<li class="pq"><p class="pq-q"><span class="pq-n">${i + 1}</span>${q.p || q.q}</p>${b}</li>`;
  }).join('');
  return `<section class="sheet" data-unit="${u.id}">${sheetHead(u, '풀어요')}${shared}
    <ol class="pq-grid">${items}</ol>
    <p class="sh-foot">달력 배우기 · ${u.no}. ${u.title} · 알맞은 답에 ○표 하세요.</p></section>`;
}
function answerOf(q) {
  if (q.type === 'choice') return `${CIRC[q.a]} ${strip(q.opts[q.a])}`;
  if (q.type === 'cal') return `${q.a}일`;
  return q.items.map(s => s[0]).join(' → ');
}
function sheetKey(units) {
  return `<section class="sheet key"><header class="sh"><div class="sh-l"><span class="sh-no">✓</span><div><small>교사용</small><h1>정답지</h1></div></div>
    <div class="sh-r"><span>기준일: ${Y}년 ${M}월 ${D}일</span></div></header>
    ${units.map(u => `<div class="kb"><h3>${u.no}. ${u.title}</h3><ol>${getQs(u).map(q => `<li>${answerOf(q)}</li>`).join('')}</ol></div>`).join('')}
    <p class="sh-foot">문제의 날짜는 학습지를 만든 날(기준일)에 맞추어 자동으로 바뀝니다.</p></section>`;
}
function buildPrint(o) {
  const root = $('#print-root');
  root.className = o.big ? 'big' : '';
  root.innerHTML = o.units.map(u => (o.learn ? sheetLearn(u) : '') + (o.quiz ? sheetQuiz(u) : '')).join('') + (o.key ? sheetKey(o.units) : '');
  if (!o.big) fitSheets();
}
/* 달(6주짜리 달, 공휴일 많은 달)에 따라 내용이 길어져도 A4 한 장에 들어가도록 조금 줄입니다. */
function fitSheets() {
  const root = $('#print-root'), html = document.documentElement;
  const pv = html.classList.contains('preview');
  const keepRoot = root.style.cssText, keepFs = html.style.getPropertyValue('font-size');
  if (!pv) { // 화면에서는 숨겨져 있으므로, 인쇄와 같은 조건(글자 11pt, 폭 182mm)으로 잠깐 펼쳐서 잰다
    html.style.setProperty('font-size', '11pt', 'important');
    root.style.cssText = 'display:block;position:absolute;left:-99999px;top:0;width:182mm';
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'height:266mm;width:1mm;position:absolute;visibility:hidden';
  root.appendChild(probe); const avail = probe.getBoundingClientRect().height; probe.remove();
  root.querySelectorAll('.sheet').forEach(sh => {
    const inner = document.createElement('div'); inner.className = 'sheet-in';
    while (sh.firstChild) inner.appendChild(sh.firstChild);
    sh.appendChild(inner);
    let z = 1;
    for (let k = 0; k < 8; k++) {
      const h = inner.getBoundingClientRect().height;
      if (h <= avail) break;
      z = Math.max(0.6, z * Math.min(0.98, avail / h)); inner.style.zoom = z;
    }
  });
  if (!pv) { root.style.cssText = keepRoot; keepFs ? html.style.setProperty('font-size', keepFs) : html.style.removeProperty('font-size'); }
}
function openPrint() {
  const here = cur && cur.u ? cur.u.id : null;
  $('#pdUnits').innerHTML = UNITS.map(u =>
    `<label class="ck"><input type="checkbox" name="pu" value="${u.id}" ${!here || here === u.id ? 'checked' : ''}> ${u.no}. ${u.title}</label>`).join('');
  $('#printDlg').showModal();
}
$('#printDlg').addEventListener('close', e => {
  if (e.target.returnValue !== 'print') return;
  const units = [...document.querySelectorAll('input[name=pu]:checked')].map(i => unitById(i.value));
  if (!units.length) return;
  buildPrint({ units, learn: $('#pdLearn').checked, quiz: $('#pdQuiz').checked, key: $('#pdKey').checked, big: $('#pdBig').checked });
  setTimeout(() => window.print(), 80);
});

/* ───────── 누르기 처리 ───────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'home': go(''); break;
    case 'open': audio(); go(el.dataset.id + '/learn/0'); break;
    case 'fs-': stepFs(-1); break;
    case 'fs+': stepFs(1); break;
    case 'zm-': stepZoom(-1); break;
    case 'zm+': stepZoom(1); break;
    case 'reset': store.fs = 1; store.zoom = 1; applySettings(); break;
    case 'sound':
      store.sound = !store.sound; applySettings();
      if (store.sound) soundPraise('소리를 켰어요'); else if ('speechSynthesis' in window) speechSynthesis.cancel();
      break;
    case 'print-open': openPrint(); break;
    case 'say': if (cur && cur.say) { audio(); speak(cur.say); } break;
    case 'prev':
      if (!cur) break;
      if (cur.phase === 'learn') cur.i === 0 ? go('') : go(`${cur.u.id}/learn/${cur.i - 1}`);
      else if (cur.phase === 'quiz') cur.i === 0 ? go(`${cur.u.id}/learn/${cur.u.learn().length - 1}`) : go(`${cur.u.id}/quiz/${cur.i - 1}`);
      break;
    case 'next':
      if (!cur) break;
      if (cur.phase === 'learn') cur.i === cur.n - 1 ? (session[cur.u.id] = [], go(`${cur.u.id}/quiz/0`)) : go(`${cur.u.id}/learn/${cur.i + 1}`);
      else if (cur.phase === 'quiz' && cur.solved) cur.i === cur.n - 1 ? go(`${cur.u.id}/done`) : go(`${cur.u.id}/quiz/${cur.i + 1}`);
      break;
    case 'retry': session[cur.u.id] = []; go(`${cur.u.id}/quiz/0`); break;
    case 'nextmonth': calOffset++; session.cal = []; go('cal/quiz/0'); break;
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
        feedback(false, `괜찮아요. ${cur.ord + 1}번째 요일을 찾아보세요.` + `<small>도움말: ${cur.q.hint}</small>`); soundRetry();
      }
      break;
    }
  }
});
window.addEventListener('hashchange', route);
const clearPrint = () => { $('#print-root').innerHTML = ''; };
window.addEventListener('afterprint', clearPrint);

applySettings();
route();
/* 주소 뒤에 ?sheet=all 을 붙이면 전체 학습지를 바로 준비합니다(&preview 화면 미리보기, &key 정답지, &big 큰 글씨). */
function rebuildPreview() {
  const ids = QS.get('sheet') === 'all' ? UNITS : (QS.get('sheet') || '').split(',').map(unitById).filter(Boolean);
  buildPrint({ units: ids, learn: true, quiz: true, key: QS.has('key'), big: QS.has('big') });
}
if (QS.has('sheet')) {
  rebuildPreview();
  if (QS.has('preview')) { document.documentElement.classList.add('preview'); window.removeEventListener('afterprint', clearPrint); }
}
loadHolidays();
})();
