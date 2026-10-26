/**
 * Live frosted glass for the blade ("实时磨砂").
 *
 * CSS cannot blur the desktop, and a *still* snapshot of the desktop (see
 * backdrop.ts) can only be re-taken while the panel is retracted. Real live
 * blur has to come from DWM, which means one extra, deliberately dumb window
 * that sits **directly underneath the panel** and is nothing but a sheet of
 * system acrylic: no page, no content, click-through, never focused.
 *
 * Why a separate window instead of `backgroundMaterial` on the panel itself
 * (measured on Windows 11 26200, Electron 34.5.8, GPU disabled):
 *   - BrowserWindow `backgroundMaterial: 'acrylic' | 'mica'` does not render a
 *     backdrop here at all; it paints a flat solid tint (211/243 grey) that
 *     never follows the content behind the window.
 *   - `SetWindowCompositionAttribute(WCA_ACCENT_POLICY,
 *     ACCENT_ENABLE_ACRYLICBLURBEHIND)` does produce a live blur — and it blurs
 *     the **entire window rectangle**, ignoring the page's own alpha. Measured
 *     on a transparent patch of the page over a sharp checkerboard: std-dev
 *     collapsed from 119 to 0.6. So the acrylic window MUST be exactly the
 *     blade's rect; the panel window (blade + flyout gutters, 800x452) can
 *     never host it. Hence: layer window == blade rect, pinned under the panel.
 *
 * Cost: one extra renderer process (~15-20 MB) for an empty transparent page.
 * That is why the layer is created lazily and torn down the moment the setting
 * is switched off.
 */
import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'
import koffi from 'koffi'
import type { BladeRect } from '../../shared/types'

export type { BladeRect }

const WCA_ACCENT_POLICY = 19
const ACCENT_ENABLE_ACRYLICBLURBEHIND = 4
/** AccentFlags 0 keeps DWM from drawing its own border inside the sheet. */
const ACCENT_FLAGS = 0

const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const SWP_NOZORDER = 0x0004
const SWP_FRAMECHANGED = 0x0020
const SWP_NOOWNERZORDER = 0x0200

const GWL_EXSTYLE = -20
const WS_EX_LAYERED = 0x00080000
const WS_EX_NOACTIVATE = 0x08000000

type Win32 = {
  setComposition: (hwnd: bigint, policy: unknown) => number
  setWindowPos: (
    hwnd: bigint,
    insertAfter: bigint,
    x: number,
    y: number,
    cx: number,
    cy: number,
    flags: number
  ) => boolean
  getWindowLong: (hwnd: bigint, index: number) => number | bigint
  setWindowLong: (hwnd: bigint, index: number, value: number) => number | bigint
}

let win32: Win32 | null = null
let win32Failed = false

function loadWin32(): Win32 | null {
  if (process.platform !== 'win32') return null
  if (win32) return win32
  if (win32Failed) return null
  try {
    const user32 = koffi.load('user32.dll')
    // koffi.struct registers the type globally; the returned descriptor is only
    // needed so the `EdgeDropAccentPolicy *` field can be marshalled.
    koffi.struct('EdgeDropAccentPolicy', {
      AccentState: 'uint32',
      AccentFlags: 'uint32',
      GradientColor: 'uint32',
      AnimationId: 'uint32'
    })
    koffi.struct('EdgeDropWcaData', {
      Attrib: 'uint32',
      pvData: 'EdgeDropAccentPolicy *',
      cbData: 'size_t'
    })
    win32 = {
      // The second parameter must be typed as the struct pointer, otherwise
      // koffi rejects the plain object ("Unexpected Object value, expected void *").
      setComposition: user32.func(
        'int SetWindowCompositionAttribute(uintptr_t hwnd, EdgeDropWcaData *data)'
      ) as Win32['setComposition'],
      setWindowPos: user32.func(
        'bool SetWindowPos(uintptr_t hwnd, uintptr_t insertAfter, int x, int y, int cx, int cy, uint32 flags)'
      ) as Win32['setWindowPos'],
      getWindowLong: user32.func('intptr_t GetWindowLongPtrW(uintptr_t hwnd, int index)') as Win32['getWindowLong'],
      setWindowLong: user32.func(
        'intptr_t SetWindowLongPtrW(uintptr_t hwnd, int index, intptr_t value)'
      ) as Win32['setWindowLong']
    }
    return win32
  } catch (err) {
    win32Failed = true
    console.warn('[Acrylic] Win32 accent APIs unavailable:', err)
    return null
  }
}

