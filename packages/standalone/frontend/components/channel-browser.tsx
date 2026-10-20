import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Network, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { providers } from 'ofm-provider-list'
import { shared } from 'ofm-shared-client'
import { Badge, Button, Card, Input } from './ui'
import type { Summary } from '../types'
import { activeLocale, tr } from '../locale'

interface Status { closed?: boolean; accounts?: { total: number; enabled: number }; models?: { total: number; disabled: number } }
type Rpc = (method: string, payload?: object) => Promise<any>
const currentLocale = activeLocale
const t = Object.assign((key: string) => shared.DICT[currentLocale()]?.[key] ?? shared.DICT.zh[key] ?? key, { get locale() { return currentLocale() } })

export function ChannelBrowser({ rpc, summary }: { rpc: Rpc; summary: Summary & { reload?(): void } }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, select] = useState<string>()
  const [auto, setAuto] = useState<{ enabled: boolean; running?: boolean; ranToday?: boolean }>()
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  const sequence = useRef(0)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const reload = useCallback(async () => {
    const started = ++sequence.current
    try {
      const value = await rpc('provider.status', { providers: providers.map(row => row.id) })
      if (!mounted.current || started !== sequence.current) return
      setStatuses(value.statuses ?? {})
      setError('')
    } catch (failure) {
      if (mounted.current && started === sequence.current) setError((failure as Error).message)
    }
  }, [rpc])
  useEffect(() => {
    mounted.current = true
    void reload()
    void rpc('usage.autoCheckin', {}).then(value => {
      if (mounted.current) setAuto(value.autoCheckin)
    }).catch(() => {})
    const timer = setInterval(() => { void reload() }, 45000)
    return () => { mounted.current = false; sequence.current++; clearInterval(timer) }
  }, [rpc, reload])
  useEffect(() => {
    if (selected) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      detailHeading.current?.focus({ preventScroll: true })
    }
  }, [selected])
  const onChanged = useCallback(() => {
    void reload()
    window.dispatchEvent(new CustomEvent('ofm:channels'))
    summary.reload?.()
  }, [reload, summary.reload])
  const onError = useCallback((_provider: unknown, failure: Error) => { if (mounted.current) setError(failure.message) }, [])
  const connected = providers.filter(provider => statuses?.[provider.id]?.accounts?.enabled && !statuses[provider.id].closed).length
  const accounts = Object.values(statuses ?? {}).reduce((sum, row) => sum + (row.accounts?.total ?? 0), 0)
  const selectedProvider = providers.find(row => row.id === selected)
  const rows = providers.filter(provider => {
    const status = statuses?.[provider.id]
    const isConnected = (status?.accounts?.enabled ?? 0) > 0 && !status?.closed
    return `${provider.name} ${provider.org}`.toLowerCase().includes(search.toLowerCase().trim())
      && (filter === 'all' || (status !== undefined && (filter === 'connected' ? isConnected : !isConnected)))
  })
  // 分类标签展示全量数量；搜索后的匹配数量由结果栏单独展示。
  const counts: Record<string, number> = {
    all: providers.length,
    connected,
    pending: providers.filter(provider => {
      const status = statuses?.[provider.id]
      return status !== undefined && (status.closed || (status.accounts?.enabled ?? 0) <= 0)
    }).length,
  }
  return <>
    <div className="channel-summary-strip">
      <div className="ch-metric"><span className="ch-metric-icon"><Network size={16} /></span>
        <div className="ch-metric-body"><span className="ch-metric-label">{tr("已接入渠道", "Connected channels", "Kanal terhubung")}</span>
          <strong className="ch-metric-value">{statuses ? connected : <span className="ch-skeleton" />}<small> / {providers.length}</small></strong></div></div>
      <div className="ch-metric"><span className="ch-metric-icon"><ShieldCheck size={16} /></span>
        <div className="ch-metric-body"><span className="ch-metric-label">{tr("本机账号", "Local accounts", "Akun lokal")}</span>
          <strong className="ch-metric-value">{statuses ? accounts : <span className="ch-skeleton" />}</strong></div></div>
      <div className="checkin-control"><span className="status-dot" /><span>{auto?.running ? tr("签到进行中", "Check-in running", "Check-in berlangsung") : auto?.ranToday ? tr("今日签到已执行", "Checked in today", "Sudah check-in hari ini") : tr("每日自动签到", "Daily auto check-in", "Check-in otomatis harian")}</span>
        <button type="button" role="switch" aria-label="每日自动签到" aria-checked={auto?.enabled === true}
          className={`ui-switch ${auto?.enabled ? 'on' : ''}`} disabled={!auto || busy} onClick={() => {
            setBusy(true)
            void rpc('usage.autoCheckin', { enabled: !auto?.enabled }).then(value => { if (mounted.current) setAuto(value.autoCheckin) })
              .catch(failure => { if (mounted.current) setError(failure.message) }).finally(() => { if (mounted.current) setBusy(false) })
          }}><span /></button>
      </div>
    </div>
    {error && <div className="channel-error" role="alert"><CircleAlert size={16} /><span>{error}</span><Button variant="ghost" onClick={() => { void reload() }}>{tr("重试", "Retry", "Coba lagi")}</Button></div>}
    {selectedProvider ? <div className="provider-detail" data-testid="provider-detail">
      <div className="provider-detail-top"><Button variant="outline" onClick={() => select(undefined)}><ArrowLeft size={15} />{tr("返回全部渠道", "Back to all channels", "Kembali ke semua kanal")}</Button>
        <span>{tr("账号凭据保存在本机独立目录", "Account credentials are stored in a separate local directory", "Kredensial akun disimpan di direktori lokal terpisah")}</span></div>
      <div className="provider-detail-layout"><Card className="provider-detail-sidebar"><h2 tabIndex={-1} ref={detailHeading}>{selectedProvider.name}</h2><p>{selectedProvider.org}</p>
        <div className="detail-label">{tr("切换渠道", "Switch channel", "Ganti kanal")}</div>{providers.map(provider => <button className={`detail-provider-link ${provider.id === selected ? 'active' : ''}`} key={provider.id}
          onClick={() => select(provider.id)}><span>{provider.name}</span>{provider.id === selected && <Check size={14} />}</button>)}</Card>
        <div className="provider-detail-main"><div className="provider-detail-description"><h2>{tr("账号与模型", "Accounts and models", "Akun dan model")}</h2><p>{tr("添加账号，管理免费额度与可用模型。", "Add accounts and manage free quotas and available models.", "Tambah akun dan kelola kuota gratis serta model yang tersedia.")}</p></div>
          <shared.ChannelCard key={selectedProvider.id} channel={selectedProvider} status={statuses?.[selectedProvider.id]} rpc={rpc} t={t} onChanged={onChanged} onError={onError} />
          <div className="detail-security-note"><ShieldCheck size={16} />{tr("沿用原渠道的登录、续期与额度规则。账号备份和供应商设置位于「供应商与备份」。", "Original channel sign-in, renewal, and quota rules apply. Account backups and provider settings are under Providers and backups.", "Aturan masuk, perpanjangan, dan kuota kanal asli tetap berlaku. Cadangan akun dan pengaturan penyedia ada di Penyedia dan cadangan.")}</div>
        </div></div>
    </div> : <>
      <div className="channel-toolbar"><div className="channel-search"><Search size={17} /><Input aria-label="搜索渠道" placeholder="搜索渠道或供应商…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="channel-filters" aria-label="渠道状态筛选">{[['all', tr('全部渠道', 'All channels', 'Semua kanal')], ['connected', tr('已接入', 'Connected', 'Terhubung')], ['pending', tr('待接入', 'Not connected', 'Belum terhubung')]].map(([id, label]) =>
          <button key={id} aria-pressed={filter === id} disabled={id !== 'all' && !statuses} onClick={() => setFilter(id)}>{label}<span>{id === 'all' || statuses ? counts[id] : '—'}</span></button>)}</div>
      </div>
      <div className="channel-results-meta"><span>{rows.length} {tr("个渠道", "channels", "kanal")}</span><span><SlidersHorizontal size={13} />{tr("按供应商管理独立账号与额度", "Manage accounts and quotas by provider", "Kelola akun dan kuota per penyedia")}</span></div>
      <div className="provider-grid">{rows.map(provider => {
        const status = statuses?.[provider.id]
        const connectedState = !status?.closed && (status?.accounts?.enabled ?? 0) > 0
        const state = status === undefined ? tr('读取中', 'Loading', 'Memuat') : status.closed ? tr('已关闭', 'Turned off', 'Ditutup') : connectedState ? tr('已接入', 'Connected', 'Terhubung') : tr('待接入', 'Not connected', 'Belum terhubung')
        return <Card className="provider-card" key={provider.id}>
          <div className="provider-card-top"><span className="provider-logo" style={{ color: provider.accent, backgroundColor: `${provider.accent}0d` }}>{provider.name.slice(0, 2).toUpperCase()}</span>
            <Badge tone={connectedState ? 'success' : 'neutral'}>{connectedState && <span className="status-dot" />}{state}</Badge></div>
          <h2>{provider.name}</h2><div className="provider-org">{provider.org}</div><p className="provider-description">{provider.note}</p>
          <div className="provider-counts"><span>{tr("账号 ", "Accounts ", "Akun ")}<strong>{status ? status.accounts?.total ?? 0 : '—'}</strong></span>
            <span>{tr("模型 ", "Models ", "Model ")}<strong>{status ? Math.max(0, (status.models?.total ?? 0) - (status.models?.disabled ?? 0)) : '—'}</strong></span></div>
          <Button variant="outline" className="provider-manage" onClick={() => select(provider.id)}>{tr("管理渠道 ", "Manage channel ", "Kelola kanal ")}<ArrowRight size={14} /></Button>
        </Card>
      })}</div>
      {rows.length === 0 && <Card className="channel-empty"><Search size={24} /><h2>{tr("没有匹配的渠道", "No matching channels", "Tidak ada kanal yang cocok")}</h2><p>{tr("试试其他名称，或切换筛选条件。", "Try another name or change the filter.", "Coba nama lain atau ubah saringan.")}</p><Button variant="outline" onClick={() => { setSearch(''); setFilter('all') }}>{tr("重置筛选", "Reset filter", "Atur ulang saringan")}</Button></Card>}
    </>}
  </>
}
