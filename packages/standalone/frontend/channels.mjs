import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { shared } from 'ofm-shared-client'
import { ChannelBrowser } from './components/channel-browser'
import { activeLocale, tr } from './locale'
import 'ofm-shared-styles.css'

const { EacAuth, useEacLogin, DICT, Tank, usePool, poolReading, capacityText, CHANNEL_PROVIDERS, LedgerPage, LogsPage } = shared
const h = React.createElement
const t = key => DICT[activeLocale()]?.[key] ?? DICT.zh[key] ?? key
t.locale = activeLocale()
let requestLifetime = new AbortController()
const ctx = {
  connection: { rpc: {
    async call(_base, _method, payload, signal) {
      const lifetime = requestLifetime.signal
      const response = await fetch('/api/management/channels/rpc', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.any([signal, lifetime]), credentials: 'same-origin',
      })
      const result = await response.json()
      lifetime.throwIfAborted()
      if (response.status === 401) window.dispatchEvent(new CustomEvent('ofm:unauthorized'))
      if (!response.ok) throw new Error(result.error ?? tr('渠道请求失败', 'Channel request failed', 'Permintaan kanal gagal'))
      return result
    },
  } },
}
async function rpc(method, payload = {}) {
  const result = await ctx.connection.rpc.call('/api', 'channel-pack', { method, payload }, AbortSignal.timeout(180000))
  if (!result.ok) throw new Error(result.error?.message ?? tr('渠道操作失败', 'Channel action failed', 'Operasi kanal gagal'))
  return result.value
}
const lockedProviders = new Set(['buddy', 'workbuddy', 'loomy'])

