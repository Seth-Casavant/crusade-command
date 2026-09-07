import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import {
  TacticalBattlefieldViewport,
  TacticalOverlay,
  TacticalOverlayItem,
} from './index'

type ResizeObserverCallbackForTest = (
  entries: Array<{ contentRect: { width: number; height: number } }>,
) => void

const landscapeDimensions = { width: 1600, height: 900 }

function installElementMeasurement(width = 800, height = 600) {
  return vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      bottom: height,
      height,
      left: 0,
      right: width,
      toJSON: () => ({}),
      top: 0,
      width,
      x: 0,
      y: 0,
    })
}

function getViewport(): HTMLElement {
  return screen.getByRole('group', {
    name: 'Interactive tactical map for Termination',
  })
}

function getScene(container: HTMLElement): HTMLElement {
  const scene = container.querySelector<HTMLElement>(
    '[data-tactical-scene="shared-transform"]',
  )

  if (!scene) {
    throw new Error('Expected a shared tactical scene.')
  }

  return scene
}

describe('TacticalBattlefieldViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts fitted, exposes keyboard-ready controls, and enforces zoom bounds', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installElementMeasurement()
    render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
      >
        <span>Map</span>
      </TacticalBattlefieldViewport>,
    )

    const viewport = getViewport()
    const zoomIn = screen.getByRole('button', { name: 'Zoom In' })
    const zoomOut = screen.getByRole('button', { name: 'Zoom Out' })
    const fitMap = screen.getByRole('button', { name: 'Fit Map' })

    expect(viewport).toHaveAttribute('tabindex', '0')
    expect(viewport).toHaveAttribute('data-fit', 'true')
    expect(viewport).toHaveAttribute('data-zoom', '1')
    expect(zoomIn).toHaveAttribute('aria-keyshortcuts', '+')
    expect(zoomOut).toBeDisabled()
    expect(fitMap).toHaveAttribute('aria-keyshortcuts', '0')
    expect(screen.getByLabelText('Map zoom level')).toHaveTextContent('100%')

    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(zoomIn)
    }
    expect(viewport).toHaveAttribute('data-zoom', '4')
    expect(zoomIn).toBeDisabled()
    expect(screen.getByLabelText('Map zoom level')).toHaveTextContent('400%')

    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(zoomOut)
    }
    expect(viewport).toHaveAttribute('data-zoom', '1')
    expect(zoomOut).toBeDisabled()
    expect(viewport).toHaveAttribute('data-fit', 'true')
  })

  it('supports bounded pointer and keyboard pan, then restores Fit Map state', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installElementMeasurement()
    render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
      >
        <span>Map</span>
      </TacticalBattlefieldViewport>,
    )

    const viewport = getViewport()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    expect(viewport).toHaveAttribute('data-pannable', 'true')

    fireEvent.pointerDown(viewport, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 7,
      pointerType: 'mouse',
    })
    fireEvent.pointerMove(viewport, {
      clientX: 10000,
      clientY: -10000,
      pointerId: 7,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(viewport, {
      pointerId: 7,
      pointerType: 'mouse',
    })

    expect(viewport).toHaveAttribute('data-pan-x', '400')
    expect(viewport).toHaveAttribute('data-pan-y', '-150')
    expect(viewport).not.toHaveAttribute('data-dragging')

    fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
    expect(viewport).toHaveAttribute('data-pan-x', '400')
    fireEvent.keyDown(viewport, { key: 'Home' })
    expect(viewport).toHaveAttribute('data-zoom', '1')
    expect(viewport).toHaveAttribute('data-pan-x', '0')
    expect(viewport).toHaveAttribute('data-pan-y', '0')
    expect(viewport).toHaveAttribute('data-fit', 'true')
  })

  it('keeps the image and normalized overlay in one transform-owning scene', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installElementMeasurement()
    const { container } = render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
      >
        <img alt="Map fixture" />
        <TacticalOverlay>
          <TacticalOverlayItem position={{ x: 0.25, y: 0.75 }}>
            <span data-testid="normalized-marker">Marker</span>
          </TacticalOverlayItem>
        </TacticalOverlay>
      </TacticalBattlefieldViewport>,
    )

    const viewport = getViewport()
    const scene = getScene(container)
    const image = screen.getByRole('img', { name: 'Map fixture' })
    const overlay = container.querySelector('.tactical-overlay')
    const item = screen.getByTestId('normalized-marker').parentElement
    const initialSceneTransform = scene.style.transform

    expect(image.parentElement).toBe(scene)
    expect(overlay?.parentElement).toBe(scene)
    expect(scene).toHaveStyle({ height: '900px', width: '1600px' })
    expect(scene.style.transform).toContain('scale(0.5)')
    expect(item).toHaveStyle({ left: '25%', top: '75%' })

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })

    expect(scene.style.transform).not.toBe(initialSceneTransform)
    expect(item).toHaveStyle({ left: '25%', top: '75%' })
    expect(image).not.toHaveStyle({ transform: expect.any(String) })
    expect(overlay).not.toHaveStyle({ transform: expect.any(String) })
  })

  it('recalculates fit after resize without moving normalized coordinates', () => {
    let resizeCallback: ResizeObserverCallbackForTest | null = null
    const observe = vi.fn()
    const disconnect = vi.fn()

    class ResizeObserverForTest {
      constructor(callback: ResizeObserverCallbackForTest) {
        resizeCallback = callback
      }

      observe = observe
      disconnect = disconnect
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverForTest)
    installElementMeasurement()
    const { container, unmount } = render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
      >
        <TacticalOverlay>
          <TacticalOverlayItem position={{ x: 0.4, y: 0.6 }}>
            <span data-testid="resize-marker">Marker</span>
          </TacticalOverlayItem>
        </TacticalOverlay>
      </TacticalBattlefieldViewport>,
    )

    const viewport = getViewport()
    const scene = getScene(container)
    const item = screen.getByTestId('resize-marker').parentElement
    const initialTransform = scene.style.transform

    expect(observe).toHaveBeenCalledWith(viewport)
    act(() => {
      resizeCallback?.([{ contentRect: { width: 400, height: 800 } }])
    })

    expect(scene.style.transform).not.toBe(initialTransform)
    expect(scene.style.transform).toContain('scale(0.25)')
    expect(viewport).toHaveAttribute('data-fit', 'true')
    expect(item).toHaveStyle({ left: '40%', top: '60%' })

    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('falls back to one cleaned-up window resize listener when observers are unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installElementMeasurement()
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
      >
        <span>Map</span>
      </TacticalBattlefieldViewport>,
    )

    const resizeRegistration = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'resize',
    )
    expect(resizeRegistration).toBeDefined()

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      resizeRegistration?.[1],
    )
  })

  it('disables interaction while loading without removing the stable viewport', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installElementMeasurement()
    render(
      <TacticalBattlefieldViewport
        battlefieldName="Termination"
        dimensions={landscapeDimensions}
        disabled
        isBusy
        statusLayer={<span role="status">Loading Tactical Cartography...</span>}
      >
        <span>Map</span>
      </TacticalBattlefieldViewport>,
    )

    const viewport = getViewport()
    expect(viewport).toHaveAttribute('aria-busy', 'true')
    expect(viewport).toHaveAttribute('aria-disabled', 'true')
    expect(viewport).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('Loading Tactical Cartography...')).toHaveRole(
      'status',
    )
    expect(screen.getByRole('button', { name: 'Zoom In' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom Out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fit Map' })).toBeDisabled()
  })
})
