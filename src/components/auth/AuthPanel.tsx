import { useState, type FormEvent } from 'react'

import {
  signInCommandStaff,
  signOutCommandStaff,
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
  const [password, setPassword] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConfigured = state.status !== 'unconfigured'
  const isAuthenticated = state.status === 'authenticated'
  const identityLabel = isAuthenticated
    ? state.role
      ? roleLabels[state.role]
      : 'Authenticated read-only viewer'
    : 'Public read-only viewer'

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)
    setIsSubmitting(true)

    try {
      await signInCommandStaff(email, password)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Sign-in failed.',
      )
    } finally {
      setPassword('')
      setIsSubmitting(false)
    }
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
      title="Phase 3 Access"
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
        <form className="auth-foundation__form" onSubmit={handleSignIn}>
          <p className="specimen-label">Command staff sign-in</p>
          <label>
            Email
            <input
              autoComplete="username"
              disabled={!isConfigured || isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              disabled={!isConfigured || isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <Button
            disabled={!isConfigured}
            isLoading={isSubmitting}
            loadingLabel="Authenticating"
            type="submit"
          >
            Authenticate
          </Button>
        </form>
      )}

      {!isConfigured && (
        <p className="auth-foundation__notice">
          Add browser-safe Supabase values to the ignored local environment file
          to enable command staff authentication.
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
