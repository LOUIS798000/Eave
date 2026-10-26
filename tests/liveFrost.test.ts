/**
 * Live ("实时磨砂") acrylic frost.
 *
 * These assertions pin down the platform behaviour that was measured the hard
 * way on Windows 11 26200 / Electron 34.5.8 (see electron/main/acrylic.ts for
 * the numbers). They are source-level on purpose: every one of them maps to a
 * failure mode that looks like "the frost quietly disappeared", which no unit
 * test can observe through the DOM.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SETTINGS } from '../shared/types'
import { liveAccentAlpha, liveSheetAlpha } from '../shared/glass'

function read(relPath: string): string {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf8')
}

describe('Live acrylic frost', () => {
  const acrylic = () => read('electron/main/acrylic.ts')

  it('is opt-in and off by default', () => {
    expect(DEFAULT_SETTINGS.frostLive).toBe(false)
  })

  it('uses the legacy accent policy, not backgroundMaterial', () => {
    const src = acrylic()
    // Measured: BrowserWindow `backgroundMaterial: 'acrylic'|'mica'` paints a
    // flat solid tint on this build and never follows the content behind.
    expect(src).toContain('SetWindowCompositionAttribute')
    expect(src).toContain('ACCENT_ENABLE_ACRYLICBLURBEHIND')
    expect(src).toContain('WCA_ACCENT_POLICY')
    // (The doc comment explains why; the code must not pass the option.)
    expect(src).not.toMatch(/^\s*backgroundMaterial\s*:/m)
  })

  it('clears WS_EX_LAYERED before applying the accent', () => {
    const src = acrylic()
    // A layered window never gets a backdrop material: without this the layer
    // is simply see-through and the panel looks un-frosted.
    expect(src).toContain('WS_EX_LAYERED')
    expect(src).toContain('next &= ~WS_EX_LAYERED')
  })

  it('never steals focus from the user\'s app', () => {
    const src = acrylic()
    expect(src).toContain('WS_EX_NOACTIVATE')
    expect(src).toContain('SWP_NOACTIVATE')
  })

  it('sizes the glass to the blade and pins it directly under the panel', () => {
    const src = acrylic()
    // The accent blurs the whole window rectangle, so the layer must be exactly
    // the blade; anything bigger frosts the desktop around the dock.
    expect(src).toContain('bladeRect')
    expect(src).toContain('SetWindowPos')
    expect(src).toContain('SWP_NOSIZE')
    // Idempotent device-pixel rounding, otherwise the layer creeped wider.
    expect(src).toContain('physWidth')
    expect(src).toMatch(/panelWindow/)
  })

  it('is created lazily and torn down when the setting is off', () => {
    const windowSrc = read('electron/main/window.ts')
    expect(windowSrc).toContain('export function applyFrostMode()')
    expect(windowSrc).toContain('destroyAcrylicLayer()')
    expect(windowSrc).toContain('ensureAcrylicLayer(mainWindow)')
    // Snapshot capture is pointless (and wasteful) in live mode.
    expect(windowSrc).toContain('(settings.frostLive ?? false)')
    // Hidden whenever the panel is not on screen.
    expect(windowSrc).toContain('hideAcrylicLayer()')
    expect(windowSrc).toContain('refreshAcrylicPosition()')
  })

  it('is toggled from settings and reported the blade rect by the renderer', () => {
    expect(read('electron/main/ipc.ts')).toContain('applyFrostMode()')
    expect(read('electron/main/ipc.ts')).toContain("on('window:blade-rect'")
    expect(read('shared/ipc.ts')).toContain("'window:blade-rect'")
    expect(read('shared/bridge.ts')).toContain('reportBladeRect')
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('window.edge.reportBladeRect')
    expect(panel).toContain('blade blade-live')
    expect(panel).toContain('blade-live-shown')
  })

  it('keeps the sheet opaque until main confirms the blur is on screen', () => {
    // The whole point: the acrylic layer is a *rectangle*. If the blade turns
    // translucent before the rounded shape has grown over that rectangle, the
    // rectangle is what the user sees first — the exact two-step flash that was
    // reported. So the translucency is gated on a main -> renderer event.
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('onFrostLive')
    expect(panel).toMatch(/liveGlassOn \? ' blade-live-shown'/)
    expect(panel).toContain('if (!frostLive) setLiveGlassOn(false)')

    const css = read('src/styles/panel.css')
    const liveIdx = css.indexOf('.blade.blade-live {')
    expect(liveIdx).toBeGreaterThan(-1)
    const liveBlock = css.slice(liveIdx, css.indexOf('}', liveIdx))
    // Plain `.blade-live` must stay opaque: no rgba here.
    expect(liveBlock).toContain('background-color: #fbfbfd;')
    expect(liveBlock).not.toContain('rgba(')
    const shownIdx = css.indexOf('.blade.blade-live.blade-live-shown {')
    expect(shownIdx).toBeGreaterThan(liveIdx)
    const shownBlock = css.slice(shownIdx, css.indexOf('}', shownIdx))
    expect(shownBlock).toContain('rgba(251, 251, 253, var(--live-sheet, 0.42))')
    expect(shownBlock).toContain('transition: background-color')

    // And the glass is only raised once the open clip-path has settled, which
    // the renderer reports from a real transitionend — not a guessed timeout.
    expect(panel).toContain('reportPanelExpanded')
    expect(panel).toContain("e.propertyName !== 'clip-path'")
    expect(read('shared/ipc.ts')).toContain("'window:panel-expanded'")
    expect(read('electron/main/ipc.ts')).toContain("on('window:panel-expanded'")
    const windowSrc = read('electron/main/window.ts')
    expect(windowSrc).toContain('setAcrylicVisibilityListener')
    expect(windowSrc).toContain("'window:frost-live'")
  })

  it('lets the same strength setting move the whole glass stack', () => {
    // Both whites must move the same way, otherwise the setting silently
    // cancels itself out and "透明度" does nothing.
    const soft = 0.5
    expect(liveSheetAlpha(soft)).toBeCloseTo(0.42, 2)
    expect(liveSheetAlpha(1)).toBeLessThan(liveSheetAlpha(soft))
    expect(liveSheetAlpha(0)).toBeGreaterThan(liveSheetAlpha(soft))
    expect(liveAccentAlpha(1)).toBeLessThan(liveAccentAlpha(soft))
    expect(liveAccentAlpha(0)).toBeGreaterThan(liveAccentAlpha(soft))
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(liveSheetAlpha(t)).toBeGreaterThan(0)
      expect(liveSheetAlpha(t)).toBeLessThan(1)
      expect(liveAccentAlpha(t)).toBeGreaterThan(0)
      expect(liveAccentAlpha(t)).toBeLessThan(1)
    }
    // The accent colour main hands to DWM is derived from that same mapping.
    expect(read('electron/main/acrylic.ts')).toContain('liveAccentAlpha(frostIntensity)')
    expect(read('src/components/Panel.tsx')).toContain('liveSheetAlpha(frostIntensity)')
  })

  it('ships a transparent page for the glass layer', () => {
    const html = read('resources/acrylic.html')
    expect(html).toContain('background: transparent')
    // Only a local file works: Chromium blocks top-level data: navigation.
    expect(acrylic()).toContain("'resources', 'acrylic.html'")
  })
})

