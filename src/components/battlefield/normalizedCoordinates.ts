import type { CSSProperties } from 'react'

export type NormalizedTacticalPoint = Readonly<{
  x: number
  y: number
}>

export type NormalizedPositionStyle = Pick<CSSProperties, 'left' | 'top'>

export function isNormalizedTacticalPoint(
  point: unknown,
): point is NormalizedTacticalPoint {
  return (
    typeof point === 'object' &&
    point !== null &&
    'x' in point &&
    'y' in point &&
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  )
}

function toPercentage(value: number): string {
  return `${Number((value * 100).toFixed(6))}%`
}

export function normalizedPointToStyle(
  point: unknown,
): NormalizedPositionStyle | null {
  if (!isNormalizedTacticalPoint(point)) {
    return null
  }

  return {
    left: toPercentage(point.x),
    top: toPercentage(point.y),
  }
}
