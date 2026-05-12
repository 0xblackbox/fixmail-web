'use client';

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { Ic } from './icons';

// ─── Context ───────────────────────────────────────────────────────────────
interface LockCtx {
  hasPassword: boolean;
  locked: boolean;
  enable:           (pw: string) => Promise<void>;
  lockNow:          () => void;
  disable:          () => Promise<void>;
  unlock:           (pw: string) => Promise<boolean>;
  openSetup:        () => void;
}

const Ctx = createContext<LockCtx>({
  hasPassword: false, locked: false,
  enable: async () => {}, lockNow: () => {}, disable: async () => {},
  unlock: async () => true, openSetup: () => {},
});

export function useLock() { return useContext(Ctx); }

// ─── Helpers ───────────────────────────────────────────────────────────────
function getEmail() {
  return typeof window !== 'undefined' ? localStorage.getItem('fm_email') || '' : '';
}

async function apiSetPin(email: string, pin: string): Promise<boolean> {
  if (!email) return false;
  const res = await fetch(`/api/inbox/${encodeURIComponent(email)}/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return res.ok;
}

async function apiDelPin(email: string): Promise<boolean> {
  if (!email) return false;
  const res = await fetch(`/api/inbox/${encodeURIComponent(email)}/pin`, { method: 'DELETE' });
  return res.ok;
}

// ─── PIN input (reusable) ──────────────────────────────────────────────────
function PinInput({
  title, subtitle, onSubmit, onCancel,
}: {
  title: string; subtitle: string;
  onSubmit: (pin: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [v, setV]         = useState('');
  const [show, setShow]   = useState(false);
  const [err, setErr]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [focus, setFocus] = useState(false);
  const ref               = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);

  const submit = async () => {
    if (!v || busy) return;
    setBusy(true);
    const ok = await onSubmit(v);
    if (!ok) {
      setErr('密码不正确，请重试');
      setV('');
      setBusy(false);
      setTimeout(() => setErr(''), 1500);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
            <circle cx="12" cy="16" r="1"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2>{title}</h2>
          <p style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        <div
          className={`lock-input-wrap${focus ? ' focus' : ''}${err ? ' error' : ''}`}
          style={err ? { animation: 'shake .35s' } : {}}
        >
          <input
            ref={ref}
            type={show ? 'text' : 'password'}
            value={v}
            onChange={e => setV(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={e => { if (e.key === 'Enter' && v && !busy) submit(); }}
            placeholder="访问密码"
            autoComplete="off"
            disabled={busy}
          />
          <button onClick={() => setShow(s => !s)} title={show ? '隐藏' : '显示'} type="button">
            {show
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z"/><circle cx="7" cy="7" r="1.5"/><path d="m2 2 10 10"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/></svg>
            }
          </button>
        </div>
        <div className="lock-error-msg">{err || ' '}</div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', height: 42 }}
          onClick={submit}
          disabled={!v || busy}
        >
          {busy ? '验证中…' : '解锁'}
        </button>
        {onCancel && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onCancel}
          >
            取消
          </button>
        )}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ─── Setup modal ────────────────────────────────────────────────────────────
function LockSetupModal({ open, onClose, ctx }: { open: boolean; onClose: () => void; ctx: LockCtx }) {
  const [p1, setP1]     = useState('');
  const [p2, setP2]     = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setP1(''); setP2(''); setShow(false); setBusy(false); } }, [open]);
  if (!open) return null;

  if (ctx.hasPassword) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h4>访问密码已启用</h4>
            <p>密码存储在服务端。任何设备访问此收件箱均需验证。</p>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn" style={{ justifyContent: 'flex-start', height: 40, gap: 10 }}
              onClick={() => { ctx.lockNow(); onClose(); }}>
              {Ic.lock}<span>立即锁定屏幕</span>
            </button>
            <button className="btn" style={{ justifyContent: 'flex-start', height: 40, gap: 10 }}
              onClick={async () => { await ctx.disable(); onClose(); }}>
              {Ic.unlock}<span>禁用访问密码</span>
            </button>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const valid  = p1.length >= 4 && p1 === p2;
  const status = !p1 ? '' : !valid ? 'error' : 'ok';
  const hint   = p1.length === 0 ? '密码将存储在服务端，任何设备访问均需验证。至少 4 位。'
    : p1.length < 4 ? '密码太短，至少 4 位'
    : p2.length === 0 ? '再输入一次以确认'
    : p1 !== p2 ? '两次输入不一致'
    : '✓ 密码匹配，启用后全端生效';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h4>设置访问密码</h4>
          <p>密码存储在服务端（SHA-256 哈希）。任何设备访问此收件箱均需验证。</p>
        </div>
        <div className="modal-body">
          <div className="custom-input" style={{ padding: 0 }}>
            <input type={show ? 'text' : 'password'} value={p1} onChange={e => setP1(e.target.value)}
              placeholder="新密码（至少 4 位）" style={{ height: 40 }} />
            <button onClick={() => setShow(s => !s)} type="button"
              style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--muted)', width: 36, height: 36, cursor: 'pointer' }}>
              {show ? '◍' : '●'}
            </button>
          </div>
          <div className="custom-input" style={{ padding: 0, marginTop: 8 }}>
            <input type={show ? 'text' : 'password'} value={p2} onChange={e => setP2(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && valid && !busy) { setBusy(true); ctx.enable(p1).then(onClose); } }}
              placeholder="确认密码" style={{ height: 40 }} />
          </div>
          <div className={`modal-hint ${status}`}>{hint}</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-sm" disabled={!valid || busy}
            style={{ opacity: valid && !busy ? 1 : 0.5 }}
            onClick={() => { if (valid && !busy) { setBusy(true); ctx.enable(p1).then(onClose); } }}>
            {busy ? '设置中…' : '启用并锁定'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ──────────────────────────────────────────────────────────────
export default function LockProvider({ children }: { children: React.ReactNode }) {
  const [hasPassword, setHasPassword] = useState(false);
  const [locked, setLocked]           = useState(false);
  const [setupOpen, setSetupOpen]     = useState(false);

  // On mount: check if this inbox has a PIN set (server check via cookie)
  useEffect(() => {
    const email = getEmail();
    if (!email) return;
    fetch(`/api/inbox/${encodeURIComponent(email)}/pin`)
      .then(r => r.json())
      .then(d => {
        if (d.locked) {
          setHasPassword(true);
          // Check if we have a valid cookie already (cookie auto-sent)
          // Try a quick inbox fetch to see if we're authenticated
          fetch(`/api/inbox/${encodeURIComponent(email)}`)
            .then(r => {
              if (r.status === 401) setLocked(true);
              // if 200, cookie is valid — stay unlocked
            });
        }
      })
      .catch(() => {});
  }, []);

  // Set PIN: store on server, set cookie via /api/pin-session
  const enable = useCallback(async (pw: string) => {
    const email = getEmail();
    const pinOk = await apiSetPin(email, pw);
    if (!pinOk) return; // server rejected — abort silently
    // Set the PIN cookie via server so it's sent on all future requests
    const sessionRes = await fetch('/api/pin-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin: pw }),
    });
    if (!sessionRes.ok) return; // session creation failed — abort
    setHasPassword(true);
    setLocked(true);
  }, []);

  const lockNow = useCallback(() => setLocked(true), []);

  const disable = useCallback(async () => {
    const email = getEmail();
    const res = await apiDelPin(email);
    if (res === false) return; // server rejected — PIN cookie invalid, abort
    // Clear the PIN cookie
    await fetch('/api/pin-session', { method: 'DELETE' });
    setHasPassword(false);
    setLocked(false);
  }, []);

  // Unlock: verify PIN on server, server sets/refreshes cookie
  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const email = getEmail();
    const res = await fetch('/api/pin-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin }),
    });
    if (res.ok) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const ctx: LockCtx = {
    hasPassword, locked,
    enable, lockNow, disable, unlock,
    openSetup: () => setSetupOpen(true),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}

      {/* Screen lock — cookie-based, no race condition */}
      {locked && hasPassword && (
        <PinInput
          title="FixMail 已加锁"
          subtitle="输入访问密码以继续。"
          onSubmit={unlock}
        />
      )}

      <LockSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} ctx={ctx} />
    </Ctx.Provider>
  );
}
