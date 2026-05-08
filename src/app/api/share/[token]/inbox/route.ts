import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const share = await redis.get(`share:${params.token}`) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as any[];
  return NextResponse.json({
    email: share.email,
    messages: msgs.map(m => { const obj = typeof m === 'string' ? JSON.parse(m) : m; const { html, text, ...meta } = obj; return meta; }),
  });
}
