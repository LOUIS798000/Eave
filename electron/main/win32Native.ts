/**
 * Native Win32 clipboard, input, and foreground-process helpers via koffi.
 *
 * Replaces the always-resident PowerShell (.NET WinForms) child process for
 * the hot paths (`Ctrl+V` paste simulation and `CF_HDROP` file-drop writes),
 * saving ~30–60 MB of background RAM and eliminating inter-process latency.
 * Also provides foreground process name lookup for the privacy exclusion list.
 */
import koffi from 'koffi'
import { basename } from 'node:path'

const INPUT_KEYBOARD = 1
const KEYEVENTF_KEYUP = 0x0002
const VK_CONTROL = 0x11
const VK_LSHIFT = 0xA0
const VK_RSHIFT = 0xA1
const VK_LMENU = 0xA4
const VK_RMENU = 0xA5
const VK_V = 0x56

const CF_HDROP = 15
const GMEM_MOVEABLE = 0x0002
const GMEM_ZEROINIT = 0x0040
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

interface NativeApi {
  sendInput: (cInputs: number, pInputs: Buffer, cbSize: number) => number
  openClipboard: (hWnd: number) => boolean
  emptyClipboard: () => boolean
  setClipboardData: (uFormat: number, hMem: unknown) => unknown
  closeClipboard: () => boolean
  globalAlloc: (uFlags: number, dwBytes: number) => unknown
  globalLock: (hMem: unknown) => unknown
  globalUnlock: (hMem: unknown) => boolean
  globalFree: (hMem: unknown) => unknown
  rtlMoveMemory: (dest: unknown, src: Buffer, length: number) => void
  getForegroundWindow: () => number
  getWindowThreadProcessId: (hWnd: number, lpdwProcessId: Buffer) => number
  openProcess: (dwDesiredAccess: number, bInheritHandle: boolean, dwProcessId: number) => number
  queryFullProcessImageNameW: (hProcess: number, dwFlags: number, lpExeName: Buffer, lpdwSize: Buffer) => boolean
  closeHandle: (hObject: number) => boolean
}

let api: NativeApi | null = null
let loadAttempted = false

function loadNativeApi(): NativeApi | null {
  if (process.platform !== 'win32') return null
  if (loadAttempted) return api
  loadAttempted = true
  try {
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')
    api = {
      sendInput: user32.func('uint32 SendInput(uint32 cInputs, uint8_t *pInputs, int cbSize)'),
      openClipboard: user32.func('bool OpenClipboard(uintptr_t hWndNewOwner)'),
      emptyClipboard: user32.func('bool EmptyClipboard()'),
      setClipboardData: user32.func('void *SetClipboardData(uint32 uFormat, void *hMem)'),
      closeClipboard: user32.func('bool CloseClipboard()'),
      globalAlloc: kernel32.func('void *GlobalAlloc(uint32 uFlags, size_t dwBytes)'),
      globalLock: kernel32.func('void *GlobalLock(void *hMem)'),
      globalUnlock: kernel32.func('bool GlobalUnlock(void *hMem)'),
      globalFree: kernel32.func('void *GlobalFree(void *hMem)'),
      rtlMoveMemory: kernel32.func('void RtlMoveMemory(void *Destination, const uint8_t *Source, size_t Length)'),
      getForegroundWindow: user32.func('uintptr_t GetForegroundWindow()'),
      getWindowThreadProcessId: user32.func('uint32 GetWindowThreadProcessId(uintptr_t hWnd, uint8_t *lpdwProcessId)'),
      openProcess: kernel32.func('uintptr_t OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'),
      queryFullProcessImageNameW: kernel32.func(
        'bool QueryFullProcessImageNameW(uintptr_t hProcess, uint32 dwFlags, uint8_t *lpExeName, uint8_t *lpdwSize)'
      ),
      closeHandle: kernel32.func('bool CloseHandle(uintptr_t hObject)')
    }
    return api
  } catch (err) {
    console.warn('[win32Native] Failed to load Win32 APIs:', err)
    api = null
    return null
  }
}

/**
 * Build an 8-event INPUT buffer for Ctrl+V:
 * first releases any physically held Shift/Alt modifiers (e.g. from Shift+Enter,
 * Alt+1, or Alt+V triggers) so the target app never sees Ctrl+Shift+V / Ctrl+Alt+V,
 * then sends Ctrl down -> V down -> V up -> Ctrl up.
 * Exported for unit testing the exact Win32 ABI byte layout.
 */
