import { render, screen } from '@testing-library/react'

import { ProgressMeter } from './ProgressMeter'

describe('ProgressMeter', () => {
  it('presents both the numeric and visual value', () => {
    render(<ProgressMeter value={67} />)

    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Crusade progress' }),
    ).toHaveAttribute('aria-valuenow', '67')
  })

  it('constrains values to the supported range', () => {
    render(<ProgressMeter value={140} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })
})
