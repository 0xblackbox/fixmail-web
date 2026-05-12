'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppNav from '@/components/AppNav';
import { Ic, Avatar, colorFor } from '@/components/icons';
import { useLock } from '@/components/LockProvider';

// ─── Config ────────────────────────────────────────────────────────────────
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'fixmail.org';
const POLL_MS = 10_000;
const EMAIL_TTL = 10 * 60 * 1000;

// ─── Types ─────────────────────────────────────────────────────────────────
interface Msg { id: string; from: string; fromAddress: string; subject: string; receivedAt: string; }
interface MsgDetail extends Msg { html?: string; text?: string; }
interface Toast { id: string; msg: string; }

// ─── Helpers ───────────────────────────────────────────────────────────────
const ADJ  = ['calm','brisk','mellow','sharp','silent','fuzzy','golden','spry','pixel','ember','drift','loop','echo','linen','slate'];
const NOUN = ['fox','kite','oak','reef','moon','heron','spark','ridge','willow','stone','fern','dune','wren','fig','tide'];
const randLocal = () =>
  `${ADJ[Math.floor(Math.random()*ADJ.length)]}-${NOUN[Math.floor(Math.random()*NOUN.length)]}-${Math.floor(Math.random()*900)+100}`;

const fmtCountdown = (ms: number) => {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

const fmtRel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

const tagFor = (subject: string): { tag: string; label: string } => {
  const s = subject.toLowerCase();
  if (s.includes('验证码') || s.includes('code') || s.includes('otp') || s.includes('verification'))
    return { tag: 'code', label: '验证码' };
  if (s.includes('magic') || s.includes('login') || s.includes('登录') || s.includes('sign in'))
    return { tag: 'code', label: '魔法链接' };
  if (s.includes('security') || s.includes('安全') || s.includes('alert') || s.includes('警告'))
    return { tag: 'warn', label: '安全' };
  if (s.includes('receipt') || s.includes('收据') || s.includes('invoice') || s.includes('order'))
    return { tag: 'default', label: '收据' };
  return { tag: 'default', label: '通知' };
};

// ─── Address card ──────────────────────────────────────────────────────────
const RENEW_MS = 10 * 60 * 1000; // 续期每次加 10 分钟

function AddressCard({
  local, domain, ttl, ttlMax, onCopy, onCustom, onRefresh, onRenew,
}: {
  local: string; domain: string; ttl: number; ttlMax: number;
  onCopy: () => void; onCustom: () => void; onRefresh: () => void; onRenew: () => void;
}) {
  const urgent = ttl > 0 && ttl < 60_000; // 不足 1 分钟
  return (
    <div className="address-row">
      <div className="address-card">
        <div style={{ width:42,height:42,borderRadius:10,background:'var(--accent-soft)',display:'grid',placeItems:'center',color:'var(--accent-ink)',flexShrink:0 }}>
          <svg width="22" height="22" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 28v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8"/>
            <path d="M8 28h8l2 4h12l2-4h8"/>
            <path d="M14 12l4-4h12l4 4 4 14H10z"/>
          </svg>
        </div>
        <div className="address-meta">
          <div className="address-label">你的临时邮箱</div>
          <div className="address-value mono">
            <span>{local}</span>
            <span className="at">@</span>
            <span className="domain">{domain}</span>
          </div>
        </div>
        <div className="address-actions">
          <button className="btn" onClick={onCopy}>{Ic.copy}<span>复制</span></button>
          <button className="btn" onClick={onCustom}>{Ic.edit}<span>自定义</span></button>
          <button className="btn btn-icon-sq" onClick={onRefresh}>{Ic.refresh}</button>
        </div>
      </div>
      <div className="timer-card" style={urgent ? { borderColor:'var(--danger,#e5534b)' } : {}}>
        <div className="timer-label" style={urgent ? { color:'var(--danger,#e5534b)' } : {}}>
          {urgent ? '即将过期' : '剩余时间'}
        </div>
        <div className="timer-value mono" style={urgent ? { color:'var(--danger,#e5534b)' } : {}}>
          {fmtCountdown(ttl)}
        </div>
        <div className="timer-bar"><i style={{ width:`${Math.max(0,Math.min(100,(ttl/ttlMax)*100))}%`, background: urgent ? 'var(--danger,#e5534b)' : undefined }} /></div>
        <button
          className="btn btn-sm"
          style={{ marginTop:8, width:'100%', justifyContent:'center', fontSize:12 }}
          onClick={onRenew}
          title="延长 10 分钟"
        >
          {Ic.clock}<span>续期 +10 分钟</span>
        </button>
      </div>
    </div>
  );
}

// ─── Inbox list ────────────────────────────────────────────────────────────
function InboxList({ msgs, selectedId, onSelect, search, setSearch, loading }: {
  msgs: Msg[]; selectedId: string | null; onSelect: (id: string) => void;
  search: string; setSearch: (s: string) => void; loading: boolean;
}) {
  const filtered = msgs.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.from.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
  });
  return (
    <aside className="inbox">
      <div className="inbox-head">
        <div className="inbox-title">
          <h2>收件箱</h2>
          <span className="inbox-count">{msgs.length} 封</span>
        </div>
        <span className="badge-live">
          <i style={{ display:'inline-block',width:6,height:6,borderRadius:'50%',background:'var(--accent)',animation:loading?'none':'pulse 1.6s infinite' }} />
          实时
        </span>
      </div>
      <div className="inbox-search">
        {Ic.search}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索发件人、主题…" />
      </div>
      <div className="inbox-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>{loading ? '加载中…' : msgs.length === 0 ? '等待邮件到达' : '无匹配结果'}</strong>
            <p>{loading ? '正在获取最新邮件' : msgs.length === 0 ? '将你的邮箱地址填写到需要验证的网站' : '调整搜索词后重试'}</p>
          </div>
        ) : filtered.map(m => {
          const { tag, label } = tagFor(m.subject);
          const color = colorFor(m.from);
          return (
            <div key={m.id} className={`mail-item${selectedId === m.id ? ' selected' : ''}`} onClick={() => onSelect(m.id)}>
              <Avatar name={m.from} color={color} />
              <div className="mail-body">
                <div className="mail-from">{m.from}</div>
                <div className="mail-subject">{m.subject}</div>
                <div className="mail-tag-row">
                  <span className={`mail-tag ${tag}`}>{label}</span>
                </div>
              </div>
              <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0 }}>
                <span className="mail-time">{fmtRel(m.receivedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Reader ────────────────────────────────────────────────────────────────
function Reader({ mail, currentAddress, onDelete, onCopyOtp }: {
  mail: MsgDetail | null; currentAddress: string;
  onDelete: (id: string) => void; onCopyOtp: (otp: string) => void;
}) {
  const otpMatch = mail ? (mail.subject + ' ' + (mail.text || '')).match(/\b(\d{4,8})\b/) : null;
  const otp = otpMatch ? otpMatch[1] : null;

  if (!mail) {
    return (
      <section className="reader">
        <div className="reader-empty">
          <div className="reader-empty-icon">{Ic.inbox}</div>
          <strong>未选择邮件</strong>
          <p>从左侧列表中选择一封邮件以查看内容。新邮件将实时到达。</p>
        </div>
      </section>
    );
  }

  const color = colorFor(mail.from);
  return (
    <section className="reader">
      <div className="reader-toolbar">
        <div className="reader-toolbar-left">
          {otp && <button className="btn btn-sm" onClick={() => onCopyOtp(otp)}>{Ic.copy}<span>复制验证码</span></button>}
        </div>
        <div className="reader-toolbar-left">
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(mail.id)}>{Ic.trash}</button>
        </div>
      </div>
      <div className="reader-body">
        <h1 className="reader-subject">{mail.subject}</h1>
        <div className="reader-meta">
          <Avatar name={mail.from} color={color} size={38} />
          <div className="reader-meta-text">
            <div className="reader-from">{mail.from} <span className="reader-from-email">&lt;{mail.fromAddress}&gt;</span></div>
            <div className="reader-to">发送至：<span className="mono">{currentAddress}</span></div>
          </div>
          <div className="reader-time">{new Date(mail.receivedAt).toLocaleString('zh-CN')}</div>
        </div>
        <div className="reader-content">
          {otp && <div className="otp">{otp.replace(/(\d{3})(\d{3,5})/, '$1 $2')}</div>}
          {mail.html ? (
            <iframe srcDoc={mail.html} style={{ width:'100%',minHeight:320,border:'none',borderRadius:8 }}
              sandbox="allow-popups" title="邮件内容" />
          ) : (
            <pre style={{ whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,lineHeight:1.75,color:'var(--ink-2)',margin:0 }}>
              {mail.text || '（此邮件没有正文）'}
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Custom address modal ──────────────────────────────────────────────────
function CustomModal({ open, onClose, onSave, current, domain }: {
  open: boolean; onClose: () => void;
  onSave: (local: string) => void; current: string; domain: string;
}) {
  const [local, setLocal] = useState('');
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocal(current.split('@')[0] || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, current]);

  if (!open) return null;
  const valid = /^[a-z0-9][a-z0-9._-]{0,31}$/i.test(local);
  const status = local.length === 0 ? '' : valid ? 'ok' : 'error';
  const hint = local.length === 0 ? '支持字母、数字、点、连字符；最短 1 位'
    : valid ? '✓ 可用 — 此地址将立即生效' : '格式不合法，请以字母或数字开头';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h4>自定义邮箱地址</h4>
          <p>选一个好记的名字。地址绑定到当前会话，可随时切换。</p>
        </div>
        <div className="modal-body">
          <div className={`custom-input${focus ? ' focus' : ''}`}>
            <input ref={inputRef} type="text" value={local} placeholder="你的用户名"
              onChange={e => setLocal(e.target.value.toLowerCase())}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              onKeyDown={e => { if (e.key === 'Enter' && valid) onSave(local); }} />
            <span className="at-sep">@</span>
            <span style={{ fontFamily:'"Geist Mono",monospace',fontSize:13,color:'var(--ink-2)',paddingRight:12,paddingLeft:4 }}>{domain}</span>
          </div>
          <div className={`modal-hint ${status}`}>{hint}</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-sm" disabled={!valid}
            style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(local)}>保存地址</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [local, setLocal]       = useState('');
  const [ttl, setTtl]           = useState(EMAIL_TTL);
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail]     = useState<MsgDetail | null>(null);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts]     = useState<Toast[]>([]);
  const lock = useLock();

  const addrRef = useRef('');
  const address = local ? `${local}@${DOMAIN}` : '';

  const pushToast = useCallback((msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(arr => [...arr, { id, msg }]);
    setTimeout(() => setToasts(arr => arr.filter(t => t.id !== id)), 1800);
  }, []);

  const fetchMsgs = useCallback(async (addr: string) => {
    if (!addr) return;
    setLoading(true);
    try {
      // Cookie is sent automatically — no manual headers needed
      const res = await fetch(`/api/inbox/${encodeURIComponent(addr)}`);
      if (res.ok) {
        setMsgs((await res.json()).messages || []);
      } else if (res.status === 401) {
        // PIN protected and cookie missing/wrong — show lock screen
        lock.lockNow();
      }
    } finally { setLoading(false); }
  }, [lock]);

  const generateEmail = useCallback(async () => {
    try {
      const res = await fetch('/api/generate');
      if (!res.ok) throw new Error();
      const { email } = await res.json();
      const [l] = (email as string).split('@');
      setLocal(l); addrRef.current = email;
      setTtl(EMAIL_TTL); setMsgs([]); setSelectedId(null); setDetail(null);
      localStorage.setItem('fm_email', email);
      localStorage.setItem('fm_expire', String(Date.now() + EMAIL_TTL));
      return email as string;
    } catch {
      const l = randLocal();
      const email = `${l}@${DOMAIN}`;
      setLocal(l); addrRef.current = email; setTtl(EMAIL_TTL);
      localStorage.setItem('fm_email', email);
      localStorage.setItem('fm_expire', String(Date.now() + EMAIL_TTL));
      return email;
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('fm_email');
    const exp   = Number(localStorage.getItem('fm_expire') || 0);
    if (saved && exp > Date.now()) {
      const [l] = saved.split('@');
      setLocal(l); addrRef.current = saved; setTtl(exp - Date.now());
      fetchMsgs(saved);
    } else {
      generateEmail().then(addr => { if (addr) fetchMsgs(addr); });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    const tick = setInterval(() => {
      setTtl(prev => {
        const next = prev - 1000;
        if (next <= 0) { generateEmail().then(addr => { if (addr) fetchMsgs(addr); }); return EMAIL_TTL; }
        return next;
      });
    }, 1000);

    // 轮询：后台时暂停，切回前台立即拉取一次
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPoll = () => {
      if (poll) return;
      poll = setInterval(() => { if (addrRef.current) fetchMsgs(addrRef.current); }, POLL_MS);
    };
    const stopPoll = () => {
      if (poll) { clearInterval(poll); poll = null; }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stopPoll();
      } else {
        if (addrRef.current) fetchMsgs(addrRef.current); // 立即拉一次
        startPoll();
      }
    };

    startPoll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(tick);
      stopPoll();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchMsgs, generateEmail]);

  const onSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(addrRef.current)}/${id}`);
      if (res.ok) {
        setDetail(await res.json());
      } else if (res.status === 401) {
        lock.lockNow();
      }
    } catch {}
  }, [lock]);

  const onDelete = useCallback((id: string) => {
    setMsgs(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
    pushToast('邮件已删除');
  }, [selectedId, pushToast]);

  const onCopyOtp = useCallback((otp: string) => {
    navigator.clipboard?.writeText(otp).catch(() => {});
    pushToast(`验证码 ${otp} 已复制`);
  }, [pushToast]);

  const onCopy = useCallback(() => {
    navigator.clipboard?.writeText(address).catch(() => {});
    pushToast('邮箱地址已复制');
  }, [address, pushToast]);

  const onRefresh = useCallback(async () => {
    const addr = await generateEmail();
    if (addr) fetchMsgs(addr);
    pushToast('已生成新邮箱地址');
  }, [generateEmail, fetchMsgs, pushToast]);

  const onRenew = useCallback(() => {
    setTtl(prev => {
      const next = prev + RENEW_MS;
      const newExp = Date.now() + next;
      localStorage.setItem('fm_expire', String(newExp));
      return next;
    });
    pushToast('已续期 10 分钟');
  }, [pushToast]);

  const onSaveCustom = useCallback((l: string) => {
    const email = `${l}@${DOMAIN}`;
    setLocal(l); addrRef.current = email; setTtl(EMAIL_TTL);
    setMsgs([]); setSelectedId(null); setDetail(null);
    localStorage.setItem('fm_email', email);
    localStorage.setItem('fm_expire', String(Date.now() + EMAIL_TTL));
    fetchMsgs(email); setModalOpen(false);
    pushToast(`地址已设置为 ${email}`);
  }, [fetchMsgs, pushToast]);

  const selectedMsg = detail?.id === selectedId ? detail : null;

  return (
    <div className="app">
      <AppNav loading={loading} />

      <div className="address-wrap">
        <AddressCard local={local || '…'} domain={DOMAIN} ttl={ttl} ttlMax={EMAIL_TTL}
          onCopy={onCopy} onCustom={() => setModalOpen(true)} onRefresh={onRefresh} onRenew={onRenew} />
      </div>

      <div className="mail-wrap">
        <div className="mail-grid">
          <InboxList msgs={msgs} selectedId={selectedId} onSelect={onSelect}
            search={search} setSearch={setSearch} loading={loading} />
          <Reader mail={selectedMsg} currentAddress={address}
            onDelete={onDelete} onCopyOtp={onCopyOtp} />
        </div>
      </div>

      <CustomModal open={modalOpen} onClose={() => setModalOpen(false)}
        onSave={onSaveCustom} current={address} domain={DOMAIN} />

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast"><span className="check">{Ic.check}</span>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
