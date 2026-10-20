import { tr, activeLocale } from '../locale'
import { Coffee, Activity, Boxes, Cable, ChevronRight, Handshake, LayoutDashboard, LogOut, Moon, Network, Settings2, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import brandMark from '../../../../icon.svg?inline'
import { Badge, Button } from './ui'
import type { Host, Page, Summary } from '../types'
import { locale, localeNames, type Locale } from '../locale'

const labels: Record<Locale, Record<string, string>> = {
  zh: { workspace: tr("工作空间", "Workspace", "Ruang kerja"), language: tr("语言", "Language", "Bahasa") },
  en: { workspace: 'Workspace', language: 'Language' },
  id: { workspace: 'Ruang kerja', language: 'Bahasa' },
}
function LanguageSelector() {
  const [current, setCurrent] = useState<Locale>(locale.current)
  return <label className="language-selector">{labels[current].language}<select value={current} aria-label={labels[current].language} onChange={event => { const next = event.target.value as Locale; locale.set(next); setCurrent(next); window.location.reload() }}>{(Object.keys(localeNames) as Locale[]).map(value => <option key={value} value={value}>{localeNames[value]}</option>)}</select></label>
}

const navigation = [
  { label: tr("工作空间", "Workspace", "Ruang kerja"), items: [
    { id: 'overview', name: tr("概览", "At a Glance", "Rangkuman:"), icon: LayoutDashboard },
    { id: 'models', name: tr("模型清单", "Model list", "Daftar model"), icon: Boxes },
    { id: 'usage', name: tr("用量统计", "Usage statistics", "Statistik penggunaan"), icon: Activity },
  ] },
  { label: tr("渠道与连接", "Channels & Connections", "Saluran & Koneksi"), items: [
    { id: 'channels', name: tr("免费账号渠道", "Free account channels", "Saluran akun gratis"), icon: Network },
    { id: 'eac', name: tr("EAC 协付渠道", "EAC co-payment channel", "Saluran pembayaran bersama EAC"), icon: Handshake },
    { id: 'connection', name: tr("API 接入", "API Access", "Akses api"), icon: Cable },
  ] },
  { label: tr("管理", "Managing", "Kelola"), items: [{ id: 'settings', name: tr("服务设置", "Service Setting", "Pengaturan Layanan"), icon: Settings2 }] },
  { label: tr("项目支持", "Project support", "Dukungan Proyek"), items: [{ id: 'sponsor', name: tr("来自赞助商的广告", "Ads from Sponsors", "Iklan dari Sponsor"), icon: Coffee }] },
] as const

type Origin = { x: number; y: number }

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const apply = (next: 'light' | 'dark') => {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('ofm-theme', next) } catch { /* 存储不可用时仅本次会话生效 */ }
    setTheme(next)
  }
  const toggle = (origin?: Origin) => {
    const next = theme === 'dark' ? 'light' : 'dark'
    // 没有 View Transition、或用户要求减少动效时直接切换，不做扩散。
    if (!origin || typeof document.startViewTransition !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(next); return }
    const root = document.documentElement
    // 半径取按钮中心到视口最远角的距离，保证圆盘一定盖满整屏。
    const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y))
    root.style.setProperty('--theme-reveal-x', `${origin.x}px`)
    root.style.setProperty('--theme-reveal-y', `${origin.y}px`)
    root.style.setProperty('--theme-reveal-r', `${radius}px`)
    // 扩散期间关掉 300ms 的底色过渡，否则"新主题"快照会抓到过渡中间色。
    root.classList.add('theme-transitioning')
    const transition = document.startViewTransition(() => { flushSync(() => apply(next)) })
    const finish = () => {
      root.classList.remove('theme-transitioning')
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.style.removeProperty('--theme-reveal-r')
    }
    transition.finished.then(finish, finish)
  }
  return { theme, toggle }
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? tr("切换到浅色主题", "Switch to light theme", "Beralih ke tema terang") : tr("切换到深色主题", "Switch to Dark Theme", "Beralih ke Tema Gelap")
  return <Button variant="ghost" className="theme-toggle" aria-label={label} title={theme === 'dark' ? tr("浅色", "Light", "Terang") : tr("深色", "Dark", "Warna jendela?")}
    onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) }}>
    <span className="theme-toggle-track" data-theme={theme}>
      <span className="theme-toggle-icon theme-toggle-sun" aria-hidden="true"><Sun size={16} /></span>
      <span className="theme-toggle-icon theme-toggle-moon" aria-hidden="true"><Moon size={16} /></span>
    </span>
  </Button>
}

