import { tr, activeLocale } from './locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { Boxes, Check, CircleAlert, CircleCheck, Copy, Eye, EyeOff, LoaderCircle, Play, RefreshCw, Search, SlidersHorizontal, Square, X } from 'lucide-react'
import { providers } from 'ofm-provider-list'
import { Badge, Button, Input } from './components/ui'
import { filterModels } from './models-data.mjs'
import { visibilityCopy } from './visibility-data.mjs'
import type { Host, Model, ModelTestResult, ServiceSettings, Summary } from './types'
import './models.css'

const availabilityNames: Record<string, string> = {
  available: tr("已探测可用", "Probed Available", "Probed Tersedia"), listed: tr("清单已收录", "Inventory included", "Inventaris disertakan"), unknown: tr("未探测", "Undetected", "Tidak terdeteksi"),
  unavailable: tr("不可用", "Terminal Not Available", "tidak tersedia"), throttled: tr("限流中", "Current limiting", "Pembatasan saat ini"), 'region-blocked': tr("地区受限", "Region Restricted", "Wilayah Dibatasi"),
}
const sourceNames: Record<string, string> = { anonymous: tr("匿名模型", "Anonymous model", "Model anonim"), kilo: tr("Kilo 免费池", "Kilo Free Pool", "Kolam renang Kilo Gratis"), eac: tr("EAC 协付", "EAC Collaborative Payments", "Pembayaran Kolaboratif EAC") }
const channelName = (id: string) => sourceNames[id]
  ?? providers.find(provider => provider.id === id)?.name ?? id
const number = (value: number) => new Intl.NumberFormat(activeLocale()).format(value)
const capacity = (value?: number) => value && Number.isFinite(value) && value > 0
  ? value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : number(value) : tr("未知", "Unknown", "Tidak Diketahui")
const initialFilters = { search: '', channel: 'all', capability: 'all', availability: 'all', access: 'all' }
type Operation = 'refresh' | 'probe' | 'test'
type TestState = { model: Model; state: 'pending' | 'success' | 'error' | 'cancelled'; result?: ModelTestResult; error?: string }

