/* 같이가게 화면. 데이터는 Flask 서버(/api)에 저장된다. */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");

const S = { store: null, aiLive: false, plans: {}, goals: {}, view: "welcome", sel: null, step: 0, edit: null,
  ob: null, tried: false, log: null, copyF: null, copyText: null, demoPick: false, mIdx: 0 };

/* ---------- 아이콘 ---------- */
const I = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l-8 8 8 8"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 4.5 7 4.5c2 0 3.6 1.1 5 2.8 1.4-1.7 3-2.8 5-2.8 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  cafe: '<svg viewBox="0 0 24 24" fill="none" stroke="#B8860B" stroke-width="2" stroke-linecap="round"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2.3"/><path d="M8 3.5c0 1 1 1.5 1 2.5M12 3.5c0 1 1 1.5 1 2.5"/></svg>',
  pc: '<svg viewBox="0 0 24 24" fill="none" stroke="#4263EB" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  hair: '<svg viewBox="0 0 24 24" fill="none" stroke="#D6336C" stroke-width="2" stroke-linecap="round"><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.5 16L18 4M15.5 16L6 4"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="#E8590C" stroke-width="2" stroke-linecap="round"><path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4"/></svg>',
  beer: '<svg viewBox="0 0 24 24" fill="none" stroke="#F08C00" stroke-width="2" stroke-linecap="round"><path d="M6 7h10v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7a3 3 0 0 1 5-3 3 3 0 0 1 5 3"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="none" stroke="#AE3EC9" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="9" r="2.5"/><path d="M12 6.5a3 3 0 1 1 3 2.5M12 6.5a3 3 0 1 0-3 2.5M9.5 9a3 3 0 1 0 2.5 3M14.5 9a3 3 0 1 1-2.5 3M12 12v9M12 17c2-2 4-2 5-2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="#868E96"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1z"/><path d="M15 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="#2F9E44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v10h16V10M3 10l2-6h14l2 6zM9 20v-5h6v5"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="#1C7ED6" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="#0CA678" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="#F59F00" stroke-width="2" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="#7048E8" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="#E03131" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8"/><path d="M20 3v5h-5"/></svg>',
};
const KINDS = [["카페", "cafe"], ["음식점", "food"], ["치킨·주점", "beer"], ["PC방", "pc"], ["미용실", "hair"], ["꽃집", "flower"], ["기타", "dots"]];
const KIND_IC = Object.fromEntries(KINDS);
const STRENGTHS = {
  "카페": ["직접 만든 디저트", "넓은 좌석", "콘센트 많은 자리", "조용한 분위기", "합리적인 가격"],
  "PC방": ["최신 사양 PC", "넓은 단체석", "깨끗한 시설", "다양한 먹거리", "24시간 영업"],
  "미용실": ["1:1 예약제", "꼼꼼한 상담", "합리적인 가격", "주차 가능"],
  "음식점": ["푸짐한 양", "직접 만든 반찬", "혼밥하기 편함", "단체석"],
  "치킨·주점": ["바삭한 튀김", "단체석", "늦게까지 영업", "배달 가능"],
  "꽃집": ["당일 제작", "맞춤 꽃다발", "배달 가능", "합리적인 가격"],
  "기타": ["친절한 응대", "합리적인 가격", "오래된 단골", "깨끗한 매장"],
};
const MANAGERS = [
  { id: "duri", name: "두리", soft: "#B6C5FD", ink: "#1A2A8C", cta: "#1A3FA5" },
  { id: "moa", name: "모아", soft: "#D2BEFF", ink: "#42187A", cta: "#42187A" },
  { id: "tori", name: "토리", soft: "#FFBE98", ink: "#802D00", cta: "#802D00" },
  { id: "tantan", name: "탄탄", soft: "#A0E39F", ink: "#22420E", cta: "#22420E" },
];
const MQUOTE = "“사장님! 어려운건 저와 같이 해봐요.”";
const josa = w => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? "이" : "가");
const mgr = id => MANAGERS.find(m => m.id === id) || MANAGERS[0];
const mImg = id => `/static/img/${mgr(id).id}.png`;
function applyTheme(id) {
  const m = mgr(id), r = document.documentElement.style;
  r.setProperty("--cta", m.cta); r.setProperty("--brand-soft", m.soft); r.setProperty("--brand-ink", m.ink);
}
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const NOTIFY = ["매주 월요일 오전", "매주 금요일 오후", "2주마다 월요일 오전"];
const REASONS = [["time", "시간이 부족했어요"], ["photo", "사진이 없었어요"], ["skip", "필요 없을 것 같았어요"], ["etc", "기타"]];
const REASON_TXT = Object.fromEntries(REASONS);

/* ---------- 서버 ---------- */
async function api(path, body, method) {
  const opt = body === undefined ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const r = await fetch(path, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return d;
}
function busy(t) {
  const b = document.getElementById("busy"); if (!t) { b.hidden = true; return; }
  const id = S.store?.profile?.manager || S.ob?.manager || "duri";
  b.querySelector(".busy-card").innerHTML = `<div class="busy-face"><img src="${mImg(id)}" alt=""></div><span class="spin"></span><p>${esc(mgr(id).name)}${josa(mgr(id).name)} ${esc(t)}</p>`;
  b.hidden = false;
}
let tt; function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2800); }
async function run(label, fn) { try { if (label) busy(label); await fn(); } catch (e) { toast(e.message); } finally { busy(); } }

