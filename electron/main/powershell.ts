import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isStoreBuild } from './config'

export function getSystemPowerShellPath(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  return `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
}

/** Writable cwd so packaged (WindowsApps) launches don't inherit a read-only working directory. */
export function getWritableCwd(): string {
  for (const candidate of [process.env.TEMP, process.env.TMP, process.env.USERPROFILE]) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return 'C:\\Windows\\Temp'
}

interface QueueEntry {
  command: string
  resolve: () => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** Auto-reclaim the helper process after 60s of inactivity to keep RAM minimal. */
const IDLE_RECLAIM_MS = 60_000

class PersistentPowerShell {
  private proc: ChildProcess | null = null
  private queue: QueueEntry[] = []
  private running = false
  private disposed = false
  private outputBuffer = ''
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private powershellPath: string

  constructor() {
    this.powershellPath = getSystemPowerShellPath()
    // Intentionally lazy: do NOT spawn powershell.exe at app boot.
    // Hot paths (Ctrl+V and CF_HDROP) run natively via koffi in win32Native.ts,
    // so PowerShell is only spawned on-demand for rare fallback / multi-format tasks
    // and automatically reclaimed after IDLE_RECLAIM_MS.
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private scheduleIdleReclaim(): void {
    this.clearIdleTimer()
    if (!this.proc || this.running || this.queue.length > 0) return
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (!this.running && this.queue.length === 0 && this.proc) {
        try { this.proc.kill() } catch { /* ignore */ }
        this.proc = null
      }
    }, IDLE_RECLAIM_MS)
  }

  private ensureProc(): boolean {
    if (this.disposed || process.platform !== 'win32') return false
    if (this.proc && !this.proc.killed) return true
    try {
      this.outputBuffer = ''
      this.proc = spawn(this.powershellPath, ['-NoProfile', '-NonInteractive', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        ...(isStoreBuild() ? { cwd: getWritableCwd() } : {})
      })

      this.proc.stdout?.on('data', (data) => {
        this.outputBuffer += data.toString()
        if (this.outputBuffer.includes('__CLIPBOARD_DONE__')) {
          this.outputBuffer = ''
          this.onCommandFinished(null)
        }
      })

      this.proc.on('close', () => {
        this.proc = null
        this.running = false
        this.clearIdleTimer()
        if (this.queue.length > 0 && !this.disposed) {
          this.processQueue()
        }
      })

      this.proc.on('error', (err) => {
        console.error('[PersistentPowerShell] error:', err)
        this.proc = null
        this.running = false
        this.onCommandFinished(err instanceof Error ? err : new Error(String(err)))
      })
      return true
    } catch (err) {
      console.error('[PersistentPowerShell] spawn failed:', err)
      this.proc = null
      return false
    }
  }

  private onCommandFinished(err: Error | null): void {
    const active = this.queue.shift()
    if (active) {
      clearTimeout(active.timer)
      if (err) active.reject(err)
      else active.resolve()
    }
    this.running = false
    if (this.queue.length > 0) {
      this.processQueue()
    } else {
      this.scheduleIdleReclaim()
    }
  }

  public run(script: string, timeoutMs = 3000): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('DISPOSED'))
    return new Promise((resolve, reject) => {
      this.clearIdleTimer()
      const entry: QueueEntry = {
        command: script,
        resolve,
        reject,
        timer: setTimeout(() => {
          const idx = this.queue.indexOf(entry)
          if (idx !== -1) {
            this.queue.splice(idx, 1)
            entry.reject(new Error('TIMEOUT'))
            if (idx === 0) {
              this.running = false
              // Kill hung powershell instance so the next queued task starts clean.
              if (this.proc) {
                try { this.proc.kill() } catch { /* ignore */ }
                this.proc = null
              }
              this.processQueue()
            }
          }
        }, timeoutMs)
      }
      this.queue.push(entry)
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.running || this.queue.length === 0) return
    if (!this.ensureProc() || !this.proc) {
      this.onCommandFinished(new Error('SPAWN_FAILED'))
      return
    }
    this.running = true
    const active = this.queue[0]

    try {
      const fullCmd = `${active.command}; Write-Host "__CLIPBOARD_DONE__"\n`
      this.proc.stdin?.write(fullCmd, 'utf8')
    } catch (err) {
      this.onCommandFinished(err instanceof Error ? err : new Error(String(err)))
    }
  }

  public dispose(): void {
    this.disposed = true
    this.clearIdleTimer()
    for (const entry of this.queue) {
      clearTimeout(entry.timer)
      entry.reject(new Error('DISPOSED'))
    }
    this.queue = []
    this.running = false
    if (this.proc) {
      try { this.proc.kill() } catch { /* ignore */ }
      this.proc = null
    }
  }
}

export const psHost = new PersistentPowerShell()
