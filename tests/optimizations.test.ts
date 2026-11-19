import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const testDirs = vi.hoisted(() => ({ root: '' }))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => testDirs.root,
    getPath: () => testDirs.root
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8')
  },
  nativeImage: {
    createFromPath: () => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }) })
  }
}))

vi.mock('../electron/store/paths', () => ({
  PATHS: {
    indexFile: () => join(testDirs.root, 'items.json'),
    settingsFile: () => join(testDirs.root, 'settings.json'),
    imagesDir: () => join(testDirs.root, 'images'),
    payloadsDir: () => join(testDirs.root, 'payloads'),
    tempDir: () => join(testDirs.root, 'temp')
  }
}))

import { ItemStore } from '../electron/store/ItemStore'
import { loadSettings, saveSettings, resetSettingsCache } from '../electron/store/settings'
import { buildCtrlVInputBuffer, buildDropFilesBuffer, isAppExcluded } from '../electron/main/win32Native'
import { resolveThemeMode } from '../src/lib/theme'
import {
  unwrapPdfLines,
  formatJsonText,
  minifyJsonText,
  cleanTrackingUrl,
  dedupeLines,
  toggleTextCase,
  getAvailableTextTransforms
} from '../src/lib/textTransforms'

describe('ItemStore reliability, full-text search, edit, and security allowlist', () => {
  beforeEach(() => {
    testDirs.root = mkdtempSync(join(tmpdir(), 'eave-opt-'))
    mkdirSync(join(testDirs.root, 'images'), { recursive: true })
    mkdirSync(join(testDirs.root, 'payloads'), { recursive: true })
    mkdirSync(join(testDirs.root, 'temp'), { recursive: true })
    resetSettingsCache()
  })

  afterEach(() => {
    try { rmSync(testDirs.root, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('cleans up >300-char text payload files on pruneExpired and delete', () => {
    const store = new ItemStore()
    const longText = 'A'.repeat(350) + 'TAIL_NEEDLE_MARKER'
    store.add({ kind: 'text', text: longText, isUrl: false }, 50)
    const item = store.list()[0]
    const payloadFile = join(testDirs.root, 'payloads', `${item.id}.txt`)
    expect(existsSync(payloadFile)).toBe(true)

    // Backdate item so pruneExpired evicts it
    ;(item as any).capturedAt = Date.now() - 48 * 3600 * 1000
    const pruned = store.pruneExpired(1)
    expect(pruned).toBe(true)
    expect(store.list().length).toBe(0)
    expect(existsSync(payloadFile)).toBe(false)
  })

  it('reconciles orphaned payload and image files on startup', () => {
    const orphanTxt = join(testDirs.root, 'payloads', 'orphan-id.txt')
    const orphanImg = join(testDirs.root, 'images', 'abcd1234-efgh5678.png')
    writeFileSync(orphanTxt, 'stale', 'utf8')
    writeFileSync(orphanImg, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    const store = new ItemStore()
    store.add({ kind: 'text', text: 'alive', isUrl: false }, 50)
    store.persistSync()

    const reloaded = new ItemStore()
    reloaded.load()
    expect(existsSync(orphanTxt)).toBe(false)
    expect(existsSync(orphanImg)).toBe(false)
    expect(reloaded.list().length).toBe(1)
  })

  it('recovers automatically from .bak when primary items.json is corrupted', () => {
    const store = new ItemStore()
    store.add({ kind: 'text', text: 'first-note', isUrl: false }, 50)
    store.persistSync()
    store.add({ kind: 'text', text: 'second-note', isUrl: false }, 50)
    store.persistSync()

    // Corrupt primary file while .bak remains intact
    writeFileSync(join(testDirs.root, 'items.json'), '{broken-json', 'utf8')

    const recovered = new ItemStore()
    recovered.load()
    expect(recovered.list().length).toBeGreaterThanOrEqual(1)
  })

  it('searches full >300-char text payloads and image filenames', () => {
    const store = new ItemStore()
    const longText = 'intro '.repeat(80) + 'SUPER_SECRET_NEEDLE_2026'
    store.add({ kind: 'text', text: longText, isUrl: false }, 50)
    store.add({
      kind: 'image',
      imageId: 'img12345-abcd1234',
      width: 100,
      height: 100,
      bytes: 2048,
      fileName: 'DesignMockupFinal.png'
    }, 50)

    const textHits = store.searchIds('super_secret_needle')
    expect(textHits.length).toBe(1)
    expect(store.getFullText(textHits[0])).toContain('SUPER_SECRET_NEEDLE_2026')

    const imgHits = store.searchIds('DesignMockup')
    expect(imgHits.length).toBe(1)
  })

  it('updates text in-place and maintains dedup signature consistency', () => {
    const store = new ItemStore()
    store.add({ kind: 'text', text: 'original', isUrl: false }, 50)
    const id = store.list()[0].id
    const updatedLong = 'edited-body '.repeat(40)
    expect(store.updateText(id, updatedLong)).toBe(true)
    expect(store.getFullText(id)).toBe(updatedLong)
    // Re-adding the same edited content should dedup instead of duplicating
    store.add({ kind: 'text', text: updatedLong, isUrl: false }, 50)
    expect(store.list().length).toBe(1)
  })

  it('enforces file path allowlist for edgelocal://file/', () => {
    const store = new ItemStore()
    const known = join(testDirs.root, 'sample.png')
    store.add({ kind: 'files', paths: [known] }, 50)
    expect(store.isKnownFilePath(known)).toBe(true)
    expect(store.isKnownFilePath('C:\\Windows\\System32\\drivers\\etc\\hosts')).toBe(false)
  })

  it('validates and atomically saves theme, excludedApps, and pinnedDefaultExpanded', () => {
    const saved = saveSettings({
      theme: 'dark',
      excludedApps: ['KeePass.exe', 'keepass.exe', '  WeChat.exe  ', ''],
      pinnedDefaultExpanded: true
    })
    expect(saved.theme).toBe('dark')
    expect(saved.excludedApps).toEqual(['KeePass.exe', 'WeChat.exe'])
    expect(saved.pinnedDefaultExpanded).toBe(true)

    resetSettingsCache()
    const loaded = loadSettings()
    expect(loaded.theme).toBe('dark')
    expect(loaded.excludedApps).toEqual(['KeePass.exe', 'WeChat.exe'])
    expect(loaded.pinnedDefaultExpanded).toBe(true)
  })
})

describe('Native Win32 ABI builders and exclusion matching', () => {
  it('builds a valid 8-event x64 SendInput Ctrl+V buffer (4 modifier keyups + 4 Ctrl+V events)', () => {
    const { buffer, stride, count } = buildCtrlVInputBuffer(true)
    expect(stride).toBe(40)
    expect(count).toBe(8)
    expect(buffer.length).toBe(320)
    // Events 0..3: release Shift/Alt modifiers
    expect(buffer.readUInt16LE(0 * stride + 8)).toBe(0xA0)
    expect(buffer.readUInt32LE(0 * stride + 12)).toBe(0x0002)
    expect(buffer.readUInt16LE(2 * stride + 8)).toBe(0xA4)
    expect(buffer.readUInt32LE(2 * stride + 12)).toBe(0x0002)
    // Event 4: Ctrl down
    expect(buffer.readUInt32LE(4 * stride)).toBe(1)
    expect(buffer.readUInt16LE(4 * stride + 8)).toBe(0x11)
    expect(buffer.readUInt32LE(4 * stride + 12)).toBe(0)
    // Event 5: V down
    expect(buffer.readUInt16LE(5 * stride + 8)).toBe(0x56)
    expect(buffer.readUInt32LE(5 * stride + 12)).toBe(0)
    // Event 6: V up
    expect(buffer.readUInt16LE(6 * stride + 8)).toBe(0x56)
    expect(buffer.readUInt32LE(6 * stride + 12)).toBe(0x0002)
    // Event 7: Ctrl up
    expect(buffer.readUInt16LE(7 * stride + 8)).toBe(0x11)
    expect(buffer.readUInt32LE(7 * stride + 12)).toBe(0x0002)
  })

  it('builds a valid UTF-16LE DROPFILES payload with double-NUL terminator', () => {
    const buf = buildDropFilesBuffer(['C:\\a.txt', 'D:\\测试.png'])
    expect(buf.readUInt32LE(0)).toBe(20) // pFiles
    expect(buf.readUInt32LE(16)).toBe(1) // fWide
    const decoded = buf.subarray(20).toString('utf16le')
    expect(decoded).toBe('C:\\a.txt\0D:\\测试.png\0\0')
  })

  it('matches excluded apps case-insensitively with or without .exe', () => {
    expect(isAppExcluded('KeePass.exe', ['keepass'])).toBe(true)
    expect(isAppExcluded('wechat.exe', ['WeChat.exe'])).toBe(true)
    expect(isAppExcluded('Code.exe', ['WeChat.exe'])).toBe(false)
    expect(isAppExcluded(null, ['WeChat.exe'])).toBe(false)
  })
})

describe('Theme resolver and bundle regression guards', () => {
  it('resolves explicit theme modes', () => {
    expect(resolveThemeMode('dark')).toBe('dark')
    expect(resolveThemeMode('light')).toBe('light')
  })

  it('keeps gsap out of CopyIndicatorCurve and full translations out of main process', () => {
    const root = join(__dirname, '..')
    const curve = readFileSync(join(root, 'src/components/CopyIndicatorCurve.tsx'), 'utf8')
    expect(curve).not.toContain('LiquidOctopusLoader')
    expect(curve).not.toContain('gsap')

    const tray = readFileSync(join(root, 'electron/main/tray.ts'), 'utf8')
    const win = readFileSync(join(root, 'electron/main/window.ts'), 'utf8')
    expect(tray).toContain('mainStrings')
    expect(win).toContain('mainStrings')
    expect(tray).not.toContain('i18n/translations')
    expect(win).not.toContain('i18n/translations')

    const card = readFileSync(join(root, 'src/components/ClipboardItem.tsx'), 'utf8')
    expect(card).not.toContain('useStore((s) => s.settings)')
    expect(card).not.toContain('useStore((s) => s.expandedStackId)')

    const settingsTsx = readFileSync(join(root, 'src/components/Settings.tsx'), 'utf8')
    expect(settingsTsx).not.toContain('setting-pill ')
    expect(settingsTsx).toContain("className={`pill ${currentTheme === opt.val ? 'active' : ''}`}")
  })
})

describe('Smart offline text transforms', () => {
  it('unwraps PDF hard line breaks for Chinese and English while keeping paragraphs and lists', () => {
    const raw = '机械原理中关于\n凸轮机构的压力角\n定义如下：\n- 第一点\n- 第二点\n\nAn algo-\nrithm splits\nlines cleanly.'
    const out = unwrapPdfLines(raw)
    expect(out).toBe('机械原理中关于凸轮机构的压力角定义如下：\n- 第一点\n- 第二点\n\nAn algorithm splits lines cleanly.')
  })

  it('formats and minifies valid JSON structures', () => {
    const raw = '{"a":1,"b":[2,3]}'
    const pretty = formatJsonText(raw)
    expect(pretty).toContain('\n  "a": 1')
    expect(minifyJsonText(pretty)).toBe(raw)
  })

  it('strips tracking parameters from URLs without breaking legitimate query params', () => {
    const raw = 'https://www.bilibili.com/video/BV1xx?p=2&vd_source=abc123&spm_id_from=333.999'
    expect(cleanTrackingUrl(raw)).toBe('https://www.bilibili.com/video/BV1xx?p=2')
  })

  it('dedupes lines preserving order and toggles Latin casing', () => {
    expect(dedupeLines('a\nb\na\nc\nb')).toBe('a\nb\nc')
    expect(toggleTextCase('hello world')).toBe('HELLO WORLD')
    expect(toggleTextCase('HELLO WORLD')).toBe('hello world')
  })

  it('only surfaces contextually relevant transforms', () => {
    const jsonActions = getAvailableTextTransforms('{"k":1}').map((a) => a.id)
    expect(jsonActions).toEqual(['format-json'])

    const urlActions = getAvailableTextTransforms('https://example.com/?id=1&utm_source=x', true).map((a) => a.id)
    expect(urlActions).toEqual(['clean-url'])
  })
})
