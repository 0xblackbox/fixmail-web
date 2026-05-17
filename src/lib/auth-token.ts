// HMAC-SHA256 signed auth token — Edge Runtime compatible, no Redis needed.
// Cookie stores the signature, never the plaintext password.

const PAYLOAD = 'fixmail-auth-v1';

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signAuthToken(secret: string): Promise<string> {
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PAYLOAD));
  return btoa(Array.from(new Uint8Array(sig), b => String.fromCharCode(b)).join(''));
}

export async function verifyAuthToken(token: string, secret: string): Promise<boolean> {
  try {
    const expected = await signAuthToken(secret);
    return token === expected;
  } catch {
    return false;
  }
}
