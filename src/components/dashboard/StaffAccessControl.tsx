import { useState } from 'react'

import {
  isCommandStaffRole,
  signOutCommandStaff,
  type AuthenticationState,
} from '../../data/services/auth'
import { Button } from '../ui'

export type StaffAccessControlProps = {
  authentication: AuthenticationState
  onNavigateToLogin: () => void
  signOut?: typeof signOutCommandStaff
}

const staffRoleLabels = {
  ADMINISTRATOR: 'Administrator',
  MODERATOR: 'Moderator',
} as const

export function StaffAccessControl({
  authentication,
  onNavigateToLogin,
  signOut = signOutCommandStaff,
}: StaffAccessControlProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const role =
    authentication.status === 'authenticated' ? authentication.role : null
  const isStaff = isCommandStaffRole(role)

  if (authentication.status === 'loading') {
    return null
  }

  const handleSignOut = async () => {
    setError(null)
    setIsSigningOut(true)

    try {
      await signOut()
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Sign-out failed.',
      )
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <nav aria-label="Staff session" className="staff-access-control">
      {isStaff ? (
        <>
          <span className="staff-access-control__identity">
            {staffRoleLabels[role]} session
          </span>
          <Button
            isLoading={isSigningOut}
            loadingLabel="SIGNING OUT"
            onClick={() => void handleSignOut()}
            variant="secondary"
          >
            SIGN OUT
          </Button>
        </>
      ) : (
        <Button onClick={onNavigateToLogin} variant="secondary">
          STAFF ACCESS
        </Button>
      )}
      {error ? (
        <span className="staff-access-control__error" role="alert">
          {error}
        </span>
      ) : null}
    </nav>
  )
}
