import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

import type { AuthPanelAuthentication } from '../components/auth/AuthPanel'
import { StaffAuthenticationError } from '../data/services/auth'
import { StaffLoginRoute } from './StaffLogin'

const publicAuthentication: AuthPanelAuthentication = {
  state: { status: 'public', session: null, role: null },
  error: null,
}

function staffAuthentication(
  role: 'ADMINISTRATOR' | 'MODERATOR' | 'PLAYER',
): AuthPanelAuthentication {
  return {
    state: {
      status: 'authenticated',
      session: {
        user: { email: `${role.toLowerCase()}@example.test` },
      } as unknown as Session,
      role,
    },
    error: null,
  }
}

describe('StaffLoginRoute', () => {
  it('renders and completes the existing email OTP request flow', async () => {
    const requestOtp = vi.fn(async () => 'administrator@example.test')
    const verifyOtp = vi.fn(async () => undefined)
    render(
      <StaffLoginRoute
        authentication={publicAuthentication}
        requestOtp={requestOtp}
        returnTo="/"
        verifyOtp={verifyOtp}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Staff Access' })).toBeInTheDocument()
    expect(
      screen.getByText('administrator@crusade-command.invalid'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'administrator@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }))
    await waitFor(() =>
      expect(requestOtp).toHaveBeenCalledWith('administrator@example.test'),
    )

    fireEvent.change(await screen.findByLabelText('One-time code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith(
        'administrator@example.test',
        '123456',
      ),
    )
  })

  it('explains when a local email is not provisioned without exposing provider details', async () => {
    const requestOtp = vi.fn(async () => {
      throw new StaffAuthenticationError(
        'ACCOUNT_NOT_PROVISIONED',
        'This email is not provisioned for Crusade Command staff access.',
      )
    })
    render(
      <StaffLoginRoute
        authentication={publicAuthentication}
        requestOtp={requestOtp}
        returnTo="/"
      />,
    )

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'unknown@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'This email is not provisioned for Crusade Command staff access.',
    )
    expect(screen.queryByText('Signups not allowed for otp')).not.toBeInTheDocument()
  })

  it.each(['ADMINISTRATOR', 'MODERATOR'] as const)(
    'redirects an authorized %s to the requested staff route',
    async (role) => {
      const onAuthorizedRedirect = vi.fn()
      render(
        <StaffLoginRoute
          authentication={staffAuthentication(role)}
          onAuthorizedRedirect={onAuthorizedRedirect}
          returnTo="/admin/submissions"
        />,
      )

      expect(
        screen.getByRole('heading', { name: 'Staff Access Confirmed' }),
      ).toBeInTheDocument()
      await waitFor(() =>
        expect(onAuthorizedRedirect).toHaveBeenCalledWith('/admin/submissions'),
      )
    },
  )

  it('returns to the intended route after an OTP-authenticated role resolves', async () => {
    const onAuthorizedRedirect = vi.fn()
    const { rerender } = render(
      <StaffLoginRoute
        authentication={publicAuthentication}
        onAuthorizedRedirect={onAuthorizedRedirect}
        returnTo="/admin/submissions"
      />,
    )

    expect(onAuthorizedRedirect).not.toHaveBeenCalled()
    rerender(
      <StaffLoginRoute
        authentication={staffAuthentication('ADMINISTRATOR')}
        onAuthorizedRedirect={onAuthorizedRedirect}
        returnTo="/admin/submissions"
      />,
    )

    await waitFor(() =>
      expect(onAuthorizedRedirect).toHaveBeenCalledWith('/admin/submissions'),
    )
  })

  it('denies an authenticated Player and allows sign-out', async () => {
    const signOut = vi.fn(async () => undefined)
    render(
      <StaffLoginRoute
        authentication={staffAuthentication('PLAYER')}
        returnTo="/admin/submissions"
        signOut={signOut}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
  })
})
