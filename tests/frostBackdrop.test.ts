import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SETTINGS } from '../shared/types'

function read(relPath: string): string {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf8')
}

describe('Desktop frost backdrop', () => {
  it('defaults to full frost and clamps the setting', () => {
    expect(DEFAULT_SETTINGS.frostIntensity).toBe(1)
    const storeSrc = read('electron/store/settings.ts')
    expect(storeSrc).toContain('out.frostIntensity = Math.min(')
  })

  it('captures the desktop with GDI instead of desktopCapturer', () => {
    const src = read('electron/main/backdrop.ts')
    expect(src).toContain('StretchBlt')
    expect(src).toContain('GetDIBits')
    expect(src).toContain('nativeImage.createFromBitmap')
    expect(src).toContain('HALFTONE')
    // desktopCapturer/WGC can return black frames with GPU accel disabled.
    expect(src).not.toMatch(/from 'electron'[\s\S]*desktopCapturer/)
  })

  it('only snapshots while the blade is retracted, and replays it on open', () => {
    const src = read('electron/main/window.ts')
    expect(src).toContain('if (interactive) return')
    expect(src).toContain('scheduleBackdropRefresh(500)')
    expect(src).toContain('pushBackdrop()')
    expect(src).toContain("sendToMainWindow('window:backdrop', cached)")
  })

  it('paints the frost behind blade content and keeps the blade base opaque', () => {
    const css = read('src/styles/panel.css')
    expect(css).toContain('.blade-frost')
    expect(css).toContain('z-index: -1')
    expect(css).toContain('pointer-events: none')
    // Chromium only keeps ClearType on a provably opaque background.
    expect(css).toContain('background-color: #fbfbfd;')
    expect(css).not.toContain('background: var(--blade-bg);')
  })

  it('gates the frost layer on the setting and the snapshot', () => {
    const src = read('src/components/Panel.tsx')
    expect(src).toContain('const frostIntensity = settings.frostIntensity ?? 1')
    expect(src).toContain('if (!backdrop || frostIntensity <= 0 || frostLive || settingsOpen)')
    expect(src).toContain('<div className="blade-frost" style={frostStyle} aria-hidden="true" />')
    expect(src).toContain("'--frost-size'")
    expect(src).toContain("'--frost-pos'")
  })

  it('exposes a frost control in both settings layouts', () => {
    const src = read('src/components/Settings.tsx')
    expect(src).toContain('patch({ frostIntensity: opt.val })')
    expect(src).toContain("t('appearance.frostTitle')")
    expect(src).toContain("{ label: t('appearance.frostOff'), val: 0 }")
  })

  it('offers the live (acrylic) frost mode next to the snapshot mode', () => {
    const settingsSrc = read('src/components/Settings.tsx')
    expect(settingsSrc).toContain("{ label: t('appearance.frostStill'), live: false }")
    expect(settingsSrc).toContain("{ label: t('appearance.frostLive'), live: true }")
    expect(settingsSrc).toContain('{ frostLive: opt.live }')
    const types = read('shared/types.ts')
    expect(types).toContain('frostLive?: boolean')
    expect(DEFAULT_SETTINGS.frostLive).toBe(false)
  })

  it('re-asserts the glass z-order after focus transitions', () => {
    // Making the panel focusable (hotkey recorder, search) and releasing it can
    // leave the panel under the topmost glass overlay, which paints the blur on
    // top of the cards. Every focus transition re-inserts the glass below.
    const win = read('electron/main/window.ts')
    expect(win).toContain('function reassertGlassSoon()')
    expect(win).toContain('reassertGlassSoon()')
    expect(win).toContain("mainWindow.on('blur'")
    expect(read('electron/main/acrylic.ts')).toContain('export function reassertAcrylicOrder')
    expect(read('electron/main/composition.ts')).toContain('reassertOrder(): void')
  })

  it('paints the blade flat and opaque while Settings is open', () => {
    // The clipboard list sits behind the settings view; neither a snapshot of
    // it nor a live-acrylic sample of the previous frame may show through.
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain("settingsOpen ? ' blade-settings' : ''")
    const css = read('src/styles/panel.css')
    expect(css).toContain('.blade.blade-settings {')
    expect(css).toContain('.blade.blade-settings .blade-frost {')
  })
})

