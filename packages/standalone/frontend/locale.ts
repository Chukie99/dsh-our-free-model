export type Locale = 'zh' | 'en' | 'id'

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  id: 'Bahasa Indonesia',
}

const STORAGE_KEY = 'ofm-locale'
const LOCALE_EVENT = 'ofm-locale-changed'

function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en' || value === 'id'
}

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : 'id'
  } catch {
    return 'id'
  }
}

export function activeLocale(): Locale {
  return locale.current
}

export function tr(zh: string, en: string, id: string): string {
  switch (activeLocale()) {
    case 'zh': return zh
    case 'en': return en
    case 'id': return id
  }
}

export const locale = {
  current: readLocale(),
  set(value: Locale): void {
    if (!isLocale(value)) return
    this.current = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Language remains active for this session when storage is unavailable.
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LOCALE_EVENT))
    }
  },
}
