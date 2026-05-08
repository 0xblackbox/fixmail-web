import { NextResponse } from 'next/server';
import { redis, DOMAIN, SHARE_TTL, genId, ShareData } from '@/lib/redis';

export async function POST() {
  const email = `${genId(10)}@${DOMAIN}`;
  const token = genId(20, true);
  const share: ShareData = { email, status: 'active', createdAt: new Date().toISOString() };
  await redis.set(`share:${token}`, share, { ex: SHARE_TTL });
  return NextResponse.json({ token, email, shareUrl: `/share/${token}` });
}
