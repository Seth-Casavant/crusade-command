import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import type { TacticalDimensions } from '../../data/battlefields'
import {
  TACTICAL_VIEWPORT_MAX_ZOOM,
  TACTICAL_VIEWPORT_MIN_ZOOM,
  TACTICAL_VIEWPORT_ZOOM_STEP,
  calculateTacticalViewportTransform,
  clampTacticalViewportZoom,
  type TacticalViewportPan,
  type TacticalViewportSize,
} from './tacticalViewportMath'

type TacticalViewportState = Readonly<{
  pan: TacticalViewportPan
  zoom: number
}>

type ActivePointer = Readonly<{
  id: number
  pointerType: string
  startClientX: number
  startClientY: number
  startPan: TacticalViewportPan
}>

export type TacticalBattlefieldViewportProps = {
  battlefieldName: string
  children: ReactNode
  dimensions: TacticalDimensions
  disabled?: boolean
  isBusy?: boolean
  statusLayer?: ReactNode
}

const INITIAL_VIEW_STATE: TacticalViewportState = Object.freeze({
  pan: Object.freeze({ x: 0, y: 0 }),
  zoom: TACTICAL_VIEWPORT_MIN_ZOOM,
})
const INITIAL_VIEWPORT_SIZE: TacticalViewportSize = Object.freeze({
  width: 0,
  height: 0,
})
const KEYBOARD_PAN_STEP = 32

function areSizesEqual(
  first: TacticalViewportSize,
  second: TacticalViewportSize,
): boolean {
  return first.width === second.width && first.height === second.height
}

function toStableCssNumber(value: number): number {
  return Number(value.toFixed(6))
}

function safelyCapturePointer(element: HTMLDivElement, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId)
  } catch {
    // Pointer capture is progressive enhancement. React's pointer-up and
    // pointer-cancel handlers still terminate an interaction when unavailable.
  }
}

function safelyReleasePointer(element: HTMLDivElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture?.(pointerId)
    }
  } catch {
    // The browser may have already released capture during cancellation.
  }
}

