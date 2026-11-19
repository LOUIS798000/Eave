/**
 * Theme: writes dynamic CSS properties and data attributes to :root.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** Resolve a user theme preference ('system' | 'light' | 'dark') to an active mode. */
export function resolveThemeMode(pref: ThemePreference | undefined): ResolvedTheme {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

/** Apply reduce-motion preference as a data attribute the CSS can key off. */
export function applyReduceMotion(reduce: boolean): void {
  document.documentElement.dataset.motion = reduce ? 'reduce' : 'full'
}

/** Apply active color theme ('light' | 'dark') to <html>. */
export function applyThemeMode(pref: ThemePreference | undefined): ResolvedTheme {
  const resolved = resolveThemeMode(pref)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  return resolved
}
