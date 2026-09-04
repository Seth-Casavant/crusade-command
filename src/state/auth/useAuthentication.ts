import { useEffect, useState } from 'react'

import {
  getAuthenticationState,
  initialAuthenticationState,
  subscribeToAuthentication,
  type AuthenticationState,
} from '../../data/services/auth'

export function useAuthentication() {
  const [state, setState] = useState<AuthenticationState>(
    initialAuthenticationState,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const applyState = (nextState: AuthenticationState) => {
      if (isMounted) {
        setState(nextState)
        setError(null)
      }
    }

    const applyError = (authError: Error) => {
      if (isMounted) {
        setError(authError.message)
      }
    }

    void getAuthenticationState().then(applyState).catch(applyError)
    const unsubscribe = subscribeToAuthentication(applyState, applyError)

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return { state, error }
}