export function buildCtrlVInputBuffer(is64Bit = process.arch === 'x64' || process.arch === 'arm64'): {
  buffer: Buffer
  stride: number
  count: number
} {
  // sizeof(INPUT): 40 bytes on 64-bit Windows (4-byte type + 4-byte align pad + 32-byte union),
  // 28 bytes on 32-bit Windows (4-byte type + 24-byte union).
  const stride = is64Bit ? 40 : 28
  const kiOffset = is64Bit ? 8 : 4
  const events: Array<{ vk: number; flags: number }> = [
    { vk: VK_LSHIFT, flags: KEYEVENTF_KEYUP },
    { vk: VK_RSHIFT, flags: KEYEVENTF_KEYUP },
    { vk: VK_LMENU, flags: KEYEVENTF_KEYUP },
    { vk: VK_RMENU, flags: KEYEVENTF_KEYUP },
    { vk: VK_CONTROL, flags: 0 },
    { vk: VK_V, flags: 0 },
    { vk: VK_V, flags: KEYEVENTF_KEYUP },
    { vk: VK_CONTROL, flags: KEYEVENTF_KEYUP }
  ]
  const buffer = Buffer.alloc(stride * events.length)
  events.forEach((ev, idx) => {
    const base = idx * stride
    buffer.writeUInt32LE(INPUT_KEYBOARD, base)
    buffer.writeUInt16LE(ev.vk, base + kiOffset)
    buffer.writeUInt16LE(0, base + kiOffset + 2) // wScan
    buffer.writeUInt32LE(ev.flags, base + kiOffset + 4)
  })
  return { buffer, stride, count: events.length }
}

/**
 * Build a Win32 DROPFILES (CF_HDROP) memory payload for UTF-16LE file paths.
 * Exported for unit testing.
 */
export function buildDropFilesBuffer(paths: string[]): Buffer {
  const headerSize = 20
  const body = Buffer.from(`${paths.join('\0')}\0\0`, 'utf16le')
  const buf = Buffer.alloc(headerSize + body.length)
  buf.writeUInt32LE(headerSize, 0) // pFiles
  buf.writeInt32LE(0, 4) // pt.x
  buf.writeInt32LE(0, 8) // pt.y
  buf.writeUInt32LE(0, 12) // fNC
  buf.writeUInt32LE(1, 16) // fWide = TRUE (UTF-16LE)
  body.copy(buf, headerSize)
  return buf
}

/**
 * Simulate Ctrl+V natively using Win32 SendInput. Returns true on success.
 */
export function sendCtrlVNative(): boolean {
  const native = loadNativeApi()
  if (!native) return false
  try {
    const { buffer, stride, count } = buildCtrlVInputBuffer()
    const sent = native.sendInput(count, buffer, stride)
    return sent === count
  } catch (err) {
    console.warn('[win32Native] SendInput Ctrl+V failed:', err)
    return false
  }
}

/**
 * Write real file references (CF_HDROP) onto the Windows clipboard natively.
 * Returns true on success; callers may fall back to PowerShell on failure.
 */
export async function writeFileDropListNative(paths: string[]): Promise<boolean> {
  if (!paths || paths.length === 0) return false
  const native = loadNativeApi()
  if (!native) return false

  const payload = buildDropFilesBuffer(paths)
  const hMem = native.globalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, payload.length)
  if (!hMem) return false

  const ptr = native.globalLock(hMem)
  if (!ptr) {
    try { native.globalFree(hMem) } catch { /* ignore */ }
    return false
  }
  try {
    native.rtlMoveMemory(ptr, payload, payload.length)
  } finally {
    native.globalUnlock(hMem)
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if (native.openClipboard(0)) {
      let ownedByOs = false
      try {
        native.emptyClipboard()
        const res = native.setClipboardData(CF_HDROP, hMem)
        ownedByOs = Boolean(res)
        return ownedByOs
      } catch {
        return false
      } finally {
        try { native.closeClipboard() } catch { /* ignore */ }
        if (!ownedByOs) {
          try { native.globalFree(hMem) } catch { /* ignore */ }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  try { native.globalFree(hMem) } catch { /* ignore */ }
  return false
}

/**
 * Return the executable filename (e.g. "KeePass.exe") of the current Windows
 * foreground window, or null if unavailable.
 */
export function getForegroundProcessName(): string | null {
  const native = loadNativeApi()
  if (!native) return null
  try {
    const hwnd = Number(native.getForegroundWindow())
    if (!hwnd) return null
    const pidBuf = Buffer.alloc(4)
    native.getWindowThreadProcessId(hwnd, pidBuf)
    const pid = pidBuf.readUInt32LE(0)
    if (!pid) return null
    const hProc = Number(native.openProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid))
    if (!hProc) return null
    try {
      const maxChars = 1024
      const nameBuf = Buffer.alloc(maxChars * 2)
      const sizeBuf = Buffer.alloc(4)
      sizeBuf.writeUInt32LE(maxChars, 0)
      const ok = native.queryFullProcessImageNameW(hProc, 0, nameBuf, sizeBuf)
      if (!ok) return null
      const len = sizeBuf.readUInt32LE(0)
      if (!len) return null
      const fullPath = nameBuf.toString('utf16le', 0, len * 2)
      return basename(fullPath) || null
    } finally {
      try { native.closeHandle(hProc) } catch { /* ignore */ }
    }
  } catch {
    return null
  }
}

/**
 * Check whether a foreground process name matches any entry in the user's
 * excluded-apps list (case-insensitive; supports with or without `.exe`).
 */
export function isAppExcluded(processName: string | null, excludedApps?: string[]): boolean {
  if (!processName || !excludedApps || excludedApps.length === 0) return false
  const norm = (s: string) => s.trim().toLowerCase().replace(/\.exe$/i, '')
  const current = norm(processName)
  if (!current) return false
  return excludedApps.some((entry) => norm(entry) === current)
}
