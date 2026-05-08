import { NextResponse } from 'next/server';
import { DOMAIN, genId } from '@/lib/redis';

export async function GET() {
  return NextResponse.json({ email: `${genId(10)}@${DOMAIN}` });
}
