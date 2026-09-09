import { createContext, useContext, type ReactNode } from 'react'

import type { TacticalDimensions } from '../../data/battlefields'
import {
  normalizedPointToNativeStyle,
  type NormalizedTacticalPoint,
} from './normalizedCoordinates'

const TacticalOverlayDimensionsContext =
  createContext<TacticalDimensions | null>(null)

export type TacticalOverlayProps = {
  children?: ReactNode
  className?: string
  dimensions: TacticalDimensions
}

export function TacticalOverlay({
  children,
  className = '',
  dimensions,
}: TacticalOverlayProps) {
  const classes = ['tactical-overlay', className].filter(Boolean).join(' ')

  return (
    <TacticalOverlayDimensionsContext.Provider value={dimensions}>
      <div
        className={classes}
        data-tactical-coordinate-space="native-image"
        style={{ height: dimensions.height, width: dimensions.width }}
      >
        {children}
      </div>
    </TacticalOverlayDimensionsContext.Provider>
  )
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
  const dimensions = useContext(TacticalOverlayDimensionsContext)
  const style = dimensions
    ? normalizedPointToNativeStyle(position, dimensions)
    : null

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
