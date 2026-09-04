import { render, screen } from '@testing-library/react'

import { DevelopmentHome } from './DevelopmentHome'

describe('DevelopmentHome', () => {
  it('confirms that the styled Phase 4 foundation is ready', () => {
    render(<DevelopmentHome />)

    expect(
      screen.getByRole('heading', { name: 'Crusade Command' }),
    ).toBeInTheDocument()
    expect(screen.getByText('System status: Ready')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Phase 4 Foundation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('React + TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Supabase Auth foundation')).toBeInTheDocument()
    expect(
      screen.getByText('Revision-based synchronization'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Phase 3 Access' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Campaign Synchronization' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '67',
    )
  })
})
