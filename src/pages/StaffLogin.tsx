import { useEffect } from 'react'

import {
  AuthPanelView,
  type AuthPanelAuthentication,
  type AuthPanelViewProps,
} from '../components/auth/AuthPanel'
import { Button } from '../components/ui'
import { isCommandStaffRole } from '../data/services/auth'
import {
  navigateTo,
  PUBLIC_DASHBOARD_PATH,
  staffReturnPath,
} from '../navigation'
import { useAuthentication } from '../state/auth/useAuthentication'

export type StaffLoginRouteProps = {
  authentication: AuthPanelAuthentication
  returnTo: string
  onAuthorizedRedirect?: (path: string) => void
  onReturnToDashboard?: () => void
  requestOtp?: AuthPanelViewProps['requestOtp']
  signOut?: AuthPanelViewProps['signOut']
  verifyOtp?: AuthPanelViewProps['verifyOtp']
}

export function StaffLoginRoute({
  authentication,
  returnTo,
  onAuthorizedRedirect = navigateTo,
  onReturnToDashboard = () => navigateTo(PUBLIC_DASHBOARD_PATH),
  requestOtp,
  signOut,
  verifyOtp,
}: StaffLoginRouteProps) {
  const isAuthorized =
    authentication.state.status === 'authenticated' &&
    isCommandStaffRole(authentication.state.role)

  useEffect(() => {
    if (isAuthorized) {
      onAuthorizedRedirect(returnTo)
    }
  }, [isAuthorized, onAuthorizedRedirect, returnTo])

  if (authentication.state.status === 'loading') {
    return (
      <main className="staff-login">
        <section aria-live="polite" className="staff-login__state">
          <p>Identity verification</p>
          <h1>Checking Staff Session</h1>
          <span>Resolving command authorization from the database.</span>
        </section>
      </main>
    )
  }

  if (isAuthorized) {
    return (
      <main className="staff-login">
        <section aria-live="polite" className="staff-login__state">
          <p>Identity verified</p>
          <h1>Staff Access Confirmed</h1>
          <span>Returning to the requested command interface.</span>
        </section>
      </main>
    )
  }

  const isDenied = authentication.state.status === 'authenticated'

  return (
    <main className="staff-login">
      <div className="staff-login__shell">
        <header className="staff-login__header">
          <div>
            <p>Crusade Command / Identity gate</p>
            <h1>Staff Access</h1>
          </div>
          <Button onClick={onReturnToDashboard} variant="secondary">
            Return to Dashboard
          </Button>
        </header>

        {import.meta.env.DEV && !isDenied ? (
          <aside className="staff-login__local-guidance">
            <h2>Local development identities</h2>
            <p>
              Clean resets deterministically provision these sandbox-only Auth
              identities and database roles:
            </p>
            <ul>
              <li>
                Administrator:{' '}
                <code>administrator@crusade-command.invalid</code>
              </li>
              <li>
                Moderator: <code>moderator@crusade-command.invalid</code>
              </li>
            </ul>
            <p>
              Verification codes are delivered to the{' '}
              <a
                href="http://127.0.0.1:54324"
                rel="noreferrer"
                target="_blank"
              >
                local mail catcher
              </a>
              . Production accounts must still be explicitly provisioned.
            </p>
          </aside>
        ) : null}

        {isDenied ? (
          <p className="staff-login__denied" role="alert">
            Access denied. This authenticated account is not assigned an
            Administrator or Moderator role.
          </p>
        ) : null}

        <AuthPanelView
          authentication={authentication}
          requestOtp={requestOtp}
          signOut={signOut}
          verifyOtp={verifyOtp}
        />
      </div>
    </main>
  )
}

export function StaffLoginPage() {
  const authentication = useAuthentication()

  return (
    <StaffLoginRoute
      authentication={authentication}
      returnTo={staffReturnPath()}
    />
  )
}
