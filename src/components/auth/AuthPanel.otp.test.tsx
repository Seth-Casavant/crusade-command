import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

import type { AuthenticationState } from '../../data/services/auth'

const panelMocks = vi.hoisted(() => ({
  authenticationState: {
    state: { status: 'public', session: null, role: null },
    error: null,
  } as { state: AuthenticationState; error: string | null },
  requestOtp: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('../../data/services/auth', () => ({
  requestCommandStaffOtp: panelMocks.requestOtp,
  signOutCommandStaff: panelMocks.signOut,
  verifyCommandStaffOtp: panelMocks.verifyOtp,
}))

vi.mock('../../state/auth/useAuthentication', () => ({
  useAuthentication: () => panelMocks.authenticationState,
}))

import { AuthPanel } from './AuthPanel'

describe('AuthPanel email OTP flow', () => {
  beforeEach(() => {
    panelMocks.authenticationState = {
      state: { status: 'public', session: null, role: null },
      error: null,
    }
    panelMocks.requestOtp.mockReset()
    panelMocks.verifyOtp.mockReset()
    panelMocks.signOut.mockReset()
    panelMocks.requestOtp.mockResolvedValue('administrator@example.test')
    panelMocks.verifyOtp.mockResolvedValue(undefined)
    panelMocks.signOut.mockResolvedValue(undefined)
  })

  it('requests and verifies an email OTP without a password field', async () => {
    render(<AuthPanel />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'administrator@example.test' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send verification code' }),
    )

    await waitFor(() =>
      expect(panelMocks.requestOtp).toHaveBeenCalledWith(
        'administrator@example.test',
      ),
    )
    expect(await screen.findByLabelText('One-time code')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    )
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('One-time code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))

    await waitFor(() =>
      expect(panelMocks.verifyOtp).toHaveBeenCalledWith(
        'administrator@example.test',
        '123456',
      ),
    )
  })

  it.each([
    ['ADMINISTRATOR', 'Administrator'],
    ['MODERATOR', 'Moderator'],
  ] as const)('presents a resolved %s role', (role, label) => {
    panelMocks.authenticationState = {
      state: {
        status: 'authenticated',
        session: {
          user: { email: `${role.toLowerCase()}@example.test` },
        } as unknown as Session,
        role,
      },
      error: null,
    }

    render(<AuthPanel />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
