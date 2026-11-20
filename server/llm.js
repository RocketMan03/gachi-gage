// LLM 호출 계층: Gemini(기본, 무료 티어) / Groq(대안, 무료 티어) / mock(데모 모드)
// - 게시물 문구: 참고 사진을 Gemini가 직접 보고 작성 (Groq은 글만)
// - AI 이미지: Gemini 이미지 모델 (무료 키에서는 막혀 있을 수 있음 → 화면에서 안내)

const { buildPostPrompt, buildIdeasPrompt, buildFeedbackPrompt, buildPostFeedbackPrompt } = require('./prompts');
const { mockPost, mockIdeas, mockFeedback, mockPostFeedback } = require('./mock');

function providerName() {
  const p = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (p !== 'auto') return p;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'mock';
}

function modelName() {
  const p = providerName();
  if (p === 'gemini') return configuredModel('text');
  if (p === 'groq') return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return 'rule-based-demo';
}

const GEMINI_BASE = () => process.env.GEMINI_HOST || 'https://generativelanguage.googleapis.com';

// ---------- 모델 자동 선택 ----------
// Google이 예전 모델을 새 사용자에게 막는 경우가 있어서(404), 설정한 모델이 안 되면
// 이 키로 쓸 수 있는 모델 목록을 조회해 가장 최신 flash 모델로 자동 전환한다.
const resolved = { text: null, image: null };
let modelListCache = null;

async function listModels() {
  if (modelListCache) return modelListCache;
  const all = [];
  let pageToken = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${GEMINI_BASE()}/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });
    if (!res.ok) throw new Error(`모델 목록 조회 실패 (HTTP ${res.status})`);
    const d = await res.json();
    all.push(...(d.models || []));
    if (!d.nextPageToken) break;
    pageToken = d.nextPageToken;
  }
  modelListCache = all
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  return modelListCache;
}

