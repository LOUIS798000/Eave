/**
 * Renderer liveness watchdog (diagnostic runs only).
 *
 * The hover beat lives entirely in this process: a `setTimeout` dwell, then a
 * `requestAnimationFrame` that commits the open, then CSS transitions driven
 * by the compositor. If Chromium throttles or freezes the page — which it does
 * when it believes the window is hidden or occluded — those timers stretch to
 * seconds (or stop), so the panel silently "ignores" a hover that the main
 * process dutifully reported.
 *
 * This hook proves or disproves that from the inside: it records visibility,
 * achieved animation frames per second and the drift of a 1s timer. A drift of
 * hundreds of ms, or a frame rate of zero, is the fingerprint of a throttled
 * or occluded window. Silent in every normal run (`?diag=1` absent).
 */
import { useEffect } from 'react'
import { useStore } from '../store/appStore'
import { diagOn, dlog } from '../lib/diag'

const HB_MS = 1000

export function useRendererWatchdog(): void {
  useEffect(() => {
    if (!diagOn) return

    let frames = 0
    let rafId = 0
    const countFrame = (): void => {
      frames++
      rafId = requestAnimationFrame(countFrame)
    }
    rafId = requestAnimationFrame(countFrame)

    let lastAt = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const drift = now - lastAt - HB_MS
      lastAt = now
      const s = useStore.getState()
      dlog(
        `hb vis=${document.visibilityState} raf=${frames} drift=${Math.round(drift)}ms ` +
          `open=${s.open ? 1 : 0} settings=${s.settingsOpen ? 1 : 0} preview=${s.previewItemId ? 1 : 0} ` +
          `drag=${s.dragActive ? 1 : 0} transition=${s.edgeTransition?.active ? 1 : 0}`
      )
      frames = 0
    }, HB_MS)

    const onVisibility = (): void => {
      dlog(`visibility ${document.visibilityState}`)
    }
    const onFocus = (): void => dlog('window focus')
    const onBlur = (): void => dlog('window blur')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
