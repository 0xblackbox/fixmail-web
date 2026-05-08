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

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
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

  useEffect(() => {
    if (pageStatus !== 'active' || ttl <= 0) return;
    const t = setInterval(() => setTtl(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [pageStatus, ttl]);

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

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-[#d97757] rounded-full animate-spin" />
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'expired') {
    return (
      <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">链接已失效</h1>
          <p className="text-sm text-gray-500">此分享链接不存在或已过期</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'consumed' && !selected) {
    return (
      <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">已完成</h1>
          <p className="text-sm text-gray-500">验证码已查看，此链接已自动关闭</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f8] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#d97757] rounded-lg flex items-center justify-center">
              <MailIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">FixMail</span>
          </div>
          <div className="flex items-center gap-2">
            {pageStatus === 'active' && ttl > 0 && (
              <div className={`flex items-center gap-1.5 text-sm ${ttl < 120 ? 'text-red-500' : 'text-gray-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${ttl < 120 ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="font-mono">{formatTTL(ttl)}</span>
              </div>
            )}
            {pageStatus === 'consumed' && (
              <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium">链接已关闭</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">用这个地址去注册</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-gray-800 text-sm font-medium truncate">
              {shareInfo?.email || '加载中...'}
            </div>
            <button onClick={handleCopy}
              className={`shrink-0 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                copied
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-[#d97757] text-white hover:bg-[#c4694a]'
              }`}>
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {selected ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 bg-green-50/60">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <p className="text-green-600 text-xs font-medium">验证码已收到 · 链接已自动关闭</p>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{selected.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">来自：{selected.from}</p>
              </div>
              <div className="p-5">
                {selected.html ? (
                  <iframe srcDoc={selected.html} className="w-full min-h-64 border-0 rounded-xl"
                    sandbox="allow-popups" title="邮件内容" />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.text || '（无内容）'}
                  </pre>
                )}
              </div>
            </>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-[#d97757] rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-400 font-medium">等待验证码邮件</p>
              <p className="text-xs text-gray-300 mt-1">每 5 秒自动刷新</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {messages.map(msg => (
                <li key={msg.id} onClick={() => handleView(msg.id)}
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 text-sm truncate">{msg.from}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{msg.subject}</p>
                    </div>
                    <span className="text-xs bg-[#d97757]/10 text-[#d97757] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0">
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
