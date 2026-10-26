/**
 * Opt-in diagnostic timeline (`EAVE_DIAG=<file>`).
 *
 * The defects this exists for are invisible to unit tests: "the shelf
 * sometimes ignores my hover after I come back from a fullscreen app" and
 * "the panel flashes while I drag a file onto it" depend on the live
 * interplay between the cursor poll, the renderer's dwell/close timers, the
 * OS drag translator, z-order and the fullscreen suppressor. Reading that
 * back needs one shared, ordered trace of both processes.
 *
 * Costs nothing when the env var is absent: every entry point is a single
 * string check. Writes are appended synchronously (a trace that can be lost
 * on the exact crash/jank being measured is worthless) and never throw.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const target = process.env.EAVE_DIAG || ''

/** True when the trace file is enabled for this process. */
export const diagEnabled = target.length > 0

let prepared = false

function prepare(): void {
  if (prepared) return
  prepared = true
  try {
    mkdirSync(dirname(target), { recursive: true })
    // Fresh run, fresh trace: a stale file from a previous launch would
    // interleave two timelines that look identical.
    writeFileSync(target, '')
  } catch {
    /* ignore — no trace is better than a crash */
  }
}

let writeFailed = false

/**
 * Append one line: `HH:MM:SS.mmm <tag> <message>`.
 *
 * `tag` groups the origin so a trace can be read as parallel lanes:
 * `poll` (cursor poll decisions), `main` (window/lifecycle), `renderer`
 * (console output forwarded from the webContents), `win` (native window
 * events), `stall`/`slow` (main-thread blocks), `beat` (main-thread liveness).
 */
export function diag(tag: string, message: string): void {
  if (!diagEnabled) return
  if (!prepared) prepare()
  const t = new Date()
  const p2 = (n: number): string => String(n).padStart(2, '0')
  const p3 = (n: number): string => String(n).padStart(3, '0')
  const stamp = `${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}.${p3(t.getMilliseconds())}`
  try {
    appendFileSync(target, `${stamp} ${tag.padEnd(8)} ${message}\n`)
  } catch (err) {
    // Never swallow a broken trace silently: an empty-looking timeline is
    // otherwise indistinguishable from a stalled process.
    if (!writeFailed) {
      writeFailed = true
      console.error('[diag] trace write failed:', err)
    }
  }
}

/**
 * Watch the main thread for stalls (diagnostic runs only).
 *
 * A 200ms interval that should always be on time: any gap well above that
 * means the single main thread was blocked, which delays the cursor poll and
 * therefore the whole open path. Nothing else in the trace can distinguish
 * "the user did not hover" from "the hover was processed two seconds late".
 * A `beat` every 2s also separates "main is blocked" from "the poll stopped".
 */
export function installStallWatch(): void {
  if (!diagEnabled) return
  let last = Date.now()
  let lastBeat = Date.now()
  const timer = setInterval(() => {
    const now = Date.now()
    const gap = now - last
    last = now
    if (gap > 450) diag('stall', `main thread blocked ${gap}ms`)
    if (now - lastBeat >= 2000) {
      lastBeat = now
      diag('beat', 'alive')
    }
  }, 200)
  timer.unref?.()
}
