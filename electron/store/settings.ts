/**
 * Settings persistence.
 *
 * Settings are small (a single flat object) so a plain JSON file is plenty.
 * The store guards against partial/corrupt files by deep-merging onto the
 * defaults so a bad field never takes the whole app down.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { DEFAULT_SETTINGS, normalizeHoverOpenDelay, type Settings } from '../../shared/types'
import {
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  TOP_HEIGHT_MAX,
  TOP_HEIGHT_MIN,
  TOP_WIDTH_MAX,
  TOP_WIDTH_MIN,
  clampNumber
} from '../../shared/panelSize'
import { PATHS } from './paths'

let cache: Settings | null = null

function merge(base: Settings, patch: Partial<Settings>): Settings {
  const out = { ...base, ...patch } as Settings
  // Clamp the numeric slider into its valid range.
  out.hotZoneHeight = Math.min(0.6, Math.max(0.2, out.hotZoneHeight))
  out.historyLimit = Math.min(2000, Math.max(50, Math.round(out.historyLimit)))
  out.autoDeleteHours = Math.max(0, Number(out.autoDeleteHours) || 0)
  out.verticalOffset = Math.min(1.0, Math.max(0.0, typeof out.verticalOffset === 'number' ? out.verticalOffset : 0.5))
  out.hoverOpenDelay = normalizeHoverOpenDelay(out.hoverOpenDelay)
  if (out.uiStyle !== 'modern' && out.uiStyle !== 'compact') {
    out.uiStyle = 'modern'
  }
  if (out.stickPosition !== 'left' && out.stickPosition !== 'right' && out.stickPosition !== 'top') {
    out.stickPosition = 'left'
  }
  if (out.triggerAlignment !== 'top' && out.triggerAlignment !== 'center' && out.triggerAlignment !== 'bottom' && out.triggerAlignment !== 'left' && out.triggerAlignment !== 'right') {
    out.triggerAlignment = 'center'
  }
  if (typeof out.horizontalOffset !== 'number' || Number.isNaN(out.horizontalOffset)) {
    out.horizontalOffset = 0.5
  }
  out.horizontalOffset = Math.min(1.0, Math.max(0.0, out.horizontalOffset))
  out.frostIntensity = Math.min(
    1,
    Math.max(0, typeof out.frostIntensity === 'number' && Number.isFinite(out.frostIntensity) ? out.frostIntensity : 1)
  )
  // Panel size: width is always an explicit pixel value; heights keep 0 as
  // "auto" so upgraders retain the old fraction/default behaviour.
  out.panelWidth = Math.round(
    clampNumber(
      typeof out.panelWidth === 'number' && Number.isFinite(out.panelWidth) ? out.panelWidth : PANEL_WIDTH_DEFAULT,
      PANEL_WIDTH_MIN,
      PANEL_WIDTH_MAX
    )
  )
  out.panelHeightPx = Math.round(
    clampNumber(
      typeof out.panelHeightPx === 'number' && Number.isFinite(out.panelHeightPx) ? out.panelHeightPx : 0,
      0,
      10000
    )
  )
  out.topPanelWidth = Math.round(
    clampNumber(
      typeof out.topPanelWidth === 'number' && Number.isFinite(out.topPanelWidth) ? out.topPanelWidth : 0,
      0,
      TOP_WIDTH_MAX
    )
  )
  out.topPanelHeightPx = Math.round(
    clampNumber(
      typeof out.topPanelHeightPx === 'number' && Number.isFinite(out.topPanelHeightPx) ? out.topPanelHeightPx : 0,
      0,
      TOP_HEIGHT_MAX
    )
  )
  // A tiny explicit top width would collapse the horizontal header. Only
  // clamp values that are actually set; 0 stays "auto" (full-width dock).
  if (out.topPanelWidth > 0 && out.topPanelWidth < TOP_WIDTH_MIN) out.topPanelWidth = TOP_WIDTH_MIN
  if (out.topPanelHeightPx > 0 && out.topPanelHeightPx < TOP_HEIGHT_MIN) out.topPanelHeightPx = TOP_HEIGHT_MIN
  if (typeof out.language !== 'string' || !out.language.trim()) {
    out.language = 'system'
  }
  // Drop the long-removed bounceAnimation key so old files stop carrying it.
  delete (out as unknown as Record<string, unknown>).bounceAnimation
  return out
}

export function getSettings(): Settings {
  return loadSettings()
}

export function loadSettings(): Settings {
  if (cache) return cache
  let file: Partial<Settings> = {}
  try {
    if (existsSync(PATHS.settingsFile())) {
      file = JSON.parse(readFileSync(PATHS.settingsFile(), 'utf8')) as Partial<Settings>
    }
  } catch {
    file = {}
  }
  cache = merge({ ...DEFAULT_SETTINGS }, file)
  return cache
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = merge(loadSettings(), patch)
  cache = next
  try {
    writeFileSync(PATHS.settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    /* non-fatal; settings stay in memory */
  }
  return next
}

export function resetSettingsCache(): void {
  cache = null
}
