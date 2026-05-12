'use client';

import { useState, useEffect } from 'react';
import AppNav from '@/components/AppNav';
import { Ic } from '@/components/icons';

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'fixmail.org';

// ─── Types ─────────────────────────────────────────────────────────────────
interface ShareItem { token: string; email: string; url: string; copied: boolean; expired: boolean; }
interface Toast { id: string; msg: string; }

// ─── Mini address banner ────────────────────────────────────────────────────
function CurrentAddressBanner() {
  const [addr, setAddr] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('fm_email');
    const exp   = Number(localStorage.getItem('fm_expire') || 0);
    if (saved && exp > Date.now()) setAddr(saved);
  }, []);
  if (!addr) return null;
  const [local, domain] = addr.split('@');
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,
      padding:'9px 16px',borderRadius:9,
      background:'var(--surface-2)',border:'.5px solid var(--line)',
      fontSize:13,color:'var(--muted)',marginBottom:16,
    }}>
      <svg width="14" height="14" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'var(--accent-ink)',flexShrink:0 }}>
        <path d="M8 28v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8"/><path d="M8 28h8l2 4h12l2-4h8"/><path d="M14 12l4-4h12l4 4 4 14H10z"/>
      </svg>
      <span>当前主邮箱：</span>
      <span className="mono" style={{ color:'var(--ink)',fontWeight:500 }}>{local}<span style={{ color:'var(--muted)' }}>@</span>{domain}</span>
      <span style={{ marginLeft:'auto',fontSize:11,color:'var(--muted-2)' }}>每个分享链接均配备独立临时邮箱</span>
    </div>
  );
}

