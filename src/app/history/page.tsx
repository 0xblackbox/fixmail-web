'use client';

import { useState, useEffect } from 'react';
import AppNav from '@/components/AppNav';
import { Ic } from '@/components/icons';

interface HistoryItem {
  addr: string;
  at: string;
  count: number;
  status: 'active' | 'expired';
}

// In a real implementation this would persist to localStorage or server.
// For now we build history from localStorage + a few mock past entries.
function useHistory(): [HistoryItem[], () => void] {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const live: HistoryItem[] = [];
    const saved  = localStorage.getItem('fm_email');
    const exp    = Number(localStorage.getItem('fm_expire') || 0);
    if (saved) {
      live.push({
        addr: saved,
        at: '当前会话',
        count: 0,
        status: exp > Date.now() ? 'active' : 'expired',
      });
    }
    // Merge with stored history list
    const stored = JSON.parse(localStorage.getItem('fm_history') || '[]') as HistoryItem[];
    // Deduplicate by addr
    const all = [...live, ...stored.filter(h => h.addr !== saved)];
    setItems(all);
  }, []);

  const clear = () => {
    // Keep only current active session
    const active = items.filter(h => h.status === 'active');
    setItems(active);
    const toStore = active.filter(h => h.at !== '当前会话');
    localStorage.setItem('fm_history', JSON.stringify(toStore));
  };

  return [items, clear];
}

export default function HistoryPage() {
  const [history, clearHistory] = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    if (confirmClear) { clearHistory(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
  };

  return (
    <div className="app">
      <AppNav />

      <div className="mail-wrap" style={{ paddingTop: 24 }}>
        <div className="panel-view">
          <div className="panel-head">
            <div>
              <h2>历史会话</h2>
              <p>当前浏览器中使用过的临时邮箱地址。已过期地址的邮件已从服务器删除。</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={handleClear}
              style={confirmClear ? { color:'var(--danger)',borderColor:'var(--danger)' } : {}}>
              {Ic.trash}
              <span>{confirmClear ? '确认清空？' : '清空全部'}</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 240 }}>
              <strong>暂无历史记录</strong>
              <p>使用过的临时邮箱地址将会出现在这里。</p>
            </div>
          ) : (
            <div className="history-table">
              <div className="history-row history-head">
                <span>地址</span>
                <span>创建时间</span>
                <span>邮件数</span>
                <span>状态</span>
                <span></span>
              </div>
              {history.map((h, i) => (
                <div key={i} className="history-row">
                  <span className="mono" style={{ color:'var(--ink)',fontWeight:500,fontSize:13 }}>{h.addr}</span>
                  <span style={{ color:'var(--muted)' }}>{h.at}</span>
                  <span style={{ color:'var(--ink-2)',fontVariantNumeric:'tabular-nums' }}>{h.count}</span>
                  <span>
                    <span className={`status-pill ${h.status}`}>
                      <i />{h.status === 'active' ? '使用中' : '已过期'}
                    </span>
                  </span>
                  <span style={{ textAlign:'right' }}>
                    {h.status === 'active'
                      ? <span style={{ color:'var(--muted)',fontSize:12 }}>当前会话</span>
                      : <span style={{ color:'var(--muted)',fontSize:12 }}>已过期</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info card */}
        <div style={{
          padding:'16px 20px',borderRadius:'var(--radius-lg)',
          border:'.5px solid var(--line)',background:'var(--surface)',
          fontSize:13,color:'var(--muted)',lineHeight:1.65,
        }}>
          <strong style={{ color:'var(--ink-2)',display:'block',marginBottom:6 }}>关于历史记录</strong>
          历史记录仅存储在当前浏览器的本地存储（localStorage）中，不会上传至服务器。
          清除浏览器数据或使用隐身窗口后，历史记录将不可见。
          已过期的地址对应的邮件已从服务器永久删除，无法恢复。
        </div>
      </div>
    </div>
  );
}
