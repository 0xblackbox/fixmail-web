import { NextRequest, NextResponse } from 'next/server';
import { redis, ShareData } from '@/lib/redis';
import { checkPin } from '@/lib/checkPin';
import { verifyPin } from '@/lib/pin';

export async function GET(req: NextRequest, { params }: { params: { token: string; id: string } }) {
  const key   = `share:${params.token}`;
  const share = await redis.get(key) as ShareData | null;
  if (!share) return NextResponse.json({ error: '链接不存在或已过期' }, { status: 404 });
  if (share.status === 'consumed') return NextResponse.json({ error: '链接已失效' }, { status: 410 });

  // Check share password
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

  // Check inbox PIN
  const pinErr = await checkPin(req, share.email);
  if (pinErr) return pinErr;

  const msgs = await redis.lrange(`inbox:${share.email}`, 0, -1) as any[];
  const message = msgs.map(m => typeof m === 'string' ? JSON.parse(m) : m).find((m: any) => m.id === params.id);
  if (!message) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });

  // 查看邮件才计一次使用次数（原子递增）
  const ttl = await redis.ttl(key);
  if (share.maxOpens > 0) {
    const countKey = `share_opens:${params.token}`;
    const count = await redis.incr(countKey);
    if (count === 1 && ttl > 0) await redis.expire(countKey, ttl);

    if (count >= share.maxOpens) {
      // 达到上限，消费链接
      share.status = 'consumed';
      if (ttl > 0) await redis.set(key, share, { ex: ttl });
    }
  } else {
    // 不限次数：仍然在查看单封邮件后消费（阅后即焚语义）
    // maxOpens === 0 表示不限，不自动消费
  }

  return NextResponse.json(message);
}
