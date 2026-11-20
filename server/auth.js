// 로그인: 아이디 + 비밀번호(scrypt 해시) + 세션 쿠키. 추가 패키지 없이 Node 기본 crypto만 사용.
const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'gg_session';
const SESSION_DAYS = 30;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passHash, 'hex'));
}

function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
function setCookie(req, res, token, maxAgeSec) {
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${https ? '; Secure' : ''}`);
}

function startSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.addSession({ token, userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() });
  setCookie(req, res, token, SESSION_DAYS * 86400);
}
function endSession(req, res) {
  const token = readCookie(req);
  if (token) db.deleteSession(token);
  setCookie(req, res, '', 0);
}
function currentUser(req) {
  const token = readCookie(req);
  const s = token && db.getSession(token);
  if (!s || s.expiresAt < new Date().toISOString()) return null;
  return db.getUser(s.userId);
}

// 비밀번호 마구 넣어 보기 막기: 같은 IP에서 10분 안에 8번 틀리면 10분 잠금
const fails = new Map();
function tooMany(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > 600000) { fails.delete(ip); return false; }
  return f.n >= 8;
}
function addFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > 600000) fails.set(ip, { n: 1, since: Date.now() });
  else f.n++;
}

const LOGIN_ID = /^[a-z0-9._@-]{4,40}$/;

module.exports = { hashPassword, checkPassword, startSession, endSession, currentUser, tooMany, addFail, LOGIN_ID };
