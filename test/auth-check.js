// 로그인·권한 자체 점검. 먼저 서버를 켜고(PORT=3016 LLM_PROVIDER=mock node server/index.js) 다른 창에서: npm run check:auth
// 주의: data/db.json에 owner1, owner2 계정과 가게A가 생겨요. 테스트용 폴더에서 돌리세요.
const assert = require('assert');
const B = 'http://localhost:3016';
const OK = { terms: true, privacy: true, age: true }; // 필수 약관 동의
async function call(method, path, body, cookie) {
  if (/signup$/.test(path)) body = { consents: OK, ...body };
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get('set-cookie');
  return { status: r.status, data: await r.json().catch(() => ({})), cookie: set ? set.split(';')[0] : null };
}
(async () => {
  assert.equal((await call('GET', '/api/auth/me')).status, 401, '로그인 없이 me');
  assert.equal((await call('POST', '/api/stores', { name: 'x', category: 'y', address: 'z' })).status, 401, '로그인 없이 가게 만들기');
  assert.equal((await call('PUT', '/api/connections', { disconnect: 'threads' })).status, 401, '로그인 없이 연결 바꾸기');
  assert.equal((await call('GET', '/api/health')).status, 200, 'health는 공개');
  assert.ok(!('connections' in (await call('GET', '/api/health')).data), 'health에 연결 정보 없음');
  assert.equal((await call('POST', '/api/auth/signup', { loginId: 'noagree', password: '12345678', consents: { terms: true } })).status, 400, '필수 약관 없이 가입 못 함');
  assert.equal((await call('POST', '/api/auth/signup', { loginId: 'AB', password: '12345678' })).status, 400, '짧은 아이디');
  assert.equal((await call('POST', '/api/auth/signup', { loginId: 'owner1', password: '1234' })).status, 400, '짧은 비번');
  const a = await call('POST', '/api/auth/signup', { loginId: 'owner1', password: 'password1' });
  assert.equal(a.status, 201); assert.ok(/^gg_session=[a-f0-9]{64}$/.test(a.cookie), '쿠키');
  assert.equal((await call('POST', '/api/auth/signup', { loginId: 'owner1', password: 'password1' })).status, 409, '중복 아이디');
  const st = await call('POST', '/api/stores', { name: '가게A', category: '카페', address: '경산' }, a.cookie);
  assert.equal(st.status, 201);
  const post = await call('POST', `/api/stores/${st.data.id}/posts`, { topic: '딸기라떼' }, a.cookie);
  assert.equal(post.status, 201);
  const me = await call('GET', '/api/auth/me', null, a.cookie);
  assert.equal(me.data.storeId, st.data.id, '내 가게 찾기');
  const b = await call('POST', '/api/auth/signup', { loginId: 'owner2', password: 'password2' });
  assert.equal((await call('GET', `/api/stores/${st.data.id}`, null, b.cookie)).status, 404, '남의 가게 못 봄');
  assert.equal((await call('GET', `/api/posts/${post.data.id}`, null, b.cookie)).status, 404, '남의 게시물 못 봄');
  assert.equal((await call('DELETE', `/api/posts/${post.data.id}`, null, b.cookie)).status, 404, '남의 게시물 못 지움');
  assert.equal((await call('GET', `/api/posts/${post.data.id}`, null, a.cookie)).status, 200, '내 게시물은 보임');
  const login = await call('POST', '/api/auth/login', { loginId: 'OWNER1', password: 'password1' });
  assert.equal(login.status, 200, '대문자 아이디도 로그인'); assert.equal(login.data.storeId, st.data.id);
  for (let i = 0; i < 8; i++) assert.equal((await call('POST', '/api/auth/login', { loginId: 'owner1', password: 'wrong' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { loginId: 'owner1', password: 'password1' })).status, 429, '8번 틀리면 잠금');
  await call('POST', '/api/auth/logout', null, a.cookie);
  assert.equal((await call('GET', '/api/auth/me', null, a.cookie)).status, 401, '로그아웃 후 세션 끝');
  console.log('ALL AUTH CHECKS PASSED');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
