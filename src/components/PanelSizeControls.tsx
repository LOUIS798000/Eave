/**
 * PanelSizeControls — explicit width/height steppers for the shelf window.
 *
 * Two dimensions, each with −/+ fine steps plus a small set of shape presets.
 * Sizes are committed on click (never while dragging), so the blade can
 * resize without the control sliding out from under the pointer.
 */
import { useTranslation } from '../i18n'

export interface PanelSizePreset {
  label: string
  width: number
  height: number
}

export interface PanelSizeControlsProps {
  width: number
  height: number
  widthMin: number
  widthMax: number
  heightMin: number
  heightMax: number
  widthStep?: number
  heightStep?: number
  presets: PanelSizePreset[]
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
  onPreset: (width: number, height: number) => void
  onReset: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function SizeRow({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const canDecrease = value > min
  const canIncrease = value < max
  return (
    <div className="panel-size-row">
      <div className="panel-size-label">
        <span className="panel-size-label-text">{label}</span>
        <span className="panel-size-value">{value}<span className="panel-size-unit">px</span></span>
      </div>
      <div className="panel-size-stepper">
        <button
          type="button"
          className="panel-size-step"
          aria-label={`${label} -`}
          disabled={!canDecrease}
          onClick={() => onChange(clamp(value - step, min, max))}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="panel-size-gauge" aria-hidden="true">
          <span
            className="panel-size-gauge-fill"
            style={{ width: `${max > min ? ((value - min) / (max - min)) * 100 : 0}%` }}
          >
            <span className="panel-size-gauge-knob" />
          </span>
        </div>
        <button
          type="button"
          className="panel-size-step"
          aria-label={`${label} +`}
          disabled={!canIncrease}
          onClick={() => onChange(clamp(value + step, min, max))}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function PanelSizeControls({
  width,
  height,
  widthMin,
  widthMax,
  heightMin,
  heightMax,
  widthStep = 10,
  heightStep = 10,
  presets,
  onWidthChange,
  onHeightChange,
  onPreset,
  onReset
}: PanelSizeControlsProps) {
  const { t } = useTranslation()
  const safeWidth = clamp(width, widthMin, widthMax)
  const safeHeight = clamp(height, heightMin, heightMax)

  return (
    <div className="panel-size-controls">
      <SizeRow
        label={t('position.widthLabel') || 'Width'}
        value={safeWidth}
        min={widthMin}
        max={widthMax}
        step={widthStep}
        onChange={onWidthChange}
      />
      <SizeRow
        label={t('position.heightLabel') || 'Height'}
        value={safeHeight}
        min={heightMin}
        max={heightMax}
        step={heightStep}
        onChange={onHeightChange}
      />
      <div className="panel-size-presets">
        <div className="panel-size-preset-track" role="group" aria-label={t('position.panelSizeTitle') || 'Shelf size'}>
          {presets.map((preset) => {
            const active = Math.abs(safeWidth - clamp(preset.width, widthMin, widthMax)) <= 4 &&
              Math.abs(safeHeight - clamp(preset.height, heightMin, heightMax)) <= 4
            return (
              <button
                key={preset.label}
                type="button"
                className={`panel-size-preset${active ? ' active' : ''}`}
                onClick={() => onPreset(
                  clamp(preset.width, widthMin, widthMax),
                  clamp(preset.height, heightMin, heightMax)
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="panel-size-reset"
          onClick={onReset}
          title={t('position.sizeReset') || 'Reset'}
          aria-label={t('position.sizeReset') || 'Reset'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M4.5 4.5v4.2h4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default PanelSizeControls
