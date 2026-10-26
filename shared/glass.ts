/**
 * Live-glass opacity mapping, shared by main and the renderer.
 *
 * In live mode the blade is a stack of two whites:
 *   1. the DWM acrylic sheet `alpha = liveAccentAlpha()` (the veil the system
 *      blur adds on top of the blurred desktop), and
 *   2. the blade's own sheet `alpha = liveSheetAlpha()` painted over it.
 * `frostIntensity` ("毛玻璃强度": 柔和 / 浓郁) drives **both in the same
 * direction** — otherwise the two washes cancel out and the setting does
 * nothing visible: 0 = least desktop showing, 1 = most.
 *
 * The values are pinned so that the middle step (0.5) reproduces the look that
 * was signed off before the control became real: sheet 0.42 + accent 0.22.
 *
 * Note the two ends are deliberately not symmetric: the strong end is where the
 * user asked for "less white", so it gets the wider travel.
 */

export function clampFrostIntensity(frostIntensity: number): number {
  const t = Number.isFinite(frostIntensity) ? frostIntensity : 1
  return Math.max(0, Math.min(1, t))
}

/** Alpha (0..1) of the blade's own sheet over the acrylic layer. */
export function liveSheetAlpha(frostIntensity: number): number {
  const t = clampFrostIntensity(frostIntensity)
  return Math.round((0.54 - 0.24 * t) * 1000) / 1000
}

/** Alpha (0..1) of the white veil the acrylic accent adds over the blur. */
export function liveAccentAlpha(frostIntensity: number): number {
  const t = clampFrostIntensity(frostIntensity)
  return Math.round((0.26 - 0.08 * t) * 1000) / 1000
}
