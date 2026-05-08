import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const share = await redis.get(`share:${params.token}`) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  const ttl = await redis.ttl(`share:${params.token}`);
  return NextResponse.json({ ...share, ttl });
}

export async function DELETE(_: NextRequest, { params }: { params: { token: string } }) {
  const share = await redis.get(`share:${params.token}`) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在' }, { status: 404 });
  share.status = 'consumed';
  await redis.set(`share:${params.token}`, share, { ex: 60 });
  return NextResponse.json({ ok: true });
}
