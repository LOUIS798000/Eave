import { describe, it, expect } from 'vitest'
import {
  PANEL_HEIGHT_MIN,
  PANEL_PREVIEW_GUTTER,
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  PANEL_WINDOW_GUTTER,
  TOP_HEIGHT_DEFAULT,
  TOP_HEIGHT_MAX,
  TOP_HEIGHT_MIN,
  TOP_WIDTH_MAX,
  TOP_WIDTH_MIN,
  resolvePanelHeight,
  resolvePanelWidth,
  resolvePreviewColumnWidth,
  resolveStickWindowWidth,
  resolveTopCardWidth,
  resolveTopPanelHeight,
  resolveTopPanelWidth
} from '../shared/panelSize'
import { computeStickBounds, type DisplayInfo } from '../electron/main/geometry'

function display(id: number, w: number, h: number): DisplayInfo {
  return {
    id,
    workArea: { x: 0, y: 0, width: w, height: h },
    scaleFactor: 1,
    isPrimary: true
  }
}

describe('panel size model — left/right blade', () => {
  it('defaults to the historical 270px blade and 50% height', () => {
    expect(resolvePanelWidth({})).toBe(PANEL_WIDTH_DEFAULT)
    expect(resolvePanelHeight({ panelHeight: 0.5 }, 1000)).toBe(500)
  })

  it('clamps custom blade width to a layout-safe range', () => {
    expect(resolvePanelWidth({ panelWidth: 100 })).toBe(PANEL_WIDTH_MIN)
    expect(resolvePanelWidth({ panelWidth: 900 })).toBe(PANEL_WIDTH_MAX)
    expect(resolvePanelWidth({ panelWidth: 360 })).toBe(360)
  })

  it('uses explicit height when set, but never below the readable minimum', () => {
    expect(resolvePanelHeight({ panelHeight: 0.5, panelHeightPx: 640 }, 1000)).toBe(640)
    expect(resolvePanelHeight({ panelHeight: 0.5, panelHeightPx: 100 }, 1000)).toBe(PANEL_HEIGHT_MIN)
    expect(resolvePanelHeight({ panelHeight: 1 }, 1000)).toBe(976)
  })

  it('keeps the native window wide enough for shadow + flyout gutters', () => {
    expect(resolveStickWindowWidth(270, false)).toBe(270 + PANEL_WINDOW_GUTTER)
    expect(resolveStickWindowWidth(270, true)).toBe(270 + PANEL_PREVIEW_GUTTER)
    expect(resolvePreviewColumnWidth(270)).toBe(740)
  })
})

describe('panel size model — top dock', () => {
  it('keeps the legacy full-width 210px dock when unset', () => {
    expect(resolveTopPanelWidth({}, 1920)).toBe(TOP_WIDTH_MAX)
    expect(resolveTopPanelHeight({})).toBe(TOP_HEIGHT_DEFAULT)
  })

  it('honours custom top width/height and clamps to the safe range', () => {
    expect(resolveTopPanelWidth({ topPanelWidth: 800 }, 1920)).toBe(800)
    expect(resolveTopPanelWidth({ topPanelWidth: 500 }, 1920)).toBe(TOP_WIDTH_MIN)
    expect(resolveTopPanelWidth({ topPanelWidth: 1600 }, 1920)).toBe(TOP_WIDTH_MAX)
    expect(resolveTopPanelWidth({ topPanelWidth: 1600 }, 1200)).toBe(TOP_WIDTH_MAX)

    expect(resolveTopPanelHeight({ topPanelHeightPx: 245 })).toBe(245)
    expect(resolveTopPanelHeight({ topPanelHeightPx: 100 })).toBe(TOP_HEIGHT_MIN)
    expect(resolveTopPanelHeight({ topPanelHeightPx: 900 })).toBe(TOP_HEIGHT_MAX)
  })

  it('keeps compact horizontal cards near the 1.75:1 proportion', () => {
    expect(resolveTopCardWidth(72)).toBe(126)
    expect(resolveTopCardWidth(80)).toBe(140)
    expect(resolveTopCardWidth(120)).toBe(210)
    expect(resolveTopCardWidth(146)).toBe(210)
  })
})

describe('computeStickBounds — custom top dock size', () => {
  const PRIMARY = display(1, 1920, 1040)

  it('shrinks the native window and moves the dock with a custom width', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 800,
      topPanelHeight: 240
    })
    // 800px blade + 60px flare gutters.
    expect(r.width).toBe(860)
    // 240px blade + 270px room for the flyout column below it.
    expect(r.height).toBe(510)
    // Centered: dock starts at 560, window 30px earlier.
    expect(r.x).toBe(530)
  })

  it('reserves 180px of window height so Settings stays usable at the 120px floor', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 800,
      topPanelHeight: 120
    })
    expect(r.width).toBe(860)
    expect(r.height).toBe(450)
  })

  it('supports the compact 180px top floor', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 800,
      topPanelHeight: 180
    })
    expect(r.width).toBe(860)
    expect(r.height).toBe(450)
  })

  it('expands height for the preview flyout without changing width', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 800,
      topPanelHeight: 240,
      previewActive: true
    })
    expect(r.width).toBe(860)
    expect(r.height).toBe(750)
  })

  it('keeps the dock left-aligned at offset 0', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 800,
      horizontalOffset: 0
    })
    expect(r.x).toBe(0)
  })

  it('clamps an undersized custom width instead of collapsing the header', () => {
    const r = computeStickBounds({
      position: 'top',
      displays: [PRIMARY],
      topPanelWidth: 500
    })
    expect(r.width).toBe(TOP_WIDTH_MIN + 60)
  })

  it('preserves the original geometry when no custom size is supplied', () => {
    const r = computeStickBounds({ position: 'top', displays: [PRIMARY] })
    expect(r.width).toBe(1140)
    expect(r.height).toBe(480)
    expect(r.x).toBe(390)
  })
})
