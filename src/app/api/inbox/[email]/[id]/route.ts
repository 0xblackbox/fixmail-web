import { NextRequest, NextResponse } from 'next/server';
import { redis, validateEmail } from '@/lib/redis';
import { checkPin } from '@/lib/checkPin';

export async function GET(req: NextRequest, { params }: { params: { email: string; id: string } }) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 });

  const pinErr = await checkPin(req, email);
  if (pinErr) return pinErr;

  const raw = await redis.lrange(`inbox:${email}`, 0, -1) as any[];
  const message = raw.map(m => typeof m === 'string' ? JSON.parse(m) : m).find((m: any) => m.id === params.id);
  if (!message) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });
  return NextResponse.json(message);
}

export async function DELETE(req: NextRequest, { params }: { params: { email: string; id: string } }) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 });

  const pinErr = await checkPin(req, email);
  if (pinErr) return pinErr;

  const key = `inbox:${email}`;
  const raw = await redis.lrange(key, 0, -1) as any[];
  const target = raw.find(m => {
    try { return (typeof m === 'string' ? JSON.parse(m) : m).id === params.id; } catch { return false; }
  });
  if (!target) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });

  await redis.lrem(key, 1, target);
  return NextResponse.json({ ok: true });
}
