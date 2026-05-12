import { NextRequest, NextResponse } from 'next/server';
import { redis, genId } from '@/lib/redis';
import { verifyPin } from '@/lib/pin';

/**
 * POST { email, pin } — verify PIN, issue a random session token, set httpOnly cookie
 * DELETE             — clear cookie and session from Redis
 *
 * Cookie `inbox_pin` = "{email}|{session_token}"  (no plaintext PIN stored)
 * Redis  `pin_session:{email}` = session_token     (30-day TTL, invalidated on PIN change/delete)
 */
const COOKIE     = 'inbox_pin';
const SESSION_TTL = 30 * 24 * 3600; // 30 days

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, pin } = body;
  if (!email || !pin) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  const normalEmail = String(email).toLowerCase();
  const stored = await redis.get(`pin:${normalEmail}`) as string | null;
  if (!stored) {
    // No PIN set — allow access, no cookie needed
    return NextResponse.json({ ok: true });
  }

  // Verify using salted hash (salt = email)
  const ok = await verifyPin(String(pin), stored, normalEmail);
  if (!ok) return NextResponse.json({ error: '密码错误' }, { status: 401 });

  // Issue a random session token — stored in Redis, never the PIN itself
  const token = genId(32, true);
  await redis.set(`pin_session:${normalEmail}`, token, { ex: SESSION_TTL });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, `${normalEmail}|${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  // Revoke session from Redis too
  const cookieVal = req.cookies.get(COOKIE)?.value || '';
  if (cookieVal) {
    const pipeIdx = cookieVal.indexOf('|');
    if (pipeIdx > 0) {
      const cookieEmail = cookieVal.slice(0, pipeIdx);
      await redis.del(`pin_session:${cookieEmail}`);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