async function boot() {
  MANAGERS.forEach(m => { const im = new Image(); im.src = mImg(m.id); });  // 캐릭터 이미지 미리 불러오기
  const sp = document.createElement("div"); sp.className = "splash"; sp.innerHTML = '<img src="/static/img/logo.png" alt="같이가게">'; document.body.appendChild(sp);
  setTimeout(() => { sp.classList.add("out"); setTimeout(() => sp.remove(), 400); }, 1100);
  try {
    const d = await api("/api/state");
    Object.assign(S, { store: d.store, aiLive: d.aiLive, plans: d.plans, goals: d.goals });
    S.view = d.store ? "home" : "welcome";
    render();
  } catch (e) { app.innerHTML = `<p class="loading-text">${esc(e.message)}</p>`; }
}

/* ---------- 상태 도우미 ---------- */
const P = () => S.store.profile;
const curWeek = () => S.store.weeks[S.store.weeks.length - 1];
function findRec(id) { for (const w of S.store.weeks) for (const r of w.recs) if (r.id === id) return { w, r }; return {}; }
const newOb = () => ({ name: "", kind: "", kind_etc: "", region: "", hours: "", closed: [], products: [{ name: "", price: "" }],
  strengths: [], goals: [], goal_text: "", notify: NOTIFY[0], manager: "" });

