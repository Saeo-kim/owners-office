// HTTP Basic authentication for the whole site. The browser asks once; the
// password is the OWNER_PASSCODE secret. Fails closed when the secret is missing.

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authorize(request, env) {
  if (!env.OWNER_PASSCODE) {
    return new Response('OWNER_PASSCODE 비밀값이 설정되지 않았습니다. 배포 설정을 확인하세요.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (match) {
    let decoded = '';
    try {
      decoded = atob(match[1]);
    } catch {
      decoded = '';
    }
    const colon = decoded.indexOf(':');
    const password = colon >= 0 ? decoded.slice(colon + 1) : '';
    if (sameText(password, env.OWNER_PASSCODE)) return null;
  }
  return new Response('인증이 필요합니다.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Owner\'s Office", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
