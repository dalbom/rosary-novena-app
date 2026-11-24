'use strict';
const TOTAL = 54, HALF = 27, KEY = 'novena.v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 날짜 ----------
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diff = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmt = (s) => { const d = parse(s); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };

// ---------- 저장 ----------
let data = { intentions: [], texts: {}, session: null };
try { const raw = localStorage.getItem(KEY); if (raw) data = Object.assign(data, JSON.parse(raw)); } catch (e) { /* 저장소 사용 불가 시 메모리로만 동작 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('저장하지 못했습니다'); } };
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

let ui = { tab: 'list', detail: null, sub: null, flash: null };

// ---------- 지향 계산 ----------
const findI = (id) => data.intentions.find((x) => x.id === id);
const endOf = (it) => addDays(it.start, TOTAL - 1);
const dayNo = (it, date) => diff(it.start, date) + 1; // 1..54
const doneCount = (it) => Object.keys(it.done || {}).filter((d) => { const n = dayNo(it, d); return n >= 1 && n <= TOTAL; }).length;
const isActiveToday = (it) => { const n = dayNo(it, today()); return n >= 1 && n <= TOTAL; };
function dayInfo(n) {
  const mystery = MYSTERIES[(n - 1) % MYSTERIES.length];
  const phase = n <= HALF ? PHASES[0] : PHASES[1];
  return { mystery, phase, phaseDay: n <= HALF ? n : n - HALF };
}
const textOf = (k) => (data.texts[k] != null ? data.texts[k] : (PRAYERS[k] ? PRAYERS[k].text : ''));

// ---------- 기도 순서 (사용자 제공 기도문 파일의 구성) ----------
function buildSteps(n) {
  const { mystery: m, phase: p } = dayInfo(n);
  const S = [];
  const fixed = (k, extra) => S.push(Object.assign({ key: k, title: PRAYERS[k].title }, extra));
  fixed('sign', { kicker: '시작 기도' });
  fixed('hail', { kicker: '시작 기도' });
  fixed(p.id, { kicker: m.name });
  fixed('creed', { bead: 0 });
  fixed('our', { bead: 1 });
  for (let i = 0; i < 3; i++) fixed('hail', { bead: 2 + i, count: [i + 1, 3] });
  fixed('glory', { bead: 4 });
  fixed('fatima', { bead: 4 });
  for (let d = 0; d < 5; d++) {
    const base = 5 + d * 11, kicker = `${m.name} ${d + 1}단`;
    S.push({ title: `${d + 1}단`, text: m.items[d], bead: base, kicker: m.name, mystery: true });
    fixed('our', { bead: base, kicker });
    for (let i = 0; i < 10; i++) fixed('hail', { bead: base + 1 + i, count: [i + 1, 10], kicker });
    fixed('glory', { bead: base + 10, kicker });
    fixed('fatima', { bead: base + 10, kicker });
    S.push({ title: '꽃다발 봉헌', text: m.bouquet[d], bead: base + 10, kicker });
  }
  fixed('communion', { kicker: '마침' });
  fixed(p.id === 'petition' ? 'commPet' : 'commThx', { kicker: '마침' });
  fixed('salve', { kicker: '마침' });
  fixed('salvePray', { kicker: '마침' });
  fixed('sign', { kicker: '마침' });
  return S;
}

// 일자형 5단 묵주 (십자가 → 1 → 3 → [1+10]×5)
const BEADS = (() => {
  const arr = [{ t: 'x', y: 15 }];
  let y = 30;
  const add = (t) => { y += t === 'L' ? 15 : 10.5; arr.push({ t, y }); if (t === 'L') y += 4; };
  add('L'); add('s'); add('s'); add('s');
  for (let d = 0; d < 5; d++) { y += 5; add('L'); for (let i = 0; i < 10; i++) add('s'); }
  return { arr, h: y + 10 };
})();
function beadsSvg(cur) {
  let s = `<svg viewBox="0 0 30 ${BEADS.h}" preserveAspectRatio="xMidYMid meet"><line x1="15" y1="26" x2="15" y2="${BEADS.h - 10}" stroke="rgba(255,244,225,.2)" stroke-width="1"/>`;
  BEADS.arr.forEach((b, i) => {
    const on = i < cur, now = i === cur;
    // 지난 알: 신비 색 / 지금 알: 밝은 상아색 + 얇은 테 / 남은 알: 어두운 빈 알
    const fill = now ? '#f1e9da' : on ? 'var(--accent)' : '#2b2622';
    if (b.t === 'x') s += `<path d="M15 3v24M8 10h14" stroke="${now || on ? fill : 'rgba(255,244,225,.3)'}" stroke-width="${now ? 3.6 : 3}" stroke-linecap="round"/>`;
    else {
      const r = (b.t === 'L' ? 5.6 : 3.4) + (now ? 1.2 : 0);
      if (now) s += `<circle cx="15" cy="${b.y}" r="${r + 2.6}" fill="var(--bg)" stroke="var(--accent)" stroke-width="1"/>`;
      s += `<circle cx="15" cy="${b.y}" r="${r}" fill="${fill}"${on ? ' fill-opacity=".8"' : ''} stroke="${now || on ? 'none' : 'rgba(255,244,225,.28)'}" stroke-width=".7"/>`;
    }
  });
  return s + '</svg>';
}

// ---------- 공통 UI ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
function closeModal() { $('#modal').innerHTML = ''; }
function modal(html) { $('#modal').innerHTML = `<div class="sheet glass">${html}</div>`; return $('#modal .sheet'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
function setAccent(c) { document.documentElement.style.setProperty('--accent', c || '#c2a878'); }

function render() {
  const v = $('#view');
  v.className = '';
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  if (ui.tab === 'pray') return renderPray(v);
  setAccent();
  if (ui.sub === 'settings') return renderSettings(v);
  if (ui.detail && findI(ui.detail)) return renderDetail(v, findI(ui.detail));
  renderList(v);
}
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  if (b.dataset.tab === ui.tab && ui.tab === 'list') { ui.detail = null; ui.sub = null; }
  ui.tab = b.dataset.tab; render();
});

// ---------- 지향 목록 ----------
function renderList(v) {
  const t = today();
  let h = `<div class="head"><h1>지향 목록</h1><div class="acts">
    <button class="iconbtn glass" id="bSet" aria-label="설정"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></button>
    <button class="iconbtn glass" id="bAdd" aria-label="지향 추가"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div></div>`;
  if (!data.intentions.length) {
    h += `<div class="glass empty"><span class="big">✝</span>아직 지향이 없습니다.<br>54일 동안 바칠 기도의 지향을 추가하세요.<br><button class="pill primary glass" id="bAdd2">지향 추가</button></div>`;
  }
  for (const it of data.intentions) {
    const n = dayNo(it, t), dc = doneCount(it);
    let st = n < 1 ? `${-n + 1}일 뒤 시작` : n > TOTAL ? '기간 종료' : `${n}일째 · ${dayInfo(n).phase.name}`;
    const badge = dc >= TOTAL ? '<span class="badge">완료</span>' : (n >= 1 && n <= TOTAL && it.done && it.done[t]) ? '<span class="badge">오늘 ✓</span>' : '';
    h += `<button class="card glass" data-id="${it.id}"><h3>${esc(it.title)}${badge}</h3>
      <div class="meta"><span>${fmt(it.start)} 시작 · ${st}</span><span>${dc} / ${TOTAL}</span></div>
      <div class="bar"><b style="width:${(dc / TOTAL) * 100}%"></b></div></button>`;
  }
  v.innerHTML = h;
  v.onclick = (e) => {
    if (e.target.closest('#bAdd, #bAdd2')) return addIntention();
    if (e.target.closest('#bSet')) { ui.sub = 'settings'; return render(); }
    const c = e.target.closest('.card'); if (c) { ui.detail = c.dataset.id; render(); v.scrollTop = 0; }
  };
}

function addIntention() {
  const s = modal(`<h3>새 지향</h3>
    <label>지향</label><input id="fTitle" placeholder="예) 가족의 건강을 위하여" maxlength="80">
    <label>시작일</label><input id="fStart" type="date" value="${today()}">
    <p class="note">시작일부터 54일(청원 27일 + 감사 27일) 동안 바칩니다.</p>
    <div class="row"><button class="pill glass" id="fCancel">취소</button><button class="pill primary glass" id="fOk">추가</button></div>`);
  $('#fCancel', s).onclick = closeModal;
  $('#fOk', s).onclick = () => {
    const title = $('#fTitle', s).value.trim(), start = $('#fStart', s).value;
    if (!title) return toast('지향을 입력하세요');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return toast('시작일을 선택하세요');
    const it = { id: Date.now().toString(36), title, start, done: {} };
    data.intentions.unshift(it); save(); closeModal(); ui.detail = it.id; render();
  };
}

// ---------- 달력 ----------
function renderDetail(v, it) {
  const t = today(), end = endOf(it), dc = doneCount(it);
  let h = `<button class="back glass" id="bBack"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>목록</button>
    <h1 style="margin-top:14px">${esc(it.title)}</h1>
    <div class="glass card" style="pointer-events:none"><div class="meta"><span>${fmt(it.start)} ~ ${fmt(end)}</span><span>${dc} / ${TOTAL}</span></div><div class="bar"><b style="width:${(dc / TOTAL) * 100}%"></b></div></div>
    <div class="legend"><span><i style="background:var(--green)"></i>기도함</span><span><i style="background:var(--red)"></i>빠짐</span><span><i style="background:var(--grey)"></i>오늘·예정</span><span>✝ 마지막 날</span></div>`;
  const first = parse(it.start), last = parse(end);
  for (let y = first.getFullYear(), m = first.getMonth(); y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth()); m === 11 ? (y++, m = 0) : m++) {
    h += `<div class="glass month"><h4>${y}년 ${m + 1}월</h4><div class="grid">${'일월화수목금토'.split('').map((d) => `<div class="dow">${d}</div>`).join('')}`;
    const lead = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    h += '<div></div>'.repeat(lead);
    for (let d = 1; d <= dim; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`, n = dayNo(it, ds);
      if (n < 1 || n > TOTAL) { h += `<div class="day out">${d}</div>`; continue; }
      const done = it.done && it.done[ds];
      const cls = done ? 'done' : ds < t ? 'miss' : 'wait';
      const mark = n === TOTAL ? '<span class="cross">✝</span>' : '<span class="lamp"></span>';
      h += `<button class="day ${cls}${ds === t ? ' today' : ''}${ui.flash === ds ? ' flash' : ''}" data-d="${ds}">${d}${mark}</button>`;
    }
    h += '</div></div>';
  }
  h += `<div style="text-align:center"><button class="pill danger" id="bDel">이 지향 삭제</button></div>`;
  v.innerHTML = h;
  if (ui.flash) { const f = $('.flash', v); if (f) f.scrollIntoView({ block: 'center' }); ui.flash = null; }
  v.onclick = (e) => {
    if (e.target.closest('#bBack')) { ui.detail = null; return render(); }
    if (e.target.closest('#bDel')) {
      if (confirm(`"${it.title}" 지향과 기도 기록을 삭제할까요?`)) {
        data.intentions = data.intentions.filter((x) => x.id !== it.id);
        if (data.session && data.session.iid === it.id) data.session = null;
        save(); ui.detail = null; render();
      }
      return;
    }
    const b = e.target.closest('.day[data-d]'); if (!b) return;
    const ds = b.dataset.d;
    if (b.classList.contains('done')) return toast('이미 기도를 바친 날입니다');
    if (ds > t) return toast('아직 오지 않은 날입니다');
    startPrayer(it.id, ds);
  };
}

// ---------- 기도하기 ----------
function startPrayer(iid, date) {
  const s = data.session;
  if (!s || s.iid !== iid || s.date !== date) data.session = { iid, date, step: 0 };
  save(); ui.tab = 'pray'; render();
}
function renderPray(v) {
  let s = data.session;
  if (s && (!findI(s.iid) || (findI(s.iid).done || {})[s.date])) { s = data.session = null; save(); }
  if (s) return renderSession(v, s);
  setAccent();
  const t = today(), act = data.intentions.filter(isActiveToday);
  const todo = act.filter((it) => !(it.done && it.done[t]));
  if (todo.length === 1 && act.length === 1) return startPrayer(todo[0].id, t);
  let h = '<h1>기도하기</h1>';
  if (!act.length) {
    h += `<div class="glass empty"><span class="big">✝</span>${data.intentions.length ? '오늘 바칠 기도가 없습니다.' : '먼저 지향 목록에서 지향을 추가하세요.'}<br><button class="pill primary glass" data-go="list">지향 목록으로</button></div>`;
  } else if (!todo.length) {
    h += `<div class="glass empty"><span class="big" style="color:var(--green)">✓</span>오늘의 기도는 마쳤습니다.<br>내일 다시 만나요.<br><button class="pill primary glass" data-go="cal" data-id="${act[0].id}">달력 보기</button></div>`;
  } else {
    h += '<p class="note" style="margin:0 6px 14px">오늘 바칠 지향을 선택하세요.</p>';
    for (const it of act) {
      const n = dayNo(it, t), di = dayInfo(n), done = it.done && it.done[t];
      h += `<button class="card glass" data-id="${it.id}" ${done ? 'data-done="1" style="opacity:.6"' : ''}><h3>${esc(it.title)}${done ? '<span class="badge">오늘 ✓</span>' : ''}</h3>
        <div class="meta"><span>${di.phase.name} ${di.phaseDay}일째 · ${di.mystery.name}</span><span>${n} / ${TOTAL}</span></div></button>`;
    }
  }
  v.innerHTML = h;
  v.onclick = (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { ui.tab = 'list'; ui.detail = g.dataset.id || null; ui.sub = null; return render(); }
    const c = e.target.closest('.card'); if (!c) return;
    if (c.dataset.done) return toast('오늘의 기도는 마쳤습니다');
    startPrayer(c.dataset.id, t);
  };
}

function renderSession(v, s) {
  const it = findI(s.iid), n = dayNo(it, s.date), di = dayInfo(n), steps = buildSteps(n);
  s.step = Math.max(0, Math.min(s.step, steps.length - 1));
  const st = steps[s.step];
  setAccent(di.mystery.color);
  v.className = 'pray';
  const firstBead = steps.findIndex((x) => x.bead != null);
  let lastBead = 0; steps.forEach((x, i) => { if (x.bead != null) lastBead = i; });
  const showBeads = s.step >= firstBead && s.step <= lastBead;
  const raw = (st.key ? textOf(st.key) : st.text).replace('{ROSE}', di.mystery.rose);
  const body = `<p class="${st.mystery ? 'mys' : ''}">${raw.split('\n').map((l) => /^\(.*\)$/.test(l.trim()) ? `<span class="paren">${esc(l)}</span>` : esc(l)).join('\n')}</p>`;
  let dots = '';
  if (st.count) { dots = '<div class="dots">'; for (let i = 1; i <= st.count[1]; i++) dots += `<i class="${i < st.count[0] ? 'on' : i === st.count[0] ? 'cur' : ''}"></i>`; dots += '</div>'; }
  const back = s.date !== today() ? ` · ${fmt(s.date)} 보충` : '';
  v.innerHTML = `<div class="pcard glass" id="pcard">
    <div class="ptop"><div><div class="t">${esc(it.title)}</div><div class="s">${di.phase.name} ${di.phaseDay}일째 (${n}/${TOTAL}) · ${di.mystery.name}${back}</div></div>
      <button class="iconbtn" id="pClose" aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="pprog"><b style="width:${((s.step + 1) / steps.length) * 100}%"></b></div>
    <div class="pbody"><div class="ptext"><div class="inner">
      <div class="kicker">${esc(st.kicker || di.mystery.name)}</div>
      <h2>${esc(st.title)}${st.count ? `<small>${st.count[0]} / ${st.count[1]}</small>` : ''}</h2>${dots}${body}
    </div></div>${showBeads ? `<div class="beads">${beadsSvg(st.bead != null ? st.bead : -1)}</div>` : ''}</div>
    <div class="phint"><span>‹ 이전</span><span>${s.step === steps.length - 1 ? '터치하여 마침 ✓' : '다음 ›'}</span></div></div>`;
  v.onclick = (e) => {
    if (e.target.closest('#pClose')) { data.session = null; save(); ui.tab = 'list'; ui.detail = it.id; return render(); }
    if (!e.target.closest('#pcard')) return;
    if (e.clientX < window.innerWidth * 0.3) { if (s.step > 0) { s.step--; save(); render(); } return; }
    if (s.step < steps.length - 1) { s.step++; save(); return render(); }
    it.done = it.done || {}; it.done[s.date] = true; data.session = null; save();
    ui.tab = 'list'; ui.detail = it.id; ui.sub = null; ui.flash = s.date; render();
    toast(doneCount(it) >= TOTAL ? '54일 기도를 모두 마쳤습니다 ✝' : '기도를 마쳤습니다');
  };
}

// ---------- 설정 / 기도문 편집 / 백업 ----------
function editText(key, label) {
  const isFixed = true;
  const s = modal(`<h3>${esc(label)}</h3><textarea id="fTxt" placeholder="기도문을 입력하거나 붙여 넣으세요">${esc(isFixed ? textOf(key) : (data.texts[key] || ''))}</textarea>
    <div class="row">${isFixed ? '<button class="pill glass" id="fReset">기본값</button>' : ''}<button class="pill glass" id="fCancel">취소</button><button class="pill primary glass" id="fOk">저장</button></div>`);
  $('#fCancel', s).onclick = closeModal;
  if (isFixed) $('#fReset', s).onclick = () => { delete data.texts[key]; save(); closeModal(); render(); };
  $('#fOk', s).onclick = () => {
    const val = $('#fTxt', s).value.replace(/\s+$/, '');
    if (!val || (isFixed && val === PRAYERS[key].text)) delete data.texts[key]; else data.texts[key] = val;
    save(); closeModal(); render();
  };
}
function renderSettings(v) {
  let h = `<button class="back glass" id="bBack"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>목록</button>
    <h1 style="margin-top:14px">설정</h1>
    <div class="sect">백업</div>
    <button class="item glass" id="bExp">기록 내보내기<em>파일로 저장</em></button>
    <button class="item glass" id="bImp">기록 가져오기<em>백업 파일 선택</em></button>
    <input type="file" id="fImp" accept="application/json,.json" hidden>
    <p class="note">기록은 이 아이폰 안에만 저장됩니다. 가끔 내보내서 파일 앱이나 iCloud에 보관하세요.</p>
    <div class="sect">기도문</div>`;
  for (const k of Object.keys(PRAYERS)) {
    h += `<button class="item glass" data-k="${k}" data-l="${esc(PRAYERS[k].title)}">${esc(PRAYERS[k].title)}${data.texts[k] != null ? '<em class="ok">수정됨</em>' : ''}</button>`;
  }
  h += '<p class="note">기도문은 제공된 9일기도 기도문 파일 그대로입니다. 고쳐도 「기본값」으로 되돌릴 수 있습니다. 청원·감사 기도의 {ROSE} 자리에는 그날 신비의 장미 문구가 들어갑니다.</p>';
  v.innerHTML = h;
  v.onclick = (e) => {
    if (e.target.closest('#bBack')) { ui.sub = null; return render(); }
    if (e.target.closest('#bExp')) return exportData();
    if (e.target.closest('#bImp')) return $('#fImp').click();
    const b = e.target.closest('[data-k]'); if (b) editText(b.dataset.k, b.dataset.l);
  };
  $('#fImp').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((txt) => {
      const d = JSON.parse(txt);
      if (!d || !Array.isArray(d.intentions)) throw new Error('format');
      if (!confirm(`백업의 지향 ${d.intentions.length}개로 현재 기록을 바꿀까요?`)) return;
      data = { intentions: d.intentions, texts: d.texts || {}, session: null }; save(); ui.sub = null; render(); toast('가져왔습니다');
    }).catch(() => toast('백업 파일을 읽지 못했습니다'));
  };
}
async function exportData() {
  const name = `novena-backup-${today()}.json`;
  const json = JSON.stringify({ intentions: data.intentions, texts: data.texts, exported: new Date().toISOString() }, null, 2);
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// 자정이 지나거나 앱으로 돌아오면 다시 그림
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#modal').innerHTML) render(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
