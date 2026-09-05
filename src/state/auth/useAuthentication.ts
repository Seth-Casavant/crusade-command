import { useEffect, useState } from 'react'

import {
  getAuthenticationState,
  initialAuthenticationState,
  subscribeToAuthentication,
  type AuthenticationState,
} from '../../data/services/auth'

export type AuthenticationDependencies = {
  getState: () => Promise<AuthenticationState>
  subscribe: (
    onStateChange: (state: AuthenticationState) => void,
    onError: (error: Error) => void,
  ) => () => void
}

const defaultDependencies: AuthenticationDependencies = {
  getState: getAuthenticationState,
  subscribe: subscribeToAuthentication,
}

export function useAuthentication(dependencies = defaultDependencies) {
  const [state, setState] = useState<AuthenticationState>(
    initialAuthenticationState,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let subscriptionRevision = 0

    const applyState = (nextState: AuthenticationState) => {
      if (isMounted) {
        setState(nextState)
        setError(null)
      }
    }

    const applyError = (authError: Error) => {
      if (isMounted) {
        setState((currentState) =>
          currentState.status === 'unconfigured'
            ? currentState
            : { status: 'public', session: null, role: null },
        )
        setError(authError.message)
      }
    }

    const applySubscriptionState = (nextState: AuthenticationState) => {
      subscriptionRevision += 1
      applyState(nextState)
    }
    const initialRevision = subscriptionRevision
    const unsubscribe = dependencies.subscribe(
      applySubscriptionState,
      applyError,
    )

    void dependencies
      .getState()
      .then((nextState) => {
        if (subscriptionRevision === initialRevision) {
          applyState(nextState)
        }
      })
      .catch(applyError)

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [dependencies])

  return { state, error }
}
