// PIN hashing via Web Crypto (works in both Node.js serverless and Edge)
// salt = email address — prevents rainbow table attacks across inboxes

export async function hashPin(pin: string, salt = ''): Promise<string> {
  const encoded = new TextEncoder().encode(pin + salt);
  const buf     = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, stored: string, salt = ''): Promise<boolean> {
  return (await hashPin(pin, salt)) === stored;
}
