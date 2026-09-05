import { render, screen } from '@testing-library/react'

import { CampaignProgress } from './CampaignProgress'

describe('CampaignProgress', () => {
  it.each([0, 1, 50, 99, 100])(
    'renders %s percent numerically and visually',
    (value) => {
      render(<CampaignProgress value={value} />)

      expect(screen.getByText(`${value}%`)).toBeInTheDocument()
      expect(
        screen.getByRole('progressbar', { name: 'Campaign progress' }),
      ).toHaveAttribute('aria-valuenow', String(value))
    },
  )

  it.each([
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [-1, 0],
    [101, 100],
  ])('normalizes unsupported value %s to %s', (value, expected) => {
    render(<CampaignProgress value={value} />)

    expect(screen.getByText(`${expected}%`)).toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      String(expected),
    )
  })
})