export function TacticalBattlefieldViewport({
  battlefieldName,
  children,
  dimensions,
  disabled = false,
  isBusy = false,
  statusLayer,
}: TacticalBattlefieldViewportProps) {
  const instructionsId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<ActivePointer | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewportSize, setViewportSize] = useState<TacticalViewportSize>(
    INITIAL_VIEWPORT_SIZE,
  )
  const [viewState, setViewState] =
    useState<TacticalViewportState>(INITIAL_VIEW_STATE)
  const transform = calculateTacticalViewportTransform(
    viewportSize,
    dimensions,
    viewState.zoom,
    viewState.pan,
  )
  const canPan =
    !disabled && (transform.maxPan.x > 0 || transform.maxPan.y > 0)
  const isFit =
    transform.zoom === TACTICAL_VIEWPORT_MIN_ZOOM &&
    transform.pan.x === 0 &&
    transform.pan.y === 0

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return undefined
    }

    let isDisposed = false

    const updateSize = (width: number, height: number) => {
      if (
        isDisposed ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return
      }

      const nextSize = { width, height }
      setViewportSize((currentSize) =>
        areSizesEqual(currentSize, nextSize) ? currentSize : nextSize,
      )
      setViewState((currentState) => {
        const nextTransform = calculateTacticalViewportTransform(
          nextSize,
          dimensions,
          currentState.zoom,
          currentState.pan,
        )

        if (
          nextTransform.pan.x === currentState.pan.x &&
          nextTransform.pan.y === currentState.pan.y &&
          nextTransform.zoom === currentState.zoom
        ) {
          return currentState
        }

        return {
          pan: nextTransform.pan,
          zoom: nextTransform.zoom,
        }
      })
    }

    const measureViewport = () => {
      const bounds = viewport.getBoundingClientRect()
      updateSize(bounds.width, bounds.height)
    }

    measureViewport()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureViewport)

      return () => {
        isDisposed = true
        activePointerRef.current = null
        window.removeEventListener('resize', measureViewport)
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry) {
        updateSize(entry.contentRect.width, entry.contentRect.height)
      }
    })
    resizeObserver.observe(viewport)

    return () => {
      isDisposed = true
      activePointerRef.current = null
      resizeObserver.disconnect()
    }
  }, [dimensions])

  const updateZoom = useCallback(
    (requestedZoom: number) => {
      if (disabled) {
        return
      }

      setViewState((currentState) => {
        const zoom = clampTacticalViewportZoom(requestedZoom)
        const nextTransform = calculateTacticalViewportTransform(
          viewportSize,
          dimensions,
          zoom,
          currentState.pan,
        )

        return {
          pan: nextTransform.pan,
          zoom: nextTransform.zoom,
        }
      })
    },
    [dimensions, disabled, viewportSize],
  )

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      if (disabled) {
        return
      }

      setViewState((currentState) => {
        const currentTransform = calculateTacticalViewportTransform(
          viewportSize,
          dimensions,
          currentState.zoom,
          currentState.pan,
        )
        const nextTransform = calculateTacticalViewportTransform(
          viewportSize,
          dimensions,
          currentState.zoom,
          {
            x: currentTransform.pan.x + deltaX,
            y: currentTransform.pan.y + deltaY,
          },
        )

        return {
          pan: nextTransform.pan,
          zoom: nextTransform.zoom,
        }
      })
    },
    [dimensions, disabled, viewportSize],
  )

  const fitMap = useCallback(() => {
    if (!disabled) {
      setViewState(INITIAL_VIEW_STATE)
    }
  }, [disabled])

  const finishPointerInteraction = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const activePointer = activePointerRef.current

      if (!activePointer || activePointer.id !== event.pointerId) {
        return
      }

      activePointerRef.current = null
      setIsDragging(false)

      safelyReleasePointer(event.currentTarget, event.pointerId)
    },
    [],
  )

  const cancelPointerInteraction = useCallback(() => {
    const activePointer = activePointerRef.current
    const viewport = viewportRef.current

    if (activePointer && viewport) {
      safelyReleasePointer(viewport, activePointer.id)
    }

    activePointerRef.current = null
    setIsDragging(false)
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !canPan ||
      activePointerRef.current ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return
    }

    activePointerRef.current = {
      id: event.pointerId,
      pointerType: event.pointerType,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: transform.pan,
    }
    setIsDragging(true)

    safelyCapturePointer(event.currentTarget, event.pointerId)

    try {
      event.currentTarget.focus({ preventScroll: true })
    } catch {
      event.currentTarget.focus()
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activePointer = activePointerRef.current

    if (!activePointer || activePointer.id !== event.pointerId || !canPan) {
      return
    }

    const deltaX = event.clientX - activePointer.startClientX
    const deltaY = event.clientY - activePointer.startClientY

    // Vertical one-finger gestures remain available to the page on touch
    // devices. A horizontal drag can still inspect the tactical canvas.
    if (
      activePointer.pointerType === 'touch' &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      return
    }

    event.preventDefault()
    const nextTransform = calculateTacticalViewportTransform(
      viewportSize,
      dimensions,
      transform.zoom,
      {
        x: activePointer.startPan.x + deltaX,
        y: activePointer.startPan.y + deltaY,
      },
    )
    setViewState({
      pan: nextTransform.pan,
      zoom: nextTransform.zoom,
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    const step = event.shiftKey ? KEYBOARD_PAN_STEP * 3 : KEYBOARD_PAN_STEP
    let handled = true

    switch (event.key) {
      case 'ArrowUp':
        panBy(0, step)
        break
      case 'ArrowDown':
        panBy(0, -step)
        break
      case 'ArrowLeft':
        panBy(step, 0)
        break
      case 'ArrowRight':
        panBy(-step, 0)
        break
      case '+':
      case '=':
        updateZoom(transform.zoom + TACTICAL_VIEWPORT_ZOOM_STEP)
        break
      case '-':
      case '_':
        updateZoom(transform.zoom - TACTICAL_VIEWPORT_ZOOM_STEP)
        break
      case '0':
      case 'Home':
        fitMap()
        break
      default:
        handled = false
    }

    if (handled) {
      event.preventDefault()
    }
  }

  const sceneTransform = `translate3d(${toStableCssNumber(
    transform.translate.x,
  )}px, ${toStableCssNumber(
    transform.translate.y,
  )}px, 0) scale(${toStableCssNumber(transform.effectiveScale)})`

  return (
    <>
      <div
        aria-label="Tactical map controls"
        className="tactical-battlefield__toolbar"
        role="group"
      >
        <button
          aria-keyshortcuts="+"
          disabled={disabled || transform.zoom >= TACTICAL_VIEWPORT_MAX_ZOOM}
          onClick={() =>
            updateZoom(transform.zoom + TACTICAL_VIEWPORT_ZOOM_STEP)
          }
          type="button"
        >
          Zoom In
        </button>
        <button
          aria-keyshortcuts="-"
          disabled={disabled || transform.zoom <= TACTICAL_VIEWPORT_MIN_ZOOM}
          onClick={() =>
            updateZoom(transform.zoom - TACTICAL_VIEWPORT_ZOOM_STEP)
          }
          type="button"
        >
          Zoom Out
        </button>
        <button
          aria-keyshortcuts="0"
          disabled={disabled}
          onClick={fitMap}
          type="button"
        >
          Fit Map
        </button>
        <output aria-label="Map zoom level" aria-live="polite">
          Zoom {Math.round(transform.zoom * 100)}%
        </output>
      </div>

      <div aria-label="Pan map" className="tactical-battlefield__toolbar tactical-battlefield__pan-controls" role="group">
        <button type="button" aria-label="Pan left" disabled={!canPan || transform.pan.x >= transform.maxPan.x} onClick={() => panBy(KEYBOARD_PAN_STEP * 3, 0)}>←</button>
        <button type="button" aria-label="Pan up" disabled={!canPan || transform.pan.y >= transform.maxPan.y} onClick={() => panBy(0, KEYBOARD_PAN_STEP * 3)}>↑</button>
        <button type="button" aria-label="Pan down" disabled={!canPan || transform.pan.y <= -transform.maxPan.y} onClick={() => panBy(0, -KEYBOARD_PAN_STEP * 3)}>↓</button>
        <button type="button" aria-label="Pan right" disabled={!canPan || transform.pan.x <= -transform.maxPan.x} onClick={() => panBy(-KEYBOARD_PAN_STEP * 3, 0)}>→</button>
      </div>

      <p className="screen-reader-only" id={instructionsId}>
        Use Zoom In and Zoom Out to change scale. When zoomed, drag the map or
        use the pan buttons or arrow keys to pan. Vertical touch swipes scroll
        the page. Press Home or zero to fit the complete map.
      </p>

      <div
        aria-busy={isBusy || undefined}
        aria-describedby={instructionsId}
        aria-disabled={disabled || undefined}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home 0 + -"
        aria-label={`Interactive tactical map for ${battlefieldName}`}
        className="tactical-battlefield__viewport"
        data-dragging={isDragging || undefined}
        data-fit={isFit}
        data-pan-x={toStableCssNumber(transform.pan.x)}
        data-pan-y={toStableCssNumber(transform.pan.y)}
        data-pannable={canPan}
        data-zoom={transform.zoom}
        onBlur={cancelPointerInteraction}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        ref={viewportRef}
        role="group"
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
        tabIndex={disabled ? -1 : 0}
      >
        <div
          className="tactical-battlefield__scene"
          data-tactical-scene="shared-transform"
          style={{
            height: dimensions.height,
            transform: sceneTransform,
            width: dimensions.width,
          }}
        >
          {children}
        </div>
        {statusLayer}
      </div>
    </>
  )
}
