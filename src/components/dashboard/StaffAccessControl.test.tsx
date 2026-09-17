import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

import type { AuthenticationState } from '../../data/services/auth'
import { StaffAccessControl } from './StaffAccessControl'

const publicAuthentication: AuthenticationState = {
  status: 'public',
  session: null,
  role: null,
}

function authenticated(role: 'ADMINISTRATOR' | 'MODERATOR' | 'PLAYER') {
  return {
    status: 'authenticated',
    session: { user: { email: `${role.toLowerCase()}@example.test` } } as Session,
    role,
  } satisfies AuthenticationState
}

describe('StaffAccessControl', () => {
  it('shows the restrained STAFF ACCESS entry for public viewers', () => {
    const onNavigateToLogin = vi.fn()
    render(
      <StaffAccessControl
        authentication={publicAuthentication}
        onNavigateToLogin={onNavigateToLogin}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'STAFF ACCESS' }))
    expect(onNavigateToLogin).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'SIGN OUT' })).not.toBeInTheDocument()
  })

  it.each([
    ['ADMINISTRATOR', 'Administrator session'],
    ['MODERATOR', 'Moderator session'],
  ] as const)('shows authenticated staff controls for %s', (role, label) => {
    render(
      <StaffAccessControl
        authentication={authenticated(role)}
        onNavigateToLogin={vi.fn()}
        signOut={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SIGN OUT' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'STAFF ACCESS' })).not.toBeInTheDocument()
  })

  it('signs out and returns to the public entry state after auth state clears', async () => {
    const signOut = vi.fn(async () => undefined)
    const { rerender } = render(
      <StaffAccessControl
        authentication={authenticated('ADMINISTRATOR')}
        onNavigateToLogin={vi.fn()}
        signOut={signOut}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'SIGN OUT' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))

    rerender(
      <StaffAccessControl
        authentication={publicAuthentication}
        onNavigateToLogin={vi.fn()}
        signOut={signOut}
      />,
    )
    expect(screen.getByRole('button', { name: 'STAFF ACCESS' })).toBeInTheDocument()
    expect(screen.queryByText('Administrator session')).not.toBeInTheDocument()
  })

  it('does not present an ordinary Player as command staff', () => {
    render(
      <StaffAccessControl
        authentication={authenticated('PLAYER')}
        onNavigateToLogin={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'STAFF ACCESS' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SIGN OUT' })).not.toBeInTheDocument()
  })
})
