import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/pin-session',           // PIN 会话验证（收件箱锁）
  '/api/share/',                // 分享链接相关 API（token 子路径）
];

// 分享链接页本身对外公开（/share/[token]），但 /share 生成页仍需登录
function isPublicSharePage(pathname: string) {
  return /^\/share\/[^/]+/.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    isPublicSharePage(pathname) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next(); // no password configured

  const cookie = req.cookies.get('site_auth')?.value;
  if (cookie === sitePassword) return NextResponse.next();

  // Not authenticated — redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?from=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
