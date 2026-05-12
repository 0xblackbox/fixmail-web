'use client';

import AppNav from '@/components/AppNav';
import { Ic } from '@/components/icons';

const FAQ = [
  {
    q: '邮箱地址会保留多久？',
    a: '默认 10 分钟，可在收件箱页面的地址栏看到剩余时间。点击「刷新」立即生成新地址，或在「自定义」中绑定自己想要的用户名（最长 24 小时）。',
  },
  {
    q: '我的邮件会被加密吗？',
    a: '所有邮件在传输过程中使用 TLS 加密，存储时以加密方式保存。临时地址过期后，邮件会立即从存储中删除，无法恢复。',
  },
  {
    q: '可以接收附件吗？',
    a: '可以接收附件。所有附件会随邮件一起在地址过期时自动清除，不需要手动操作。',
  },
  {
    q: '一次性分享链接是怎么工作的？',
    a: '每个分享链接配有专属的独立临时邮箱，以只读方式查看。链接到期或达到最大打开次数后自动失效，不会暴露你的主邮箱地址。',
  },
  {
    q: '历史会话数据存在哪里？',
    a: '历史记录仅存储在浏览器本地（localStorage），不会上传到服务器。清除浏览器数据或使用隐身窗口时历史记录不可见。',
  },
  {
    q: '是否支持 API？',
    a: '是。通过 REST API 可以创建临时地址、轮询邮件、生成分享链接。欢迎查阅下方开发者文档了解更多。',
  },
];

const API_ENDPOINTS = [
  { method: 'GET',  path: '/api/generate',               desc: '生成一个新的临时邮箱地址' },
  { method: 'GET',  path: '/api/inbox/:email',            desc: '获取指定邮箱的邮件列表' },
  { method: 'GET',  path: '/api/inbox/:email/:id',        desc: '获取单封邮件详情（含 HTML/Text）' },
  { method: 'POST', path: '/api/share',                   desc: '创建一次性分享链接（返回专属邮箱）' },
  { method: 'GET',  path: '/share/:token',                desc: '分享链接落地页' },
];

const METHOD_COLOR: Record<string, string> = {
  GET:  'oklch(40% 0.12 155)',
  POST: 'oklch(40% 0.12 255)',
};

export default function DocsPage() {
  return (
    <div className="app">
      <AppNav />

      <div className="mail-wrap" style={{ paddingTop: 24, maxWidth: 900 }}>

        {/* Header */}
        <div className="panel-head" style={{ border:'none',paddingBottom:0,marginBottom:4 }}>
          <div>
            <h2>文档</h2>
            <p style={{ margin:'6px 0 0',fontSize:13,color:'var(--muted)',lineHeight:1.55 }}>
              关于 FixMail 工作原理、隐私实践和 API 接口的说明。
            </p>
          </div>
          <button className="btn btn-sm">
            {Ic.external}<span>GitHub</span>
          </button>
        </div>

        {/* FAQ */}
        <div className="panel-view">
          <div style={{ paddingBottom:16,marginBottom:16,borderBottom:'.5px solid var(--line)' }}>
            <h3 style={{ margin:0,fontSize:15,fontWeight:600 }}>常见问题</h3>
          </div>
          <div className="docs-grid">
            {FAQ.map((item, i) => (
              <div key={i} className="docs-card">
                <div className="docs-q">{item.q}</div>
                <div className="docs-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* API Reference */}
        <div className="panel-view">
          <div style={{ paddingBottom:16,marginBottom:16,borderBottom:'.5px solid var(--line)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div>
              <h3 style={{ margin:0,fontSize:15,fontWeight:600 }}>API 参考</h3>
              <p style={{ margin:'4px 0 0',fontSize:12.5,color:'var(--muted)' }}>Base URL：<span className="mono">https://fixmail.org</span></p>
            </div>
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {API_ENDPOINTS.map((ep, i) => (
              <div key={i} style={{
                display:'grid',gridTemplateColumns:'64px 1fr auto',gap:12,alignItems:'center',
                padding:'10px 14px',borderRadius:8,
                border:'.5px solid var(--line)',background:'var(--surface-2)',
                fontSize:13,
              }}>
                <span className="mono" style={{ fontSize:11,fontWeight:700,color: METHOD_COLOR[ep.method] || 'var(--ink-2)' }}>
                  {ep.method}
                </span>
                <span className="mono" style={{ color:'var(--ink)',fontSize:12.5 }}>{ep.path}</span>
                <span style={{ color:'var(--muted)',fontSize:12,textAlign:'right' }}>{ep.desc}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop:16,padding:'12px 16px',borderRadius:8,
            background:'var(--surface-2)',border:'.5px solid var(--line)',
            fontSize:12.5,color:'var(--muted)',lineHeight:1.65,
          }}>
            <strong style={{ color:'var(--ink-2)' }}>认证：</strong>
            当前 API 为公开接口，无需 Token。后续版本将支持 API Key 认证以提升速率限制。
          </div>
        </div>

        {/* Privacy policy */}
        <div style={{
          padding:'18px 20px',borderRadius:'var(--radius-lg)',
          border:'.5px solid var(--line)',background:'var(--surface)',
        }}>
          <h3 style={{ margin:'0 0 12px',fontSize:15,fontWeight:600 }}>隐私承诺</h3>
          <ul style={{ margin:0,padding:'0 0 0 18px',fontSize:13,color:'var(--muted)',lineHeight:2 }}>
            <li>所有邮件和地址在到期后立即从服务器删除，不留存日志。</li>
            <li>不追踪用户行为，不设置跨站 Cookie。</li>
            <li>历史记录和锁屏密码仅存储在你的浏览器本地，服务端无法访问。</li>
            <li>分享链接的访问日志在链接失效后立即清除。</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
