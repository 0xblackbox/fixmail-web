import { NextRequest, NextResponse } from 'next/server';
import { redis, SHARE_TTL, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string; id: string } }) {
  const key = `share:${params.token}`;
  const share = await redis.get(key) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as any[];
  const message = msgs.map(m => typeof m === 'string' ? JSON.parse(m) : m).find((m: any) => m.id === params.id);
  if (!message) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });

  // 消费链接
  const ttl = await redis.ttl(key);
  share.status = 'consumed';
  await redis.set(key, share, { ex: Math.max(ttl, 1) });

  return NextResponse.json(message);
}
