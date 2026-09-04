import { useId, type CSSProperties } from 'react'

type ProgressMeterProps = {
  label?: string
  value: number
}

type ProgressStyle = CSSProperties & {
  '--progress-value': string
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export function ProgressMeter({
  label = 'Crusade progress',
  value,
}: ProgressMeterProps) {
  const labelId = useId()
  const normalizedValue = normalizeProgress(value)
  const progressStyle: ProgressStyle = {
    '--progress-value': `${normalizedValue}%`,
  }

  return (
    <div className="command-progress">
      <div className="command-progress__header">
        <span className="command-progress__label" id={labelId}>
          {label}
        </span>
        <span className="command-progress__value">{normalizedValue}%</span>
      </div>
      <div
        aria-labelledby={labelId}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedValue}
        aria-valuetext={`${normalizedValue} percent`}
        className="command-progress__track"
        role="progressbar"
      >
        <span
          className="command-progress__fill"
          style={progressStyle}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