function hwndOf(win: BrowserWindow | null): bigint {
  if (!win || win.isDestroyed()) return 0n
  const buf = win.getNativeWindowHandle()
  return process.arch === 'x64' ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
}

/**
 * Gradient colour of the glass, as 0xAABBGGRR. The alpha is how much white the
 * sheet adds on top of the blurred backdrop; the DOM sheet adds the rest.
 */
function glassColor(frostIntensity: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(frostIntensity) ? frostIntensity : 1))
  const alpha = Math.round(0x24 + 0x30 * t) // 0.14 (soft) .. 0.33 (rich)
  return ((alpha << 24) | 0x00faf8f6) >>> 0
}

function applyAccentColor(win: BrowserWindow, frostIntensity: number): boolean {
  const api = loadWin32()
  if (!api) return false
  const hwnd = hwndOf(win)
  if (hwnd === 0n) return false
  try {
    const style = Number(api.getWindowLong(hwnd, GWL_EXSTYLE))
    let next = style | WS_EX_NOACTIVATE
    /*
     * WS_EX_LAYERED must be OFF or DWM silently ignores the accent: a layered
     * window is composited by the window itself and never gets a backdrop
     * material, so the glass layer came out fully see-through (the panel then
     * looked like it had no frost at all). Electron turns the style on because
     * the window is created with a translucent backgroundColor, so it has to be
     * cleared here — the page still composites with alpha, which is what lets
     * the blur show through.
     */
    next &= ~WS_EX_LAYERED
    if (next !== style) {
      api.setWindowLong(hwnd, GWL_EXSTYLE, next)
      api.setWindowPos(
        hwnd,
        0n,
        0,
        0,
        0,
        0,
        SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOOWNERZORDER
      )
    }
    const ok = api.setComposition(hwnd, {
      Attrib: WCA_ACCENT_POLICY,
      pvData: {
        AccentState: ACCENT_ENABLE_ACRYLICBLURBEHIND,
        AccentFlags: ACCENT_FLAGS,
        GradientColor: glassColor(frostIntensity),
        AnimationId: 0
      },
      cbData: 16
    })
    return ok !== 0
  } catch (err) {
    console.warn('[Acrylic] Failed to apply accent policy:', err)
    return false
  }
}

let layer: BrowserWindow | null = null
let layerReady = false
let layerOk = false
let bladeRect: BladeRect | null = null
let panelWindow: BrowserWindow | null = null
let wantVisible = false
let tint = 1

/** The panel window whose client area the reported blade rect is relative to. */
export function setAcrylicPanel(win: BrowserWindow | null): void {
  panelWindow = win
  const layerWin = getAcrylicLayer()
  if (layerWin) positionLayer(layerWin)
}

/** True when a live acrylic layer can exist on this machine. */
export function isAcrylicAvailable(): boolean {
  return loadWin32() !== null
}

export function getAcrylicLayer(): BrowserWindow | null {
  return layer && !layer.isDestroyed() ? layer : null
}

/**
 * Create the glass layer (idempotent). The window is not shown until
 * `showAcrylicLayer` and only ever becomes visible if DWM accepted the accent —
 * a failed accent would leave a solid black rectangle, so it stays hidden.
 */
export async function ensureAcrylicLayer(parent: BrowserWindow | null): Promise<BrowserWindow | null> {
  if (!isAcrylicAvailable()) return null
  if (layer && !layer.isDestroyed()) {
    if (parent) panelWindow = parent
    return layer
  }
  if (parent) panelWindow = parent
  const bounds = parent && !parent.isDestroyed() ? parent.getBounds() : { x: 0, y: 0, width: 8, height: 8 }
  layer = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: Math.max(8, Math.round(bladeRect?.width ?? bounds.width)),
    height: Math.max(8, Math.round(bladeRect?.height ?? bounds.height)),
    show: false,
    frame: false,
    // DWM only applies a backdrop material to a non-layered window.
    transparent: false,
    backgroundColor: '#00000000',
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    acceptFirstMouse: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  })
  layer.setIgnoreMouseEvents(true, { forward: false })
  layer.setAlwaysOnTop(true, 'screen-saver')
  layer.on('closed', () => {
    layer = null
    layerReady = false
  })
  layerReady = false
  layerOk = false
  const created = layer
  const pageUrl = join(app.getAppPath(), 'resources', 'acrylic.html')
  // A tiny local page, not a data: URL: Chromium refuses top-level data:
  // navigation here (ERR_FAILED). Retry once — the very first navigation in a
  // freshly started app occasionally aborts with ERR_FAILED as well.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await created.loadFile(pageUrl)
      break
    } catch (err) {
      const last = attempt === 3
      console.warn(`[Acrylic] Layer page load attempt ${attempt} failed:`, err)
      if (last || created.isDestroyed() || layer !== created) return null
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  if (layer !== created || created.isDestroyed()) return null
  layerOk = applyAccentColor(created, tint)
  if (!layerOk) console.warn('[Acrylic] DWM rejected the accent policy — falling back to the snapshot frost')
  layerReady = true
  if (wantVisible && layerOk) showAcrylicLayer(parent)
  return created
}

