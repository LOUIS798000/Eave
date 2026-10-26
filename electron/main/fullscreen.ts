/**
 * Fullscreen Game & Presentation Detection Module.
 *
 * Detects when a Direct3D fullscreen game, full-screen video, or presentation
 * is active in the foreground using Windows API `SHQueryUserNotificationState`.
 *
 * Power optimisation: instead of spawning a new powershell.exe process every
 * second (each cold-start costs ~60–100ms of CPU + disk I/O for CLR/DLL load),
 * we call the Win32 function directly via koffi (already a project dependency).
 * koffi keeps shell32.dll loaded in-process; the call itself takes <1µs.
 *
 * WHY THE STATE CODE ALONE IS NOT ENOUGH
 * --------------------------------------
 * The cursor poll stops sending anything while this module says "fullscreen",
 * and the panel is force-closed. A false positive is therefore not a cosmetic
 * glitch: every hover is ignored and an open panel is closed again ~800ms
 * later, which reads as "it flashes and then refuses to open".
 *
 * `QUNS_BUSY` (2) is the ambiguous value: Windows also reports it for the
 * desktop/shell having focus and for other "do not disturb me" situations, not
 * only for fullscreen windows. The desktop-shell allow-list below catches the
 * common ones, but it cannot cover every shell class or a foreground window
 * that is momentarily unknown (GetForegroundWindow() == 0 while an app is
 * closing — exactly what happens right after leaving a fullscreen app).
 *
 * So state 2 is only honoured when the foreground window *is* a fullscreen
 * window: it covers ≥95% of the display it sits on AND is not a normal framed
 * window (a maximized application keeps its caption and resize border, a
 * fullscreen video/game/slideshow does not). States 3 (D3D exclusive
 * fullscreen) and 4 (presentation mode) are unambiguous and stay as they are.
 */
import koffi from 'koffi'
import { screen } from 'electron'

// Windows QUERY_USER_NOTIFICATION_STATE enum values:
// 1 = QUNS_NOT_PRESENT        (screen saver / locked)
// 2 = QUNS_BUSY               (fullscreen app / presentation mode / desktop shell focus)
// 3 = QUNS_RUNNING_D3D_FULL_SCREEN (D3D fullscreen game)
// 4 = QUNS_PRESENTATION_MODE  (PowerPoint / Keynote presentation)
// 5 = QUNS_ACCEPTS_NOTIFICATIONS (normal desktop)
// 6 = QUNS_QUIET_TIME         (first-logon quiet time)
// 7 = QUNS_APP                (Windows Store app)
const QUNS_BUSY = 2
const QUNS_RUNNING_D3D_FULL_SCREEN = 3
const QUNS_PRESENTATION_MODE = 4

// Windows Desktop & Shell window classes that report QUNS_BUSY (2) when focused
const DESKTOP_SHELL_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'ImmersiveLauncher',
  'MultitaskingViewFrame',
  // The "no foreground window" placeholder some shell versions use.
  'no_active_wnd'
])

// Window style bits: a normal application window keeps these while maximized;
// a fullscreen video/game/slideshow window does not.
const WS_CAPTION = 0x00c00000
const WS_THICKFRAME = 0x00040000

/** Fraction of a display a window must cover to count as fullscreen. */
const FULLSCREEN_COVERAGE = 0.95

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

type ShQueryFn = (pquns: [number]) => number
type GetForegroundWindowFn = () => number
type GetClassNameFn = (hwnd: number, buf: Buffer, maxCount: number) => number
type GetWindowRectFn = (hwnd: number, out: Rect) => boolean
type GetWindowLongFn = (hwnd: number, index: number) => number

