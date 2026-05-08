import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const raw = await redis.get(`share:${params.token}`) as string | null;
  if (!raw) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  const share: ShareData = JSON.parse(raw);
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as string[];
  return NextResponse.json({
    email: share.email,
    messages: msgs.map(m => { const { html, text, ...meta } = JSON.parse(m); return meta; }),
  });
}
