// SNS 연결 정보(토큰 등) 저장소. data/connections.json 에 저장되며 .gitignore로 제외됨.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'connections.json');
let conns = { facebook: {}, instagram: {}, threads: {}, publicBaseUrl: '' };

function load() {
  try {
    if (fs.existsSync(FILE)) conns = { ...conns, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (e) {
    console.error('[connections] 읽기 실패:', e.message);
  }
}
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(conns, null, 2));
}

// 배포 서버(Render 등)에서는 토큰을 화면이 아니라 환경변수로 넣는다.
// INSTAGRAM_TOKEN, INSTAGRAM_USER_ID, PUBLIC_BASE_URL(없으면 RENDER_EXTERNAL_URL)
const env = (k) => (process.env[k] || '').trim();
const igFromEnv = () => !!env('INSTAGRAM_TOKEN');
const fbFromEnv = () => !!(env('FACEBOOK_PAGE_TOKEN') && env('FACEBOOK_PAGE_ID'));
const thFromEnv = () => !!env('THREADS_TOKEN');

function get() {
  const c = { ...conns };
  if (fbFromEnv()) c.facebook = { pageId: env('FACEBOOK_PAGE_ID'), token: env('FACEBOOK_PAGE_TOKEN') };
  if (thFromEnv()) c.threads = { token: env('THREADS_TOKEN') };
  if (igFromEnv()) c.instagram = { token: env('INSTAGRAM_TOKEN'), igUserId: env('INSTAGRAM_USER_ID') || conns.instagram.igUserId || '' };
  const base = env('PUBLIC_BASE_URL') || env('RENDER_EXTERNAL_URL');
  if (base) c.publicBaseUrl = base.replace(/\/+$/, '');
  return c;
}

// 게시·삭제할 때 확인하는 숫자 (공개 사이트에서 아무나 우리 계정에 올리지 못하게)
const pin = () => env('INSTAGRAM_PUBLISH_PIN') || env('PUBLISH_PIN');
function checkPin(v) {
  const p = pin();
  if (!p) return true;
  return typeof v === 'string' && v.trim() === p;
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

function update(body) {
  if (body.facebook && !fbFromEnv()) {
    conns.facebook = {
      pageId: clean(body.facebook.pageId) || conns.facebook.pageId || '',
      token: clean(body.facebook.token) || conns.facebook.token || '',
    };
  }
  if (body.instagram && !igFromEnv()) {
    conns.instagram = {
      token: clean(body.instagram.token) || conns.instagram.token || '',
      igUserId: clean(body.instagram.igUserId) || conns.instagram.igUserId || '',
    };
  }
  if (body.threads && !thFromEnv()) {
    conns.threads = { token: clean(body.threads.token) || conns.threads.token || '' };
  }
  if (typeof body.publicBaseUrl === 'string' && !env('PUBLIC_BASE_URL') && !env('RENDER_EXTERNAL_URL')) {
    conns.publicBaseUrl = clean(body.publicBaseUrl).replace(/\/+$/, '');
  }
  if (body.disconnect && conns[body.disconnect]) conns[body.disconnect] = {};
  save();
}

const mask = (t) => (t ? `${t.slice(0, 4)}…${t.slice(-4)}` : '');

// 화면에 보여줄 때는 토큰을 가린다
function view() {
  const conns = get();
  const ig = conns.instagram || {};
  return {
    pinRequired: !!pin(),
    envManaged: { instagram: igFromEnv(), facebook: fbFromEnv(), threads: thFromEnv(), publicBaseUrl: !!(env('PUBLIC_BASE_URL') || env('RENDER_EXTERNAL_URL')) },
    facebook: { connected: !!(conns.facebook.token && conns.facebook.pageId), pageId: conns.facebook.pageId || '', token: mask(conns.facebook.token) },
    instagram: { connected: !!ig.token, igUserId: ig.igUserId || '', token: mask(ig.token),
      // 인스타 삭제 API는 페이스북 로그인 방식 토큰(EAA…)에서만 된다
      canDelete: !!ig.token && !ig.token.startsWith('IG') },
    threads: { connected: !!conns.threads.token, token: mask(conns.threads.token) },
    publicBaseUrl: conns.publicBaseUrl || '',
  };
}

module.exports = { load, get, update, view, checkPin };
