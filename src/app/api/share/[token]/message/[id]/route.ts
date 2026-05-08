import { NextRequest, NextResponse } from 'next/server';
import { redis, SHARE_TTL, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string; id: string } }) {
  const key = `share:${params.token}`;
  const raw = await redis.get(key) as string | null;
  if (!raw) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  const share: ShareData = JSON.parse(raw);
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as string[];
  const message = msgs.map(m => JSON.parse(m)).find((m: any) => m.id === params.id);
  if (!message) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });

  // 消费链接
  const ttl = await redis.ttl(key);
  share.status = 'consumed';
  await redis.set(key, JSON.stringify(share), { ex: Math.max(ttl, 1) });

  return NextResponse.json(message);
}
