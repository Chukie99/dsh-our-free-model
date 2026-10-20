import { tr, activeLocale } from '../locale'
import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, Boxes, Check, CircleCheck, Copy, Handshake, Layers3, Network, RefreshCw, Terminal, Zap } from 'lucide-react'
import { Badge, Button, Card } from './ui'
import '../usage.css'
import type { Host, Snapshot } from '../types'

const number = (value: number) => new Intl.NumberFormat(activeLocale()).format(value)
const compact = (value: number) => value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : number(value)

export function Overview({ summary, stats, host }: Snapshot & { host: Host }) {
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const metricRows = [
    { name: tr("可接入模型", "Accessible Model", "Model yang Dapat Diakses"), value: number(summary.catalog.filter(model => model.routable).length), icon: Boxes, detail: tr("当前公开的模型清单", "List of currently published models", "Daftar model yang saat ini diterbitkan") },
    { name: tr("用户回合", "User Round", "Putaran Pengguna"), value: number(stats.turns), icon: Layers3, detail: `${number(stats.requests)} 次物理请求` },
    { name: tr("累计 Token", "Accumulated tokens", "Akumulasi token"), value: compact(stats.grand.input + stats.grand.output), icon: Zap, detail: `输入 ${compact(stats.grand.input)} · 输出 ${compact(stats.grand.output)}` },
    { name: tr("已恢复回合", "Round resumed", "Putaran dilanjutkan"), value: number(stats.recoveredTurns), icon: Activity, detail: `最终未完成 ${number(stats.failedTurns)} 回合` },
  ]
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const at = new Date(today); at.setDate(at.getDate() - 6 + index)
    const id = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    return { id, value: stats.days.find(row => row.day === id)?.total ?? 0 }
  })
  const total = days.reduce((sum, row) => sum + row.value, 0)
  const max = Math.max(1, ...days.map(row => row.value))
  const failures = [...stats.samples].reverse().filter(row => row.ok === false).slice(0, 4)
  const sources = [
    { name: tr("匿名与 Kilo", "Anonymous with Kilo", "Anonim dengan Kilo"), sub: tr("无需账号的免费模型", "Free model without account", "Model gratis tanpa akun"), icon: Zap, count: summary.catalog.filter(row => row.channel === 'anonymous' || row.channel === 'kilo').length, page: 'models' as const },
    { name: tr("免费账号渠道", "Free account channels", "Saluran akun gratis"), sub: tr("13 个供应商，独立账号池", "13 vendors, separate account pools", "13 vendor, kolam akun terpisah"), icon: Network, count: summary.catalog.filter(row => !['anonymous', 'kilo', 'eac'].includes(row.channel)).length, page: 'channels' as const },
    { name: tr("EAC 协付渠道", "EAC co-payment channel", "Saluran pembayaran bersama EAC"), sub: summary.eacAuth?.local ? tr("已保存本机授权", "Native authorization saved", "Otorisasi asli disimpan") : tr("尚未保存本机授权", "Native authorization has not been saved", "Otorisasi asli belum disimpan"), icon: Handshake, count: summary.catalog.filter(row => row.channel === 'eac').length, page: 'eac' as const },
  ]

  const copyEndpoint = () => {
    void host.copy(`${summary.baseUrl}/v1`).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    }).catch(host.error)
  }

  return <div className="dashboard" data-testid="overview-ready">
    <header className="dashboard-heading"><div><div className="heading-eyebrow">WORKSPACE / OVERVIEW</div><h1>{tr("工作空间概览", "Workspace overview", "Ikhtisar ruang kerja")}</h1><p>{tr("查看你的模型连接与运行情况。", "See how your model is connected and running.", "Lihat bagaimana model Anda terhubung dan berjalan.")}</p></div>
      <Button variant="outline" disabled={refreshing} onClick={() => {
        setRefreshing(true); void host.refresh().catch(host.error).finally(() => setRefreshing(false))
      }}><RefreshCw size={15} className={refreshing ? 'spinning' : ''} />{refreshing ? tr("正在更新", "updating", "Memutakhirkan") : tr("更新状态", "Update statuses", "Perbarui status")}</Button></header>

    <div className="dashboard-metrics">{metricRows.map(metric => <Card className="dashboard-metric ov-metric" key={metric.name}>
      <div><span>{metric.name}</span><div className="ov-metric-icon"><metric.icon size={17} /></div></div>
      <strong>{metric.value}</strong><p>{metric.detail}</p>
    </Card>)}</div>

    <div className="dashboard-main-grid">
      <Card className="usage-panel ov-chart-panel">
        <div className="card-heading"><div><h2>{tr("Token 用量", "Token usage", "Penggunaan token")}</h2><p>{tr("最近 7 天的输入与输出", "Inputs and outputs for the last 7 days", "Input dan output selama 7 hari terakhir")}</p></div><Badge>{tr("最近 7 天", "In the last 7 days", "7 hari terakhir")}</Badge></div>
        <div className="usage-total ov-chart-total">{compact(total)} <span>Token</span></div>
        <div className="dashboard-chart ov-chart" role="img" aria-label={`最近七天 Token 用量：${days.map(day => `${day.id} ${day.value}`).join('；')}`}>
          <div className="chart-grid-lines"><span /><span /><span /><span /></div>
          {days.map(day => <div className="dashboard-chart-column ov-chart-col" key={day.id} title={`${day.id} · ${number(day.value)} Token`}>
            <div className={`dashboard-chart-bar ${day.value === 0 ? 'zero' : ''}`} style={{ height: `${Math.max(2, day.value / max * 80)}%` }} />
            <span>{day.id.slice(5).replace('-', '/')}</span>
          </div>)}
          {total === 0 && <div className="chart-empty ov-chart-empty"><Activity size={22} /><span>{tr("还没有调用记录", "No call history yet", "Belum ada riwayat panggilan")}</span><small>{tr("接入客户端后，用量会显示在这里", "Once connected to the client, the usage will be displayed here", "Setelah terhubung ke klien, penggunaan akan ditampilkan di sini")}</small></div>}
        </div>
        <div className="card-foot"><span>{tr("按实际请求记录统计", "Record statistics by actual request", "Catat statistik berdasarkan permintaan aktual")}</span><button onClick={() => host.navigate('usage')}>{tr("查看全部用量", "See All Usage", "Lihat Semua Penggunaan")} <ArrowRight size={14} /></button></div>
      </Card>

      <Card className="quick-connect ov-quick">
        <div className="quick-icon ov-quick-icon"><Terminal size={20} /></div>
        <h2>{tr("API 接入", "API Access", "Akses api")}</h2><p>{tr("OpenAI 兼容 · Chat Completions / Responses", "OpenAI compatible · Chat Completions/Responses", "Kompatibel dengan OpenAI · Penyelesaian/Tanggapan Obrolan")}</p>
        <label>API BASE URL</label>
        <div className="quick-endpoint ov-endpoint"><code>{summary.baseUrl}/v1</code>
          <Button variant="ghost" aria-label={tr("复制 API 地址", "Copy API address", "Salin alamat api")} onClick={copyEndpoint} title={tr("复制 API 地址", "Copy API address", "Salin alamat api")}
            className={copied ? 'ov-copied' : ''}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
        </div>
        {copied && <span className="copy-feedback" role="status">{tr("地址已复制", "Address copied", "Alamat disalin")}</span>}
        <div className="connect-steps"><span>{tr("管理会话：本机独立会话", "Manage Sessions: Native Standalone Sessions", "Kelola Sesi: Sesi Mandiri Asli")}</span><span>{tr("推理鉴权：Bearer API Key", "Reasoning Authentication: Bearer API Key", "Penalaran Otentikasi: Bearer api Key")}</span><span>{tr("监听范围：仅回环地址", "Listening range: Loopback addresses only", "Rentang mendengarkan: Alamat loopback saja")}</span></div>
        <Button className="connect-button" onClick={() => host.navigate('connection')}>{tr("查看接入配置", "View Access Configuration", "Lihat Konfigurasi Akses")} <ArrowUpRight size={16} /></Button>
        <div className="connection-footnote"><span className={`status-dot ${summary.settings.enabled ? '' : 'paused'}`} />{summary.settings.enabled ? tr("推理服务已启用", "Reasoning Service Enabled", "Layanan Penalaran Diaktifkan") : tr("推理服务已暂停", "Reasoning service paused", "Layanan penalaran dihentikan sementara")}</div>
      </Card>
    </div>

    <div className="dashboard-bottom-grid">
      <Card className="ov-sources">
        <div className="card-heading"><div><h2>{tr("模型来源", "Model Origin", "Sumber Model")}</h2><p>{tr("所有渠道，共用一个接入地址", "All channels, one access address", "Semua saluran, satu alamat akses")}</p></div><Network size={18} /></div>
        <div className="source-list ov-source-list">{sources.map((source, index) => <button className="source-row ov-source-row" key={source.name} onClick={() => host.navigate(source.page)}
          style={{ animationDelay: `${index * 60}ms` }}>
          <span className="source-icon"><source.icon size={18} /></span>
          <span><strong>{source.name}</strong><small>{source.sub}</small></span>
          <Badge>{source.count} {tr("个模型", "models", "model")}</Badge><ArrowRight size={14} />
        </button>)}</div>
      </Card>

      <Card className="ov-failures">
        <div className="card-heading"><div><h2>{tr("运行检查", "Run Check", "Pemeriksaan operasional")}</h2><p>{tr("服务与最近的失败请求", "Service and Recent Failed Requests", "Layanan dan Permintaan Gagal Terbaru")}</p></div>
          <Badge tone={failures.length ? 'warning' : 'success'}>{failures.length ? tr("有失败记录", "Has a record of failures", "Memiliki catatan kegagalan") : tr("暂无失败记录", "No Failures Recorded", "Tidak Ada Kegagalan yang Tercatat")}</Badge></div>
        <div className="runtime-check"><CircleCheck size={17} /><span>{tr("渠道模块", "Channel Module", "Modul Saluran")}</span><strong>{summary.channels.state === 'ready' ? tr("已就绪", "Working on it...", "Sudah siap.") : summary.channels.state === 'failed' ? tr("加载失败", "", "Gagal memuat") : tr("初始化中", "Initializing", "Menginisialisasi")}</strong></div>
        <div className="runtime-check"><RefreshCw size={17} /><span>{tr("模型自动刷新", "Model auto refresh", "Penyegaran otomatis model")}</span><strong>{summary.automaticRefresh ? `每 ${summary.settings.probeIntervalMinutes} 分钟` : tr("已暂停", "SUSPENDED", "Sudah jeda")}</strong></div>
        {failures.length ? <div className="failure-list ov-failure-list">{failures.map((row, index) =>
          <div key={`${row.at}-${index}`} className="ov-failure-row">
            <span>{row.model ?? tr("未知模型", "Unknown model", "Model tidak dikenal")}</span>
            <small>{row.at ? new Date(row.at).toLocaleTimeString(activeLocale()) : tr("时间未知", "Unknown time", "Waktu tidak diketahui")} {tr("· 请求未完成", "· Request incomplete", "· Permohonan tidak lengkap")}</small>
          </div>)}</div>
          : <div className="runtime-empty ov-runtime-empty"><CircleCheck size={18} /><span>{tr("最近的请求样本中没有失败记录", "No failures recorded in recent request samples", "Tidak ada kegagalan yang tercatat dalam sampel permintaan terbaru")}</span></div>}
        <div className="card-foot"><span title={summary.dataDir}>{tr("数据仅保存在本机独立目录", "Data is only saved in the local standalone directory", "Data hanya disimpan di direktori mandiri lokal")}</span><button onClick={() => host.navigate('settings')}>{tr("服务设置", "Service Setting", "Pengaturan Layanan")} <ArrowRight size={14} /></button></div>
      </Card>
    </div>
  </div>
}
