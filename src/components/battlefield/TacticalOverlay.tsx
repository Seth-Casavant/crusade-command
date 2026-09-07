import type { ReactNode } from 'react'

import {
  normalizedPointToStyle,
  type NormalizedTacticalPoint,
} from './normalizedCoordinates'

export type TacticalOverlayProps = {
  children?: ReactNode
  className?: string
}

export function TacticalOverlay({
  children,
  className = '',
}: TacticalOverlayProps) {
  const classes = ['tactical-overlay', className].filter(Boolean).join(' ')

  return <div className={classes}>{children}</div>
}

export type TacticalOverlayItemProps = {
  children: ReactNode
  className?: string
  position: NormalizedTacticalPoint
}

export function TacticalOverlayItem({
  children,
  className = '',
  position,
}: TacticalOverlayItemProps) {
  const style = normalizedPointToStyle(position)

  if (!style) {
    return null
  }

  const classes = ['tactical-overlay__item', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      data-tactical-x={position.x}
      data-tactical-y={position.y}
      style={style}
    >
      {children}
    </div>
  )
}
