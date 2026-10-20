import { tr, activeLocale } from './locale'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, Check, LoaderCircle, RotateCcw, Save, Settings2, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, Input } from './components/ui'
import { settingsDraft, settingsChanged, syncSettings, validateSettingsDraft } from './settings-data.mjs'
import { visibilityCopy } from './visibility-data.mjs'
import type { Host, Summary } from './types'
import './settings.css'

type Draft = ReturnType<typeof settingsDraft>
type NumberField = 'defaultMaxTokens' | 'probeIntervalMinutes'
const connectionError = (reason: unknown) => reason instanceof Error
  ? reason.name === 'TimeoutError' ? tr("保存请求超时，结果尚未确认。请重试或检查服务状态。", "The save request timed out and the result has not been confirmed. Please try again or check the service status.", "Waktu permintaan penyimpanan habis dan hasilnya belum dikonfirmasi. Silakan coba lagi atau periksa status layanan.")
    : reason instanceof TypeError && /fetch/i.test(reason.message) ? tr("无法连接本地服务，修改已保留，请确认服务正在运行后重试。", "Unable to connect to the local service, the modification is reserved, please make sure the service is running and try again.", "Tidak dapat terhubung ke layanan lokal, modifikasi dicadangkan, pastikan layanan sedang berjalan dan coba lagi.")
    : reason.message : tr("保存失败，修改已保留，请重试。", "Saving failed, changes are reserved, please try again.", "Gagal menyimpan, perubahan dicadangkan, silakan coba lagi.")

