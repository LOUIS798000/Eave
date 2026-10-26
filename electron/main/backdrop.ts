/**
 * Desktop backdrop capture for the frosted blade.
 *
 * CSS cannot blur the desktop on Windows: `backdrop-filter` only sees our own
 * page, and the window is transparent, so there is nothing to sample. The
 * cheap, dependable alternative is to grab the few hundred pixels behind the
 * blade once, heavily downscale them (which *is* the blur) and paint the
 * result as the blade's own background. It costs ~100–200 KB of transient
 * memory and one GDI blit per open, versus a second window / DWM acrylic
 * pipeline that would fight the transparent, click-through window.
 *
 * GDI is used instead of `desktopCapturer` because the renderer runs with
 * hardware acceleration disabled; the WGC path behind `desktopCapturer` can
 * return black frames in that configuration, while BitBlt/StretchBlt always
 * works.
 */
import { nativeImage, screen } from 'electron'
import koffi from 'koffi'

type Rect = { x: number; y: number; width: number; height: number }

const SRCCOPY = 0x00cc0020
const HALFTONE = 4
const DIB_RGB_COLORS = 0
/** Downscale factor: 4 device pixels collapse into 1 backdrop pixel. */
const DOWNSCALE = 4
/** Never build a backdrop wider than this — the frost needs no detail. */
const MAX_BACKDROP_WIDTH = 320

type Gdi = {
  getDC: (hwnd: null) => unknown
  releaseDC: (hwnd: null, hdc: unknown) => number
  createCompatibleDC: (hdc: unknown) => unknown
  createCompatibleBitmap: (hdc: unknown, cx: number, cy: number) => unknown
  selectObject: (hdc: unknown, obj: unknown) => unknown
  deleteObject: (obj: unknown) => boolean
  deleteDC: (hdc: unknown) => boolean
  setStretchBltMode: (hdc: unknown, mode: number) => number
  stretchBlt: (
    dest: unknown,
    x: number,
    y: number,
    w: number,
    h: number,
    src: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    rop: number
  ) => boolean
  getDIBits: (
    hdc: unknown,
    hbm: unknown,
    start: number,
    lines: number,
    bits: Buffer,
    bmi: Buffer,
    usage: number
  ) => number
}

let gdi: Gdi | null = null
let gdiUnavailable = false

function loadGdi(): Gdi | null {
  if (process.platform !== 'win32') return null
  if (gdi) return gdi
  if (gdiUnavailable) return null
  try {
    const user32 = koffi.load('user32.dll')
    const gdi32 = koffi.load('gdi32.dll')
    gdi = {
      getDC: user32.func('void *GetDC(void *hWnd)') as Gdi['getDC'],
      releaseDC: user32.func('int ReleaseDC(void *hWnd, void *hDC)') as Gdi['releaseDC'],
      createCompatibleDC: gdi32.func('void *CreateCompatibleDC(void *hdc)') as Gdi['createCompatibleDC'],
      createCompatibleBitmap: gdi32.func(
        'void *CreateCompatibleBitmap(void *hdc, int cx, int cy)'
      ) as Gdi['createCompatibleBitmap'],
      selectObject: gdi32.func('void *SelectObject(void *hdc, void *obj)') as Gdi['selectObject'],
      deleteObject: gdi32.func('bool DeleteObject(void *obj)') as Gdi['deleteObject'],
      deleteDC: gdi32.func('bool DeleteDC(void *hdc)') as Gdi['deleteDC'],
      setStretchBltMode: gdi32.func('int SetStretchBltMode(void *hdc, int mode)') as Gdi['setStretchBltMode'],
      stretchBlt: gdi32.func(
        'bool StretchBlt(void *hdcDest, int x, int y, int w, int h, void *hdcSrc, int sx, int sy, int sw, int sh, uint32 rop)'
      ) as Gdi['stretchBlt'],
      getDIBits: gdi32.func(
        'int GetDIBits(void *hdc, void *hbm, uint32 start, uint32 lines, void *bits, void *bmi, uint32 usage)'
      ) as Gdi['getDIBits']
    }
    return gdi
  } catch (err) {
    gdiUnavailable = true
    console.warn('[Backdrop] GDI capture unavailable:', err)
    return null
  }
}

