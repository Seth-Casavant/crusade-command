import { render, screen } from '@testing-library/react'

import { NoActiveCrusade } from './NoActiveCrusade'

describe('NoActiveCrusade', () => {
  it('renders an accessible and deliberate empty operation state', () => {
    render(<NoActiveCrusade />)

    expect(
      screen.getByRole('region', { name: 'No Active Operation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'No Active Operation',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Awaiting deployment orders.')).toBeInTheDocument()
  })
})
