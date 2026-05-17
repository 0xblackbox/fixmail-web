import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { signAuthToken } from '@/lib/auth-token';

const MAX_FAILS   = 10;
const LOCKOUT_SEC = 15 * 60; // 15 minutes

export async function POST(req: NextRequest) {
  // Rate limiting by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const failKey = `auth_fail:${ip}`;
  const fails = (await redis.get(failKey) as number | null) || 0;
  if (fails >= MAX_FAILS) {
    return NextResponse.json({ error: '尝试次数过多，请 15 分钟后再试' }, { status: 429 });
  }

  const { password } = await req.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || password !== sitePassword) {
    const newFails = await redis.incr(failKey);
    if (newFails === 1) await redis.expire(failKey, LOCKOUT_SEC);
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  // Success — clear fail counter
  await redis.del(failKey);

  // Sanitize redirect target — must be a relative path to prevent open redirect
  const rawFrom = req.nextUrl.searchParams.get('from') || '/';
  const from = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';
  const res = NextResponse.json({ ok: true, redirect: from });

  const authToken = await signAuthToken(sitePassword);
  res.cookies.set('site_auth', authToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // no maxAge = session cookie (closes with browser)
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('site_auth');
  return res;
}
