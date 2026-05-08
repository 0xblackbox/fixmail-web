'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'fixmail.org';
const REFRESH_INTERVAL = 10;
const EMAIL_TTL = 10 * 60 * 1000;

interface Message {
  id: string;
  from: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  date: string;
}

interface MessageDetail extends Message {
  html: string;
  text: string;
}

function formatTimeLeft(ms: number) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export default function Home() {
  const [email, setEmail]         = useState('');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [selected, setSelected]   = useState<MessageDetail | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [apiError, setApiError]   = useState('');
  const [expireAt, setExpireAt]   = useState(0);
  const [timeLeft, setTimeLeft]   = useState('');
  const [shareList, setShareList] = useState<{ email: string; url: string; copiedUrl: boolean }[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [batchCount, setBatchCount]     = useState(1);
  const [copyAllDone, setCopyAllDone]   = useState(false);

  const countdownRef = useRef(REFRESH_INTERVAL);
  const emailRef     = useRef('');

  const applyEmail = useCallback((addr: string, expire?: number) => {
    const exp = expire ?? Date.now() + EMAIL_TTL;
    setEmail(addr);
    emailRef.current = addr;
    setExpireAt(exp);
    setMessages([]);
    setSelected(null);
    setApiError('');
    localStorage.setItem('tempmail_email', addr);
    localStorage.setItem('tempmail_expire', String(exp));
  }, []);

  const fetchMessages = useCallback(async (addr: string) => {
    if (!addr) return;
    setLoading(true);
    setApiError('');
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setApiError('收件箱加载失败，请点刷新重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateEmail = useCallback(async () => {
    setApiError('');
    try {
      const res = await fetch('/api/generate');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyEmail(data.email);
      return data.email as string;
    } catch {
      setApiError('生成邮箱失败，请刷新页面重试');
      return '';
    }
  }, [applyEmail]);

  useEffect(() => {
    const saved   = localStorage.getItem('tempmail_email');
    const expireS = localStorage.getItem('tempmail_expire');
    const expire  = expireS ? Number(expireS) : 0;
    if (saved && expire > Date.now()) {
      emailRef.current = saved;
      setEmail(saved);
      setExpireAt(expire);
      fetchMessages(saved);
    } else {
      generateEmail().then(addr => { if (addr) fetchMessages(addr); });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        fetchMessages(emailRef.current);
        countdownRef.current = REFRESH_INTERVAL;
        setCountdown(REFRESH_INTERVAL);
      }
      setExpireAt(prev => {
        const left = prev - Date.now();
        setTimeLeft(formatTimeLeft(left));
        if (left <= 0 && emailRef.current) {
          generateEmail().then(addr => { if (addr) fetchMessages(addr); });
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchMessages, generateEmail]);

  const handleRefresh = () => {
    fetchMessages(emailRef.current);
    countdownRef.current = REFRESH_INTERVAL;
    setCountdown(REFRESH_INTERVAL);
  };

  const handleNewEmail = async () => {
    const addr = await generateEmail();
    if (addr) { fetchMessages(addr); countdownRef.current = REFRESH_INTERVAL; setCountdown(REFRESH_INTERVAL); }
  };

  const handleSelectMessage = async (id: string) => {
    setApiError('');
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(emailRef.current)}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelected(await res.json());
    } catch {
      setApiError('邮件加载失败，请重试');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditConfirm = () => {
    const val = editValue.trim().toLowerCase();
    if (!val) { setEditError('用户名不能为空'); return; }
    if (!/^[a-z0-9._+\-]+$/.test(val)) { setEditError('只能包含字母、数字、点、下划线'); return; }
    applyEmail(`${val}@${DOMAIN}`);
    fetchMessages(`${val}@${DOMAIN}`);
    countdownRef.current = REFRESH_INTERVAL;
    setCountdown(REFRESH_INTERVAL);
    setEditMode(false);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const handleCreateShare = async () => {
    setShareLoading(true);
    try {
      const results = await Promise.all(
        Array.from({ length: batchCount }, () =>
          fetch('/api/share', { method: 'POST' }).then(r => r.json())
        )
      );
      const newItems = results.map(data => ({
        email: data.email,
        url: `${window.location.origin}${data.shareUrl}`,
        copiedUrl: false,
      }));
      setShareList(prev => [...newItems, ...prev]);
    } catch {
      setApiError('生成分享链接失败，请重试');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyOne = (index: number) => {
    navigator.clipboard.writeText(shareList[index].url);
    setShareList(prev => prev.map((item, i) => i === index ? { ...item, copiedUrl: true } : item));
    setTimeout(() => setShareList(prev => prev.map((item, i) => i === index ? { ...item, copiedUrl: false } : item)), 2000);
  };

  const handleCopyAll = () => {
    const text = shareList.map((s, i) => `${i + 1}. ${s.email}\n   ${s.url}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 2000);
  };

  const isExpiringSoon = expireAt - Date.now() < 60000;

  return (
    <div className="min-h-screen bg-[#f9f9f8] flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#d97757] rounded-lg flex items-center justify-center">
              <MailIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900 tracking-tight">FixMail</span>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft && (
              <div className={`flex items-center gap-1.5 text-sm ${isExpiringSoon ? 'text-red-500' : 'text-gray-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isExpiringSoon ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="font-mono">{timeLeft}</span>
              </div>
            )}
            <span className="text-xs text-gray-400 hidden sm:block bg-gray-50 px-3 py-1 rounded-full">10 分钟自动销毁</span>
          </div>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {apiError && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="text-red-600 text-sm">{apiError}</span>
            <button onClick={() => setApiError('')} className="text-red-300 hover:text-red-500 transition-colors text-xl leading-none ml-4">×</button>
          </div>
        </div>
      )}

      {/* ── Email Bar ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">你的临时邮箱</p>

          {editMode ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50 focus-within:border-[#d97757] focus-within:ring-2 focus-within:ring-[#d97757]/10 transition-all">
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => { setEditValue(e.target.value); setEditError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                  placeholder="输入用户名"
                  className="flex-1 px-4 py-3 font-mono text-gray-800 text-base outline-none bg-transparent"
                />
                <span className="px-4 text-gray-400 font-mono text-sm select-none border-l border-gray-200 py-3">@{DOMAIN}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleEditConfirm}
                  className="px-5 py-3 bg-[#d97757] text-white rounded-xl font-medium hover:bg-[#c4694a] transition-colors text-sm">
                  确认
                </button>
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 font-mono text-gray-800 text-base font-medium truncate">
                {email || <span className="text-gray-300 animate-pulse">生成中...</span>}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button onClick={handleCopy}
                  className={`px-5 py-3 rounded-xl font-medium text-sm transition-all ${
                    copied
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-[#d97757] text-white hover:bg-[#c4694a]'
                  }`}>
                  {copied ? '已复制 ✓' : '复制'}
                </button>
                <button onClick={() => { setEditValue(email.split('@')[0] || ''); setEditError(''); setEditMode(true); }}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">
                  自定义
                </button>
                <button onClick={handleRefresh}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm tabular-nums">
                  刷新 {countdown}s
                </button>
                <button onClick={handleNewEmail}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">
                  随机换
                </button>
              </div>
            </div>
          )}
          {editError && <p className="text-red-500 text-xs mt-2">{editError}</p>}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Message List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-gray-700 text-sm">收件箱</h2>
              {messages.length > 0 && (
                <span className="bg-[#d97757]/10 text-[#d97757] text-xs px-2 py-0.5 rounded-full font-medium">
                  {messages.length}
                </span>
              )}
            </div>
            {loading && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <MailIcon className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium">等待邮件中</p>
              <p className="text-xs text-gray-300 mt-1">每 {REFRESH_INTERVAL} 秒自动刷新</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 overflow-auto flex-1">
              {messages.map(msg => (
                <li key={msg.id} onClick={() => handleSelectMessage(msg.id)}
                  className={`px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selected?.id === msg.id ? 'bg-orange-50/60 border-l-2 border-[#d97757]' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 text-sm truncate">{msg.from}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{msg.subject}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 mt-0.5">{formatTime(msg.receivedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message Viewer */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
          {selected ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{selected.subject}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-6 bg-[#d97757]/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[#d97757] text-xs font-semibold">
                      {selected.from?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">{selected.from}</p>
                    <p className="text-xs text-gray-400">{new Date(selected.receivedAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {selected.html ? (
                  <iframe
                    srcDoc={selected.html}
                    className="w-full h-full min-h-96 border-0 rounded-xl"
                    sandbox="allow-popups"
                    title="邮件内容"
                  />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.text || '（无内容）'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <EyeIcon className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium">选择一封邮件查看</p>
              <p className="text-xs text-gray-300 mt-1">点击左侧列表中的邮件</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Share Links ── */}
      <div className="max-w-5xl mx-auto w-full px-6 pb-5">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-700 text-sm">一次性分享链接</h3>
              <p className="text-xs text-gray-400 mt-0.5">对方查看验证码后自动关闭 · 30 分钟有效</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {[1, 3, 5, 10].map(n => (
                  <button key={n} onClick={() => setBatchCount(n)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      batchCount === n ? 'bg-white text-[#d97757] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={handleCreateShare} disabled={shareLoading}
                className="px-4 py-2 bg-[#d97757] text-white rounded-lg text-sm font-medium hover:bg-[#c4694a] transition-colors disabled:opacity-50">
                {shareLoading ? '生成中...' : `生成 ${batchCount} 个`}
              </button>
            </div>
          </div>

          {shareList.length > 0 ? (
            <>
              <div className="divide-y divide-gray-50">
                {shareList.map((item, i) => (
                  <div key={i} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                    <span className="text-xs text-gray-300 w-5 shrink-0 text-center font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 mb-1">邮箱地址</p>
                        <p className="text-xs font-mono text-gray-700 truncate">{item.email}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 mb-1">分享链接</p>
                        <p className="text-xs font-mono text-[#d97757] truncate">{item.url}</p>
                      </div>
                    </div>
                    <button onClick={() => handleCopyOne(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        item.copiedUrl
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {item.copiedUrl ? '已复制 ✓' : '复制'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="text-xs text-gray-400">共 {shareList.length} 条</span>
                <div className="flex gap-2">
                  <button onClick={handleCopyAll}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copyAllDone ? 'bg-green-50 text-green-600' : 'bg-[#d97757] text-white hover:bg-[#c4694a]'
                    }`}>
                    {copyAllDone ? '已全部复制 ✓' : '一键复制全部'}
                  </button>
                  <button onClick={() => setShareList([])}
                    className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300 transition-colors">
                    清空
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">点击「生成」创建一次性链接</p>
              <p className="text-xs text-gray-300 mt-1">可批量生成，每个链接只能使用一次</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="max-w-5xl mx-auto w-full px-6 pb-8">
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 shadow-sm">
          <h3 className="font-medium text-gray-700 text-sm mb-3">使用说明</h3>
          <ol className="text-sm text-gray-500 space-y-1.5 list-decimal list-inside">
            <li>点击「自定义」设置用户名，或「随机换」生成随机地址</li>
            <li>复制邮箱地址，在需要注册的网站填入</li>
            <li>验证邮件将自动出现在收件箱（约 10 秒内）</li>
            <li>邮件和地址 10 分钟后自动销毁，无需手动操作</li>
          </ol>
        </div>
      </footer>
    </div>
  );
}
