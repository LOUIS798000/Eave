import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const spawn = vi.hoisted(() =>
  vi.fn(() => ({
    stdout: { on: vi.fn() },
    stdin: { write: vi.fn() },
    on: vi.fn(),
    kill: vi.fn()
  }))
)

vi.mock('node:child_process', () => ({
  spawn,
  execFile: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'C:\\mock\\app',
    getPath: () => 'C:\\mock\\userData'
  }
}))

import { getSystemPowerShellPath, getWritableCwd } from '../electron/main/powershell'

describe('getSystemPowerShellPath', () => {
  const prev = process.env.SystemRoot

  afterEach(() => {
    if (prev === undefined) delete process.env.SystemRoot
    else process.env.SystemRoot = prev
  })

  it('uses SystemRoot when set', () => {
    process.env.SystemRoot = 'D:\\Windows'
    expect(getSystemPowerShellPath()).toBe(
      'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
  })

  it('falls back to C:\\Windows when SystemRoot is unset', () => {
    delete process.env.SystemRoot
    expect(getSystemPowerShellPath()).toBe(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
  })
})

describe('getWritableCwd', () => {
  const prev = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE
  }
  const realDir = join(tmpdir(), `ed-cwd-${Date.now()}`)
  const missing = join(tmpdir(), `ed-cwd-missing-${Date.now()}-nope`)

  beforeEach(() => {
    mkdirSync(realDir, { recursive: true })
  })

  afterEach(() => {
    process.env.TEMP = prev.TEMP
    process.env.TMP = prev.TMP
    process.env.USERPROFILE = prev.USERPROFILE
    try { rmSync(realDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('prefers TEMP when that directory exists', () => {
    process.env.TEMP = realDir
    process.env.TMP = missing
    process.env.USERPROFILE = missing
    expect(getWritableCwd()).toBe(realDir)
    expect(existsSync(getWritableCwd())).toBe(true)
  })

  it('uses TMP when TEMP is missing', () => {
    process.env.TEMP = missing
    process.env.TMP = realDir
    process.env.USERPROFILE = missing
    expect(getWritableCwd()).toBe(realDir)
  })

  it('uses USERPROFILE when TEMP and TMP are missing', () => {
    process.env.TEMP = missing
    process.env.TMP = missing
    process.env.USERPROFILE = realDir
    expect(getWritableCwd()).toBe(realDir)
  })

  it('falls back to C:\\Windows\\Temp when none of the env dirs exist', () => {
    process.env.TEMP = missing
    process.env.TMP = missing
    process.env.USERPROFILE = missing
    expect(getWritableCwd()).toBe('C:\\Windows\\Temp')
  })
})

describe('PersistentPowerShell spawn options (lazy on-demand)', () => {
  afterEach(() => {
    delete process.env.APP_BUILD_TARGET
  })

  it('does not spawn powershell.exe on module import (zero idle footprint)', async () => {
    delete process.env.APP_BUILD_TARGET
    spawn.mockClear()
    vi.resetModules()
    await import('../electron/main/powershell')
    expect(spawn).not.toHaveBeenCalled()
  })

  it('GitHub exe: spawns lazily on run() without forcing cwd', async () => {
    delete process.env.APP_BUILD_TARGET
    spawn.mockClear()
    vi.resetModules()
    const mod = await import('../electron/main/powershell')
    if (process.platform !== 'win32') return
    void mod.psHost.run('Write-Host hi', 50).catch(() => {})
    expect(spawn).toHaveBeenCalledTimes(1)
    const opts = spawn.mock.calls[0][2] as { cwd?: string; windowsHide?: boolean }
    expect(opts.windowsHide).toBe(true)
    expect(opts.cwd).toBeUndefined()
    mod.psHost.dispose()
  })

  it('Store: spawns lazily on run() with a writable cwd', async () => {
    process.env.APP_BUILD_TARGET = 'store'
    spawn.mockClear()
    vi.resetModules()
    const mod = await import('../electron/main/powershell')
    if (process.platform !== 'win32') return
    void mod.psHost.run('Write-Host hi', 50).catch(() => {})
    expect(spawn).toHaveBeenCalledTimes(1)
    const opts = spawn.mock.calls[0][2] as { cwd?: string; windowsHide?: boolean }
    expect(opts.windowsHide).toBe(true)
    expect(opts.cwd).toBe(mod.getWritableCwd())
    mod.psHost.dispose()
  })
})
