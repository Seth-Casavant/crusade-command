import { render, screen, waitFor } from '@testing-library/react'

import { AuthPanel } from './AuthPanel'

describe('AuthPanel', () => {
  it('defaults to the safe public read-only identity', async () => {
    render(<AuthPanel />)

    await waitFor(() => {
      expect(screen.getByText('Public read-only viewer')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Send verification code' }),
    ).toBeDisabled()
  })

  it('explains that only browser-safe local configuration enables sign-in', async () => {
    render(<AuthPanel />)

    expect(
      await screen.findByText(/browser-safe Supabase values/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    )
  })
})
