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

  it('blurs the desktop with a composed effect graph, not DWM accent', () => {
    const glass = read('electron/main/composition.ts')
    // DWM's acrylic fills the whole window rectangle and cannot be shaped, so
    // the frost is a real effect graph we own and clip ourselves.
    expect(glass).toContain('CreateBackdropBrush')
    expect(glass).toContain('IGraphicsEffectD2D1Interop')
    expect(glass).toContain('CLSID_D2D1_GAUSSIAN_BLUR')
    expect(glass).toContain('CreateEffectFactory')
    // The accent policy is gone for good -- it was the source of both the
    // square corners and the dark hairline.
    expect(acrylic()).not.toContain('SetWindowCompositionAttribute')
    expect(acrylic()).not.toContain('ACCENT_ENABLE_ACRYLICBLURBEHIND')
  })

  it('shapes the glass with a rounded clip, not a window region', () => {
    const glass = read('electron/main/composition.ts')
    expect(glass).toContain('CreateRectangleClip')
    expect(glass).toContain('IRectangleClip')
    // RectangleClip is absolute, not inset: getting that wrong clips the whole
    // visual away (learned the hard way).
    expect(glass).toContain('Right/Bottom must be the size')
    expect(read('electron/main/acrylic.ts')).toContain('BLADE_RADIUS')
  })

  it('never steals focus from the user\'s app', () => {
    const glass = read('electron/main/composition.ts')
    expect(glass).toContain('WS_EX_NOACTIVATE')
    expect(glass).toContain('SWP_NOACTIVATE')
  })

  it('tracks the blade rect and stays pinned under the panel', () => {
    const glass = read('electron/main/composition.ts')
    const adapter = acrylic()
    expect(adapter).toContain('bladeRect')
    expect(adapter).toContain('setRect')
    // Pinned under the panel without ever resizing the panel itself.
    expect(glass).toContain('SetWindowPos')
    expect(glass).toContain('SWP_NOSIZE')
    expect(adapter).toMatch(/panelWindow/)
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

  it('keeps the frozen frost up until main confirms the blur is on screen', () => {
    // The whole point: the acrylic layer is a *rectangle*. If the blade turns
    // translucent before the rounded shape has grown over that rectangle, the
    // rectangle is what the user sees first; if it goes flat white instead, the
    // user sees a white flash first. So the blade paints the frozen frost (a
    // snapshot tinted to match the glass) for the whole growth, and the
    // translucency is gated on a main -> renderer event.
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('onFrostLive')
    expect(panel).toMatch(/liveGlassOn \? ' blade-live-shown'/)
    expect(panel).toContain('if (!frostLive) setLiveGlassOn(false)')
    expect(panel).toContain('livePhotoTint(frostIntensity)')

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
    // A crossfade would stack both whites mid-way and flash; the hand-over is
    // one frame on purpose.
    expect(shownBlock).not.toContain('transition:')

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

  it('drops the glass the moment the panel starts retracting', () => {
    // Not when `setInteractive(false)` arrives 300 ms later: by then the blade
    // has shrunk away from a full-size sheet, which reads as two layers.
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('window.edge.reportPanelCollapsed()')
    expect(read('shared/ipc.ts')).toContain("'window:panel-collapsed'")
    expect(read('electron/main/ipc.ts')).toContain("on('window:panel-collapsed'")
    const windowSrc = read('electron/main/window.ts')
    expect(windowSrc).toContain('export function onPanelCollapsed()')
    expect(windowSrc).toContain('hideAcrylicLayer()')
    // The snapshot is still taken in live mode: it is the material the blade
    // paints while it grows.
    const refresh = windowSrc.slice(windowSrc.indexOf('function refreshBackdrop'))
    expect(refresh.slice(0, 900)).not.toContain('settings.frostLive ?? false')
  })

  it('lets the same strength setting move the whole glass stack', () => {
    // Both whites must move the same way, otherwise the setting silently
    // cancels itself out and "透明度" does nothing.
    const soft = 0.5
    // 0.42 sheet + 0.22 acrylic veil, composited into one sheet (the composition
    // layer only blurs, so the white has to come from here).
    expect(liveSheetAlpha(soft)).toBeCloseTo(0.548, 2)
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
    // The glass itself is a composed blur now, so its white veil is gone; the
    // layer is drawn by composition.ts instead of DWM's accent policy.
    expect(read('electron/main/composition.ts')).toContain('createBlurBrush')
    expect(read('src/components/Panel.tsx')).toContain('liveSheetAlpha(frostIntensity)')
  })

  it('owns its own window instead of hosting a page', () => {
    // The layer is a raw composition window: no renderer, no page, no extra
    // Chromium process (the old acrylic layer needed all three).
    const glass = read('electron/main/composition.ts')
    expect(glass).toContain('CreateWindowExW')
    expect(glass).toContain('CreateDesktopWindowTarget')
    expect(glass).not.toContain('acrylic.html')
    expect(acrylic()).not.toContain('acrylic.html')
  })
})



