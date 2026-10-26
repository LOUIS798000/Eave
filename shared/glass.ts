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

/**
 * Alpha (0..1) of the blade's own sheet over the live glass.
 *
 * The DWM acrylic this replaced added its own white veil (`liveAccentAlpha`)
 * *inside* the glass; the composition layer only blurs, so that white now has to
 * come from this sheet. The two used to be composited on screen, so folding them
 * together with 1-(1-a)(1-b) keeps the same final whiteness (0.548 at t = 0.5)
 * instead of making the panel visibly clearer than the look that was signed off.
 */
export function liveSheetAlpha(frostIntensity: number): number {
  const t = clampFrostIntensity(frostIntensity)
  const sheet = 0.54 - 0.24 * t
  const accent = 0.26 - 0.08 * t
  return Math.round((1 - (1 - sheet) * (1 - accent)) * 1000) / 1000
}

/** Alpha (0..1) of the white veil the acrylic accent adds over the blur. */
export function liveAccentAlpha(frostIntensity: number): number {
  const t = clampFrostIntensity(frostIntensity)
  return Math.round((0.26 - 0.08 * t) * 1000) / 1000
}

/**
 * White tint for the *frozen* frost (`--frost-tint` on `.blade-frost`) that
 * stands in for the live glass while the panel is growing.
 *
 * The acrylic layer can only be raised once the blade covers its whole
 * rectangle, so for the ~285 ms of the open animation the blade has to paint
 * something itself. A flat white sheet reads as a white flash followed by glass;
 * a snapshot of the same desktop with a matching tint reads as glass from the
 * first frame, and the hand-over is invisible.
 *
 * Calibrated against measurement rather than theory: DWM's acrylic lightens its
 * backdrop more than `liveSheetAlpha + liveAccentAlpha` suggests (measured over
 * a solid red window at 1536x864 / 125%: live 0.5 -> G 194, live 1.0 -> G 180,
 * frozen 0.548 -> G 181, frozen 0.77 -> G 214), hence the higher numbers here.
 */
export function livePhotoTint(frostIntensity: number): number {
  const t = clampFrostIntensity(frostIntensity)
  return Math.round((0.71 - 0.17 * t) * 1000) / 1000
}

