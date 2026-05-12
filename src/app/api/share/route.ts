import { NextRequest, NextResponse } from 'next/server';
import { redis, DOMAIN, genId, ShareData } from '@/lib/redis';
import { hashPin } from '@/lib/pin';

const EXPIRY_MAP: Record<string, number> = {
  '10m': 10 * 60,
  '1h':  60 * 60,
  '24h': 24 * 60 * 60,
  '7d':  7 * 24 * 60 * 60,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const expiry   = EXPIRY_MAP[body.expiry] ?? EXPIRY_MAP['24h'];
  const maxOpens = body.maxOpens === '∞' ? 0 : Math.max(1, Number(body.maxOpens) || 1);
  const password = body.password ? String(body.password).trim() : '';

  // Custom email support
  let email: string;
  if (body.customEmail && typeof body.customEmail === 'string') {
    const local = body.customEmail.trim().toLowerCase().replace(/[^a-z0-9._+\-]/g, '');
    // Enforce 1–32 character local part
    if (!local || local.length > 32) {
      return NextResponse.json({ error: '自定义邮箱前缀长度须在 1–32 个字符之间' }, { status: 400 });
    }
    email = `${local}@${DOMAIN}`;
  } else {
    email = `${genId(10)}@${DOMAIN}`;
  }
  const token = genId(20, true);

  const share: ShareData = {
    email,
    status: 'active',
    createdAt: new Date().toISOString(),
    maxOpens,
    openCount: 0,
    ...(password ? { passwordHash: await hashPin(password) } : {}),
  };

  await redis.set(`share:${token}`, share, { ex: expiry });
  return NextResponse.json({ token, email, shareUrl: `/share/${token}` });
}
