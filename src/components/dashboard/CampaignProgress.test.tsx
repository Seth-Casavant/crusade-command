import { render, screen } from '@testing-library/react'

import { CampaignProgress } from './CampaignProgress'

describe('CampaignProgress', () => {
  it.each([0, 24, -3])(
    'renders %s authoritative Crusade points without inventing a target',
    (value) => {
      render(<CampaignProgress value={value} />)

      expect(
        screen.getByRole('group', { name: 'Current Crusade points' }),
      ).toHaveTextContent(String(value))
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(screen.queryByText(`${value}%`)).not.toBeInTheDocument()
    },
  )

  it.each([
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [1.5, 0],
  ])('normalizes unsupported value %s to %s', (value, expected) => {
    render(<CampaignProgress value={value} />)

    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent(String(expected))
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  })
})
