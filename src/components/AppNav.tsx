'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ic } from './icons';
import { useLock } from './LockProvider';

const NAV_LINKS = [
  { href: '/',        label: '收件箱' },
  { href: '/share',   label: '分享链接' },
  { href: '/history', label: '历史会话' },
  { href: '/docs',    label: '文档' },
] as const;

// Mobile tab icons
const TabIcons = {
  '/': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m2 7 10 6 10-6"/>
    </svg>
  ),
  '/share': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49"/>
    </svg>
  ),
  '/history': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l2 2"/><path d="M3.05 11a9 9 0 1 0 .5-3"/>
      <path d="M3 4v4h4"/>
    </svg>
  ),
  '/docs': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
} as const;

export default function AppNav({ loading = false }: { loading?: boolean }) {
  const pathname = usePathname();
  const lock = useLock();

  return (
    <>
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="brand">
              <div className="brand-mark">F</div>
              FixMail
            </div>
          </Link>
          <div className="nav-links">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link${active ? ' active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="nav-right">
          <span className="badge-live">
            <i style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent)',
              animation: loading ? 'none' : 'pulse 1.6s infinite',
              opacity: loading ? 0.4 : 1,
            }} />
            {loading ? '同步中' : '在线接收'}
          </span>
          <button
            className={`lock-pill${lock.hasPassword ? ' on' : ''}`}
            onClick={lock.openSetup}
            title={lock.hasPassword ? '访问密码已启用' : '设置访问密码'}
          >
            {lock.hasPassword ? Ic.lock : Ic.unlock}
            {lock.hasPassword ? '已加锁' : '未加锁'}
          </button>
        </div>
      </nav>

      {/* Mobile bottom tab bar — only visible on ≤640px */}
      <div className="mobile-tab-bar">
        <ul>
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} className={`mobile-tab-item${active ? ' active' : ''}`}>
                  {TabIcons[href]}
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
