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

  it('writes the visual offset as a Vector3 and names the clip class right', () => {
    // put_Offset takes a Vector3, not the Vector2 used for Size. Handing it the
    // short struct corrupts the stack: the whole app dies with 0xC0000005 the
    // first time a rect is laid out (measured, not guessed).
    const glass = read('electron/main/composition.ts')
    expect(glass).toContain("koffi.struct('EaveV3'")
    expect(glass).toContain('putV3')
    expect(glass).toMatch(/method\(visual, 15, api\(\)\.proto\.putV3, \{ x, y, z: 0 \}\)/)
    // CreateRectangleClip returns Windows.UI.Composition.RectangleClip. The
    // "Composition…" prefix belongs to the WinUI namespace, and verifying
    // against it made every create() throw (i.e. quietly no live glass at all).
    expect(glass).toContain("verify(box.value, 'Windows.UI.Composition.RectangleClip')")
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

  it('knows the exact shape the blade is painting, every frame', () => {
    // The glass is no longer drawn on the blade's *box* — a rectangle behind a
    // rounded shape that is still growing is precisely what poked corners out
    // and showed a sheet before the panel. It is drawn on `blade box ∩
    // clip-path`, which the renderer measures per frame.
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('visibleGlassShape')
    expect(panel).toContain('parseClipShape')
    expect(panel).toContain('getComputedStyle(container).clipPath')
    // Chrome keeps calc() in the computed clip-path and interpolates it as
    // `calc(<pct>% - <px>px)`. Reading "the px" out of that yields NaN for the
    // whole animation, and a plain whitespace split shreds it into three
    // tokens, so both have to be handled explicitly.
    expect(panel).toContain('function evalLength')
    expect(panel).toContain('function splitTopLevel')
    expect(panel).toContain('function insetBody')
    // A corner is rounded only when the intersection really has a rounded
    // corner there (the blade's, or the clip's) — never gratuitously.
    expect(panel).toContain('const corner = (')
    expect(panel).toContain('SHAPE_EPS')

    // Reported from the same commit that flips the clip-path, so main has the
    // shape before the first frame of the animation is composited.
    expect(panel).toContain('useLayoutEffect')
    expect(panel).toContain('requestAnimationFrame(measure)')

    // The shape carries its own corner radii; the default corners are only the
    // fallback for a caller that has no shape to report.
    const types = read('shared/types.ts')
    expect(types).toContain('export interface BladeRadii')
    expect(types).toMatch(/radii\?: BladeRadii/)
    expect(read('electron/main/acrylic.ts')).toContain('rect.radii')
  })

  it('shows the glass on the first shape report, then releases the sheet', () => {
    // Sequence: the renderer reports the shape it is about to paint → main
    // draws the glass on that shape → main says "it is on screen" → the blade
    // goes translucent. Nothing is ever painted that the blade has not reached.
    const adapter = read('electron/main/acrylic.ts')
    expect(adapter).toContain('export function armAcrylicLayer')
    expect(adapter).toMatch(/if \(wantVisible && layer\.isReady\(\) && !layer\.isVisible\(\)\) layer\.raise\(true\)/)
    const windowSrc = read('electron/main/window.ts')
    expect(windowSrc).toContain('armAcrylicLayer(mainWindow)')

    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('onFrostLive')
    // `open &&` is load-bearing: on close the sheet must go opaque in the same
    // frame the retraction starts, not one round-trip later.
    expect(panel).toMatch(/open && liveGlassOn \? ' blade-live-shown'/)
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
    // A crossfade would stack both whites mid-way and flash; the hand-over is
    // one frame on purpose.
    expect(shownBlock).not.toContain('transition:')

    // The settled shape is still confirmed from a real transitionend.
    expect(panel).toContain('reportPanelExpanded')
    expect(panel).toContain("e.propertyName !== 'clip-path'")
    expect(read('shared/ipc.ts')).toContain("'window:panel-expanded'")
    expect(read('electron/main/ipc.ts')).toContain("on('window:panel-expanded'")
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



