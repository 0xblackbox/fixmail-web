import { NextRequest, NextResponse } from 'next/server';
import { redis, validateEmail } from '@/lib/redis';

export async function GET(_: NextRequest, { params }: { params: { email: string; id: string } }) {
  const email = params.email.toLowerCase();
  if (!validateEmail(email)) return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 });

  const raw = await redis.lrange(`inbox:${email}`, 0, -1) as string[];
  const message = raw.map(m => JSON.parse(m)).find((m: any) => m.id === params.id);
  if (!message) return NextResponse.json({ error: '邮件不存在' }, { status: 404 });
  return NextResponse.json(message);
}