// ─── Share section ─────────────────────────────────────────────────────────
function ShareSection({ onToast }: { onToast: (msg: string) => void }) {
  const [expiry, setExpiry]       = useState('24h');
  const [maxOpens, setMaxOpens]   = useState('1');
  const [pw, setPw]               = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [count, setCount]         = useState(1);
  const [links, setLinks]         = useState<ShareItem[]>([]);
  const [loading, setLoading]     = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expiry,
              maxOpens,
              password: pw,
              // For batch, append index to avoid duplicate emails
              customEmail: customEmail.trim()
                ? (count === 1 ? customEmail.trim() : `${customEmail.trim()}${i + 1}`)
                : '',
            }),
          }).then(r => r.json())
        )
      );
      setLinks(results.map(data => ({
        token: data.token,
        email: data.email,
        url: `${window.location.origin}${data.shareUrl}`,
        copied: false,
        expired: false,
      })));
      onToast(count === 1 ? '分享链接已生成' : `已生成 ${count} 个分享链接`);
    } catch { onToast('生成失败，请重试'); }
    finally { setLoading(false); }
  };

  const expireOne = async (idx: number) => {
    const link = links[idx];
    if (link.expired) return;
    await fetch(`/api/share/${link.token}`, { method: 'DELETE' }).catch(() => {});
    setLinks(arr => arr.map((l, i) => i === idx ? { ...l, expired: true } : l));
    onToast('链接已失效');
  };

  const expireAll = async () => {
    await Promise.all(links.filter(l => !l.expired).map(l =>
      fetch(`/api/share/${l.token}`, { method: 'DELETE' }).catch(() => {})
    ));
    setLinks(arr => arr.map(l => ({ ...l, expired: true })));
    onToast('全部链接已失效');
  };

  const copyOne = (idx: number) => {
    navigator.clipboard?.writeText(links[idx].url).catch(() => {});
    setLinks(arr => arr.map((l, i) => i === idx ? { ...l, copied: true } : l));
    setTimeout(() => setLinks(arr => arr.map((l, i) => i === idx ? { ...l, copied: false } : l)), 1400);
    onToast('链接已复制');
  };

  const copyAll = () => {
    const txt = links.map((l, i) => `${i + 1}. ${l.email}\n   ${l.url}`).join('\n\n');
    navigator.clipboard?.writeText(txt).catch(() => {});
    onToast(`${links.length} 条（邮箱 + 链接）已复制`);
  };

  const reset = () => setLinks([]);
  const isBatch = links.length > 1;
  const expiryLabel: Record<string, string> = { '10m': '10 分钟', '1h': '1 小时', '24h': '24 小时', '7d': '7 天' };

  return (
    <div className="share-section">
      <div className="share-head">
        <span className="share-tag">{Ic.link} 一次性链接</span>
        <h3>生成可分享的临时链接</h3>
        <p>每个分享链接配有独立临时邮箱。链接到期或被打开指定次数后自动失效，真实地址不会暴露。支持批量生成，便于一次性分发给多人。</p>
      </div>
      <div className="share-form">
        {/* ── Controls row 1 ── */}
        <div className="share-controls share-controls-4">
          <div className="share-control">
            <label>有效期</label>
            <select value={expiry} onChange={e => setExpiry(e.target.value)}>
              <option value="10m">10 分钟</option>
              <option value="1h">1 小时</option>
              <option value="24h">24 小时</option>
              <option value="7d">7 天</option>
            </select>
          </div>
          <div className="share-control">
            <label>最大打开次数</label>
            <select value={maxOpens} onChange={e => setMaxOpens(e.target.value)}>
              <option value="1">1 次（阅后即焚）</option>
              <option value="3">3 次</option>
              <option value="10">10 次</option>
              <option value="∞">不限</option>
            </select>
          </div>
          <div className="share-control">
            <label>访问密码（可选）</label>
            <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="留空则无需密码" />
          </div>
          <div className="share-control">
            <label>生成数量</label>
            <div className="batch-stepper">
              <button className="batch-btn" onClick={() => setCount(n => Math.max(1, n - 1))} disabled={count <= 1}>−</button>
              <input type="number" min={1} max={50} value={count}
                onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
              <button className="batch-btn" onClick={() => setCount(n => Math.min(50, n + 1))} disabled={count >= 50}>+</button>
              <div className="batch-quick">
                {[1, 5, 10, 25].map(n => (
                  <button key={n} className={`quick-chip${count === n ? ' active' : ''}`} onClick={() => setCount(n)}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Custom email row ── */}
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:2 }}>
          <div style={{
            display:'flex',alignItems:'center',flex:1,
            border:'.5px solid var(--line)',borderRadius:8,
            background:'var(--surface)',overflow:'hidden',
          }}>
            <span style={{ padding:'0 10px',fontSize:12.5,color:'var(--muted)',borderRight:'.5px solid var(--line)',height:36,display:'flex',alignItems:'center',whiteSpace:'nowrap',flexShrink:0 }}>
              自定义邮箱前缀
            </span>
            <input
              type="text"
              value={customEmail}
              onChange={e => setCustomEmail(e.target.value.replace(/[^a-zA-Z0-9._+\-]/g, ''))}
              placeholder={`留空则随机生成（如：mybox → mybox@${DOMAIN}）`}
              style={{ flex:1,border:'none',outline:'none',background:'transparent',padding:'0 12px',fontSize:13,height:36,color:'var(--ink)',minWidth:0 }}
            />
            {customEmail && (
              <span style={{ padding:'0 12px',fontSize:12,color:'var(--muted)',borderLeft:'.5px solid var(--line)',height:36,display:'flex',alignItems:'center',whiteSpace:'nowrap',flexShrink:0 }}>
                @{DOMAIN}
              </span>
            )}
          </div>
        </div>

        {/* ── Single result ── */}
        {!isBatch && (
          links.length ? (
            <div className={`share-result active`} style={{ flexDirection:'column',alignItems:'stretch',gap:10, opacity: links[0].expired ? 0.55 : 1 }}>
              {links[0].expired && (
                <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:6,background:'var(--surface-2)',fontSize:12,color:'var(--muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  此链接已手动失效
                </div>
              )}
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ fontSize:11,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',color:'var(--muted)',width:52,flexShrink:0 }}>邮箱地址</span>
                <span className="mono" style={{ flex:1,fontSize:13.5,color:'var(--ink)',fontWeight:600,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                  {links[0].email}
                </span>
                <button className="btn btn-sm" onClick={() => {
                  navigator.clipboard?.writeText(links[0].email).catch(()=>{});
                  onToast('邮箱地址已复制');
                }}>{Ic.copy}<span>复制邮箱</span></button>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ fontSize:11,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase',color:'var(--muted)',width:52,flexShrink:0 }}>分享链接</span>
                <span className="share-link mono" style={{ flex:1, textDecoration: links[0].expired ? 'line-through' : 'none' }}>{links[0].url}</span>
                <button className="btn btn-primary btn-sm" onClick={() => copyOne(0)} disabled={links[0].expired}>
                  {Ic.copy}<span>{links[0].copied ? '已复制' : '复制链接'}</span>
                </button>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <button
                  className="btn btn-sm"
                  style={{ color: links[0].expired ? 'var(--muted)' : 'var(--danger,#e5534b)', gap:6 }}
                  onClick={() => expireOne(0)}
                  disabled={links[0].expired}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  <span>{links[0].expired ? '已失效' : '立即失效'}</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>重新生成</button>
              </div>
            </div>
          ) : (
            <div className="share-result">
              <span className="share-link mono placeholder">https://fixmail.org/share/——————</span>
              <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
                {loading ? '生成中…' : '生成链接'}
              </button>
            </div>
          )
        )}

        {/* ── Batch result ── */}
        {isBatch && (
          <div className="batch-result">
            <div className="batch-result-head">
              <span><strong>{links.length}</strong> 个链接已生成</span>
              <div style={{ display:'flex',gap:6 }}>
                <button className="btn btn-sm" onClick={copyAll}>{Ic.copy}<span>复制全部</span></button>
                <button className="btn btn-sm" style={{ color:'var(--danger,#e5534b)' }} onClick={expireAll}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  <span>全部失效</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>重新生成</button>
              </div>
            </div>
            <div className="batch-list">
              {links.map((l, i) => (
                <div key={i} className="batch-item" style={{ gridTemplateColumns:'36px 1fr 1fr 32px 32px', opacity: l.expired ? 0.5 : 1 }}>
                  <span className="batch-idx mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mono" style={{ color:'var(--ink)',fontSize:12.5,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{l.email}</span>
                  <span className="batch-link mono" style={{ textDecoration: l.expired ? 'line-through' : 'none' }}>{l.url}</span>
                  <button className={`batch-copy${l.copied ? ' copied' : ''}`} onClick={() => copyOne(i)} disabled={l.expired} title="复制链接">
                    {l.copied ? Ic.check : Ic.copy}
                  </button>
                  <button
                    className="batch-copy"
                    onClick={() => expireOne(i)}
                    disabled={l.expired}
                    title={l.expired ? '已失效' : '立即失效'}
                    style={{ color: l.expired ? 'var(--muted)' : 'var(--danger,#e5534b)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!links.length && count > 1 && (
          <div className="share-result">
            <span className="share-link placeholder">将生成 {count} 个独立链接，每个仅可打开 {maxOpens} 次</span>
            <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
              {loading ? '生成中…' : '批量生成'}
            </button>
          </div>
        )}

        <div className="share-meta">
          <span className="share-meta-item">{Ic.clock} 有效期 <strong>{expiryLabel[expiry]}</strong></span>
          <span className="share-meta-item">{Ic.eye} 最多打开 <strong>{maxOpens}</strong> 次</span>
          <span className="share-meta-item">{Ic.shield} {pw ? <>密码保护：<strong>已启用</strong></> : '无密码保护'}</span>
          <span className="share-meta-item">{Ic.link} 数量 <strong>{count}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function SharePage() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(arr => [...arr, { id, msg }]);
    setTimeout(() => setToasts(arr => arr.filter(t => t.id !== id)), 1800);
  };

  return (
    <div className="app">
      <AppNav />

      <div className="mail-wrap" style={{ paddingTop: 24 }}>
        <div className="panel-head" style={{ border:'none',paddingBottom:0,marginBottom:4 }}>
          <div>
            <h2>分享链接</h2>
            <p style={{ margin:'6px 0 0',fontSize:13,color:'var(--muted)',lineHeight:1.55 }}>
              生成一次性链接，让他人以只读方式访问专属临时邮箱。链接自动过期，隐私安全。
            </p>
          </div>
        </div>

        <CurrentAddressBanner />
        <ShareSection onToast={pushToast} />
      </div>

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span className="check">{Ic.check}</span>{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
