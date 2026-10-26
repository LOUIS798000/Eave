/**
 * Live frosted glass for the blade ("实时磨砂").
 *
 * The drawing itself lives in composition.ts — a Windows.UI.Composition sprite
 * whose brush is a Gaussian blur of whatever is behind the window, clipped to a
 * rounded rectangle. This module is only the adapter that gives the rest of the
 * app the old acrylic-layer API (`showAcrylicLayer`, `setAcrylicBladeRect`, …)
 * so window.ts and ipc.ts keep their sequencing:
 *
 *   open ──▶ armAcrylicLayer() ──▶ first shape report ──▶ glass on screen
 *                                   └─ listener(true)  ──▶ blade goes translucent
 *   close starts ──▶ hideAcrylicLayer() ──▶ listener(false) ──▶ blade opaque
 *
 * History, because it explains the shape of this code: this used to be a second
 * Electron window with DWM's acrylic accent. That blur fills the whole window
 * rectangle and cannot be shaped (SetWindowRgn, DWMWCP_ROUND and
 * DWM_BB_BLURREGION were all accepted and all ignored), so a square sheet always
 * poked out of the 24 px rounded blade and the accent painted its own hairline
 * on top. Windows.UI.Composition blurs a rectangle we own and clip ourselves, so
 * both defects disappear instead of being hidden.
 */
import { BrowserWindow, screen } from 'electron'
import type { BladeRect } from '../../shared/types'
import { CornerRadii, GlassLayer, GlassRect, ZERO_RADII } from './composition'

export type { BladeRect }

/** The blade's corner radius, in CSS pixels (see `.blade` in panel.css). */
const BLADE_RADIUS = 24

let layer: GlassLayer | null = null
let panelWindow: BrowserWindow | null = null
let bladeRect: BladeRect | null = null
let wantVisible = false
let visibilityListener: ((visible: boolean) => void) | null = null

/** Forwarded to the renderer so the blade's own sheet can follow the glass. */
export function setAcrylicVisibilityListener(cb: (visible: boolean) => void): void {
  visibilityListener = cb
  layer?.setVisibilityListener(cb)
}

export function isAcrylicLayerVisible(): boolean {
  return layer?.isVisible() ?? false
}

/** The panel window the reported blade rect is relative to. */
export function setAcrylicPanel(win: BrowserWindow | null): void {
  panelWindow = win
  layer?.moveToPanel()
}

/** True when a live layer can exist on this machine. */
export function isAcrylicAvailable(): boolean {
  return process.platform === 'win32'
}

/**
 * Create the layer (idempotent). Resolves with the panel window when the glass
 * is ready, or null when composition is unavailable — the caller then simply
 * keeps painting the frozen snapshot.
 */
export async function ensureAcrylicLayer(
  parent: BrowserWindow | null
): Promise<BrowserWindow | null> {
  if (!isAcrylicAvailable()) return null
  if (parent) panelWindow = parent
  if (!layer) {
    const created = new GlassLayer()
    created.setVisibilityListener((visible) => visibilityListener?.(visible))
    layer = created
  }
  const live = layer.create(panelWindow)
  if (!live) {
    layer.destroy()
    layer = null
    return null
  }
  layer.setRect(bladeRect ? toGlassRect(bladeRect) : null)
  layer.setRadii(bladeRect?.radii ? clampRadii(bladeRect.radii) : radiiFor(panelWindow))
  if (wantVisible) showAcrylicLayer(panelWindow)
  return panelWindow
}

/** Blur strength / tint changes. The white sheet itself is CSS. */
export function setAcrylicTint(frostIntensity: number): void {
  // More "毛玻璃强度" = more desktop showing through, which reads as a slightly
  // tighter blur. Keep it inside a range that stays legible over text.
  const t = Math.max(0, Math.min(1, Number.isFinite(frostIntensity) ? frostIntensity : 1))
  layer?.setBlur(14 + 16 * (1 - t))
}

