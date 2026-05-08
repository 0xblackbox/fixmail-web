'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface ShareInfo {
  email: string;
  status: 'active' | 'consumed';
  ttl: number;
}

interface Message {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
}

interface MessageDetail extends Message {
  html: string;
  text: string;
}

type PageStatus = 'loading' | 'active' | 'consumed' | 'expired';

function formatTTL(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [shareInfo, setShareInfo]   = useState<ShareInfo | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [selected, setSelected]     = useState<MessageDetail | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [copied, setCopied]         = useState(false);
  const [ttl, setTtl]               = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // 初始化：拉取分享信息
  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(res => {
        if (res.status === 404) { setPageStatus('expired'); return null; }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setShareInfo(data);
        setTtl(data.ttl);
        setPageStatus(data.status === 'consumed' ? 'consumed' : 'active');
      })
      .catch(() => setPageStatus('expired'));
  }, [token]);

  // 轮询收件箱
  const pollInbox = useCallback(async () => {
    const res = await fetch(`/api/share/${token}/inbox`);
    if (res.status === 404) { setPageStatus('expired'); stopPolling(); return; }
    if (res.status === 410) { setPageStatus('consumed'); stopPolling(); return; }
    const data = await res.json();
    setMessages(data.messages || []);
  }, [token]);

  useEffect(() => {
    if (pageStatus !== 'active') { stopPolling(); return; }
    pollInbox();
    pollRef.current = setInterval(pollInbox, 5000);
    return stopPolling;
  }, [pageStatus, pollInbox]);

  // TTL 倒计时
  useEffect(() => {
    if (pageStatus !== 'active' || ttl <= 0) return;
    const t = setInterval(() => setTtl(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [pageStatus, ttl]);

  // 查看邮件（消费链接）
  const handleView = async (id: string) => {
    const res = await fetch(`/api/share/${token}/message/${id}`);
    if (res.status === 410) { setPageStatus('consumed'); return; }
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data);
    setPageStatus('consumed');
    stopPolling();
  };

  const handleCopy = () => {
    if (!shareInfo?.email) return;
    navigator.clipboard.writeText(shareInfo.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 页面状态渲染 ─────────────────────────────────

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (pageStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-gray-700 mb-2">链接已失效</h1>
          <p className="text-gray-500 text-sm">此分享链接不存在或已过期</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'consumed' && !selected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-700 mb-2">已完成</h1>
          <p className="text-gray-500 text-sm">验证码已查看，此链接已自动关闭</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">临时邮箱</span>
          {pageStatus === 'active' && ttl > 0 && (
            <span className={`text-sm font-mono ${ttl < 120 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
              {formatTTL(ttl)} 后失效
            </span>
          )}
          {pageStatus === 'consumed' && (
            <span className="text-sm text-green-600 font-medium">链接已关闭</span>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-8 flex flex-col gap-5">
        {/* 邮箱地址 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl px-6 py-6">
          <p className="text-blue-200 text-sm mb-3">用这个邮箱地址去注册</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/15 rounded-xl px-4 py-3 font-mono text-white font-semibold text-sm truncate">
              {shareInfo?.email || '加载中...'}
            </div>
            <button onClick={handleCopy}
              className="px-4 py-3 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shrink-0">
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
        </div>

        {/* 收件区域 */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {selected ? (
            /* 显示邮件内容 */
            <>
              <div className="px-5 py-4 border-b bg-green-50">
                <p className="text-green-600 text-xs font-medium mb-1">✓ 验证码已收到 · 链接已自动关闭</p>
                <h3 className="font-semibold text-gray-800 text-sm">{selected.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">来自：{selected.from}</p>
              </div>
              <div className="p-5">
                {selected.html ? (
                  <iframe srcDoc={selected.html} className="w-full min-h-64 border-0 rounded-lg"
                    sandbox="allow-popups" title="邮件内容" />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.text || '（无内容）'}
                  </pre>
                )}
              </div>
            </>
          ) : messages.length === 0 ? (
            /* 等待中 */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-400">等待验证码邮件...</p>
              <p className="text-xs text-gray-300 mt-1">每 5 秒自动刷新</p>
            </div>
          ) : (
            /* 邮件列表 */
            <ul className="divide-y divide-gray-100">
              {messages.map(msg => (
                <li key={msg.id} onClick={() => handleView(msg.id)}
                  className="px-5 py-4 cursor-pointer hover:bg-blue-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{msg.from}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{msg.subject}</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0">
                      点击查看
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          查看验证码后此链接将自动关闭 · 有效期 30 分钟
        </p>
      </div>
    </div>
  );
}
