/**
 * Idle working-set trimming.
 *
 * Chromium keeps a large private working set resident even after the panel has
 * been closed for minutes (renderer heaps, compositor surfaces, decoded image
 * caches, SwiftShader). Windows would eventually trim those pages under memory
 * pressure, but on a desktop with plenty of RAM it leaves them resident
 * indefinitely.
 *
 * `EmptyWorkingSet` asks the OS to move the process's unused pages to standby
 * instead of keeping them in physical RAM. It does not change committed memory
 * and Windows pages them back on demand, so this is only run after the panel
 * has been closed for a while. The main process is trimmed last: trimming the
 * children can fault some shared bookkeeping back into the browser process,
 * and a final pass on the browser keeps the whole app's working set low.
 *
 * If the user immediately re-opens the panel, the pages fault back in; that is
 * the deliberate trade-off for a much lower idle footprint. Set
 * EDGE_DROP_MEMORY_TRIM_MS=0 to disable the idle timer (handy for profiling).
 */
import { app } from 'electron'
import koffi from 'koffi'

type OpenProcessFn = (access: number, inherit: boolean, pid: number) => number
type EmptyWorkingSetFn = (handle: number) => boolean
type CloseHandleFn = (handle: number) => boolean

let openProcess: OpenProcessFn | null = null
let emptyWorkingSet: EmptyWorkingSetFn | null = null
let closeHandle: CloseHandleFn | null = null
let apiUnavailable = false

const PROCESS_SET_QUOTA = 0x0100
const PROCESS_QUERY_INFORMATION = 0x0400

function loadApi(): boolean {
  if (process.platform !== 'win32') return false
  if (openProcess && emptyWorkingSet && closeHandle) return true
  if (apiUnavailable) return false
  try {
    const kernel32 = koffi.load('kernel32.dll')
    const psapi = koffi.load('psapi.dll')
    openProcess = kernel32.func(
      'uintptr_t OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
    ) as unknown as OpenProcessFn
    emptyWorkingSet = psapi.func(
      'bool EmptyWorkingSet(uintptr_t hProcess)'
    ) as unknown as EmptyWorkingSetFn
    closeHandle = kernel32.func(
      'bool CloseHandle(uintptr_t hObject)'
    ) as unknown as CloseHandleFn
    return true
  } catch (err) {
    apiUnavailable = true
    console.warn('[Memory] Working-set trim unavailable:', err)
    return false
  }
}

/**
 * Trim the private working set of every Chromium child process.
 * Returns the number of processes trimmed. Safe to call when unavailable.
 */
export function trimWorkingSets(): number {
  if (!loadApi()) return 0
  let trimmed = 0
  try {
    // Children first, browser process last (see the module comment).
    const metrics = app.getAppMetrics().filter((m) => m.pid)
    metrics.sort((a, b) => Number(a.pid === process.pid) - Number(b.pid === process.pid))
    for (const metric of metrics) {
      const pid = metric.pid
      const handle = Number(openProcess!(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, false, pid))
      if (!handle) continue
      try {
        if (emptyWorkingSet!(handle)) trimmed++
      } finally {
        closeHandle!(handle)
      }
    }
  } catch (err) {
    console.warn('[Memory] Working-set trim failed:', err)
  }
  return trimmed
}
