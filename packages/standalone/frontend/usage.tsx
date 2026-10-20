import { tr, activeLocale } from './locale'
import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, CircleAlert, Layers3, RefreshCw, Search, RotateCcw, X } from 'lucide-react'
import { Badge, Button, Card, Input } from './components/ui'
import { usageDays, usageModels } from './usage-data.mjs'
import type { Host, Stats, UsageModel } from './types'
import './usage.css'

const number = (value: number) => new Intl.NumberFormat(activeLocale()).format(value)
const compact = (value: number) => value >= 1e6 ? `${Number((value / 1e6).toFixed(1))}M`
  : value >= 1e3 ? `${Number((value / 1e3).toFixed(1))}K` : number(value)
const measured = (value?: number | null) => value != null && Number.isFinite(value) ? number(value) : '—'

export function Usage({ stats, host, active }: { stats: Stats; host: Host; active: boolean }) {
  const [period, setPeriod] = useState(14)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('calls')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refreshingRef = useRef(false)
  const activeRef = useRef(active)
  activeRef.current = active
  useEffect(() => {
    if (!active) {
      generation.current++
      refreshingRef.current = false
      setRefreshing(false); setMessage(''); setError('')
    }
    return () => { generation.current++ }
  }, [active])
  const days: { day: string; total: number }[] = usageDays(stats.days, period)
  const windowTotal = days.reduce((sum, day) => sum + day.total, 0)
  const max = Math.max(1, ...days.map(day => day.total))
  const models: { total: number; pages: number; page: number; rows: UsageModel[] } = usageModels(stats.models, { search, sort, page })
  useEffect(() => { if (page !== models.page) setPage(models.page) }, [page, models.page])
  const hasHistory = stats.requests > 0 || stats.turns > 0 || stats.models.length > 0 || stats.days.length > 0
  const metrics = [
    { name: tr("用户回合", "User Round", "Putaran Pengguna"), value: stats.turns, detail: tr("一次用户请求计为一个回合", "One user request counts as one round", "Satu permintaan pengguna dihitung sebagai satu putaran"), icon: Layers3 },
    { name: tr("物理请求", "Physical Request", "Permintaan Fisik"), value: stats.requests, detail: tr("含重试与断流恢复的追加请求", "Includes retry and outage recovery append request", "Termasuk upaya ulang dan permintaan penambahan pemulihan pemadaman"), icon: Activity },
    { name: tr("输入 Token", "Enter Token", "Masukkan Token"), value: stats.grand.input, detail: tr("以已上报用量为准", "Subject to reported usage", "Tunduk pada penggunaan yang dilaporkan"), icon: ArrowDownToLine },
    { name: tr("输出 Token", "Output Token", "Token Keluaran"), value: stats.grand.output, detail: tr("以已上报用量为准", "Subject to reported usage", "Tunduk pada penggunaan yang dilaporkan"), icon: ArrowUpFromLine },
    { name: tr("失败回合", "Failed rounds", "Putaran yang gagal"), value: stats.failedTurns, detail: tr("最终未完成的用户回合", "Final Incomplete User Round", "Putaran Pengguna Akhir yang Belum Selesai"), icon: CircleAlert },
    { name: tr("已恢复回合", "Round resumed", "Putaran dilanjutkan"), value: stats.recoveredTurns, detail: tr("经历恢复后完成的用户回合", "User rounds completed after experiencing recovery", "Putaran pengguna selesai setelah mengalami pemulihan"), icon: RotateCcw },
  ]
  const refresh = async () => {
    if (refreshingRef.current || !activeRef.current) return
    const started = ++generation.current
    const isCurrent = () => started === generation.current && activeRef.current
    refreshingRef.current = true
    setRefreshing(true); setMessage(''); setError('')
    try {
      await host.refresh()
      if (isCurrent()) setMessage(tr("统计已更新", "Stats updated", "Statistik diperbarui"))
    } catch (reason) {
      if (isCurrent()) setError(reason instanceof Error ? reason.name === 'TimeoutError' ? tr("刷新超时，请重试。", "Refresh timed out, please try again.", "Waktu penyegaran habis, silakan coba lagi.")
        : reason instanceof TypeError && /fetch/i.test(reason.message) ? tr("无法连接本地服务，请确认服务正在运行后重试。", "Unable to connect to the local service, please make sure the service is running and try again.", "Tidak dapat terhubung ke layanan lokal, pastikan layanan sedang berjalan dan coba lagi.")
        : reason.message : tr("统计刷新失败，请重试。", "Statistics refresh failed, please try again.", "Penyegaran statistik gagal, silakan coba lagi."))
    } finally {
      if (isCurrent()) { refreshingRef.current = false; setRefreshing(false) }
    }
  }
  if (!active) return null
  return <div className="usage-browser" data-testid="usage-ready">
    <header className="dashboard-heading"><div><div className="heading-eyebrow">WORKSPACE / USAGE</div>
      <h1>{tr("用量统计", "Usage statistics", "Statistik penggunaan")}</h1><p>{tr("查看本机累计用量与每日趋势。", "View the cumulative usage and daily trends of the machine.", "Lihat penggunaan kumulatif dan tren harian mesin.")}</p></div>
      <Button variant="outline" disabled={refreshing} onClick={() => { void refresh() }}>
        <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />{refreshing ? tr("正在更新", "updating", "Memutakhirkan") : tr("更新统计", "Renewals count", "Perbarui Statistik")}
      </Button>
    </header>
    {message && <p className="usage-feedback" role="status">{message}</p>}
    {error && <div className="channel-error" role="alert"><CircleAlert size={16} /><span>{error}</span>
      <Button variant="ghost" aria-label={tr("关闭统计错误提示", "Turn off Statistical Error Prompts", "Nonaktifkan Prompt Kesalahan Statistik")} onClick={() => setError('')}><X size={15} /></Button></div>}
    <div className="usage-metrics">{metrics.map(metric => <Card className="dashboard-metric ov-metric" key={metric.name}>
      <div><span>{metric.name}</span><div className="ov-metric-icon"><metric.icon size={17} /></div></div>
      <strong title={number(metric.value)} data-metric={metric.name}>{metric.name.includes('Token') ? compact(metric.value) : number(metric.value)}</strong><p>{metric.detail}</p>
    </Card>)}</div>
    <div className="usage-scope"><span>{tr("累计统计 · 不受下方趋势天数影响", "Cumulative stats · Not affected by down trend days", "Statistik kumulatif · Tidak terpengaruh oleh hari tren turun")}</span>
      <span>{tr("物理失败请求", "Physical Failure Request", "Permintaan Kegagalan Fisik")} <strong data-testid="usage-request-failures">{number(stats.requestFailures)}</strong></span>
      <span>{tr("思考 Token", "Think Token", "Think Token")} <strong>{number(stats.grand.reasoning)}</strong></span></div>
    {(stats.logicalEstimated || stats.requestFailuresEstimated) && <p className="usage-estimated" role="note">
      <CircleAlert size={15} /><span>{tr("历史统计含估算：", "Historical Statistics with Estimates:", "Statistik Historis dengan Estimasi:")}
        {stats.logicalEstimated && tr("迁移前的用户回合按历史请求估算。", "User rounds prior to migration are estimated by historical request.", "Putaran pengguna sebelum migrasi diperkirakan berdasarkan permintaan historis.")}
        {stats.requestFailuresEstimated && tr("部分物理失败请求按保留记录估算。", "Some physical failure requests are estimated by retention records.", "Beberapa permintaan kegagalan fisik diperkirakan oleh catatan retensi.")}
        {tr("新记录沿用独立的请求与回合统计。", "The new record retains the independent request and round statistics.", "Catatan baru mempertahankan permintaan independen dan statistik bulat.")}</span></p>}
    <Card className="usage-trend">
      <div className="card-heading"><div><h2>{tr("每日 Token 用量", "Daily Token Usage", "Penggunaan Token Harian")}</h2><p>{tr("最近", "k-Nearest", "Terdekat")} {period} {tr("天 · 输入与输出合计", "days · Total inputs and outputs", "hari · Total input dan output")}</p></div>
        <div className="channel-filters" role="group" aria-label={tr("趋势时间范围", "Trending Time Range", "Rentang Waktu Tren")}>{[7, 14, 30].map(count =>
          <button key={count} aria-pressed={period === count} onClick={() => setPeriod(count)}>{count} {tr("天", "day", "Hari")}</button>)}</div>
      </div>
      <div className="usage-window-total"><strong data-testid="usage-window-total">{number(windowTotal)}</strong><span>{tr("Token / 所选时段", "Token/Selected time period", "Token/Periode waktu yang dipilih")}</span></div>
      <p className="usage-scroll-hint">{tr("左右滑动查看完整日期。", "Swipe left and right to see the full date.", "Geser ke kiri dan kanan untuk melihat tanggal lengkap.")}</p>
      <div className="usage-trend-scroll"><div className="usage-trend-chart" style={{ minWidth: period * 35 }}
        role="img" aria-label={`最近 ${period} 天 Token 用量：${days.map(day => `${day.day} ${number(day.total)}`).join('；')}`}>
        {days.map(day => <div className="usage-day" key={day.day} tabIndex={0} title={`${day.day} · ${number(day.total)} Token`}
          aria-label={`${day.day}：${number(day.total)} Token`}>
          <div className="usage-day-track"><div className={`usage-day-bar ${day.total ? '' : 'zero'}`} style={{ height: `${Math.max(1, day.total / max * 100)}%` }} /></div>
          <span>{day.day.slice(5).replace('-', '/')}</span>
        </div>)}
      </div></div>
      {windowTotal === 0 && <p className="usage-window-empty" role="status">{hasHistory ? tr("所选时段没有已记录的 Token 用量，累计统计仍保留历史记录。", "There is no recorded token usage for the selected time period, and the cumulative statistics remain historical.", "Tidak ada penggunaan token yang tercatat untuk periode waktu yang dipilih, dan statistik kumulatif tetap historis.") : tr("还没有调用记录，接入客户端后用量会显示在这里。", "There is no call record, the usage will be displayed here after accessing the client.", "Tidak ada catatan panggilan, penggunaan akan ditampilkan di sini setelah mengakses klien.")}</p>}
      <div className="card-foot"><span>{days[0].day} — {days[days.length - 1].day} {tr("· 本地自然日", "· Local Nature Day", "· Hari Alam Lokal")}</span><span>{tr("未上报的用量不会自动估算为实际 Token", "Unreported usage will not be automatically estimated as an actual token", "Penggunaan yang tidak dilaporkan tidak akan secara otomatis diperkirakan sebagai token aktual")}</span></div>
    </Card>
    <Card className="usage-model-panel">
      <div className="card-heading"><div><h2>{tr("按模型统计", "Statistics by model", "Statistik menurut model")}</h2><p>{tr("累计记录 · 每页最多 20 个模型", "Cumulative records · Up to 20 models per page", "Catatan kumulatif · Hingga 20 model per halaman")}</p></div>
        <Badge>{number(stats.models.length)} {tr("个模型", "models", "model")}</Badge></div>
      <div className="usage-model-filters"><div className="usage-model-search"><Search size={16} />
        <Input type="search" aria-label={tr("搜索统计模型", "Search Statistical Models", "Cari Model Statistik")} placeholder={tr("搜索模型名称或 ID…", "Search for a model name or ID…", "Cari nama model atau ID…")} value={search}
          onChange={event => { setSearch(event.target.value); setPage(1) }} /></div>
        <select aria-label={tr("统计模型排序", "Statistical Model Sorting", "Penyortiran Model Statistik")} value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}>
          <option value="calls">{tr("物理请求最多", "Most Physical Requests", "Permintaan Fisik Terbanyak")}</option><option value="tokens">{tr("Token 用量最多", "Most Token Used", "Token Paling Banyak Digunakan")}</option>
          <option value="failedTurns">{tr("失败回合最多", "Most Failed Turns", "Giliran Paling Gagal")}</option><option value="name">{tr("模型名称", "Model Name", "Nama Model")}</option>
        </select>
        {search && <Button variant="ghost" onClick={() => { setSearch(''); setPage(1) }}><X size={14} />{tr("清空搜索", "Clear search", "Hapus pencarian")}</Button>}
      </div>
      {models.total ? <><p className="usage-scroll-hint">{tr("左右滑动查看完整统计。", "Swipe left and right to see the full stats.", "Geser ke kiri dan kanan untuk melihat statistik lengkap.")}</p>
      <div className="usage-model-scroll" tabIndex={0} role="region" aria-label={tr("按模型累计统计，可横向滚动", "Accumulated by model, scrollable horizontally", "Akumulasi oleh model, dapat digulir secara horizontal")}>
        <table className="usage-model-table"><thead><tr>
          <th scope="col">{tr("模型 / ID", "Former ID", "Model/ID")}</th><th scope="col">{tr("用户回合", "User Round", "Putaran Pengguna")}</th><th scope="col">{tr("物理请求", "Physical Request", "Permintaan Fisik")}</th><th scope="col">{tr("输入 Token", "Enter Token", "Masukkan Token")}</th>
          <th scope="col">{tr("输出 Token", "Output Token", "Token Keluaran")}</th><th scope="col">{tr("失败回合", "Failed rounds", "Putaran yang gagal")}</th><th scope="col">{tr("恢复回合", "Resume Round", "Lanjutkan Putaran")}</th><th scope="col">{tr("首字延迟", "Initial Delay", "Penundaan Awal")}</th><th scope="col">{tr("生成速度", "Generation Speed", "Kecepatan Generasi")}</th>
        </tr></thead><tbody>{models.rows.map(model => <tr key={model.model} data-usage-model={model.model}>
          <td><strong>{model.name}</strong><code>{model.model}</code></td><td>{number(model.turns)}</td>
          <td>{number(model.calls)}<small>{tr("失败", "Kalah", "Gagal")} {number(model.failed)}</small></td>
          <td>{number(model.input)}</td><td>{number(model.output)}</td><td>{number(model.failedTurns)}</td>
          <td>{number(model.recoveredTurns)}</td><td>{measured(model.avgTtftMs)}<small>ms</small></td><td>{measured(model.tps)}<small>Token/s</small></td>
        </tr>)}</tbody></table>
      </div></> : <div className="usage-empty"><Activity size={25} /><h3>{search.trim() ? tr("没有匹配的模型", "No matching models", "Tidak ada model yang cocok") : tr("还没有模型用量记录", "No model usage records yet", "Belum ada catatan penggunaan model")}</h3>
        <p>{search.trim() ? tr("试试其他名称或 ID，或清空搜索。", "Try a different name or ID, or clear the search.", "Coba nama atau identitas lain, atau kosongkan pencarian.") : tr("接入客户端并发送消息后，模型统计会显示在这里。", "Once you connect to the client and send the message, the model statistics will be displayed here.", "Setelah Anda terhubung ke klien dan mengirim pesan, statistik model akan ditampilkan di sini.")}</p></div>}
      <div className="usage-pagination"><span data-testid="usage-model-count">{number(models.total)} / {number(stats.models.length)} {tr("个模型", "models", "model")}</span>
        <span>{tr("第", "No.", "Ke")} {models.page} / {models.pages} {tr("页", "Page", "daun")}</span><Button variant="outline" aria-label={tr("上一页统计模型", "Previous Statistical Model", "Model Statistik Sebelumnya")} disabled={models.page === 1}
          onClick={() => setPage(models.page - 1)}><ChevronLeft size={15} />{tr("上一页", "Prev", "Back")}</Button>
        <Button variant="outline" aria-label={tr("下一页统计模型", "Next Statistical Model", "Model Statistik Berikutnya")} disabled={models.page === models.pages}
          onClick={() => setPage(models.page + 1)}>{tr("下一页", "Next\\tF8", "Berikut")}<ChevronRight size={15} /></Button></div>
    </Card>
    <p className="footnote">{tr("统计只记录用量与性能，不保存提示词和回答。首字延迟与生成速度基于保留的可测量样本；未测得时显示“—”。", "Statistics only record usage and performance, do not save prompts and answers. Initial delay and generation speed are based on the retained measurable samples; '—' is displayed when not measured.", "Statistik hanya mencatat penggunaan dan kinerja, tidak menyimpan petunjuk dan jawaban. Penundaan awal dan kecepatan pembangkitan didasarkan pada sampel terukur yang dipertahankan; '-' ditampilkan ketika tidak diukur.")}</p>
  </div>
}
