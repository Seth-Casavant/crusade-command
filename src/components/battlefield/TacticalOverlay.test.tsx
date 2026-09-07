import { render, screen } from '@testing-library/react'

import {
  TacticalOverlay,
  TacticalOverlayItem,
  isNormalizedTacticalPoint,
  normalizedPointToStyle,
} from './index'

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

  it('renders items inside one generic overlay surface', () => {
    const { container } = render(
      <TacticalOverlay>
        <TacticalOverlayItem position={{ x: 0.125, y: 0.875 }}>
          <span data-testid="coordinate-proof">Development reference</span>
        </TacticalOverlayItem>
      </TacticalOverlay>,
    )

    const overlay = container.querySelector('.tactical-overlay')
    const item = screen.getByTestId('coordinate-proof').parentElement

    expect(overlay).toContainElement(item)
    expect(item).toHaveStyle({ left: '12.5%', top: '87.5%' })
    expect(item).toHaveAttribute('data-tactical-x', '0.125')
    expect(item).toHaveAttribute('data-tactical-y', '0.875')
  })

  it('omits an invalid overlay item instead of placing it outside the map', () => {
    render(
      <TacticalOverlay>
        <TacticalOverlayItem position={{ x: -1, y: 2 }}>
          Invalid marker
        </TacticalOverlayItem>
      </TacticalOverlay>,
    )

    expect(screen.queryByText('Invalid marker')).not.toBeInTheDocument()
  })
})
