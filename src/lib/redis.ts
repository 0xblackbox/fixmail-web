import { Redis } from '@upstash/redis';
import { randomBytes } from 'crypto';

export const redis = Redis.fromEnv();

export const DOMAIN    = process.env.NEXT_PUBLIC_DOMAIN || 'fixmail.org';
export const EMAIL_TTL = 10 * 60; // 10 分钟
export const SHARE_TTL = 30 * 60; // 30 分钟

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CHARS_MIX = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function genId(len = 10, mixed = false) {
  const set = mixed ? CHARS_MIX : CHARS;
  const bytes = randomBytes(len);
  return Array.from(bytes, b => set[b % set.length]).join('');
}

export function validateEmail(email: string): boolean {
  const [username, domain] = email.split('@');
  if (!username || !domain) return false;
  if (domain !== DOMAIN) return false;
  if (!/^[a-z0-9._+\-]+$/i.test(username)) return false;
  return true;
}

export interface ShareData {
  email: string;
  status: 'active' | 'consumed';
  createdAt: string;
}
