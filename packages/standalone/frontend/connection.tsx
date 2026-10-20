import { tr, activeLocale } from './locale'
import { useState } from 'react'
import { Cable, Check, CircleCheck, Copy, Eye, EyeOff, KeyRound, Link2, LockKeyhole, RotateCcw, ShieldAlert, Terminal } from 'lucide-react'
import { Button, Card } from './components/ui'
import type { Host, Summary } from './types'

export function Connection({ summary, host, active }: { summary: Summary; host: Host; active: boolean }) {
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  if (!active) return null
  const endpoint = `${summary.baseUrl}/v1`
  const model = summary.catalog.find(row => row.routable)?.id ?? 'MODEL_ID'
  const example = `curl ${summary.baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ model, messages: [{ role: 'user', content: '你好' }] })}'`
  const run = async (action: () => Promise<void>, message = '') => {
    setBusy(true); setNotice(''); setError('')
    try { await action(); if (message) setNotice(message) }
    catch (reason) { setError(reason instanceof Error ? reason.message : tr("操作失败，请重试。", "Operation failed, please try again!\n", "Operasi gagal, silakan ulang")) }
    finally { setBusy(false) }
  }
  const copy = async (id: string, text: string, message: string) => run(async () => {
    await host.copy(text)
    setCopied(id)
    window.setTimeout(() => setCopied(current => current === id ? '' : current), 1600)
  }, message)
  const toggleKey = () => void run(async () => {
    if (apiKey) { setApiKey(''); return }
    setApiKey(await host.getApiKey())
  })
  const rotate = () => {
    if (!window.confirm(tr("轮换后旧 API Key 会立即失效，确认继续吗？", "The old API Key will expire immediately after rotation, are you sure you want to continue?", "Kunci api lama akan segera kedaluwarsa setelah rotasi, apakah Anda yakin ingin melanjutkan?"))) return
    void run(async () => setApiKey(await host.rotateKey()), tr("密钥已轮换，请更新所有客户端配置。", "Keys have been rotated, please update all client configurations.", "Kunci telah diputar, perbarui semua konfigurasi klien."))
  }
  return <div className="connection-browser" data-testid="connection-ready">
    <header className="dashboard-heading"><div><div className="heading-eyebrow">CONNECT YOUR TOOLS</div>
      <h1>{tr("API 接入", "API Access", "Akses api")}</h1><p>{tr("使用 OpenAI 兼容接口，把本地模型接入你的工具。", "Connect local models to your tools using OpenAI-compatible interfaces.", "Hubungkan model lokal ke alat Anda menggunakan antarmuka yang kompatibel dengan OpenAI.")}</p></div>
      <Cable size={22} aria-hidden="true" /></header>
    {notice && <p className="connection-feedback" role="status"><CircleCheck size={15} />{notice}</p>}
    {error && <p className="connection-error" role="alert"><ShieldAlert size={16} />{error}</p>}
    <Card className="connection-card"><div className="connection-card-heading"><span className="cx-icon"><KeyRound size={16} /></span><div><h2>{tr("连接凭据", "Connection credentials", "Kredensial koneksi")}</h2><p>{tr("管理会话与推理密钥相互独立。", "The management session is independent of the inference key.", "Sesi manajemen tidak bergantung pada kunci inferensi.")}</p></div></div>
      <label className="field-label" htmlFor="connection-endpoint">API Base URL</label>
      <div className="copy-field"><div className="cx-field"><Link2 size={14} /><input id="connection-endpoint" readOnly value={endpoint} /></div>
        <Button variant="outline" className={copied === 'endpoint' ? 'cx-copied' : undefined} disabled={busy} onClick={() => void copy('endpoint', endpoint, tr("地址已复制。", "Address copied.", "Alamat disalin."))}>{copied === 'endpoint' ? <Check size={14} /> : <Copy size={14} />}{tr("复制地址", "Copy address", "Salin alamat")}</Button></div>
      <label className="field-label" htmlFor="connection-key">API Key</label>
      <div className="copy-field"><div className={`cx-field${apiKey ? ' cx-revealed' : ''}`}><LockKeyhole size={14} /><input id="connection-key" type={apiKey ? 'text' : 'password'} readOnly value={apiKey} placeholder={tr("点击查看后显示", "Show after clicking View", "Tampilkan setelah mengeklik Lihat")} /></div>
        <Button variant="outline" disabled={busy} onClick={toggleKey}>{apiKey ? <EyeOff size={14} /> : <Eye size={14} />}{apiKey ? tr("隐藏密钥", "Hide key", "Sembunyikan kunci") : tr("查看密钥", "View Key", "Lihat Kunci")}</Button>
        <Button variant="outline" className={copied === 'key' ? 'cx-copied' : undefined} disabled={!apiKey || busy} onClick={() => void copy('key', apiKey, tr("密钥已复制。", "Key copied.", "Kunci disalin."))}>{copied === 'key' ? <Check size={14} /> : <Copy size={14} />}{tr("复制", "Copy", "Duplikasi")}</Button></div>
      <p className="footnote">{tr("密钥用于客户端调用，请妥善保管。", "The key is used for client calls, please keep it safe.", "Kunci digunakan untuk panggilan klien, harap jaga keamanannya.")}</p>
    </Card>
    <Card className="connection-card"><div className="connection-card-heading"><span className="cx-icon"><Terminal size={16} /></span><div><h2>{tr("快速开始", "PLAY", "Cepat mulai")}</h2><p>{tr("将 YOUR_API_KEY 替换为上方密钥。", "Replace your_API_key with the key above.", "Ganti _API_KEY Anda dengan kunci di atas.")}</p></div>
      <Button variant="ghost" className={copied === 'example' ? 'cx-copied' : undefined} disabled={busy} onClick={() => void copy('example', example, tr("示例已复制。", "Sample copied.", "Sampel disalin."))}>{copied === 'example' ? <Check size={14} /> : <Copy size={14} />}{tr("复制示例", "Copy example", "Salin contoh")}</Button></div>
      <pre className="connection-example cx-code">{example}</pre>
    </Card>
    <Card className="connection-card connection-danger"><div className="connection-card-heading"><span className="cx-icon cx-icon-danger"><ShieldAlert size={16} /></span><div><h2>{tr("轮换 API Key", "Rotate API Key", "Putar Kunci api")}</h2><p>{tr("轮换后旧密钥立即失效，需要更新所有客户端。", "The old key expires immediately after rotation and all clients need to be updated.", "Kunci lama segera kedaluwarsa setelah rotasi dan semua klien perlu diperbarui.")}</p></div></div>
      <Button variant="outline" className="cx-danger-btn" disabled={busy} onClick={rotate}><RotateCcw size={15} />{tr("轮换密钥", "Rotation Key", "Tombol Rotasi")}</Button></Card>
  </div>
}