export const pageNames: Record<Page, string> = {
  overview: tr("概览", "At a Glance", "Rangkuman:"), models: tr("模型清单", "Model list", "Daftar model"), usage: tr("用量统计", "Usage statistics", "Statistik penggunaan"), channels: tr("免费账号渠道", "Free account channels", "Saluran akun gratis"),
  eac: tr("EAC 协付渠道", "EAC co-payment channel", "Saluran pembayaran bersama EAC"), settings: tr("服务设置", "Service Setting", "Pengaturan Layanan"), connection: tr("API 接入", "API Access", "Akses api"), sponsor: tr("来自赞助商的广告", "Ads from Sponsors", "Iklan dari Sponsor"),
}

export function Sidebar({ page, summary, host }: { page: Page; summary?: Summary; host: Host }) {
  return <>
    <a className="console-brand" href="/" aria-label={tr("Our Free Model 首页", "Our Free Model Home", "Rumah Model Gratis Kami")}>
      <img className="console-mark" src={brandMark} alt="" width={34} height={36} />
      <span>Our Free Model<small>{tr("本地模型工作台", "Local Model Workbench", "Meja Kerja Model Lokal")}</small></span>
    </a>
    <LanguageSelector />
    <div className="workspace-switch"><span className="workspace-avatar"><ShieldCheck size={17} /></span>
      <span>{tr("个人工作空间", "Personal Workspace", "Ruang kerja pribadi")}<small>{tr("独立本地服务", "Independent local services", "Layanan lokal independen")}</small></span><Badge>{tr("本机", "This Host", "Asli")}</Badge>
    </div>
    <nav className="console-nav" aria-label={tr("管理导航", "Comment navigation", "Kelola navigasi")}>{navigation.map(group => <div className="nav-group" key={group.label}>
      <span className="nav-group-label">{group.label}</span>
      {group.items.map(item => <button key={item.id} id={item.id === 'sponsor' ? 'ofm-sponsor-menu-desktop' : undefined} className={`console-nav-item ${item.id === 'sponsor' ? 'ofm-sponsor-nav' : ''} ${page === item.id ? 'selected' : ''}`}
        aria-current={page === item.id ? 'page' : undefined} onClick={() => host.navigate(item.id)}>
        <span className="console-nav-indicator" aria-hidden="true" />
        <item.icon size={18} strokeWidth={1.7} /><span>{item.name}</span>
        {item.id === 'models' && <span className="count-badge">{summary?.catalog.length ?? '—'}</span>}
      </button>)}
    </div>)}</nav>
    <div className="sidebar-support"><ShieldCheck size={17} /><div><strong>{tr("独立本地存储", "Independent local storage", "Penyimpanan lokal independen")}</strong><p>{tr("本机运行 / 仅监听回环地址", "Native Run/Listen Loopback Address Only", "Alamat Loopback Run/Listen Asli Saja")}</p></div></div>
    <div className="console-sidebar-footer"><div><span className="status-dot" />{tr("本地服务在线", "Local service online", "Layanan lokal online")}<small>v{summary?.version ?? '—'}</small></div>
      <ThemeToggle /><Button variant="ghost" aria-label={tr("退出管理", "Quit management", "Manajemen Keluar")} title={tr("退出管理", "Quit management", "Manajemen Keluar")} onClick={() => { void host.logout().catch(host.error) }}><LogOut size={16} /></Button></div>
  </>
}
export function Topbar({ page, summary }: { page: Page; summary?: Summary }) {
  return <><div className="console-breadcrumb"><span>{tr("工作空间", "Workspace", "Ruang kerja")}</span><ChevronRight size={14} /><strong key={page} className="console-breadcrumb-current">{pageNames[page]}</strong></div>
    <div className="console-topbar-status"><span className="status-dot" /><span>{summary?.settings.enabled === false ? tr("推理已暂停", "Reasoning paused", "Penalaran dijeda") : tr("本地服务", "Home service", "Layanan Lokal")}</span><span className="topbar-divider" /><span>LOCAL</span></div></>
}
