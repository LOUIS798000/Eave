/**
 * Renderer half of the diagnostic trace (`EAVE_DIAG` builds only).
 *
 * Main loads the page with `?diag=1` when tracing is enabled, so the
 * sandboxed renderer needs neither a bridge extension nor process.env to know
 * about it. Every line goes through `console.log`, which the main process
 * forwards into the same timeline as the cursor poll (see
 * electron/main/window.ts -> console-message).
 *
 * Costs nothing in a normal build: `diagOn` is false and `dlog` exits on the
 * first byte.
 */
const enabled = (() => {
  try {
    return typeof location !== 'undefined' && /(?:^|[?&])diag=1(?:&|$)/.test(location.search)
  } catch {
    return false
  }
})()

/** True when this renderer load is a diagnostic run. */
export const diagOn: boolean = enabled

/** Append one line to the shared timeline. No-op unless `diagOn`. */
export function dlog(message: string): void {
  if (!enabled) return
  console.log(`[Diag] ${message}`)
}
