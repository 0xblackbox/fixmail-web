import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const raw = await redis.get(`share:${params.token}`) as string | null;
  if (!raw) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  const share: ShareData = JSON.parse(raw);
  const ttl = await redis.ttl(`share:${params.token}`);
  return NextResponse.json({ ...share, ttl });
}

export async function DELETE(_: NextRequest, { params }: { params: { token: string } }) {
  const raw = await redis.get(`share:${params.token}`) as string | null;
  if (!raw) return NextResponse.json({ error: '链接不存在' }, { status: 404 });
  const share: ShareData = JSON.parse(raw);
  share.status = 'consumed';
  await redis.set(`share:${params.token}`, JSON.stringify(share), { ex: 60 });
  return NextResponse.json({ ok: true });
}
