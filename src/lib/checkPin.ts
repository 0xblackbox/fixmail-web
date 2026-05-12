import { NextRequest, NextResponse } from 'next/server';
import { redis } from './redis';
import { verifyPin } from './pin';

const COOKIE      = 'inbox_pin';
const MAX_FAILS   = 10;
const LOCKOUT_SEC = 15 * 60; // 15 minutes

/**
 * Returns null if access is allowed, or an error Response otherwise.
 *
 * Auth resolution order:
 *  1. inbox_pin cookie  — "{email}|{session_token}" — validated against Redis session
 *  2. x-inbox-pin header — plaintext PIN (fallback for share-link flow)
 *
 * Failed header-based attempts are rate-limited (10 failures → 15-min lockout).
 */
export async function checkPin(req: NextRequest, email: string): Promise<NextResponse | null> {
  const stored = await redis.get(`pin:${email}`) as string | null;
  if (!stored) return null; // no PIN set — open access

  // ── Rate limit check ──────────────────────────────────────────────────────
  const failKey = `pin_fail:${email}`;
  const fails   = (await redis.get(failKey) as number | null) || 0;
  if (fails >= MAX_FAILS) {
    return NextResponse.json(
      { error: '验证失败次数过多，请 15 分钟后再试', locked: true, rateLimited: true },
      { status: 429 }
    );
  }

  // ── 1. Session cookie ─────────────────────────────────────────────────────
  const cookieVal = req.cookies.get(COOKIE)?.value || '';
  if (cookieVal) {
    const pipeIdx = cookieVal.indexOf('|');
    if (pipeIdx > 0) {
      const cookieEmail = cookieVal.slice(0, pipeIdx);
      const cookieToken = cookieVal.slice(pipeIdx + 1);
      if (cookieEmail === email && cookieToken) {
        const activeToken = await redis.get(`pin_session:${email}`) as string | null;
        if (activeToken && activeToken === cookieToken) {
          await redis.del(failKey); // reset on success
          return null;
        }
      }
    }
  }

  // ── 2. x-inbox-pin header (plaintext PIN) ─────────────────────────────────
  const headerPin = req.headers.get('x-inbox-pin') || '';
  if (headerPin) {
    const ok = await verifyPin(headerPin, stored, email); // salted verify
    if (ok) {
      await redis.del(failKey); // reset on success
      return null;
    }
    // Wrong PIN — increment failure counter
    const newFails = await redis.incr(failKey);
    if (newFails === 1) await redis.expire(failKey, LOCKOUT_SEC);
    return NextResponse.json({ error: '访问密码错误', locked: true }, { status: 401 });
  }

  // No credentials provided
  return NextResponse.json({ error: '该收件箱已加密，请提供访问密码', locked: true }, { status: 401 });
}