/** Renderer's visible shape, in CSS px inside the panel window. */
export function setAcrylicBladeRect(rect: BladeRect | null): void {
  bladeRect = rect
  if (!layer) return
  if (!rect) {
    layer.setRect(null)
    return
  }
  layer.setRect(toGlassRect(rect))
  layer.setRadii(rect.radii ? clampRadii(rect.radii) : radiiFor(panelWindow))
  // The renderer reports the shape it is *about* to paint, and only it knows
  // that shape — so the first report after an open request is also what puts
  // the glass on screen. Showing it any earlier (on the open request itself)
  // would paint a full-size rectangle the blade has not grown over yet.
  if (wantVisible && layer.isReady() && !layer.isVisible()) layer.raise(true)
}

/** Keep radii sane: a clip radius past half the shape is meaningless. */
function clampRadii(radii: CornerRadii): CornerRadii {
  return {
    topLeft: Math.max(0, radii.topLeft),
    topRight: Math.max(0, radii.topRight),
    bottomRight: Math.max(0, radii.bottomRight),
    bottomLeft: Math.max(0, radii.bottomLeft)
  }
}

/** Arm the glass for this open: it appears with the renderer's first report. */
export function armAcrylicLayer(parent: BrowserWindow | null): void {
  if (parent) panelWindow = parent
  wantVisible = true
}

function toGlassRect(rect: BladeRect): GlassRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/**
 * The blade rounds only the corners facing away from the screen edge (the ones
 * on the edge are square, because the panel is flush with it).
 */
function radiiFor(panel: BrowserWindow | null): CornerRadii {
  if (!panel || panel.isDestroyed()) return ZERO_RADII
  const bounds = panel.getBounds()
  const area = screen.getDisplayMatching(bounds).workArea
  const onTop = bounds.y <= area.y + 1
  const onBottom = bounds.y + bounds.height >= area.y + area.height - 1
  const onLeft = bounds.x <= area.x + 1
  const onRight = bounds.x + bounds.width >= area.x + area.width - 1
  if (onTop && !onBottom) {
    return { topLeft: 0, topRight: 0, bottomRight: BLADE_RADIUS, bottomLeft: BLADE_RADIUS }
  }
  if (onBottom && !onTop) {
    return { topLeft: BLADE_RADIUS, topRight: BLADE_RADIUS, bottomRight: 0, bottomLeft: 0 }
  }
  if (onLeft && !onRight) {
    return { topLeft: 0, topRight: BLADE_RADIUS, bottomRight: BLADE_RADIUS, bottomLeft: 0 }
  }
  if (onRight && !onLeft) {
    return { topLeft: BLADE_RADIUS, topRight: 0, bottomRight: 0, bottomLeft: BLADE_RADIUS }
  }
  return {
    topLeft: BLADE_RADIUS,
    topRight: BLADE_RADIUS,
    bottomRight: BLADE_RADIUS,
    bottomLeft: BLADE_RADIUS
  }
}

/** Raise the glass directly under the panel and start painting it. */
export function showAcrylicLayer(parent: BrowserWindow | null): boolean {
  wantVisible = true
  if (!layer) return false
  if (parent) panelWindow = parent
  if (!layer.isReady()) return false
  if (!bladeRect) return false
  layer.moveToPanel()
  layer.setRect(toGlassRect(bladeRect))
  layer.setRadii(bladeRect.radii ? clampRadii(bladeRect.radii) : radiiFor(panelWindow))
  layer.raise(true)
  return layer.isVisible()
}

export function hideAcrylicLayer(): void {
  wantVisible = false
  layer?.setVisible(false)
}

/** Reposition after the panel window moved / resized (display change, preview). */
export function refreshAcrylicPosition(): void {
  if (!layer) return
  layer.moveToPanel()
  layer.setRadii(bladeRect?.radii ? clampRadii(bladeRect.radii) : radiiFor(panelWindow))
  if (wantVisible) layer.raise(true)
}

/** Tear the layer down (setting switched off, or app quitting). */
export function destroyAcrylicLayer(): void {
  wantVisible = false
  layer?.destroy()
  layer = null
}

/** True once the layer exists and its compositor accepted the visual tree. */
export function isAcrylicLayerLive(): boolean {
  return !!layer && layer.isReady()
}
