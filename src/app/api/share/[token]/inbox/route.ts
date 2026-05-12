import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';
import { checkPin } from '@/lib/checkPin';
import { verifyPin } from '@/lib/pin';

async function checkShareAccess(req: NextRequest, share: ShareData): Promise<NextResponse | null> {
  if (share.passwordHash) {
    const provided = req.headers.get('x-share-password') || '';
    if (!provided) {
      return NextResponse.json({ error: '此链接受密码保护', shareLocked: true }, { status: 401 });
    }
    const ok = await verifyPin(provided, share.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: '链接密码错误', shareLocked: true }, { status: 401 });
    }
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const key   = `share:${params.token}`;
  const share = await redis.get(key) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  // Check share password
  const pwErr = await checkShareAccess(req, share);
  if (pwErr) return pwErr;

  // Check inbox PIN
  const pinErr = await checkPin(req, share.email);
  if (pinErr) return pinErr;

  // 注意：此处不计次数。次数在用户实际查看邮件时才计（message/[id] 路由）

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as any[];
  return NextResponse.json({
    email: share.email,
    messages: msgs.map(m => {
      const obj = typeof m === 'string' ? JSON.parse(m) : m;
      const { html, text, ...meta } = obj;
      return meta;
    }),
  });
}
