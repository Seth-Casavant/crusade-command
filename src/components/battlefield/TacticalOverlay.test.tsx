import { render, screen } from '@testing-library/react'

import {
  TacticalOverlay,
  TacticalOverlayItem,
  isNormalizedTacticalPoint,
  normalizedPointToNativeStyle,
  normalizedPointToStyle,
} from './index'

const nativeDimensions = { width: 1179, height: 2556 }

describe('normalized tactical overlay', () => {
  it('converts normalized coordinates into resolution-independent percentages', () => {
    expect(normalizedPointToStyle({ x: 0.25, y: 0.75 })).toEqual({
      left: '25%',
      top: '75%',
    })
    expect(normalizedPointToStyle({ x: 0, y: 0 })).toEqual({
      left: '0%',
      top: '0%',
    })
    expect(normalizedPointToStyle({ x: 1, y: 1 })).toEqual({
      left: '100%',
      top: '100%',
    })
  })

  it.each([
    { x: -0.01, y: 0.5 },
    { x: 1.01, y: 0.5 },
    { x: 0.5, y: Number.NaN },
    { x: Number.POSITIVE_INFINITY, y: 0.5 },
    { x: '0.5', y: 0.5 },
    null,
  ])('rejects invalid coordinates without clamping: %j', (point) => {
    expect(isNormalizedTacticalPoint(point)).toBe(false)
    expect(normalizedPointToStyle(point)).toBeNull()
  })

  it('resolves normalized corners against native image bounds', () => {
    expect(
      normalizedPointToNativeStyle({ x: 0, y: 0 }, nativeDimensions),
    ).toEqual({ left: '0px', top: '0px' })
    expect(
      normalizedPointToNativeStyle({ x: 1, y: 1 }, nativeDimensions),
    ).toEqual({ left: '1179px', top: '2556px' })
  })

  it('renders items inside a native-image-sized overlay surface', () => {
    const { container } = render(
      <TacticalOverlay dimensions={nativeDimensions}>
        <TacticalOverlayItem position={{ x: 0.125, y: 0.875 }}>
          <span data-testid="coordinate-proof">Development reference</span>
        </TacticalOverlayItem>
      </TacticalOverlay>,
    )

    const overlay = container.querySelector('.tactical-overlay')
    const item = screen.getByTestId('coordinate-proof').parentElement

    expect(overlay).toContainElement(item)
    expect(overlay).toHaveAttribute(
      'data-tactical-coordinate-space',
      'native-image',
    )
    expect(overlay).toHaveStyle({ height: '2556px', width: '1179px' })
    expect(item).toHaveStyle({ left: '147.375px', top: '2236.5px' })
    expect(item).toHaveAttribute('data-tactical-x', '0.125')
    expect(item).toHaveAttribute('data-tactical-y', '0.875')
  })

  it('omits an invalid overlay item instead of placing it outside the map', () => {
    render(
      <TacticalOverlay dimensions={nativeDimensions}>
        <TacticalOverlayItem position={{ x: -1, y: 2 }}>
          Invalid marker
        </TacticalOverlayItem>
      </TacticalOverlay>,
    )

    expect(screen.queryByText('Invalid marker')).not.toBeInTheDocument()
  })
})