export function Models({ summary, host, active }: { summary: Summary; host: Host; active: boolean }) {
  const visibility = visibilityCopy(document.documentElement.lang)
  const [filters, setFilters] = useState(initialFilters)
  const [operation, setOperation] = useState<Operation>()
  const [test, setTest] = useState<TestState>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string>()
  const [focusedId, setFocusedId] = useState<string>()
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const visibilityPending = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pending = useRef<AbortController | undefined>(undefined)
  const activeRef = useRef(active)
  activeRef.current = active
  const models = useMemo<Model[]>(() => filterModels(summary.catalog, filters), [summary.catalog, filters])
  const channels = useMemo(() => [...new Set(['anonymous', 'kilo', 'eac', ...summary.catalog.map(model => model.channel), filters.channel])]
    .filter(id => id !== 'all'), [summary.catalog, filters.channel])
  const focusedIndex = focusedId ? models.findIndex(model => model.id === focusedId) : -1
  const rangeExtractor = useCallback((range: Range) => {
    const visible = defaultRangeExtractor(range)
    return focusedIndex >= 0 ? [...new Set([...visible, focusedIndex])].sort((a, b) => a - b) : visible
  }, [focusedIndex])
  const virtual = useVirtualizer({
    count: models.length, getScrollElement: () => scrollRef.current,
    estimateSize: () => 112, overscan: 5, enabled: active,
    getItemKey: index => models[index].id, rangeExtractor,
  })
  const changeFilters = (patch: Partial<typeof initialFilters>) => {
    // 使用原生滚动归零，避免动态测量时平滑滚动的目标高度变化。
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setFilters(previous => ({ ...previous, ...patch }))
    setFocusedId(undefined)
  }
  useEffect(() => {
    if (!active) {
      pending.current?.abort()
      pending.current = undefined
      setOperation(undefined)
      setTest(previous => previous?.state === 'pending' ? { ...previous, state: 'cancelled' } : previous)
    }
    return () => { pending.current?.abort(); pending.current = undefined }
  }, [active])
  useEffect(() => {
    if (active && scrollRef.current) {
      const max = Math.max(0, virtual.getTotalSize() - scrollRef.current.clientHeight)
      if (scrollRef.current.scrollTop > max) scrollRef.current.scrollTop = max
    }
  }, [models.length, active, virtual])

  const run = async (kind: Operation, model?: Model) => {
    if (pending.current || !activeRef.current) return
    const controller = new AbortController()
    pending.current = controller
    setOperation(kind); setError(''); setMessage('')
    if (model) setTest({ model, state: 'pending' })
    const isCurrent = () => pending.current === controller && !controller.signal.aborted && activeRef.current
    try {
      if (kind === 'test' && model) {
        const result = await host.testModel(model.id, controller.signal)
        if (!isCurrent()) return
        setTest({ model, state: 'success', result })
        try {
          await host.refresh()
        } catch (reason) {
          if (!isCurrent()) return
          const detail = reason instanceof Error ? reason.name === 'TimeoutError' ? tr("请求超时，请重试。", "Request timed out, please try again", "Waktu permintaan habis, silakan coba lagi.") : reason.message : tr("请求失败，请重试。", "The request was unsuccessful. Please try again.", "Permohonan gagal, silakan coba lagi.")
          setError(`模型测试已成功，但刷新摘要失败：${detail}`)
        }
      } else {
        await host.refreshModels(kind === 'probe', controller.signal)
        if (!isCurrent()) return
        setMessage(kind === 'probe' ? tr("可用性探测已完成", "Availability Probe Completed", "Probe Ketersediaan Selesai") : tr("模型清单已更新", "Model manifest updated", "Manifes model diperbarui"))
      }
    } catch (reason) {
      if (!isCurrent()) return
      const detail = reason instanceof Error ? reason.name === 'TimeoutError' ? tr("请求超时，请重试。", "Request timed out, please try again", "Waktu permintaan habis, silakan coba lagi.") : reason.message : tr("操作失败，请重试。", "Operation failed, please try again!\n", "Operasi gagal, silakan ulang")
      if (kind === 'test' && model) setTest({ model, state: 'error', error: detail })
      else setError(detail)
    } finally {
      if (isCurrent()) { pending.current = undefined; setOperation(undefined) }
    }
  }

  const cancel = () => {
    pending.current?.abort()
    pending.current = undefined
    setOperation(undefined)
    setTest(previous => previous ? { ...previous, state: 'cancelled' } : previous)
  }

  const copyModelId = (model: Model) => {
    void host.copy(model.id).then(() => {
      if (activeRef.current) {
        setCopied(model.id)
        setTimeout(() => { if (activeRef.current) setCopied(undefined) }, 1800)
      }
    }).catch(host.error)
  }

  const saveVisibility = async (patch: Partial<ServiceSettings>) => {
    if (visibilityPending.current || !activeRef.current) return
    visibilityPending.current = true
    setVisibilitySaving(true); setError(''); setMessage('')
    try {
      await host.saveSettings(patch)
      if (activeRef.current) setMessage(visibility.saved)
      try { await host.refresh() } catch (reason) { if (activeRef.current) host.error(reason as Error) }
    } catch (reason) {
      if (activeRef.current) setError(reason instanceof Error ? reason.message : tr("保存失败，请重试。", "Save failed. Please try again.", "Gagal menyimpan, silakan coba lagi."))
    } finally {
      visibilityPending.current = false
      setVisibilitySaving(false)
    }
  }

  if (!active) return null
  const filtered = Object.entries(filters).some(([key, value]) => value !== initialFilters[key as keyof typeof initialFilters])
  const routable = summary.catalog.filter(model => model.routable).length
  return <div className="model-browser" data-testid="models-ready">
    <header className="dashboard-heading">
      <div><div className="heading-eyebrow">WORKSPACE / MODELS</div><h1>{tr("模型清单", "Model list", "Daftar model")}</h1>
        <p>{number(summary.catalog.length)} {tr("个模型 ·", "models ·", "model ·")} {number(routable)} {tr("个可接入", "Accessible", "Dapat diakses")}</p></div>
      <div className="actions">
        <Button variant="outline" disabled={!!operation} onClick={() => { void run('refresh') }}>
          <RefreshCw size={15} className={operation === 'refresh' ? 'spinning' : ''} />{operation === 'refresh' ? tr("正在刷新", "Refreshing", "Menyegarkan") : tr("刷新清单", "Refresh list", "Segarkan daftar")}
        </Button>
        <Button disabled={!!operation || !summary.settings.enabled} title={tr("会向上游发送少量推理请求", "will send a small number of inference requests upstream", "akan mengirim sejumlah kecil permintaan inferensi ke hulu")}
          onClick={() => { void run('probe') }}>
          {operation === 'probe' ? <LoaderCircle size={15} className="spinning" /> : <CircleCheck size={15} />}
          {operation === 'probe' ? tr("正在探测", "Probing", "Menyelidiki") : tr("探测可用性", "Probe Availability", "Ketersediaan Probe")}
        </Button>
      </div>
    </header>
    <div className="model-summary">
      <span><span className={`status-dot ${summary.settings.enabled ? '' : 'paused'}`} />{summary.settings.enabled ? tr("推理已启用", "Reasoning Enabled", "Penalaran Diaktifkan") : tr("推理已暂停", "Reasoning paused", "Penalaran dijeda")}</span>
      <span>{tr("清单更新：", "Inventory Updates:", "Pembaruan Inventaris:")}{summary.catalogSyncedAt ? new Date(summary.catalogSyncedAt).toLocaleString(activeLocale(), { hour12: false }) : tr("尚未刷新", "Not yet refreshed", "Belum disegarkan")}</span>
      <span>{tr("主动探测和测试会产生推理请求", "Active probes and tests generate inference requests", "Probe dan tes aktif menghasilkan permintaan inferensi")}</span>
    </div>
    {error && <div className="channel-error" role="alert"><CircleAlert size={16} /><span>{error}</span>
      <Button variant="ghost" aria-label={tr("关闭错误提示", "Turn off error messages", "Nonaktifkan pesan kesalahan")} title={tr("关闭错误提示", "Turn off error messages", "Nonaktifkan pesan kesalahan")} onClick={() => setError('')}><X size={15} /></Button></div>}
    {message && <p className="model-feedback" role="status"><Check size={15} />{message}</p>}
    <div className="model-filters">
      <div className="model-search"><Search size={16} /><Input type="search" aria-label={tr("搜索模型", "Search Objects", "Model Pencarian")} placeholder={tr("搜索模型名称或 ID…", "Search for a model name or ID…", "Cari nama model atau ID…")}
        value={filters.search} onChange={event => changeFilters({ search: event.target.value })} /></div>
      <select aria-label={tr("筛选渠道", "Filter Channels", "Saluran Filter")} value={filters.channel} onChange={event => changeFilters({ channel: event.target.value })}>
        <option value="all">{tr("全部渠道", "All channels", "Semua saluran")}</option>{channels.map(id => <option value={id} key={id}>{channelName(id)}</option>)}
      </select>
      <select aria-label={tr("筛选模型能力", "Screening Model Capability", "Kemampuan Model Penyaringan")} value={filters.capability} onChange={event => changeFilters({ capability: event.target.value })}>
        <option value="all">{tr("全部能力", "All Abilities", "Semua Kemampuan")}</option><option value="text">{tr("纯文本", "Plain text", "Teks biasa")}</option><option value="vision">{tr("支持视觉", "Visual support", "Dukungan visual")}</option><option value="reasoning">{tr("支持思考", "Support Thinking", "Support Thinking")}</option>
      </select>
      <select aria-label={tr("筛选可用状态", "Filter availability", "Ketersediaan filter")} value={filters.availability} onChange={event => changeFilters({ availability: event.target.value })}>
        <option value="all">{tr("全部状态", "All Statuses", "Semua Status")}</option>{Object.entries(availabilityNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}
      </select>
    </div>
    <div className="model-list-toolbar">
      <div className="channel-filters" role="group" aria-label={tr("筛选公开范围", "Screening Disclosure Range", "Rentang Pengungkapan Penyaringan")}>
        {([['all', tr("全部模型", "All Models", "Semua Model")], ['routable', tr("可接入", "Accessible", "Dapat diakses")], ['hidden', tr("未公开", "non disclosed", "Tidak dipublikasikan")]] as const).map(([id, name]) =>
          <button key={id} aria-pressed={filters.access === id} onClick={() => changeFilters({ access: id })}>{name}</button>)}
      </div>
      <span role="status" data-testid="model-result-count">{number(models.length)} / {number(summary.catalog.length)} {tr("个模型", "models", "model")}</span>
      {filtered && <Button variant="ghost" onClick={() => changeFilters(initialFilters)}><X size={14} />{tr("清空筛选", "Clear filters", "Hapus filter")}</Button>}
    </div>
    <div className="model-list-toolbar">
      <label><input type="checkbox" role="switch" checked={summary.settings.hideFreeModels === true}
        disabled={visibilitySaving} onChange={event => { void saveVisibility({ hideFreeModels: event.target.checked }) }} /> {visibility.hideFree}</label>
      <label><input type="checkbox" role="switch" checked={summary.settings.hideEacModels === true}
        disabled={visibilitySaving} onChange={event => { void saveVisibility({ hideEacModels: event.target.checked }) }} /> {visibility.hideEac}</label>
    </div>
    {test && <section className={`model-test-result model-test-${test.state}`} aria-label={tr("模型测试结果", "Model Test Results", "Hasil Uji Model")} aria-live="polite">
      <div className="model-test-heading"><div><strong>
        {test.state === 'pending' ? tr("正在测试", "Testing...", "Pengujian") : test.state === 'success' ? tr("测试完成", "Test Complete", "Tes Selesai") : test.state === 'cancelled' ? tr("测试已取消", "Test canceled", "Tes dibatalkan") : tr("测试失败", "Test failed", "Tes gagal")}
      </strong><span>{test.model.name}{test.result && ` · ${number(test.result.latencyMs)} ms`}</span></div>
        {test.state === 'pending' ? <Button variant="outline" onClick={cancel}><Square size={14} />{tr("取消测试", "Cancel test", "Batalkan tes")}</Button>
          : <Button variant="ghost" aria-label={tr("关闭测试结果", "Close test results", "Tutup hasil tes")} title={tr("关闭测试结果", "Close test results", "Tutup hasil tes")} onClick={() => setTest(undefined)}><X size={15} /></Button>}
      </div>
      {test.state === 'success' && <><pre>{test.result?.text}</pre>{test.result?.persisted === false && <p role="status">{tr("测试已成功，但结果未能保存；请检查数据目录权限或重新测试。", "The test was successful, but the results could not be saved; check the data directory permissions or retest.", "Tes berhasil, tetapi hasilnya tidak dapat disimpan; periksa izin direktori data atau uji ulang.")}</p>}</>}
      {test.state === 'error' && <p>{test.error}</p>}
    </section>}
    {models.length ? <div className="model-table" role="table" aria-label={tr("模型清单", "Model list", "Daftar model")} aria-rowcount={models.length + 1} aria-colcount={5}>
      <div className="model-table-header" role="row"><span role="columnheader">{tr("模型 / ID", "Former ID", "Model/ID")}</span><span role="columnheader">{tr("渠道与能力", "Channels & Capabilities", "Saluran & Kemampuan")}</span>
        <span role="columnheader">{tr("上下文 / 输出", "Context/Output", "Konteks/Output")}</span><span role="columnheader">{tr("可用状态", "Status Available", "Ketersediaan")}</span><span role="columnheader">{tr("操作", "Aksi", "Operate")}</span></div>
      <div ref={scrollRef} className="model-scroll" role="rowgroup" tabIndex={0} aria-label={tr("滚动模型列表", "Scroll through the list of models", "Gulir daftar model")} onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          virtual.scrollToIndex(event.key === 'Home' ? 0 : models.length - 1, { align: event.key === 'Home' ? 'start' : 'end' })
        }
      }}>
        <div className="model-virtual-content" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map(item => {
            const model = models[item.index]
            const state = model.availabilitySource === 'listing' ? 'listed' : model.availability ?? 'unknown'
            const manual = model.availabilitySource === 'manual'
            const failed = manual && state === 'unknown'
            const availabilityName = failed ? tr("实测失败", "Measurement Failure", "Kegagalan Pengukuran") : manual && state === 'available' ? tr("实测可用", "Measured Available", "Terukur Tersedia") : availabilityNames[state] ?? tr("未知状态", "Unknown Status", "Status tidak diketahui")
            const disabledReason = !summary.settings.enabled ? tr("推理服务已暂停", "Reasoning service paused", "Layanan penalaran dihentikan sementara") : !model.routable && !model.hiddenByUser ? tr("模型尚未公开，请检查渠道账号或模型设置", "The model has not been published, please check the channel account or model settings", "Model belum dipublikasikan, silakan periksa akun saluran atau pengaturan model") : operation ? tr("请等待当前操作完成", "Please wait for the current operation to complete", "Harap tunggu hingga operasi saat ini selesai") : ''
            return <div role="row" aria-rowindex={item.index + 2} key={item.key} data-index={item.index} data-model-id={model.id}
              className="model-table-row" ref={virtual.measureElement} style={{ transform: `translateY(${item.start}px)` }}
              onFocusCapture={() => setFocusedId(model.id)} onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(undefined)
              }}>
              <div role="cell" className="model-identity"><strong>{model.name}</strong><code>{model.id}</code></div>
              <div role="cell" className="model-source"><span>{channelName(model.channel)}</span><div className="model-capabilities">
                <Badge>{model.vision ? tr("视觉", "&Visual", "Visual") : tr("纯文本", "Plain text", "Teks biasa")}</Badge>{model.reasoning && <Badge tone="blue">{tr("思考", "Think", "Pertimbangkan.")}</Badge>}</div></div>
              <div role="cell" className="model-limits"><span title={model.contextWindow ? `${model.contextWindow} Token` : undefined}>{capacity(model.contextWindow)} <small>{tr("上下文", "Contextual", "Konteks")}</small></span>
                <span title={model.maxOutput ? `${model.maxOutput} Token` : undefined}>{capacity(model.maxOutput)} <small>{tr("输出", "Output", "Output")}</small></span></div>
              <div role="cell" className="model-state"><Badge tone={state === 'available' ? 'success' : failed || ['unavailable', 'throttled', 'region-blocked'].includes(state) ? 'warning' : 'neutral'}>
                {availabilityName}</Badge>
                {manual && state !== 'available' && model.detail && <small title={model.detail}
                  style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.detail}</small>}
                {!model.routable && <small>{model.hiddenByUser ? visibility.hidden : tr("未公开", "non disclosed", "Tidak dipublikasikan")}</small>}
                {model.ttftMs != null && <small>{tr("首响应", "First Response", "Tanggapan Pertama")} {number(model.ttftMs)} ms</small>}</div>
              <div role="cell" className="model-row-actions">
                {['anonymous', 'kilo', 'eac', 'aggregate', 'combo'].includes(model.channel) && <Button variant="ghost"
                  disabled={visibilitySaving || model.hiddenByGroup === true}
                  title={model.hiddenByGroup ? visibility.groupHidden : model.hiddenByUser ? visibility.show : visibility.hide}
                  aria-label={`${model.hiddenByUser ? visibility.show : visibility.hide}：${model.id}`}
                  onClick={() => { const ids = summary.settings.hiddenModelIds ?? []; void saveVisibility({
                    hiddenModelIds: ids.includes(model.id) ? ids.filter(id => id !== model.id) : [...ids, model.id],
                  }) }}>{model.hiddenByUser ? <Eye size={16} /> : <EyeOff size={16} />}</Button>}
                <Button variant="ghost" title={`复制 ${model.id}`} aria-label={`复制模型 ID：${model.id}`} onClick={() => copyModelId(model)}
                  className={copied === model.id ? 'md-copy-done' : ''}>
                  {copied === model.id ? <Check size={16} /> : <Copy size={16} />}
                </Button>
                <Button variant="outline" disabled={!!disabledReason} title={disabledReason || `测试 ${model.name}，会产生推理请求`}
                  aria-label={`测试模型：${model.id}`} onClick={() => { void run('test', model) }}
                  className={operation === 'test' && test?.model.id === model.id ? 'md-testing' : ''}>
                  {operation === 'test' && test?.model.id === model.id ? <LoaderCircle size={14} className="spinning" /> : <Play size={14} />}{tr("测试", "Test", "Test")}
                </Button>
              </div>
            </div>
          })}
        </div>
      </div>
    </div> : <div className="model-empty"><Boxes size={28} /><h2>{summary.catalog.length ? tr("没有匹配的模型", "No matching models", "Tidak ada model yang cocok") : tr("模型清单为空", "Model manifest is empty", "Manifes model kosong")}</h2>
      <p>{summary.catalog.length ? tr("调整搜索条件或清空筛选。", "Adjust search criteria or clear filters.", "Sesuaikan kriteria pencarian atau hapus filter.") : tr("刷新清单后重试，或检查渠道连接。", "Refresh the manifest and try again, or check the channel connection.", "Segarkan manifes dan coba lagi, atau periksa koneksi saluran.")}</p>
      {filtered && <Button variant="outline" onClick={() => changeFilters(initialFilters)}><SlidersHorizontal size={15} />{tr("清空筛选", "Clear filters", "Hapus filter")}</Button>}
    </div>}
    <p className="footnote">{tr("清单收录不代表实时可用。Kilo 免费池可能记录提示词，请勿发送敏感内容。", "Listings are not meant to be available in real time. Kilo free pool may record prompts, please do not send sensitive content.", "Tempat tidak dimaksudkan untuk tersedia secara real time. Kolam renang gratis Kilo dapat merekam permintaan, jangan mengirim konten sensitif.")}</p>
  </div>
}
