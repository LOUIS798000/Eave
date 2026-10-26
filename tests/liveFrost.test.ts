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
    expect(panel).toContain("frostLive ? 'blade blade-live' : 'blade'")
  })

  it('makes the blade see-through only in live mode', () => {
    const css = read('src/styles/panel.css')
    expect(css).toContain('.blade.blade-live')
    const liveBlock = css.slice(css.indexOf('.blade.blade-live'))
    expect(liveBlock).toContain('rgba(251, 251, 253, 0.42)')
    // The opaque base must survive for the snapshot (ClearType) path.
    expect(css).toContain('background-color: #fbfbfd;')
  })

  it('ships a transparent page for the glass layer', () => {
    const html = read('resources/acrylic.html')
    expect(html).toContain('background: transparent')
    // Only a local file works: Chromium blocks top-level data: navigation.
    expect(acrylic()).toContain("'resources', 'acrylic.html'")
  })
})