const versionOf = (name) => (name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0';
function rankModels(names, kind) {
  const isImage = (n) => /image/.test(n);
  const bad = /(tts|live|audio|embedding|thinking|computer|robotics|nano|gemma|learnlm|aqa)/;
  let cands = names.filter((n) => /^gemini-/.test(n) && /flash/.test(n) && (kind === 'image' ? isImage(n) : !isImage(n) && !bad.test(n)));
  if (!cands.length && kind === 'text') cands = names.filter((n) => /^gemini-/.test(n) && !isImage(n) && !/(tts|live|audio|embedding)/.test(n));
  // 정식 > 미리보기, lite는 뒤로, 높은 버전 우선
  const score = (n) => (/preview|exp/.test(n) ? 2 : 0) + (/lite/.test(n) ? 1 : 0);
  return cands.sort((a, b) => {
    if (score(a) !== score(b)) return score(a) - score(b);
    const [a1, a2 = 0] = versionOf(a).split('.').map(Number);
    const [b1, b2 = 0] = versionOf(b).split('.').map(Number);
    return b1 - a1 || b2 - a2 || a.length - b.length;
  });
}
const pickModel = (names, kind) => rankModels(names, kind)[0] || null;

function configuredModel(kind) {
  if (kind === 'image') return resolved.image || process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  return resolved.text || process.env.GEMINI_MODEL || 'gemini-3.5-flash'; // 2.5-flash는 새 키에서 404
}

// 응답 없이 멈추거나(408) 못 쓰는(404) 모델: 서버가 켜져 있는 동안 다시 고르지 않음
const hanging = new Set();

async function geminiRequest(kind, body) {
  const wait = kind === 'image' ? 90000 : 40000;
  const send = async (model) => {
    const res = await fetch(`${GEMINI_BASE()}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(wait), // 응답이 없으면 무한 대기 대신 다른 모델로
    }).catch((e) => {
      if (e.name !== 'TimeoutError') throw e;
      hanging.add(model);
      const err = new Error(`Gemini 응답 없음 ${wait / 1000}초 (${model})`);
      err.status = 408; // 상태가 있으면 askJson이 같은 모델로 또 재시도하지 않음
      throw err;
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404) hanging.add(model); // 목록엔 있어도 새 키에선 못 쓰는 모델(예: 2.5-flash): 다시 고르지 않음
      const err = new Error(res.status === 429
        ? `Gemini 무료 사용량을 다 썼어요 (${model}). 1분 뒤나 내일 다시 시도하거나, Google AI Studio에서 결제를 연결해 주세요.`
        : `Gemini ${res.status} (${model}): ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  };
  const busy = (e) => e.status === 503 || e.status === 500 || e.status === 429;
  const tryOther = (e) => e.status === 404 || e.status === 408 || busy(e); // 다른 모델로 넘어갈 오류
  const model = configuredModel(kind);
  try {
    return await send(model);
  } catch (e) {
    if (!tryOther(e)) throw e;
    if (busy(e)) {
      // 잠깐 기다렸다가 같은 모델로 한 번 더
      await sleep(1500);
      try { return await send(model); } catch (e2) { if (!tryOther(e2)) throw e2; }
    }
    // 다른 모델로 순서대로 시도 (404: 모델 없어짐 / 408: 응답 없음 / 503: 너무 바쁨)
    let names;
    try { names = await listModels(); } catch { throw e; }
    const others = rankModels(names, kind).filter((n) => n !== model && !hanging.has(n)).slice(0, 4);
    let lastErr = e;
    for (const next of others) {
      try {
        const out = await send(next);
        console.log(`[llm] ${model} 사용 불가(${e.status}) → ${next} 모델로 전환`);
        // 없어졌거나 멈추는 모델이면 앞으로는 되는 모델을 기본으로 (503은 일시적이라 이번 요청만)
        if (e.status === 404 || e.status === 408) resolved[kind] = next;
        return out;
      } catch (e3) {
        lastErr = e3;
        if (!tryOther(e3)) throw e3;
      }
    }
    throw lastErr;
  }
}

// images: [{ buffer, mime }]
async function callGemini(system, user, images = []) {
  const parts = [{ text: user }, ...images.map((im) => ({ inlineData: { mimeType: im.mime || 'image/jpeg', data: im.buffer.toString('base64') } }))];
  const data = await geminiRequest('text', {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
  });
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

async function callGroq(system, user) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const err = new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('JSON을 찾지 못했어요');
  return JSON.parse(t.slice(s, e + 1));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askJson(system, user, images = []) {
  const p = providerName();
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = p === 'gemini' ? await callGemini(system, user, images) : p === 'groq' ? await callGroq(system, user) : null;
      if (text === null) throw new Error(`알 수 없는 LLM_PROVIDER: ${p}`);
      return parseJson(text);
    } catch (e) {
      lastErr = e;
      if (e.status) break; // HTTP 오류 재시도는 geminiRequest에서 처리
      await sleep(500);
    }
  }
  throw lastErr;
}

const str = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
const allowFallback = () => (process.env.FALLBACK_TO_MOCK || 'true') !== 'false';

// 스레드: 500자, 해시태그 1개 제한 맞추기
function fitThreads(text) {
  let t = text;
  const tags = t.match(/#[^\s#]+/g) || [];
  tags.slice(1).forEach((h) => (t = t.replace(h, '')));
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > 500 ? `${t.slice(0, 497)}…` : t;
}

// 카드 문구 후보 5개 (모자라면 예시 문구로 채움, 같은 제목은 하나만)
function cardOptions(list, raw, fallback) {
  const cut = (o, d) => ({ headline: str(o?.headline, d.headline).slice(0, 20), subline: str(o?.subline, d.subline).slice(0, 30), tag: str(o?.tag, d.tag).slice(0, 12) });
  const first = cut(raw, fallback);
  const out = [first, ...(Array.isArray(list) ? list : []).map((o) => cut(o, first)), ...fallback.cardOptions];
  const seen = new Set();
  return out.filter((o) => !seen.has(o.headline) && seen.add(o.headline)).slice(0, 5);
}

function normalizePost(raw, fallback) {
  const c = raw?.captions || {};
  return {
    headline: str(raw?.headline, fallback.headline).slice(0, 20),
    subline: str(raw?.subline, fallback.subline).slice(0, 30),
    tag: str(raw?.tag, fallback.tag).slice(0, 12),
    cardOptions: cardOptions(raw?.cardOptions, raw, fallback),
    captions: {
      instagram: str(c.instagram, fallback.captions.instagram).slice(0, 2200),
      facebook: str(c.facebook, fallback.captions.facebook),
      threads: fitThreads(str(c.threads, fallback.captions.threads)),
    },
    checklist: Array.isArray(raw?.checklist) ? raw.checklist.map(String).filter(Boolean).slice(0, 5) : fallback.checklist,
    imagePrompt: str(raw?.imagePrompt, fallback.imagePrompt),
  };
}

async function generatePost(store, input, refImages, pastPosts) {
  const mock = mockPost(store, input);
  if (providerName() === 'mock') return { ...mock, source: 'mock' };
  const { system, user } = buildPostPrompt(store, input, refImages.length, pastPosts);
  try {
    const raw = await askJson(system, user, providerName() === 'gemini' ? refImages.slice(0, 4) : []);
    return { ...normalizePost(raw, mock), source: providerName() };
  } catch (e) {
    console.error('[llm] 게시물 생성 실패:', e.message);
    if (!allowFallback()) throw e;
    return { ...mock, source: 'mock', fallbackReason: e.message };
  }
}

async function generateIdeas(store, pastPosts) {
  const mock = mockIdeas(store, pastPosts);
  if (providerName() === 'mock') return { ...mock, source: 'mock' };
  const { system, user } = buildIdeasPrompt(store, pastPosts);
  try {
    const raw = await askJson(system, user);
    const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : [])
      .filter((i) => str(i?.topic))
      .map((i) => ({ topic: str(i.topic), detail: str(i.detail), why: str(i.why) }))
      .slice(0, 3);
    return { ideas: ideas.length ? ideas : mock.ideas, source: providerName() };
  } catch (e) {
    console.error('[llm] 아이디어 생성 실패:', e.message);
    if (!allowFallback()) throw e;
    return { ...mock, source: 'mock', fallbackReason: e.message };
  }
}

// 게시물 반응 피드백. 선플/악플은 실제 댓글에 있는 문장만 남긴다 (AI가 지어낸 댓글 방지)
async function generateFeedback(store, data) {
  const mock = mockFeedback(store, data);
  if (providerName() === 'mock' || !data.posts.length) return { ...mock, source: 'mock' };
  const { system, user } = buildFeedbackPrompt(store, data);
  try {
    const raw = await askJson(system, user);
    const real = (t) => t.length >= 2 && data.comments.some((c) => c.text.includes(t)); // AI가 원문 일부만 옮겨도 인정
    const list = (v) => (Array.isArray(v) ? v : []);
    const strs = (v) => list(v).map((x) => str(x)).filter(Boolean).slice(0, 6);
    return {
      summary: str(raw?.summary, mock.summary),
      styleInsights: strs(raw?.styleInsights).length ? strs(raw.styleInsights) : mock.styleInsights,
      positive: list(raw?.positive).filter((x) => real(str(x?.text))).slice(0, 6).map((x) => ({ text: str(x.text), why: str(x.why) })),
      negative: list(raw?.negative).filter((x) => real(str(x?.text))).slice(0, 6).map((x) => ({ text: str(x.text), why: str(x.why), reply: str(x.reply) })),
      suggestions: strs(raw?.suggestions).length ? strs(raw.suggestions) : mock.suggestions,
      source: providerName(),
    };
  } catch (e) {
    console.error('[llm] 피드백 생성 실패:', e.message);
    if (!allowFallback()) throw e;
    return { ...mock, source: 'mock', fallbackReason: e.message };
  }
}

// 게시물 하나 피드백. 선플/악플은 그 게시물의 실제 댓글 문장만 남긴다
async function generatePostFeedback(store, data) {
  const mock = mockPostFeedback(store, data);
  if (providerName() === 'mock') return { ...mock, source: 'mock' };
  const { system, user } = buildPostFeedbackPrompt(store, data);
  try {
    const raw = await askJson(system, user);
    const real = (t) => t.length >= 2 && data.comments.some((c) => c.text.includes(t));
    const list = (v) => (Array.isArray(v) ? v : []);
    const strs = (v, d) => { const a = list(v).map((x) => str(x)).filter(Boolean).slice(0, 4); return a.length ? a : d; };
    return {
      summary: str(raw?.summary, mock.summary),
      good: strs(raw?.good, mock.good),
      improve: strs(raw?.improve, mock.improve),
      positive: list(raw?.positive).filter((x) => real(str(x?.text))).slice(0, 5).map((x) => ({ text: str(x.text), why: str(x.why) })),
      negative: list(raw?.negative).filter((x) => real(str(x?.text))).slice(0, 5).map((x) => ({ text: str(x.text), why: str(x.why), reply: str(x.reply) })),
      nextTime: strs(raw?.nextTime, mock.nextTime),
      source: providerName(),
    };
  } catch (e) {
    console.error('[llm] 게시물 피드백 실패:', e.message);
    if (!allowFallback()) throw e;
    return { ...mock, source: 'mock', fallbackReason: e.message };
  }
}

// AI 이미지 생성/보정. source가 있으면 그 사진을 보정, 없으면 새로 생성.
async function generateImage({ prompt, source }) {
  if (providerName() !== 'gemini') {
    throw new Error('AI 이미지는 Gemini API 키가 있어야 쓸 수 있어요. 대신 자동 보정과 홍보 카드를 이용해 주세요.');
  }
  const parts = [{ text: prompt }];
  if (source) parts.push({ inlineData: { mimeType: source.mime || 'image/jpeg', data: source.buffer.toString('base64') } });
  try {
    const data = await geminiRequest('image', {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const out = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
    const inline = out?.inlineData || out?.inline_data;
    if (!inline?.data) throw new Error('이미지가 돌아오지 않았어요. 요청을 조금 바꿔서 다시 시도해 주세요.');
    return { buffer: Buffer.from(inline.data, 'base64'), mime: inline.mimeType || inline.mime_type || 'image/png' };
  } catch (e) {
    console.error('[llm] 이미지 생성 실패:', e.message);
    if (e.status === 429 || e.status === 403 || /quota|billing|free tier|RESOURCE_EXHAUSTED/i.test(e.message)) {
      throw new Error('지금 API 키로는 AI 이미지 생성을 쓸 수 없어요 (무료 키는 이미지 생성이 막혀 있거나 한도가 작아요). 자동 보정과 홍보 카드는 계속 쓸 수 있어요.');
    }
    if (e.status === 404) throw new Error('이 API 키로 쓸 수 있는 이미지 생성 모델이 없어요. 자동 보정과 홍보 카드는 계속 쓸 수 있어요.');
    throw e;
  }
}

module.exports = { providerName, modelName, generatePost, generateIdeas, generateFeedback, generatePostFeedback, generateImage, _pickModel: pickModel };