/** Update the white tint without recreating the window. */
export function setAcrylicTint(frostIntensity: number): void {
  tint = frostIntensity
  const win = getAcrylicLayer()
  if (!win || !layerReady) return
  layerOk = applyAccentColor(win, tint)
  if (!layerOk) hideAcrylicLayer()
}

/**
 * Renderer-side blade rect (CSS px inside the panel window). The absolute
 * screen position is recomputed every time the panel moves, so display
 * changes and the preview-widening resize stay in sync for free.
 */
export function setAcrylicBladeRect(rect: BladeRect | null): void {
  bladeRect = rect
  const win = getAcrylicLayer()
  if (win) positionLayer(win)
}

/**
 * Place the layer exactly over the blade.
 *
 * The blade can land on a half device pixel (its CSS left is 30 at 125% => 37.5
 * physical px), and Electron round-trips DIP <-> physical on every setBounds.
 * Rounding the *whole* rect to device pixels first and converting back once
 * keeps this idempotent; comparing raw DIP values instead made the layer grow a
 * pixel on every open.
 */
function positionLayer(win: BrowserWindow): void {
  if (!bladeRect) return
  const panel = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null
  const origin = panel ? panel.getBounds() : { x: 0, y: 0 }
  const scale = panel ? screen.getDisplayMatching(panel.getBounds()).scaleFactor : 1
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  const physLeft = Math.round((origin.x + bladeRect.left) * s)
  const physTop = Math.round((origin.y + bladeRect.top) * s)
  const physWidth = Math.max(8, Math.round(bladeRect.width * s))
  const physHeight = Math.max(8, Math.round(bladeRect.height * s))
  const target = {
    x: physLeft / s,
    y: physTop / s,
    width: physWidth / s,
    height: physHeight / s
  }
  const current = win.getBounds()
  if (
    current.x !== Math.round(target.x) ||
    current.y !== Math.round(target.y) ||
    current.width !== Math.round(target.width) ||
    current.height !== Math.round(target.height)
  ) {
    win.setBounds(target)
  }
}

/** Re-pin the glass directly under the panel window (z-order, then size). */
export function showAcrylicLayer(parent: BrowserWindow | null): void {
  wantVisible = true
  const win = getAcrylicLayer()
  if (!win || !layerReady || !layerOk) return
  if (!bladeRect) return
  positionLayer(win)
  win.setAlwaysOnTop(true, 'screen-saver')
  const api = loadWin32()
  const parentHwnd = hwndOf(parent)
  if (api && parentHwnd !== 0n) {
    // Insert the glass directly *below* the panel: the sheet blends over it.
    api.setWindowPos(
      hwndOf(win),
      parentHwnd,
      0,
      0,
      0,
      0,
      SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER
    )
  }
  if (!win.isVisible()) win.showInactive()
}

export function hideAcrylicLayer(): void {
  wantVisible = false
  const win = getAcrylicLayer()
  if (win && win.isVisible()) win.hide()
}

/** Reposition after the panel window moved / resized (display change, preview). */
export function refreshAcrylicPosition(): void {
  const win = getAcrylicLayer()
  if (!win) return
  positionLayer(win)
  if (wantVisible && layerOk) win.setAlwaysOnTop(true, 'screen-saver')
}

/** Tear the layer down (setting switched off, or app quitting). */
export function destroyAcrylicLayer(): void {
  wantVisible = false
  const win = getAcrylicLayer()
  layer = null
  layerReady = false
  layerOk = false
  if (win) {
    try {
      win.destroy()
    } catch {
      /* already gone */
    }
  }
}

/** True once the layer exists AND DWM accepted the accent. */
export function isAcrylicLayerLive(): boolean {
  return !!getAcrylicLayer() && layerOk
}




