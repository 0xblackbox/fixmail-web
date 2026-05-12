'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const [pw, setPw]       = useState('');
  const [show, setShow]   = useState(false);
  const [err, setErr]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [focus, setFocus] = useState(false);
  const ref               = useRef<HTMLInputElement>(null);
  const params            = useSearchParams();
  const router            = useRouter();

  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    const from = params.get('from') || '/';
    const res = await fetch(`/api/auth?from=${encodeURIComponent(from)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      const { redirect } = await res.json();
      router.replace(redirect || '/');
    } else {
      setErr('密码错误，请重试');
      setPw('');
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
          <h2>FixMail</h2>
          <p style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            请输入访问密码以继续
          </p>
        </div>
        <div
          className={`lock-input-wrap${focus ? ' focus' : ''}${err ? ' error' : ''}`}
          style={err ? { animation: 'shake .35s' } : {}}
        >
          <input
            ref={ref}
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={e => setPw(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={e => { if (e.key === 'Enter' && pw && !busy) submit(); }}
            placeholder="访问密码"
            autoComplete="current-password"
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
          disabled={!pw || busy}
        >
          {busy ? '验证中…' : '进入'}
        </button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
