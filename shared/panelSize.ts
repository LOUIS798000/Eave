/**
 * Panel size math shared by the main process and the renderer.
 *
 * Eave's shelf has two very different shapes:
 *   - left/right: a tall blade whose width is fixed and whose height is a
 *     fraction of the work area;
 *   - top: a wide horizontal dock whose width fills the screen and whose
 *     height is a fixed 210px.
 *
 * Users can now override either shape with explicit pixel sizes. This module
 * owns the clamps so the window geometry, the CSS box and the settings UI can
 * never disagree about what "width 800" means.
 */

import type { Settings } from './types'

/** Width of the left/right blade (the depth of the shelf). */
export const PANEL_WIDTH_DEFAULT = 270
export const PANEL_WIDTH_MIN = 240
export const PANEL_WIDTH_MAX = 560

/** Height of the left/right blade. 200px keeps a compact one-card window usable. */
export const PANEL_HEIGHT_MIN = 200

/** Width of the top dock (horizontal shelf). */
export const TOP_WIDTH_DEFAULT_MAX = 1080
export const TOP_WIDTH_MIN = 740
export const TOP_WIDTH_MAX = 1080

/** Height of the top dock. 210px is the height the horizontal card layout was designed for. */
export const TOP_HEIGHT_DEFAULT = 210
/** 120px is the lowest the header + one slim card row stays readable. */
export const TOP_HEIGHT_MIN = 120
/**
 * Native top-window height reserve below the dock. The visible blade uses the
 * user's height (settings included); this reserve keeps the extra transparent
 * window tall enough for the language/beacon flyouts and onboarding.
 */
export const TOP_SETTINGS_MIN = 180
/** The horizontal dock is a single card row; beyond 280px it is just empty glass. */
export const TOP_HEIGHT_MAX = 280

/**
 * Compact top cards keep the 210x120 proportion rather than stretching into
 * letterboxed strips as the dock gets shorter. The classic 210px card caps the
 * width, so a 146px-tall card is still 210px wide.
 */
export const TOP_CARD_ASPECT = 1.75
export const TOP_CARD_WIDTH_MAX = 210

/**
 * Transparent horizontal gutter reserved around the blade so its soft shadow
 * and the 24px corner arcs are never clipped by the native window.
 */
export const PANEL_WINDOW_GUTTER = 114
/**
 * Extra width a left/right window needs while a flyout is open. The flyout is
 * 440px wide and sits 12px outside the blade, plus shadow room.
 */
export const PANEL_PREVIEW_GUTTER = 550

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Resolve the left/right blade width in pixels. */
export function resolvePanelWidth(settings: Pick<Settings, 'panelWidth'>): number {
  const raw = finite(settings.panelWidth, PANEL_WIDTH_DEFAULT)
  return Math.round(clampNumber(raw, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX))
}

/**
 * Resolve the left/right blade height in pixels.
 *
 * `panelHeightPx` is the explicit user size; 0/undefined keeps the legacy
 * fraction-of-screen behaviour so existing installs don't jump on upgrade.
 */
export function resolvePanelHeight(
  settings: Pick<Settings, 'panelHeight' | 'panelHeightPx'>,
  viewportHeight: number
): number {
  const viewport = Math.max(1, Math.round(finite(viewportHeight, 900)))
  const auto = viewport * clampNumber(finite(settings.panelHeight, 0.6), 0.2, 1)
  const explicit = finite(settings.panelHeightPx, 0)
  const raw = explicit > 0 ? explicit : auto
  const max = Math.max(PANEL_HEIGHT_MIN, viewport - 24)
  return Math.round(clampNumber(raw, PANEL_HEIGHT_MIN, max))
}

/**
 * Resolve the top dock width for a display.
 *
 * `availableWidth` is the widest the blade may become (work area width minus
 * the two 30px flare gutters). 0/undefined keeps the original full-width dock.
 */
export function resolveTopPanelWidth(
  settings: Pick<Settings, 'topPanelWidth'>,
  availableWidth: number
): number {
  const available = Math.max(200, Math.round(finite(availableWidth, TOP_WIDTH_MAX)))
  const min = Math.min(TOP_WIDTH_MIN, available)
  const max = Math.min(TOP_WIDTH_MAX, available)
  const raw = finite(settings.topPanelWidth, 0)
  const requested = raw > 0 ? raw : max
  return Math.round(clampNumber(requested, min, max))
}

/** Resolve the top dock height in pixels. 0/undefined keeps the 210px default. */
export function resolveTopPanelHeight(
  settings: Pick<Settings, 'topPanelHeightPx'>
): number {
  const raw = finite(settings.topPanelHeightPx, 0)
  const requested = raw > 0 ? raw : TOP_HEIGHT_DEFAULT
  return Math.round(clampNumber(requested, TOP_HEIGHT_MIN, TOP_HEIGHT_MAX))
}

/** Resolve the compact horizontal card width from its height. */
export function resolveTopCardWidth(cardHeight: number): number {
  const height = Math.max(1, Math.round(finite(cardHeight, 0)))
  return Math.min(TOP_CARD_WIDTH_MAX, Math.round(height * TOP_CARD_ASPECT))
}

/** Native window width for a left/right blade (blade + shadow/flyout gutter). */
export function resolveStickWindowWidth(panelWidth: number, previewActive: boolean): number {
  const width = resolvePanelWidth({ panelWidth })
  return width + (previewActive ? PANEL_PREVIEW_GUTTER : PANEL_WINDOW_GUTTER)
}

/** How far a left/right flyout column extends from the screen edge. */
export function resolvePreviewColumnWidth(panelWidth: number): number {
  return resolvePanelWidth({ panelWidth }) + 470
}