function ChannelTools({ summary }) {
  const [provider, setProvider] = React.useState('buddy')
  const [status, setStatus] = React.useState()
  const [lock, setLock] = React.useState()
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [accounts, setAccounts] = React.useState([])
  const [account, setAccount] = React.useState('')
  const [nickname, setNickname] = React.useState('')
  const file = React.useRef()
  const generation = React.useRef(0)
  const reload = React.useCallback(async () => {
    const started = ++generation.current
    const [statuses, value, nextLock] = await Promise.all([
      rpc('provider.status', { providers: [provider] }),
      rpc('account.list', { provider }),
      lockedProviders.has(provider) ? rpc('credits.permanentLock', { provider }) : undefined,
    ])
    if (started !== generation.current) return
    setStatus(statuses.statuses[provider])
    setAccounts(value.accounts)
    setLock(nextLock)
  }, [provider])
  React.useEffect(() => {
    setStatus(undefined); setLock(undefined); setAccounts([]); setAccount(''); setNickname(''); setMessage('')
    let active = true
    void reload().catch(error => { if (active) setMessage(error.message) })
    return () => { active = false; generation.current++ }
  }, [reload])
  const run = async action => {
    setBusy(true); setMessage('')
    try {
      await action()
      await reload()
      window.dispatchEvent(new CustomEvent('ofm:channels'))
      summary.reload?.()
      setMessage(tr('已保存。', 'Saved.', 'Tersimpan.'))
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  const backup = async () => {
    const value = await rpc('backup.export')
    const blob = new Blob([JSON.stringify(value.payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `ofm-channels-${new Date().toISOString().slice(0, 10)}.json`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  const importFile = async event => {
    const selected = event.target.files[0]
    event.target.value = ''
    if (!selected) return
    if (selected.size > 8 * 1024 * 1024) { setMessage(tr('备份文件不能超过 8MB。', 'Backup files cannot exceed 8 MB.', 'Berkas cadangan tidak boleh melebihi 8 MB.')); return }
    if (!window.confirm(tr('导入会合并备份中的账号凭据、模型开关和积分锁定设置，确认继续吗？', 'Import merges account credentials, model switches, and credit locks from the backup. Continue?', 'Impor menggabungkan kredensial akun, sakelar model, dan kunci kredit dari cadangan. Lanjutkan?'))) return
    await run(async () => { await rpc('backup.import', { payload: JSON.parse(await selected.text()) }) })
  }
  return h('section', { className: 'ofm_hero', 'aria-label': tr('供应商与数据管理', 'Providers and data', 'Penyedia dan data') },
    h('h3', null, tr('供应商与数据管理', 'Providers and data', 'Penyedia dan data')),
    h('div', { className: 'ofm_row' },
      h('label', null, tr('供应商 ', 'Provider ', 'Penyedia '), h('select', { value: provider, disabled: busy, onChange: event => setProvider(event.target.value) },
        CHANNEL_PROVIDERS.map(row => h('option', { value: row.id, key: row.id }, row.name)))),
      h('button', { className: 'ofm_btn', disabled: busy || !status, onClick: () => run(() => rpc('provider.setEnabled', { provider, enabled: status.closed === true })) },
        status?.closed ? tr('启用供应商', 'Enable provider', 'Aktifkan penyedia') : tr('关闭供应商', 'Turn off provider', 'Matikan penyedia')),
      lock ? h('label', null, h('input', { type: 'checkbox', checked: lock.locked === true, disabled: busy, onChange: event => run(() => rpc('credits.permanentLock', { provider, locked: event.target.checked })) }), tr(' 锁定永久积分', ' Lock permanent credits', ' Kunci kredit permanen')) : null),
    lock ? h('p', { className: 'ofm_note' }, lock.windowDays ? tr(`锁定后仅使用 ${lock.windowDays} 天内到期的积分；免费模型沿用原有豁免规则。`, `Only credits expiring within ${lock.windowDays} days will be used; free models retain their exemption.`, `Hanya kredit yang kedaluwarsa dalam ${lock.windowDays} hari yang digunakan; model gratis tetap dikecualikan.`) : tr('锁定后按原渠道规则保护永久积分。', 'Permanent credits are protected according to the channel rules.', 'Kredit permanen dilindungi sesuai aturan kanal.')) : null,
    h('div', { className: 'ofm_row' },
      h('label', null, tr('账号 ', 'Account ', 'Akun '), h('select', { value: account, disabled: busy, onChange: event => { setAccount(event.target.value); setNickname(accounts.find(row => row.id === event.target.value)?.nickname ?? '') } },
        h('option', { value: '' }, tr('选择账号', 'Select account', 'Pilih akun')),
        accounts.map(row => h('option', { value: row.id, key: row.id }, row.nickname ?? row.id)))),
      h('input', { 'aria-label': tr('账号昵称', 'Account nickname', 'Nama panggilan akun'), value: nickname, placeholder: tr('账号昵称', 'Account nickname', 'Nama panggilan akun'), disabled: !account || busy, onChange: event => setNickname(event.target.value) }),
      h('button', { className: 'ofm_btn', disabled: !account || busy, onClick: () => run(() => rpc('account.update', { accountId: account, patch: { nickname } })) }, tr('保存昵称', 'Save nickname', 'Simpan nama panggilan')),
      h('button', { className: 'ofm_btn', disabled: !account || busy, onClick: () => run(() => rpc('account.reorder', { provider, orderedIds: [account, ...accounts.filter(row => row.id !== account).map(row => row.id)] })) }, tr('优先使用', 'Use first', 'Prioritaskan')),
      h('button', { className: 'ofm_btn', disabled: !account || busy, onClick: () => run(() => rpc('account.reset', { accountId: account })) }, tr('重置限流标记', 'Reset rate-limit flag', 'Atur ulang penanda batas frekuensi'))),
    h('div', { className: 'ofm_row ofm_acts' },
      h('button', { className: 'ofm_btn', disabled: busy, onClick: () => run(backup) }, tr('导出账号备份', 'Export account backup', 'Ekspor cadangan akun')),
      h('button', { className: 'ofm_btn', disabled: busy, onClick: () => file.current.click() }, tr('导入账号备份', 'Import account backup', 'Impor cadangan akun')),
      h('input', { ref: file, type: 'file', hidden: true, accept: '.json,application/json', onChange: importFile })),
    h('p', { className: 'ofm_note' }, tr('备份包含登录凭据，请保存在可信的本地位置。插件导出的原格式备份也可以手动导入。', 'Backups include sign-in credentials; store them in a trusted local location. Original plugin backups can also be imported manually.', 'Cadangan memuat kredensial masuk; simpan di lokasi lokal tepercaya. Cadangan format asli plugin juga dapat diimpor secara manual.')),
    message ? h('p', { role: 'status', className: 'ofm_note' }, message) : null)
}

function ChannelConsole({ summary }) {
  const [page, setPage] = React.useState('accounts')
  return h(React.Fragment, null,
    h('header', { className: 'dashboard-heading' },
      h('div', null, h('div', { className: 'heading-eyebrow' }, tr('工作台 / 渠道', 'WORKSPACE / CHANNELS', 'RUANG KERJA / KANAL')),
        h('h1', null, tr('免费账号渠道', 'Free account channels', 'Kanal akun gratis')), h('p', null, tr('连接你的账号，把各家的免费额度汇集到一个 API。', 'Connect your accounts and bring free quotas into one API.', 'Hubungkan akun untuk menggabungkan kuota gratis dalam satu API.')))),
    h('div', { className: 'ofm_seg', role: 'tablist', 'aria-label': tr('渠道管理页面', 'Channel management pages', 'Halaman pengelolaan kanal') },
      [['accounts', tr('登录与账号池', 'Sign-in and account pool', 'Masuk dan kumpulan akun')], ['ledger', tr('渠道用量', 'Channel usage', 'Penggunaan kanal')], ['logs', tr('请求日志', 'Request log', 'Log permintaan')], ['tools', tr('供应商与备份', 'Providers and backups', 'Penyedia dan cadangan')]].map(([id, name]) =>
        h('button', { key: id, role: 'tab', 'aria-selected': page === id, onClick: () => setPage(id) }, name))),
    page === 'accounts' ? h(ChannelBrowser, { rpc, summary })
      : page === 'ledger' ? h(LedgerPage, { t, ctx, summary })
        : page === 'logs' ? h(LogsPage, { t, ctx, summary })
          : h(ChannelTools, { summary }))
}

function EacPage({ summary }) {
  const [auth, onAuth] = React.useState(summary.eacAuth)
  const login = useEacLogin({ t, summary, onAuth })
  const { pool } = usePool()
  const reading = pool == null ? null : poolReading(pool)
  React.useEffect(() => { login.refresh() }, [login.refresh])
  return h(React.Fragment, null,
    h('header', { className: 'dashboard-heading' },
      h('div', null, h('div', { className: 'heading-eyebrow' }, tr('工作台 / EAC', 'WORKSPACE / EAC', 'RUANG KERJA / EAC')),
        h('h1', null, tr('EAC 协付渠道', 'EAC co-paid lane', 'Kanal EAC patungan')), h('p', null, tr('使用本机独立授权，连接共享资源池。', 'Authorize on this machine to connect to the shared pool.', 'Otorisasi di mesin ini untuk terhubung ke kumpulan bersama.')))),
    h(EacAuth, { t, auth, eacLogin: login }),
    h('div', { className: 'ofm_hero' },
      h('h3', null, tr('EAC 实时资源池', 'EAC live pool', 'Kumpulan EAC langsung')),
      pool == null ? h('p', null, pool === undefined ? tr('正在查询资源池…', 'Checking the pool…', 'Memeriksa kumpulan…') : tr('资源池暂时无法查询，请稍后刷新。', 'Pool unavailable; refresh later.', 'Kumpulan tidak tersedia; perbarui nanti.'))
        : h(React.Fragment, null,
          h(Tank, { pct: reading.pct, level: reading.level, size: 'xl' }),
          h('p', null, tr(`当前并发：${pool.inflight} · 24 小时活跃：${reading.active ?? '未知'} · 容量：${pool.pool ?? '未知'}`, `Concurrent: ${pool.inflight} · active in 24 h: ${reading.active ?? 'unknown'} · capacity: ${pool.pool ?? 'unknown'}`, `Serentak: ${pool.inflight} · aktif 24 jam: ${reading.active ?? 'tidak diketahui'} · kapasitas: ${pool.pool ?? 'tidak diketahui'}`)),
          h('p', null, capacityText(pool, t)))))
}

let root
export function show(kind, summary) {
  if (!root) {
    requestLifetime = new AbortController()
    root = createRoot(document.getElementById('channel-root'))
  }
  root.render(h(kind === 'eac' ? EacPage : ChannelConsole, { t, ctx, summary }))
}
export function hide() {
  requestLifetime.abort()
  if (root) { root.unmount(); root = undefined }
}
