import type { TacticalDimensions } from '../../data/battlefields'

export const TACTICAL_VIEWPORT_MIN_ZOOM = 1
export const TACTICAL_VIEWPORT_MAX_ZOOM = 4
export const TACTICAL_VIEWPORT_ZOOM_STEP = 0.5

export type TacticalViewportSize = Readonly<{
  width: number
  height: number
}>

export type TacticalViewportPan = Readonly<{
  x: number
  y: number
}>

export type TacticalViewportTransform = Readonly<{
  effectiveScale: number
  fitScale: number
  maxPan: TacticalViewportPan
  pan: TacticalViewportPan
  translate: TacticalViewportPan
  zoom: number
}>

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function clampTacticalViewportZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return TACTICAL_VIEWPORT_MIN_ZOOM
  }

  return clamp(
    zoom,
    TACTICAL_VIEWPORT_MIN_ZOOM,
    TACTICAL_VIEWPORT_MAX_ZOOM,
  )
}

export function calculateTacticalViewportTransform(
  viewport: TacticalViewportSize,
  content: TacticalDimensions,
  requestedZoom: number,
  requestedPan: TacticalViewportPan,
): TacticalViewportTransform {
  const zoom = clampTacticalViewportZoom(requestedZoom)

  if (
    !isPositiveFinite(viewport.width) ||
    !isPositiveFinite(viewport.height) ||
    !isPositiveFinite(content.width) ||
    !isPositiveFinite(content.height)
  ) {
    return {
      effectiveScale: 1,
      fitScale: 1,
      maxPan: { x: 0, y: 0 },
      pan: { x: 0, y: 0 },
      translate: { x: 0, y: 0 },
      zoom,
    }
  }

  const fitScale = Math.min(
    viewport.width / content.width,
    viewport.height / content.height,
  )
  const effectiveScale = fitScale * zoom
  const renderedWidth = content.width * effectiveScale
  const renderedHeight = content.height * effectiveScale
  const maxPan = {
    x: Math.max(0, (renderedWidth - viewport.width) / 2),
    y: Math.max(0, (renderedHeight - viewport.height) / 2),
  }
  const pan = {
    x: clamp(requestedPan.x, -maxPan.x, maxPan.x),
    y: clamp(requestedPan.y, -maxPan.y, maxPan.y),
  }

  return {
    effectiveScale,
    fitScale,
    maxPan,
    pan,
    translate: {
      x: (viewport.width - renderedWidth) / 2 + pan.x,
      y: (viewport.height - renderedHeight) / 2 + pan.y,
    },
    zoom,
  }
}