/* ---------- 질문 단계 ---------- */
const STEPS = [
  { k: "store", q: "사장님의 가게를\n알려주세요", ok: o => o.name.trim().length > 0, err: "가게 이름을 다시 확인해주세요",
    body: o => `<div class="form-gap"><div class="field ${S.tried && !o.name.trim() ? "err" : ""}"><label for="ob-name">가게 이름</label>
      <input class="pill-input" id="ob-name" data-ob="name" value="${esc(o.name)}" autocomplete="off" maxlength="30">
      ${S.tried && !o.name.trim() ? `<span class="err-text">가게 이름을 다시 확인해주세요</span>` : ""}</div>
      <div class="field"><label for="ob-region">가게 주소</label><input class="pill-input" id="ob-region" data-ob="region" value="${esc(o.region)}" placeholder="예) 경산시 대학로" autocomplete="off"></div></div>` },
  { k: "kind", q: "어떤 업종을 하고 계신가요?", ok: o => !!o.kind && (o.kind !== "기타" || o.kind_etc.trim()), err: "업종을 골라 주세요",
    body: o => `<div class="form-gap"><div class="field"><label for="ob-kind">업종</label>
      <select class="pill-input" id="ob-kind" data-ob="kind"><option value="" ${o.kind ? "" : "selected"} disabled hidden></option>
      ${KINDS.map(([k]) => `<option value="${k}" ${o.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
      ${o.kind === "기타" ? `<div class="field"><label for="ob-etc">어떤 가게인지 적어 주세요</label><input class="pill-input" id="ob-etc" data-ob="kind_etc" value="${esc(o.kind_etc)}" placeholder="예) 반찬가게, 공방"></div>` : ""}</div>` },
  { k: "manager", q: "당신과 함께할\n매니저를 골라주세요", ok: () => true, cta: "선택하기", hint: "추후 설정에서 매니저 변경 할 수 있어요",
    body: () => { const m = MANAGERS[S.mIdx];
      return `<div class="mgr"><div class="mgr-card" id="mgr-card">
        <div class="dots">${MANAGERS.map((x, i) => `<button data-mdot="${i}" aria-label="${x.name}" aria-current="${i === S.mIdx}"></button>`).join("")}</div>
        <div class="mgr-img"><img src="${mImg(m.id)}" alt="매니저 ${m.name}"></div>
        <div class="mgr-name">${m.name}</div><div class="mgr-quote">${MQUOTE}</div>
        <button class="mgr-nav prev" data-mnav="-1" aria-label="이전 매니저">${I.back}</button>
        <button class="mgr-nav next" data-mnav="1" aria-label="다음 매니저"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l8 8-8 8"/></svg></button>
      </div></div>`; } },
  { k: "hours", q: "영업시간을 알려주세요", ok: () => true,
    body: o => `<div class="field"><label for="ob-hours">영업시간</label><input class="pill-input" id="ob-hours" data-ob="hours" value="${esc(o.hours)}" placeholder="예) 10:00 ~ 22:00"></div>
      <div class="field"><span class="field-label">쉬는 날</span><div class="chips">${DAYS.map(d => `<button class="chip" data-closed="${d}" aria-pressed="${o.closed.includes(d)}">${d}</button>`).join("")}</div></div>` },
  { k: "products", q: "대표 상품과 가격을\n알려주세요", sub: "홍보할 때 가격을 정확하게 쓰기 위해서예요.", ok: o => o.products.some(p => p.name.trim()), err: "대표 상품을 하나 이상 적어 주세요",
    body: o => `${o.products.map((p, i) => `<div class="prod-row">
        <div class="field"><label for="pn${i}">상품·서비스</label><input class="pill-input" id="pn${i}" data-prod="name" data-i="${i}" value="${esc(p.name)}" placeholder="예) 딸기 라떼"></div>
        <div class="field"><label for="pp${i}">가격</label><input class="pill-input" id="pp${i}" data-prod="price" data-i="${i}" value="${esc(p.price)}" placeholder="5,500원"></div>
        ${o.products.length > 1 ? `<button class="del" data-delprod="${i}" aria-label="삭제">×</button>` : "<span></span>"}</div>`).join("")}
      ${o.products.length < 5 ? `<button class="add-row" id="add-prod">+ 상품 추가</button>` : ""}` },
  { k: "strengths", q: "우리 가게의 자랑은\n뭔가요?", sub: "여러 개 골라도 좋아요. 홍보 문구에 들어가요.", ok: () => true,
    body: o => { const list = [...new Set([...(STRENGTHS[o.kind] || STRENGTHS["기타"]), ...o.strengths])];
      return `<div class="chips">${list.map(x => `<button class="chip" data-str="${esc(x)}" aria-pressed="${o.strengths.includes(x)}">${esc(x)}</button>`).join("")}</div>
      <div class="field"><label for="ob-str">직접 적기</label><input class="pill-input" id="ob-str" placeholder="예) 창가 자리 햇살" maxlength="30"></div>
      <button class="add-row" id="add-str">+ 추가</button>`; } },
  { k: "goals", q: "이번에 가장 알리고 싶은 건\n뭔가요?", sub: "처음 고른 것을 가장 먼저 추천해요. 3개까지 고를 수 있어요.", ok: o => o.goals.length > 0, err: "하나 이상 골라 주세요",
    body: o => `<div class="choices">${Object.entries(S.goals).map(([k, v]) => { const i = o.goals.indexOf(k);
        return `<button class="choice" data-goal="${k}" aria-pressed="${i >= 0}"><span>${esc(v)}</span>${i === 0 ? '<span class="badge">가장 중요</span>' : i > 0 ? '<span class="badge">선택</span>' : ""}</button>`; }).join("")}</div>
      <div class="field"><label for="ob-goal">하고 싶은 말을 편하게 적어 주세요 (선택)</label>
      <textarea class="area" id="ob-goal" data-ob="goal_text" maxlength="80" placeholder="예) 새로 바꾼 좌석을 알리고 싶어요">${esc(o.goal_text)}</textarea></div>` },
  { k: "notify", q: "언제 알려드릴까요?", sub: "이 시간에 이번 주 할 일을 알려드려요.", ok: () => true,
    body: o => `<div class="choices">${NOTIFY.map(n => `<button class="choice" data-notify="${n}" aria-pressed="${o.notify === n}"><span>${n}</span></button>`).join("")}</div>` },
  { k: "confirm", q: "이렇게 등록할게요", sub: "나중에 둘러보기 → 가게 정보에서 바꿀 수 있어요.", ok: () => true,
    body: o => `<dl class="summary">
      <div><dt>가게 이름</dt><dd>${esc(o.name)}</dd></div>
      <div><dt>업종</dt><dd>${esc(o.kind === "기타" ? o.kind_etc || "기타" : o.kind)}</dd></div>
      <div><dt>위치</dt><dd>${esc(o.region || "입력 안 함")}</dd></div>
      <div><dt>영업시간</dt><dd>${esc(o.hours || "입력 안 함")}${o.closed.length ? ` · ${o.closed.join("·")} 휴무` : ""}</dd></div>
      <div><dt>대표 상품</dt><dd>${esc(o.products.filter(p => p.name).map(p => p.name + (p.price ? " " + p.price : "")).join(", "))}</dd></div>
      <div><dt>자랑</dt><dd>${esc(o.strengths.join(", ") || "입력 안 함")}</dd></div>
      <div><dt>알리고 싶은 것</dt><dd>${esc(o.goals.map(g => S.goals[g]).join(", "))}</dd></div>
      <div><dt>알림</dt><dd>${esc(o.notify)}</dd></div>
      <div><dt>매니저</dt><dd>${esc(mgr(o.manager).name)}</dd></div></dl>` },
];

/* ---------- 화면 ---------- */
const V = {
  welcome() {
    return `<section class="page"><div class="welcome">
      <img class="brand-logo" src="/static/img/logo.png" alt="같이가게">
      <h1>우리 가게 홍보,<br>이번 주엔 뭘 할지<br>알려드릴게요</h1>
      <p>가게 정보를 한 번만 알려주시면, 매주 우리 가게에 맞는 홍보와 문구를 준비해 드려요.</p>
      ${S.demoPick ? `<div class="tiles">${["PC방", "카페", "미용실"].map(k => `<button class="tile" data-demo="${k}">${I[KIND_IC[k]]}<span>${k}<small>예시 가게로 보기</small></span></button>`).join("")}</div>` : ""}
    </div><div class="bottom-cta"><button class="cta" id="start">시작하기</button>
      <button class="cta ghost sm" id="demo-pick">${S.demoPick ? "닫기" : "예시 가게로 둘러보기"}</button></div></section>`;
  },
  ob() {
    const st = STEPS[S.step], o = S.ob, editing = !!S.edit;
    const last = S.step === STEPS.length - 1;
    return `<section class="page"><div class="page-top">
      <button class="icon-btn round" id="ob-back" aria-label="뒤로">${I.back}</button><span></span></div>
      <div class="page-body"><h1 class="q">${esc(st.q)}</h1>${st.sub ? `<p class="q-sub">${esc(st.sub)}</p>` : ""}${st.body(o)}
      ${S.tried && !st.ok(o) && st.k !== "name" ? `<span class="err-text">${esc(st.err)}</span>` : ""}</div>
      <div class="bottom-cta">${st.hint ? `<p class="hint-line">${esc(st.hint)}</p>` : ""}<button class="cta" id="ob-next">${editing ? (st.cta || "저장하기") : st.cta || (last ? "추천 받기" : "다음")}</button></div></section>`;
  },
  home() {
    const s = S.store, p = s.profile, w = curWeek(), [top, ...rest] = w.recs;
    const pending = w.recs.filter(r => !r.log);
    const weeks = s.weeks.slice(-6);
    const doneAll = s.weeks.reduce((n, x) => n + x.recs.filter(r => r.log?.done).length, 0);
    return `<section class="screen">
    <div class="hero"><div><h1>요약</h1><p>${esc(w.label)} · ${esc(p.name)}</p></div><button class="avatar mgr" data-go="info" aria-label="가게 정보"><img src="${mImg(p.manager)}" alt=""></button></div>
    <div class="mgr-bubble"><div class="mgr-face"><img src="${mImg(p.manager)}" alt="매니저 ${mgr(p.manager).name}"></div>
      <div class="bubble"><b>${mgr(p.manager).name}</b> 사장님! 이번 주는 '${esc(top.title)}'부터 저와 같이 해봐요.</div></div>
    <article class="card"><div class="strip todo">이번 주 할 일 <span>${esc(w.label)}</span></div><div class="card-body">
      ${w.adjust ? `<div class="adjust"><b>기록 반영</b><span>${esc(w.adjust)}</span></div>` : ""}
      <div class="rec-main"><div class="rec-ic">${I.megaphone}</div><div>
        <div class="rec-title">${esc(top.title)}</div><div class="rec-desc">${esc(top.what)}</div>
        <div class="meta"><span>${esc(top.when)}</span><span>${esc(top.channel)}</span><span>${esc(top.effort)}</span>${top.needs_photo ? "<span>사진 필요</span>" : '<span class="ok">사진 없이 가능</span>'}</div>
      </div></div>
      <div class="btn-row"><button class="soft-btn" data-rec="${top.id}">자세히 보기</button><button class="soft-btn yellow" data-copy="${top.id}">홍보 문구 만들기</button></div>
    </div></article>
    ${rest.length ? `<article class="card"><div class="card-head">이어서 해 볼 홍보</div><div class="rows" style="margin-top:6px">
      ${rest.map(r => `<button class="row" data-rec="${r.id}"><span class="row-main"><strong>${esc(r.title)}</strong><span>${esc(r.when)} · ${esc(r.effort)}</span></span><span class="chev">›</span></button>`).join("")}</div></article>` : ""}
    <article class="card"><div class="strip log">실행 기록 <span>${pending.length ? `${pending.length}개 남음` : "이번 주 완료"}</span></div><div class="card-body">
      ${pending.length ? `<div class="rec-title" style="font-size:20px">이번 주 추천을 해 보셨나요?</div><div class="rec-desc">했는지, 못 했다면 왜 못 했는지만 알려주세요. 다음 주 추천이 달라져요.</div>
        <div class="btn-row"><button class="soft-btn" data-log="${pending[0].id}">'${esc(pending[0].title)}' 기록하기</button></div>`
        : `<div class="rec-desc">이번 주 기록을 모두 남기셨어요. 다음 주 추천에 반영돼요.</div><div class="btn-row"><button class="soft-btn" data-go="log">기록 보기</button></div>`}
    </div></article>
    <article class="card"><div class="card-head">지금까지 실행한 홍보 <span class="big-num">${doneAll}개</span></div><div class="card-body chart">
      <div class="bars">${weeks.map(x => { const n = x.recs.filter(r => r.log?.done).length; return `<div class="bar" title="${esc(x.label)} ${n}개"><i class="${n ? "" : "zero"}" style="height:${Math.max(6, n / 3 * 100)}%"></i></div>`; }).join("")}</div>
      <div class="bar-labels">${weeks.map(x => `<span>${x.week}주</span>`).join("")}</div></div></article>
    <article class="card"><div class="strip local">우리 동네 소식 <span>추천에 참고했어요</span></div><div class="card-body">
      ${w.ctx.map(c => `<div class="ctx"><strong>${esc(c.title)}</strong><p>${esc(c.detail)}</p><span class="src">출처: ${esc(c.source)} · 기준일 ${esc(c.date)}</span></div>`).join("")}</div></article>
    <p class="note">AI: ${S.aiLive ? "Claude 연결됨" : "예시 규칙으로 작동 중 (API 키를 넣으면 실제 AI)"}${s.demo ? " · 예시 가게로 보는 중" : ""}</p>
    </section>`;
  },
  rec() {
    const { r } = findRec(S.sel); if (!r) return V.home();
    const lab = { fact: "사실", context: "지역 정보", suggestion: "제안" };
    return `<section class="page"><div class="page-top"><button class="icon-btn" data-go="home" aria-label="뒤로">${I.back}</button><span></span><span style="width:48px"></span></div>
      <div class="page-body"><h1 class="detail-title">${esc(r.title)}</h1>
      <div class="meta">${r.needs_photo ? "<span>사진 필요</span>" : '<span class="ok">사진 없이 가능</span>'}<span>${esc(r.effort)}</span>${r.log ? `<span class="${r.log.done ? "ok" : ""}">${r.log.done ? "했어요" : "못 했어요"}</span>` : ""}</div>
      <dl class="kv-list"><div><dt>누구에게</dt><dd>${esc(r.target)}</dd></div><div><dt>무엇을</dt><dd>${esc(r.what)}</dd></div>
        <div><dt>언제</dt><dd>${esc(r.when)}</dd></div><div><dt>어디에</dt><dd>${esc(r.channel)}</dd></div><div><dt>왜</dt><dd>${esc(r.why)}</dd></div></dl>
      <details class="basis"><summary>추천 근거 펼쳐 보기</summary><ul>${(r.basis || []).map(b => `<li><span class="tag ${esc(b.type)}">${lab[b.type] || "참고"}</span><span>${esc(b.text)}</span></li>`).join("")}</ul></details>
      </div><div class="bottom-cta"><button class="cta" data-copy="${r.id}">홍보 문구 만들기</button><button class="cta ghost sm" data-log="${r.id}">${r.log ? "기록 고치기" : "기록 남기기"}</button></div></section>`;
  },
  copy() {
    const { w, r } = findRec(S.sel); if (!r) return V.home();
    const f = S.copyF, c = w.copies[r.id], plan = S.store.planInfo;
    const fld = (k, l, ph) => `<div class="field"><label for="cf-${k}">${l}</label><input class="mid-input" id="cf-${k}" data-cf="${k}" value="${esc(f[k])}" placeholder="${ph}"></div>`;
    return `<section class="page"><div class="page-top"><button class="icon-btn" data-rec="${r.id}" aria-label="뒤로">${I.back}</button><span></span><span style="width:48px"></span></div>
      <div class="page-body"><h1 class="q">${c ? "홍보 문구가\n준비됐어요" : "틀린 내용이 없는지\n확인해 주세요"}</h1>
      <p class="q-sub">${esc(r.title)} · ${esc(r.channel)}</p>
      ${c ? `<div class="result"><textarea id="cp-text" aria-label="홍보 문구">${esc(S.copyText ?? c.text)}</textarea>
          <div class="hashtags">${esc((c.hashtags || []).join(" "))}</div></div>
        <div class="btn-row"><button class="soft-btn yellow" id="cp-copy">문구 복사하기</button><a class="soft-btn" href="https://www.instagram.com/" target="_blank" rel="noopener" style="text-decoration:none">인스타그램 열기</a></div>
        <p class="note">${c.live ? "Claude가 만든 문구예요." : "예시 규칙으로 만든 문구예요."} 올리기 전에 한 번 더 읽어 보세요. 자동으로 올리지 않아요.</p>
        <details class="basis"><summary>들어간 내용 고치고 다시 만들기</summary><div style="display:flex;flex-direction:column;gap:18px;margin-top:14px">
          ${fld("name", "가게 이름", "")}${fld("product", "상품·서비스", "예) 딸기 라떼")}${fld("price", "가격", "예) 5,500원")}${fld("period", "기간", "예) 12월 한 달")}${fld("condition", "이용 조건", "예) 평일 오후 2~5시")}
          <button class="soft-btn" id="cp-make">다시 만들기</button></div></details>`
      : `${fld("name", "가게 이름", "")}${fld("product", "상품·서비스", "예) 딸기 라떼")}${fld("price", "가격", "예) 5,500원")}${fld("period", "기간 (선택)", "예) 12월 한 달")}${fld("condition", "이용 조건 (선택)", "예) 평일 오후 2~5시")}`}
      <div class="usage"><span class="note" style="padding:0">이번 달 문구 만들기 ${plan.used}/${plan.copies}회 사용 · ${esc(plan.name)} 플랜</span><div class="usage-bar"><i style="width:${Math.min(100, plan.used / plan.copies * 100)}%"></i></div></div>
      </div>${c ? `<div class="bottom-cta"><button class="cta" data-log="${r.id}">${r.log ? "기록 고치기" : "올렸어요, 기록하기"}</button></div>`
        : `<div class="bottom-cta"><button class="cta" id="cp-make">문구 만들기</button></div>`}</section>`;
  },
  logrec() {
    const { r } = findRec(S.sel); if (!r) return V.home();
    const L = S.log;
    const rf = (k, l, ph) => `<div class="field"><label for="lr-${k}">${l}</label><input class="mid-input" id="lr-${k}" data-react="${k}" value="${esc(L.reaction[k] || "")}" placeholder="${ph}" inputmode="numeric"></div>`;
    return `<section class="page"><div class="page-top"><button class="icon-btn" data-rec="${r.id}" aria-label="뒤로">${I.back}</button><span></span><span style="width:48px"></span></div>
      <div class="page-body"><h1 class="q">'${esc(r.title)}'\n해 보셨나요?</h1>
      <div class="tiles"><button class="tile" data-done="1" aria-pressed="${L.done === true}"><svg viewBox="0 0 24 24" fill="none" stroke="#0CA678" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>했어요</button>
        <button class="tile" data-done="0" aria-pressed="${L.done === false}"><svg viewBox="0 0 24 24" fill="none" stroke="#E03131" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>못 했어요</button></div>
      ${L.done === false ? `<div class="field"><span class="field-label">어떤 이유였나요?</span><div class="choices">${REASONS.map(([k, t]) => `<button class="choice" data-reason="${k}" aria-pressed="${L.reason === k}"><span>${t}</span></button>`).join("")}</div></div>` : ""}
      ${L.done === true ? `<div class="field"><span class="field-label">반응이 있었나요? 아는 만큼만 적어 주세요 (선택)</span></div>${rf("inquiries", "문의·예약 수", "예) 3")}${rf("likes", "좋아요·조회 수", "예) 120")}${rf("sales", "매출 메모", "예) 평소보다 조금 많았어요")}
        <p class="note" style="padding:0">매출이 달라져도 홍보만의 효과라고 단정하지 않아요. 다음 추천을 고르는 참고 자료로만 써요.</p>` : ""}
      </div><div class="bottom-cta"><button class="cta" id="lr-save" ${L.done === null || (L.done === false && !L.reason) ? "disabled" : ""}>기록하기</button></div></section>`;
  },
  log() {
    const s = S.store, w = curWeek(), anyLog = w.recs.some(r => r.log);
    const st = r => r.log ? (r.log.done ? '<span class="status done">했어요</span>' : `<span class="status miss">${esc(REASON_TXT[r.log.reason] || "못 했어요")}</span>`) : '<span class="status">기록 전</span>';
    return `<section class="screen"><div class="hero"><div><h1>기록</h1><p>기록할수록 우리 가게에 맞는 추천이 돼요</p></div></div>
      <article class="card"><div class="strip log">${esc(w.label)} <span>이번 주</span></div><div class="rows">
        ${w.recs.map(r => `<button class="row" data-log="${r.id}"><span class="row-main"><strong>${esc(r.title)}</strong><span>${esc(r.channel)} · ${esc(r.effort)}</span></span>${st(r)}</button>`).join("")}</div></article>
      <button class="cta" id="next-week" ${anyLog ? "" : "disabled"}>다음 주 추천 받기</button>
      <p class="note">시연용 버튼이에요. 일주일이 지난 것으로 보고, 남긴 기록을 반영해 다음 주 추천을 만들어요.${anyLog ? "" : " 먼저 하나 이상 기록을 남겨 주세요."}</p>
      ${s.weeks.length > 1 ? `<h2 class="section-title">지난 기록</h2>${s.weeks.slice(0, -1).reverse().map(x => `<article class="card"><div class="card-head">${esc(x.label)}</div>
        <div class="rows" style="margin-top:6px">${x.recs.map(r => `<div class="row"><span class="row-main"><strong>${esc(r.title)}</strong>${r.log?.reaction && Object.keys(r.log.reaction).length ? `<span>${esc(Object.entries(r.log.reaction).map(([k, v]) => ({ inquiries: "문의", likes: "반응", sales: "매출" }[k]) + " " + v).join(" · "))}</span>` : ""}</span>${st(r)}</div>`).join("")}</div></article>`).join("")}` : ""}
    </section>`;
  },
  explore() {
    const t = (go, ic, l) => `<button class="ex-tile" data-go="${go}">${I[ic]}<span>${l}</span></button>`;
    return `<section class="screen"><div class="hero"><div><h1>둘러보기</h1></div></div>
      <h2 class="section-title">우리 가게</h2>
      <div class="explore">${t("info", "store", "가게 정보")}${t("log", "history", "홍보 기록")}${t("region", "map", "우리 동네 소식")}${t("notify", "bell", "알림 설정")}<button class="ex-tile" data-edit="2"><span class="mgr-face" style="width:44px;height:44px"><img src="${mImg(P().manager)}" alt=""></span><span>매니저 바꾸기</span></button>${t("plan", "card", "플랜·사용량")}${t("reset", "restart", "처음부터 다시")}</div>
      <p class="note">같이가게는 홍보를 대신 올리지 않아요. 사장님이 확인하고 직접 올리도록 준비와 관리를 도와드려요.</p></section>`;
  },
  info() {
    const p = P();
    const row = (step, l, v) => `<button class="row" data-edit="${step}"><span class="row-main"><span>${l}</span><strong>${esc(v || "입력 안 함")}</strong></span><span class="chev">›</span></button>`;
    return `<section class="screen"><div class="hero"><div><h1>가게 정보</h1><p>바뀐 것만 눌러서 고치세요</p></div></div>
      <article class="card"><div class="rows">
        ${row(0, "가게 이름", p.name)}${row(0, "가게 주소", p.region)}${row(1, "업종", p.kind === "기타" ? p.kind_etc || "기타" : p.kind)}${row(2, "매니저", mgr(p.manager).name)}
        ${row(3, "영업시간", p.hours + (p.closed.length ? ` · ${p.closed.join("·")} 휴무` : ""))}
        ${row(4, "대표 상품", p.products.map(x => x.name + (x.price ? " " + x.price : "")).join(", "))}${row(5, "자랑", p.strengths.join(", "))}
        ${row(6, "알리고 싶은 것", p.goals.map(g => S.goals[g]).join(", "))}${row(7, "알림", p.notify)}</div></article>
      <button class="cta ghost" id="refresh">바뀐 정보로 이번 주 추천 다시 받기</button>
      <p class="note">이번 주에 이미 기록을 남겼다면 바뀐 정보는 다음 주 추천에 반영돼요.</p></section>`;
  },
  region() {
    const w = curWeek();
    return `<section class="screen"><div class="hero"><div><h1>우리 동네 소식</h1><p>${esc(P().region || "위치 정보 없음")}</p></div></div>
      <article class="card"><div class="strip local">${esc(w.label)} 참고 정보</div><div class="card-body">
      ${w.ctx.map(c => `<div class="ctx"><strong>${esc(c.title)}</strong><p>${esc(c.detail)}</p><span class="src">출처: ${esc(c.source)} · 기준일 ${esc(c.date)}</span></div>`).join("")}</div></article>
      <p class="note">지금은 시연용 예시 데이터예요. 실서비스에서는 공공데이터(상권 정보, 지역 행사 일정)를 연결하고, 출처와 기준일을 항상 함께 보여드려요.</p></section>`;
  },
  plan() {
    const cur = S.store.planInfo;
    return `<section class="screen"><div class="hero"><div><h1>플랜·사용량</h1><p>필요한 만큼만 쓰세요</p></div></div>
      <article class="card"><div class="strip plan">이번 달 사용량 <span>${esc(cur.name)} 플랜</span></div><div class="card-body usage">
        <div class="rec-title" style="font-size:20px">문구 만들기 ${cur.used} / ${cur.copies}회</div><div class="usage-bar"><i style="width:${Math.min(100, cur.used / cur.copies * 100)}%"></i></div></div></article>
      ${Object.entries(S.plans).map(([k, p]) => `<div class="plan ${k === cur.key ? "on" : ""}"><span class="example-tag">예시 가격 · 확정 전</span>
        <div class="plan-top"><span class="plan-name">${esc(p.name)}</span><span class="plan-price">${p.price.toLocaleString("ko-KR")}원<small> / 월</small></span></div>
        <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        ${k === cur.key ? '<span class="status done" style="align-self:flex-start">지금 쓰는 플랜</span>' : `<button class="soft-btn" data-plan="${k}">이 플랜으로 바꾸기</button>`}</div>`).join("")}
      <p class="note">결제는 연결되지 않은 시연 화면이에요. 한도를 넘으면 추가 사용 전에 차감 기준을 먼저 알려드리고 확인을 받아요.</p></section>`;
  },
  reset() {
    return `<section class="page"><div class="page-top"><button class="icon-btn" data-go="explore" aria-label="닫기">${I.close}</button><span></span><span style="width:48px"></span></div>
      <div class="page-body"><h1 class="q">처음부터 다시\n시작할까요?</h1><p class="q-sub">가게 정보와 지금까지의 추천·기록이 모두 지워져요.</p></div>
      <div class="bottom-cta"><button class="cta" id="reset-yes" style="background:var(--warn);color:#fff">모두 지우고 다시 시작</button><button class="cta ghost sm" data-go="explore">취소</button></div></section>`;
  },
};

const TABBED = { home: "home", log: "log", explore: "explore", info: "explore", region: "explore", plan: "explore" };
function render() {
  if (S.view === "notify") { startEdit(7); return; }
  const onMgr = S.view === "ob" && STEPS[S.step]?.k === "manager";
  applyTheme(onMgr ? MANAGERS[S.mIdx].id : S.view === "ob" ? S.ob?.manager : S.store?.profile?.manager);
  app.innerHTML = (V[S.view] || V.home)();
  const tab = TABBED[S.view];
  tabbar.hidden = !tab || !S.store;
  if (tab) tabbar.innerHTML = [["home", "요약", "heart"], ["log", "기록", "list"], ["explore", "둘러보기", "grid"]]
    .map(([v, l, ic]) => `<button data-go="${v}" ${tab === v ? 'aria-current="page"' : ""}>${I[ic]}${l}</button>`).join("");
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
  const card = document.getElementById("mgr-card");
  if (card) { let x0 = null;
    card.addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive: true });
    card.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) moveMgr(dx < 0 ? 1 : -1); }); }
}
function go(v) { syncOb(); S.view = v; S.tried = false; render(); window.scrollTo(0, 0); }
function moveMgr(d) { S.mIdx = (S.mIdx + d + MANAGERS.length) % MANAGERS.length; render(); }
function enterStep(i) { S.step = i; S.tried = false; if (STEPS[i].k === "manager") S.mIdx = Math.max(0, MANAGERS.findIndex(m => m.id === S.ob.manager)); render(); window.scrollTo(0, 0); }
function startEdit(step) {
  const p = JSON.parse(JSON.stringify(P()));
  if (!p.products.length) p.products = [{ name: "", price: "" }];
  S.ob = p; S.edit = step; S.view = "ob"; enterStep(step);
}
function syncOb() {
  if (S.view !== "ob" || !S.ob) return;
  app.querySelectorAll("[data-ob]").forEach(el => S.ob[el.dataset.ob] = el.value);
  app.querySelectorAll("[data-prod]").forEach(el => S.ob.products[+el.dataset.i][el.dataset.prod] = el.value);
}
function syncCopy() { app.querySelectorAll("[data-cf]").forEach(el => S.copyF[el.dataset.cf] = el.value); const t = document.getElementById("cp-text"); if (t) S.copyText = t.value; }
function syncLog() { app.querySelectorAll("[data-react]").forEach(el => S.log.reaction[el.dataset.react] = el.value); }
function openCopy(id) {
  const { w, r } = findRec(id), p = P(), c = w.copies[id];
  const prod = p.products[0] || { name: "", price: "" };
  S.copyF = c ? { ...c.fields } : { name: p.name, product: prod.name, price: prod.price, period: "", condition: "" };
  S.copyText = null; S.sel = id; go("copy");
}
function openLog(id) {
  const { r } = findRec(id);
  S.log = r.log ? { done: r.log.done, reason: r.log.reason, reaction: { ...(r.log.reaction || {}) } } : { done: null, reason: null, reaction: {} };
  S.sel = id; go("logrec");
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.go) { if (d.go === "notify") return startEdit(7); S.edit = null; return go(d.go); }
  if (d.rec) { S.sel = d.rec; return go("rec"); }
  if (d.copy) return openCopy(d.copy);
  if (d.log) return openLog(d.log);
  if (d.edit) return startEdit(+d.edit);
  if (d.demo) return run("예시 가게의 이번 주 홍보를 찾고 있어요", async () => { S.store = (await api("/api/demo", { kind: d.demo })).store; S.demoPick = false; go("home"); });
  if (d.plan) return run("", async () => { S.store = (await api("/api/plan", { plan: d.plan })).store; render(); toast(`${S.plans[d.plan].name} 플랜으로 바꿨어요.`); });
  // 질문 단계
  if (S.view === "ob") {
    syncOb(); const o = S.ob;
    if (d.mnav) return moveMgr(+d.mnav);
    if (d.mdot) { S.mIdx = +d.mdot; return render(); }
    if (d.closed) { o.closed = o.closed.includes(d.closed) ? o.closed.filter(x => x !== d.closed) : [...o.closed, d.closed]; return render(); }
    if (d.delprod) { o.products.splice(+d.delprod, 1); return render(); }
    if (d.str) { o.strengths = o.strengths.includes(d.str) ? o.strengths.filter(x => x !== d.str) : [...o.strengths, d.str].slice(0, 5); return render(); }
    if (d.goal) { o.goals = o.goals.includes(d.goal) ? o.goals.filter(x => x !== d.goal) : o.goals.length >= 3 ? (toast("3개까지 고를 수 있어요."), o.goals) : [...o.goals, d.goal]; return render(); }
    if (d.notify) { o.notify = d.notify; return render(); }
    if (b.id === "add-prod") { o.products.push({ name: "", price: "" }); render(); document.getElementById(`pn${o.products.length - 1}`)?.focus(); return; }
    if (b.id === "add-str") { const v = document.getElementById("ob-str").value.trim(); if (v && !o.strengths.includes(v)) o.strengths = [...o.strengths, v].slice(0, 5); return render(); }
    if (b.id === "ob-back") {
      if (S.edit !== null) { S.edit = null; return go("info"); }
      if (S.step === 0) return go(S.store ? "home" : "welcome");
      return enterStep(S.step - 1);
    }
    if (b.id === "ob-next") {
      const st = STEPS[S.step];
      if (st.k === "manager") o.manager = MANAGERS[S.mIdx].id;
      if (!st.ok(o)) { S.tried = true; return render(); }
      S.tried = false;
      if (S.edit !== null) return run("저장하고 있어요", async () => { S.store = (await api("/api/profile", o, "PUT")).store; S.edit = null; go("info"); toast("저장했어요."); });
      if (S.step < STEPS.length - 1) return enterStep(S.step + 1);
      return run("우리 가게에 맞는 홍보를\n찾고 있어요", async () => { S.store = (await api("/api/onboard", o)).store; S.ob = null; go("home"); });
    }
    return;
  }
  if (b.id === "start") { S.ob = newOb(); S.edit = null; S.view = "ob"; return enterStep(0); }
  if (b.id === "demo-pick") { S.demoPick = !S.demoPick; return render(); }
  if (b.id === "cp-make") { syncCopy(); return run("홍보 문구를 쓰고 있어요", async () => { const r = await api("/api/copy", { rec: S.sel, fields: S.copyF }); S.store = r.store; S.copyText = null; render(); }); }
  if (b.id === "cp-copy") {
    syncCopy(); const { w } = findRec(S.sel); const c = w.copies[S.sel];
    const text = (S.copyText ?? c.text) + "\n\n" + (c.hashtags || []).join(" ");
    navigator.clipboard?.writeText(text).then(() => toast("복사했어요. 인스타그램에 붙여 넣으세요."), () => { document.getElementById("cp-text").select(); toast("문구를 길게 눌러 복사해 주세요."); });
    return;
  }
  if (S.view === "logrec") {
    syncLog();
    if (d.done !== undefined) { S.log.done = d.done === "1"; if (S.log.done) S.log.reason = null; return render(); }
    if (d.reason) { S.log.reason = d.reason; return render(); }
    if (b.id === "lr-save") return run("", async () => { S.store = (await api("/api/log", { rec: S.sel, ...S.log })).store; go("log"); toast("기록했어요. 다음 주 추천에 반영돼요."); });
  }
  if (b.id === "next-week") return run("기록을 보고\n다음 주 홍보를 고르고 있어요", async () => { S.store = (await api("/api/next-week", {})).store; go("home"); });
  if (b.id === "refresh") return run("바뀐 정보로 추천을\n다시 찾고 있어요", async () => { S.store = (await api("/api/refresh", {})).store; go("home"); });
  if (b.id === "reset-yes") return run("", async () => { await api("/api/reset", {}); S.store = null; go("welcome"); });
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && S.view === "ob" && e.target.tagName === "INPUT") {
    e.preventDefault();
    if (e.target.id === "ob-str") return document.getElementById("add-str")?.click();
    document.getElementById("ob-next")?.click();
  }
});
document.addEventListener("change", e => {
  if (e.target.id === "ob-kind" && S.view === "ob") { syncOb(); if (S.ob.kind !== "기타") S.ob.kind_etc = ""; render(); }
});
document.addEventListener("input", e => { if (S.view === "ob" && S.tried && e.target.dataset.ob === "name") { syncOb(); } });

boot();
