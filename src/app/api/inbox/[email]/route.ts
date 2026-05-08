import { NextRequest, NextResponse } from 'next/server';
import { redis, validateEmail } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { email: string } }) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 });

  const raw = await redis.lrange(`inbox:${email}`, 0, -1) as any[];
  const messages = raw.map(m => {
    const obj = typeof m === 'string' ? JSON.parse(m) : m;
    const { html, text, ...meta } = obj;
    return meta;
  });
  return NextResponse.json({ messages });
}

export async function DELETE(_: NextRequest, { params }: { params: { email: string } }) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 });
  await redis.del(`inbox:${email}`);
  return NextResponse.json({ ok: true });
}
