import { render, screen } from '@testing-library/react'

import { Button } from './Button'

describe('Button', () => {
  it('applies a requested command variant', () => {
    render(<Button variant="danger">Abort mission</Button>)

    expect(screen.getByRole('button', { name: 'Abort mission' })).toHaveClass(
      'command-button--danger',
    )
  })

  it('announces and disables a loading action', () => {
    render(<Button isLoading>Apply update</Button>)

    const button = screen.getByRole('button', { name: 'Processing' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