export function Settings({ summary, host, active }: { summary: Summary; host: Host; active: boolean }) {
  const visibility = visibilityCopy(document.documentElement.lang)
  const [state, setState] = useState(() => ({ saved: summary.settings, draft: settingsDraft(summary.settings) }))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<NumberField, string>>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const activeRef = useRef(active)
  const generation = useRef(0)
  activeRef.current = active
  useEffect(() => () => { mounted.current = false; generation.current++ }, [])
  useEffect(() => {
    if (!active) { generation.current++; setMessage(''); setError('') }
  }, [active])
  useEffect(() => {
    setState(previous => syncSettings(previous, summary.settings, savingRef.current))
  }, [summary.settings])
  const dirty = settingsChanged(state.draft, state.saved)
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setState(previous => ({ ...previous, draft: { ...previous.draft, [key]: value } }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
    setMessage(''); setError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current || !activeRef.current) return
    const validation = validateSettingsDraft(state.draft)
    setErrors(validation.errors); setMessage(''); setError('')
    if (!validation.patch) return
    const started = ++generation.current
    const feedbackCurrent = () => mounted.current && activeRef.current && started === generation.current
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await host.saveSettings(validation.patch)
      if (!mounted.current) return
      setState({ saved, draft: settingsDraft(saved) })
      if (feedbackCurrent()) setMessage(tr("设置已保存并生效", "Settings saved and in effect", "Pengaturan disimpan dan berlaku"))
      // 保存结果已确认；后续读取失败不能误报为保存失败。
      try { await host.refresh() } catch {
        if (feedbackCurrent()) setMessage(tr("设置已保存；状态刷新失败，稍后会自动重试。", "Settings saved; status refresh failed and will automatically retry later.", "Pengaturan disimpan; penyegaran status gagal dan akan otomatis dicoba lagi nanti."))
      }
    } catch (reason) {
      if (feedbackCurrent()) setError(connectionError(reason))
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }
  const toggle = (name: 'enabled' | 'exposeRegionModels' | 'streamRecovery' | 'standaloneProbe' | 'hideFreeModels' | 'hideEacModels', label: string, help: string) =>
    <label className="settings-field" key={name}>
      <span><strong>{label}</strong><small>{help}</small></span>
      <input type="checkbox" role="switch" name={name} className="settings-toggle"
        checked={state.draft[name]} onChange={event => update(name, event.target.checked)} />
    </label>
  const numeric = (name: NumberField, label: string, help: string, min: number, max: number) =>
    <div className="settings-field settings-number-field">
      <label htmlFor={`setting-${name}`}><strong>{label}</strong><small>{help}</small></label>
      <div className="settings-number"><Input id={`setting-${name}`} name={name} type="number" min={min} max={max} step={1}
        value={state.draft[name]} onChange={event => update(name, event.target.value)}
        aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `setting-error-${name}` : undefined} />
        {errors[name] ? <p id={`setting-error-${name}`} className="settings-field-error" role="alert"><CircleAlert size={12} />{errors[name]}</p>
          : <span className="settings-hint">{min}–{max}</span>}
      </div>
    </div>
  if (!active) return null
  const statusClass = saving ? 'settings-status-saving' : dirty ? 'settings-status-dirty' : message ? 'settings-status-saved' : ''
  return <div className="settings-browser" data-testid="settings-ready">
    <header className="dashboard-heading"><div><div className="heading-eyebrow">MANAGEMENT / SETTINGS</div>
      <h1>{tr("服务设置", "Service Setting", "Pengaturan Layanan")}</h1><p>{tr("调整本机推理与模型刷新，保存后生效。", "Adjust the inference and model refresh of the machine, and it will take effect after saving.", "Sesuaikan inferensi dan penyegaran model mesin, dan itu akan berlaku setelah disimpan.")}</p></div>
      <Badge tone={summary.settings.enabled ? 'success' : 'warning'}>{summary.settings.enabled ? tr("推理服务已启用", "Reasoning Service Enabled", "Layanan Penalaran Diaktifkan") : tr("推理服务已暂停", "Reasoning service paused", "Layanan penalaran dihentikan sementara")}</Badge>
    </header>
    <form onSubmit={event => { void submit(event) }} noValidate>
      <fieldset disabled={saving} className="settings-fieldset">
        <Card className="settings-card"><div className="settings-card-heading"><Settings2 size={16} /><div><h2>{tr("推理与模型", "Reasoning & Modelling", "Penalaran & Pemodelan")}</h2><p>{tr("控制客户端调用与模型展示。", "Control client-side calls and model presentations.", "Kontrol panggilan sisi klien dan presentasi model.")}</p></div></div>
          {toggle('enabled', tr("启用推理服务", "Enable inference service", "Aktifkan layanan inferensi"), tr("关闭后暂停 API 推理，管理页面仍可访问。", "After closing, API inference is paused, and the management page is still accessible.", "Setelah ditutup, inferensi api dijeda, dan halaman manajemen masih dapat diakses."))}
          {toggle('exposeRegionModels', tr("显示地区受限模型", "Show region-restricted models", "Tampilkan model yang dibatasi wilayah"), tr("保留受当前出口地区限制的模型供客户端选择。", "Keep the model restricted by the current export region for the client to select.", "Pertahankan model dibatasi oleh wilayah ekspor saat ini untuk dipilih klien."))}
          {toggle('hideFreeModels', visibility.hideFree, tr("仅从选择器和 API 模型清单隐藏，保留历史模型调用。", "Hidden only from selectors and API model manifests, historical model calls are preserved.", "Tersembunyi hanya dari pemilih dan manifes model api, panggilan model historis dipertahankan."))}
          {toggle('hideEacModels', visibility.hideEac, tr("保留授权和历史模型调用，可随时恢复显示。", "Authorization and historical model calls are preserved and display can be resumed at any time.", "Otorisasi dan panggilan model historis dipertahankan dan tampilan dapat dilanjutkan kapan saja."))}
          {toggle('streamRecovery', tr("自动恢复断流", "Automatic restoration of disconnection", "Pemulihan otomatis pemutusan"), tr("允许从已生成的检查点继续回答。", "Allow answers to continue from the checkpoints that have been generated.", "Izinkan jawaban untuk melanjutkan dari pos pemeriksaan yang telah dibuat."))}
          {numeric('defaultMaxTokens', tr("单次最大输出 Token", "Single Maximum Output Token", "Token Output Maksimum Tunggal"), tr("512–131072，实际输出还受模型能力限制。", "512–131072, the actual output is also limited by the model capacity.", "512 -131072, output aktual juga dibatasi oleh kapasitas model."), 512, 131072)}
        </Card>
        <Card className="settings-card"><div className="settings-card-heading"><RefreshCw size={16} /><div><h2>{tr("模型刷新", "Model Refresh", "Penyegaran Model")}</h2><p>{tr("管理模型清单的周期更新与探测。", "Manage periodic updates and probes of the model inventory.", "Kelola pembaruan dan pemeriksaan berkala dari inventaris model.")}</p></div></div>
          {numeric('probeIntervalMinutes', tr("刷新间隔（分钟）", "Refresh interval in minutes:", "Refresh interval (menit)"), tr("1–1440 分钟，保存后重新安排下一轮。", "1–1440 minutes, save and reschedule the next round.", "1 -1440 menit, simpan dan jadwalkan ulang putaran berikutnya."), 1, 1440)}
          {toggle('standaloneProbe', tr("自动探测可用性", "Autodetect Availability", "Ketersediaan Deteksi Otomatis"), tr("周期刷新时发送探测请求，消耗上游额度；遇到限流会自动退避。", "When the cycle is refreshed, a probe request is sent, which consumes the upstream quota; if it encounters current limitation, it will automatically back away.", "Ketika siklus disegarkan, permintaan probe dikirim, yang mengkonsumsi kuota hulu; jika menemukan batasan saat ini, secara otomatis akan mundur."))}
          <p className="settings-note" role="note"><CircleAlert size={15} /><span>{summary.automaticRefresh
            ? tr("自动刷新已启用，保存间隔后会重新安排下一轮。", "Auto-refresh is enabled and the next round will be rescheduled after saving the interval.", "Penyegaran otomatis diaktifkan dan putaran berikutnya akan dijadwal ulang setelah menyimpan interval.")
            : tr("当前以 --no-refresh 启动。设置会保存，但自动任务保持暂停；手动刷新仍可用。", "Currently started as --no-refresh. Settings are saved, but automatic tasks remain paused; manual refreshes are still available.", "Saat ini dimulai sebagai -- no - refresh. Pengaturan disimpan, tetapi tugas otomatis tetap dijeda; penyegaran manual masih tersedia.")}</span></p>
        </Card>
        <div className="settings-footer"><span role="status" aria-live="polite" className={statusClass}><span className="settings-status-dot" aria-hidden="true" />{saving ? tr("正在保存，请稍候…", "Saving your article. Please wait.", "Menyimpan, harap tunggu...") : dirty ? tr("有尚未保存的修改", "You have unsaved changes", "Anda memiliki perubahan yang belum disimpan") : message || tr("当前设置已同步", "Current settings synced", "Pengaturan saat ini disinkronkan")}</span>
          <div className="settings-actions"><Button variant="outline" disabled={!dirty || saving} onClick={() => {
            setState(previous => ({ ...previous, draft: settingsDraft(previous.saved) }))
            setErrors({}); setError(''); setMessage('')
          }}><RotateCcw size={15} />{tr("撤销修改", "Undo modification", "Batalkan modifikasi")}</Button>
            <Button type="submit" disabled={!dirty || saving}>{saving ? <LoaderCircle size={15} className="spinning" /> : message && !dirty ? <Check size={15} /> : <Save size={15} />}{saving ? tr("正在保存", "Saving", "Menyimpan...") : tr("保存设置", "Save", "Setting Simpan")}</Button></div>
        </div>
      </fieldset>
      {error && <p className="settings-save-error" role="alert"><CircleAlert size={16} /><span>{error}</span></p>}
    </form>
    <p className="footnote">{tr("配置保存在当前独立服务的数据目录中。页面读取和保存设置不会直接发送模型推理请求。", "The configuration is saved in the data directory of the current standalone service. Page read and save settings do not send model inference requests directly.", "Konfigurasi disimpan dalam direktori data layanan mandiri saat ini. Pengaturan baca dan simpan halaman tidak mengirim permintaan inferensi model secara langsung.")}</p>
  </div>
}
