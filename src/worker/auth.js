// Passcode login with a signed session cookie. The site shell is public (it
// contains no data); every /api request except login needs a valid session.
// No browser Basic-auth prompt is used: Home Screen web apps cannot show one,
// which caused the blank screen.

export const SESSION_COOKIE = 'oo_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

function base64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The signing key is derived from the passcode, so changing the passcode
// signs out every session.
async function signingKey(env) {
  return crypto.subtle.importKey('raw', enc.encode(`owners-office-session|${env.OWNER_PASSCODE}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(env, exp) {
  const mac = await crypto.subtle.sign('HMAC', await signingKey(env), enc.encode(exp));
  return `${exp}.${base64url(mac)}`;
}

export function checkPasscode(given, env) {
  return typeof given === 'string' && Boolean(env.OWNER_PASSCODE) && sameText(given, env.OWNER_PASSCODE);
}

export async function sessionCookie(env) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const value = await sign(env, exp);
  return `${SESSION_COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export async function isAuthenticated(request, env) {
  if (!env.OWNER_PASSCODE) return false;
  const cookie = request.headers.get('Cookie') ?? '';
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  return sameText(await sign(env, exp), match[1]);
}
