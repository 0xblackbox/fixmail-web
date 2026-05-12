import { NextRequest, NextResponse } from 'next/server';
import { redis, validateEmail, PIN_TTL } from '@/lib/redis';
import { hashPin, verifyPin } from '@/lib/pin';
import { checkPin } from '@/lib/checkPin';

type Params = { params: { email: string } };

// GET — check whether a PIN is set
export async function GET(_: NextRequest, { params }: Params) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const locked = !!(await redis.get(`pin:${email}`));
  return NextResponse.json({ locked });
}

// POST { pin, oldPin? } — set PIN (requires old PIN if one already exists)
export async function POST(req: NextRequest, { params }: Params) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { pin, oldPin } = body;

  if (!pin || String(pin).length < 4)
    return NextResponse.json({ error: 'PIN 至少 4 位' }, { status: 400 });

  const existing = await redis.get(`pin:${email}`) as string | null;
  if (existing) {
    // PIN already set — must verify via cookie session or provide old PIN
    const cookieOk = (await checkPin(req, email)) === null;
    if (!cookieOk) {
      if (!oldPin) return NextResponse.json({ error: '需要旧密码验证' }, { status: 403 });
      const ok = await verifyPin(String(oldPin), existing, email);
      if (!ok) return NextResponse.json({ error: '旧密码错误' }, { status: 403 });
    }
    // Invalidate old sessions and fail counters on PIN change
    await Promise.all([
      redis.del(`pin_session:${email}`),
      redis.del(`pin_fail:${email}`),
    ]);
  }

  // Store salted hash (salt = email)
  const hash = await hashPin(String(pin), email);
  await redis.set(`pin:${email}`, hash, { ex: PIN_TTL });
  return NextResponse.json({ ok: true });
}

// DELETE — remove PIN (requires valid session cookie)
export async function DELETE(req: NextRequest, { params }: Params) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const existing = await redis.get(`pin:${email}`) as string | null;
  if (!existing) return NextResponse.json({ ok: true }); // no PIN, nothing to do

  const pinErr = await checkPin(req, email);
  if (pinErr) return pinErr;

  // Remove PIN + session + fail counter
  await Promise.all([
    redis.del(`pin:${email}`),
    redis.del(`pin_session:${email}`),
    redis.del(`pin_fail:${email}`),
  ]);
  return NextResponse.json({ ok: true });
}
