import { useSyncExternalStore } from 'react'
import { useStore } from '../store/appStore'
import { LANGUAGES, type TranslationKeys } from './types'
import en from './locales/en'
import zhCN from './locales/zh-CN'

export { LANGUAGES, type TranslationKeys }

/**
 * Only `en` (fallback) and `zh-CN` (primary product language) are bundled
 * eagerly into the main renderer chunk. All other 29 locales are code-split
 * and loaded on-demand when selected, trimming ~550 KB from initial JS parse
 * and V8 heap.
 */
const loadedLocales: Record<string, TranslationKeys> = {
  en,
  'zh-CN': zhCN
}

const LOCALE_LOADERS: Record<string, () => Promise<{ default: TranslationKeys }>> = {
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
  ru: () => import('./locales/ru'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  'zh-TW': () => import('./locales/zh-TW'),
  hi: () => import('./locales/hi'),
  ar: () => import('./locales/ar'),
  fa: () => import('./locales/fa'),
  bn: () => import('./locales/bn'),
  tr: () => import('./locales/tr'),
  vi: () => import('./locales/vi'),
  pl: () => import('./locales/pl'),
  nl: () => import('./locales/nl'),
  sv: () => import('./locales/sv'),
  id: () => import('./locales/id'),
  uk: () => import('./locales/uk'),
  el: () => import('./locales/el'),
  cs: () => import('./locales/cs'),
  ro: () => import('./locales/ro'),
  hu: () => import('./locales/hu'),
  da: () => import('./locales/da'),
  fi: () => import('./locales/fi'),
  th: () => import('./locales/th'),
  he: () => import('./locales/he'),
  no: () => import('./locales/no')
}

const inflight = new Set<string>()
const listeners = new Set<() => void>()
let localeRevision = 0

function subscribeLocale(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getLocaleSnapshot(): number {
  return localeRevision
}

export function ensureLocaleLoaded(langCode: string): void {
  if (loadedLocales[langCode] || inflight.has(langCode)) return
  const loader = LOCALE_LOADERS[langCode]
  if (!loader) return
  inflight.add(langCode)
  void loader()
    .then((mod) => {
      if (mod?.default) {
        loadedLocales[langCode] = mod.default
        localeRevision++
        for (const cb of listeners) cb()
      }
    })
    .catch((err) => {
      console.error(`[i18n] Failed to load locale "${langCode}":`, err)
    })
    .finally(() => {
      inflight.delete(langCode)
    })
}

/**
 * Resolves the active language code.
 * If 'system', automatically matches navigator.language (e.g. 'es-ES' -> 'es').
 */
export function getResolvedLanguage(settingLang?: string): string {
  const code = settingLang || useStore.getState().settings.language || 'system'
  if (code !== 'system') return code

  const g = globalThis as any
  if (!g.window || !g.window.navigator) return 'en'
  const navLang = ((g.window.navigator.language as string) || '').toLowerCase()

  if (navLang.startsWith('zh-tw') || navLang.startsWith('zh-hk')) return 'zh-TW'
  if (navLang.startsWith('zh')) return 'zh-CN'
  if (navLang.startsWith('es')) return 'es'
  if (navLang.startsWith('fr')) return 'fr'
  if (navLang.startsWith('de')) return 'de'
  if (navLang.startsWith('hi')) return 'hi'
  if (navLang.startsWith('ja')) return 'ja'
  if (navLang.startsWith('ru')) return 'ru'
  if (navLang.startsWith('it')) return 'it'
  if (navLang.startsWith('pt')) return 'pt'
  if (navLang.startsWith('ko')) return 'ko'
  if (navLang.startsWith('ar')) return 'ar'
  if (navLang.startsWith('fa')) return 'fa'
  if (navLang.startsWith('bn')) return 'bn'
  if (navLang.startsWith('tr')) return 'tr'
  if (navLang.startsWith('vi')) return 'vi'
  if (navLang.startsWith('pl')) return 'pl'
  if (navLang.startsWith('nl')) return 'nl'
  if (navLang.startsWith('sv')) return 'sv'
  if (navLang.startsWith('id')) return 'id'
  if (navLang.startsWith('uk')) return 'uk'
  if (navLang.startsWith('el')) return 'el'
  if (navLang.startsWith('cs')) return 'cs'
  if (navLang.startsWith('ro')) return 'ro'
  if (navLang.startsWith('hu')) return 'hu'
  if (navLang.startsWith('da')) return 'da'
  if (navLang.startsWith('fi')) return 'fi'
  if (navLang.startsWith('th')) return 'th'
  if (navLang.startsWith('he')) return 'he'
  if (navLang.startsWith('no') || navLang.startsWith('nb') || navLang.startsWith('nn')) return 'no'

  return 'en'
}

/**
 * Retrieves a nested string property safely from a translation dictionary.
 */
function getNestedProp(obj: any, path: string): string | undefined {
  const parts = path.split('.')
  let curr = obj
  for (const part of parts) {
    if (!curr || typeof curr !== 'object') return undefined
    curr = curr[part]
  }
  return typeof curr === 'string' ? curr : undefined
}

/**
 * Main translation function.
 * E.g., t('header.searchPlaceholder')
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const settingsLang = useStore.getState().settings.language
  const langCode = getResolvedLanguage(settingsLang)
  ensureLocaleLoaded(langCode)
  const dict = loadedLocales[langCode]

  let val = dict ? getNestedProp(dict, path) : undefined
  if (!val) {
    val = getNestedProp(en, path) || path
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }

  return val
}

/**
 * Hook that subscribes to settings.language and lazy-locale readiness.
 */
export function useTranslation() {
  const language = useStore((s) => s.settings.language)
  useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot)
  const resolvedLang = getResolvedLanguage(language)
  ensureLocaleLoaded(resolvedLang)

  // Update text direction for RTL languages like Arabic, Persian & Hebrew
  const g = globalThis as any
  if (g.document && g.document.documentElement) {
    const isRtl = resolvedLang === 'ar' || resolvedLang === 'fa' || resolvedLang === 'he'
    g.document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  }

  return {
    t,
    language,
    resolvedLang,
    languages: LANGUAGES
  }
}
