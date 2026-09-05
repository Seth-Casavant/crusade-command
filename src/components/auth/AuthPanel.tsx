import { useState, type FormEvent } from 'react'

import {
  requestCommandStaffOtp,
  signOutCommandStaff,
  verifyCommandStaffOtp,
} from '../../data/services/auth'
import { useAuthentication } from '../../state/auth/useAuthentication'
import { Button, Panel, StatusBadge } from '../ui'

const roleLabels = {
  ADMINISTRATOR: 'Administrator',
  MODERATOR: 'Moderator',
  PLAYER: 'Player / read-only',
} as const

export function AuthPanel() {
  const { state, error: sessionError } = useAuthentication()
  const [email, setEmail] = useState('')
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConfigured = state.status !== 'unconfigured'
  const isAuthenticated = state.status === 'authenticated'
  const identityLabel = isAuthenticated
    ? state.role
      ? roleLabels[state.role]
      : 'Authenticated read-only viewer'
    : 'Public read-only viewer'

  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)
    setActionMessage(null)
    setIsSubmitting(true)

    try {
      const normalizedEmail = await requestCommandStaffOtp(email)
      setEmail(normalizedEmail)
      setRequestedEmail(normalizedEmail)
      setActionMessage(
        'If this is a provisioned command-staff account, a one-time code has been sent.',
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'A verification code could not be requested.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)
    setActionMessage(null)
    setIsSubmitting(true)

    try {
      await verifyCommandStaffOtp(requestedEmail ?? email, verificationCode)
      setVerificationCode('')
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Verification failed.',
      )
      setVerificationCode('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetOtpRequest = () => {
    setRequestedEmail(null)
    setVerificationCode('')
    setActionError(null)
    setActionMessage(null)
  }

  const handleSignOut = async () => {
    setActionError(null)
    setIsSubmitting(true)

    try {
      await signOutCommandStaff()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Sign-out failed.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Panel
      className="auth-foundation-panel"
      eyebrow="Identity boundary"
      footer="Database authorization remains authoritative"
      title="Command Staff Access"
    >
      <div className="auth-foundation__identity">
        <StatusBadge
          status={isAuthenticated ? 'secured' : 'locked'}
          label={identityLabel}
        />
        <p>
          Public viewers receive only published ACTIVE mission information.
          Command staff permissions are resolved from protected database roles.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="auth-foundation__authenticated">
          <p className="auth-foundation__account">
            {state.session.user.email ?? 'Authenticated Supabase identity'}
          </p>
          <Button
            isLoading={isSubmitting}
            loadingLabel="Signing out"
            onClick={() => void handleSignOut()}
            variant="secondary"
          >
            Sign out
          </Button>
        </div>
      ) : (
        requestedEmail ? (
          <form className="auth-foundation__form" onSubmit={handleVerifyOtp}>
            <p className="specimen-label">Verify command staff email</p>
            <p className="auth-foundation__otp-recipient">
              Enter the code sent to {requestedEmail}.
            </p>
            <label>
              One-time code
              <input
                autoComplete="one-time-code"
                disabled={!isConfigured || isSubmitting}
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setVerificationCode(event.target.value)}
                pattern="[0-9]*"
                type="text"
                value={verificationCode}
              />
            </label>
            <Button
              disabled={!isConfigured}
              isLoading={isSubmitting}
              loadingLabel="Verifying"
              type="submit"
            >
              Verify code
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={resetOtpRequest}
              variant="secondary"
            >
              Use a different email
            </Button>
          </form>
        ) : (
          <form className="auth-foundation__form" onSubmit={handleRequestOtp}>
            <p className="specimen-label">Command staff email OTP</p>
            <label>
              Email
              <input
                autoComplete="email"
                disabled={!isConfigured || isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <Button
              disabled={!isConfigured}
              isLoading={isSubmitting}
              loadingLabel="Requesting code"
              type="submit"
            >
              Send verification code
            </Button>
          </form>
        )
      )}

      {!isConfigured && (
        <p className="auth-foundation__notice">
          Add browser-safe Supabase values to the ignored local environment file
          to enable command staff authentication.
        </p>
      )}

      {actionMessage && (
        <p className="auth-foundation__notice" role="status">
          {actionMessage}
        </p>
      )}

      {(sessionError || actionError) && (
        <p className="auth-foundation__error" role="alert">
          {sessionError ?? actionError}
        </p>
      )}
    </Panel>
  )
}