function bitmapInfoHeader(width: number, height: number): Buffer {
  const bmi = Buffer.alloc(44)
  bmi.writeUInt32LE(40, 0) // biSize
  bmi.writeInt32LE(width, 4) // biWidth
  bmi.writeInt32LE(-height, 8) // biHeight (negative = top-down rows)
  bmi.writeUInt16LE(1, 12) // biPlanes
  bmi.writeUInt16LE(32, 14) // biBitCount
  bmi.writeUInt32LE(0, 16) // biCompression = BI_RGB
  bmi.writeUInt32LE(width * height * 4, 20) // biSizeImage
  return bmi
}

/**
 * Capture the desktop behind `bounds` (DIP) and return it as a small PNG data
 * URL. `null` means "no backdrop available" — callers fall back to the flat
 * white frost. Must be called while our own window is not painted over the
 * area, otherwise the blade is captured instead of the desktop.
 */
export function captureBackdrop(bounds: Rect): string | null {
  const api = loadGdi()
  if (!api) return null

  const display = screen.getDisplayMatching(bounds)
  const scale = display?.scaleFactor ?? 1
  const sx = Math.round(bounds.x * scale)
  const sy = Math.round(bounds.y * scale)
  const sw = Math.max(1, Math.round(bounds.width * scale))
  const sh = Math.max(1, Math.round(bounds.height * scale))

  const factor = Math.max(DOWNSCALE, Math.ceil((sw / MAX_BACKDROP_WIDTH) * 1))
  const dw = Math.max(1, Math.round(sw / factor))
  const dh = Math.max(1, Math.round(sh / factor))

  let hdcScreen: unknown = null
  let hdcMem: unknown = null
  let hbm: unknown = null
  let previous: unknown = null
  try {
    hdcScreen = api.getDC(null)
    if (!hdcScreen) return null
    hdcMem = api.createCompatibleDC(hdcScreen)
    if (!hdcMem) return null
    hbm = api.createCompatibleBitmap(hdcScreen, dw, dh)
    if (!hbm) return null
    previous = api.selectObject(hdcMem, hbm)
    // HALFTONE averages the source pixels while shrinking, which pre-blurs the
    // backdrop instead of point-sampling it into noise.
    api.setStretchBltMode(hdcMem, HALFTONE)
    const blit = api.stretchBlt(hdcMem, 0, 0, dw, dh, hdcScreen, sx, sy, sw, sh, SRCCOPY)
    if (!blit) return null

    // GetDIBits refuses to read a bitmap that is still selected into a DC.
    if (previous) {
      api.selectObject(hdcMem, previous)
      previous = null
    }

    const bits = Buffer.alloc(dw * dh * 4)
    const bmi = bitmapInfoHeader(dw, dh)
    const lines = api.getDIBits(hdcScreen, hbm, 0, dh, bits, bmi, DIB_RGB_COLORS)
    if (!lines) return null

    // GDI leaves the alpha byte of a 32bpp BI_RGB DIB at 0, which would make
    // the whole snapshot fully transparent once nativeImage reads it as BGRA.
    for (let i = 3; i < bits.length; i += 4) bits[i] = 0xff

    const image = nativeImage.createFromBitmap(bits, { width: dw, height: dh })
    if (image.isEmpty()) return null
    const url = image.toDataURL()
    return url.length > 32 ? url : null
  } catch (err) {
    console.warn('[Backdrop] Capture failed:', err)
    return null
  } finally {
    try {
      if (hdcMem && previous) api.selectObject(hdcMem, previous)
      if (hbm) api.deleteObject(hbm)
      if (hdcMem) api.deleteDC(hdcMem)
      if (hdcScreen) api.releaseDC(null, hdcScreen)
    } catch {
      /* ignore cleanup failures */
    }
  }
}
