import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(relPath: string): string {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf8')
}

describe('custom window size — renderer wiring', () => {
  it('Panel sets the blade CSS variable and compacts the header at narrow widths', () => {
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain("document.documentElement.style.setProperty('--panel-width'")
    expect(panel).toContain("containerClass += ' blade-compact'")
    expect(panel).toContain("containerClass += ' blade-narrow'")
    expect(panel).toContain("containerClass += ' blade-short'")
    expect(panel).toContain("containerClass += ' blade-top-compact'")
    expect(panel).toContain("'--hcard-h'")
    expect(panel).toContain("'--hcard-w'")
    expect(panel).toContain('width: topPanelWidth')
    expect(panel).toContain('height: panelH')
    expect(panel).toContain(': { width: panelWidth, height: panelH }')
  })

  it('Panel pins the blade top while settings is open so height edits do not move the controls', () => {
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain('settingsAnchorTop')
    expect(panel).toContain('containerStyle.top = `${anchoredTop}px`')
    expect(panel).toContain("containerStyle.transform = 'none'")
  })

  it('Settings renders one size card with the right model for each dock', () => {
    const settings = read('src/components/Settings.tsx')
    expect(settings).toContain('PanelSizeControls')
    expect(settings).toContain('renderPanelSizeCard()')
    expect(settings).toContain("void patch(isHorizontal ? { topPanelWidth: value } : { panelWidth: value })")
    expect(settings).toContain('topPanelHeightPx: value')
    expect(settings).toContain('panelHeightPx: value')
    expect(settings).toContain("void patch({ panelWidth: PANEL_WIDTH_DEFAULT, panelHeightPx: 0, panelHeight: 0.5 })")
  })

  it('Hover hit-testing follows the configured size instead of fixed 270/218 constants', () => {
    const hover = read('src/hooks/useEdgeHover.ts')
    expect(hover).toContain('resolvePanelWidth(state.settings)')
    expect(hover).toContain('const baseBladeH = resolveTopPanelHeight(state.settings) + 8')
    expect(hover).toContain('resolvePreviewColumnWidth(panelW)')
    expect(hover).not.toContain('const PANEL_WIDE = 270')
    expect(hover).not.toContain('const baseBladeH = 218')
  })

  it('Flyouts derive their vertical size from the same model', () => {
    for (const file of [
      'src/components/PreviewFlyout.tsx',
      'src/components/LanguageFlyout.tsx',
      'src/components/IndicatorStyleFlyout.tsx'
    ]) {
      const src = read(file)
      expect(src).toContain('resolveTopPanelHeight(settings)')
      expect(src).toContain('resolvePanelHeight(settings, screenH)')
      expect(src).toContain('top: panelH + 12')
    }
  })

  it('Narrow/short layout CSS exists for compact header and size card', () => {
    const panelCss = read('src/styles/panel.css')
    expect(panelCss).toContain('.blade-compact')
    expect(panelCss).toContain('.blade-narrow')
    expect(panelCss).toContain('--seg-slot: 20px')

    const settingsCss = read('src/styles/settings.css')
    expect(settingsCss).toContain('.panel-size-controls')
    expect(settingsCss).toContain('.settings-shelf-card.panel-size-card')
    expect(settingsCss).toContain('.panel-size-stepper')
  })
})