if (process.platform === 'win32') {
  // Registered once, before any prototype mentions it. LONG fields, 4-byte
  // aligned: identical layout to Win32 RECT.
  koffi.struct('EDGE_FS_RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
}

let shQueryFn: ShQueryFn | null = null
let getForegroundWindowFn: GetForegroundWindowFn | null = null
let getClassNameFn: GetClassNameFn | null = null
let getWindowRectFn: GetWindowRectFn | null = null
let getWindowLongFn: GetWindowLongFn | null = null

if (process.platform === 'win32') {
  try {
    const shell32 = koffi.load('shell32.dll')
    shQueryFn = shell32.func('int SHQueryUserNotificationState(_Out_ int *pquns)') as ShQueryFn
    console.log('[Fullscreen] Loaded SHQueryUserNotificationState via koffi')
  } catch (err) {
    console.error('[Fullscreen] koffi shell32 load failed — fullscreen detection disabled:', err)
  }

  try {
    const user32 = koffi.load('user32.dll')
    getForegroundWindowFn = user32.func('uintptr_t GetForegroundWindow()') as GetForegroundWindowFn
    getClassNameFn = user32.func('int GetClassNameA(uintptr_t hWnd, _Out_ char *lpClassName, int nMaxCount)') as GetClassNameFn
    getWindowRectFn = user32.func(
      'bool GetWindowRect(uintptr_t hWnd, _Out_ EDGE_FS_RECT *rc)'
    ) as GetWindowRectFn
    getWindowLongFn = user32.func('int GetWindowLongW(uintptr_t hWnd, int nIndex)') as GetWindowLongFn
  } catch (err) {
    console.error('[Fullscreen] koffi user32 load failed:', err)
  }
}

let isFullscreenActiveCache = false
let checkTimer: ReturnType<typeof setInterval> | null = null
let onFullscreenDetectedFn: (() => void) | null = null

export function registerFullscreenActiveListener(fn: () => void): void {
  onFullscreenDetectedFn = fn
}

/** Window class of the current foreground window ('' when unreadable). */
function foregroundClassName(): string {
  if (!getForegroundWindowFn || !getClassNameFn) return ''
  try {
    const hwnd = getForegroundWindowFn()
    if (!hwnd) return ''
    const buf = Buffer.alloc(256)
    const len = getClassNameFn(hwnd, buf, 256)
    if (len <= 0) return ''
    return buf.toString('utf8', 0, len).trim()
  } catch {
    return ''
  }
}

/** Check if the current foreground window belongs to the Windows Desktop or Shell. */
function isDesktopForeground(): boolean {
  return DESKTOP_SHELL_CLASSES.has(foregroundClassName())
}

/**
 * Does the foreground window really cover the display it sits on?
 *
 * Combined with the "no caption / no resize border" test this distinguishes a
 * fullscreen app (video, game, slideshow) from a maximized window, which is the
 * whole point of not trusting QUNS_BUSY on its own.
 */
function isForegroundFullscreenWindow(): boolean {
  if (!getForegroundWindowFn || !getWindowRectFn || !getWindowLongFn) return false
  try {
    const hwnd = getForegroundWindowFn()
    if (!hwnd) return false
    const rect: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
    if (!getWindowRectFn(hwnd, rect)) return false

    const width = rect.right - rect.left
    const height = rect.bottom - rect.top
    if (width <= 0 || height <= 0) return false

    const style = getWindowLongFn(hwnd, -16) // GWL_STYLE
    const looksLikeAppWindow = (style & WS_CAPTION) !== 0 && (style & WS_THICKFRAME) !== 0
    if (looksLikeAppWindow) return false

    // Compare in physical pixels: window rects are physical, display bounds are DIP.
    let bestCoverage = 0
    for (const display of screen.getAllDisplays()) {
      const scale = display.scaleFactor || 1
      const dl = display.bounds.x * scale
      const dt = display.bounds.y * scale
      const dr = (display.bounds.x + display.bounds.width) * scale
      const db = (display.bounds.y + display.bounds.height) * scale
      const overlapW = Math.max(0, Math.min(rect.right, dr) - Math.max(rect.left, dl))
      const overlapH = Math.max(0, Math.min(rect.bottom, db) - Math.max(rect.top, dt))
      const displayArea = (dr - dl) * (db - dt)
      if (displayArea <= 0) continue
      bestCoverage = Math.max(bestCoverage, (overlapW * overlapH) / displayArea)
    }
    return bestCoverage >= FULLSCREEN_COVERAGE
  } catch {
    return false
  }
}

/**
 * Synchronously query the notification state via the loaded koffi function.
 * Returns the QUERY_USER_NOTIFICATION_STATE integer, or -1 on any error.
 */
function queryNotificationState(): number {
  if (!shQueryFn) return -1
  try {
    const out: [number] = [0]
    const hr = shQueryFn(out)
    // hr === 0 means S_OK
    return hr === 0 ? out[0] : -1
  } catch {
    return -1
  }
}

export function isFullscreenAppActive(): boolean {
  return isFullscreenActiveCache
}

/**
 * Diagnostic snapshot of the live inputs to the suppression decision.
 *
 * `suppress` is the cached verdict the cursor poll actually consumes;
 * `state` is the raw value re-queried right now (so a stale cache shows up as
 * suppress=true with state≠2/3/4); `foreground` is the window class that
 * decides whether QUNS_BUSY counts as a real fullscreen app.
 */
export function fullscreenDiagnostics(): {
  suppress: boolean
  state: number
  fg: string
  fullscreenWindow: boolean
} {
  return {
    suppress: isFullscreenActiveCache,
    state: queryNotificationState(),
    fg: foregroundClassName(),
    fullscreenWindow: isForegroundFullscreenWindow()
  }
}

export function triggerFullscreenCheck(): void {
  if (process.platform !== 'win32') return
  const state = queryNotificationState()
  if (state < 0) return // koffi unavailable or call failed

  let isNowFullscreen = false
  if (state === QUNS_RUNNING_D3D_FULL_SCREEN || state === QUNS_PRESENTATION_MODE) {
    isNowFullscreen = true
  } else if (state === QUNS_BUSY) {
    // Ambiguous: fullscreen app, presentation settings, or shell focus.
    isNowFullscreen = !isDesktopForeground() && isForegroundFullscreenWindow()
  }

  const becameFullscreen = isNowFullscreen && !isFullscreenActiveCache
  isFullscreenActiveCache = isNowFullscreen
  // Rising edge only: this fires every check while a game stays fullscreen
  // (every 800ms), and the listener force-closes the panel.
  if (becameFullscreen) {
    onFullscreenDetectedFn?.()
  }
}

/**
 * Re-evaluate right now and return the fresh verdict.
 *
 * Called by the cursor poll before it lets a cached `true` silence the edge
 * detector: a stale flag must cost at most one tick, never a whole session.
 */
export function recheckFullscreenNow(): boolean {
  triggerFullscreenCheck()
  return isFullscreenActiveCache
}

/**
 * Start the periodic fullscreen monitor.
 *
 * 800 ms — fast enough that leaving a game restores the shelf within a frame or
 * two of the user noticing, and negligible on battery (one <1µs native call).
 */
const FULLSCREEN_CHECK_INTERVAL_MS = 800

export function startFullscreenMonitor(): void {
  if (process.platform !== 'win32') return
  if (checkTimer !== null) return

  triggerFullscreenCheck() // seed cache immediately
  checkTimer = setInterval(triggerFullscreenCheck, FULLSCREEN_CHECK_INTERVAL_MS)
}

export function stopFullscreenMonitor(): void {
  if (checkTimer !== null) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  isFullscreenActiveCache = false
}
