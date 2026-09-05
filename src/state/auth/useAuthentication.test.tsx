import { act, renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

import type { AuthenticationState } from '../../data/services/auth'
import {
  useAuthentication,
  type AuthenticationDependencies,
} from './useAuthentication'

const publicState: AuthenticationState = {
  status: 'public',
  session: null,
  role: null,
}

const administratorState: AuthenticationState = {
  status: 'authenticated',
  session: {
    user: { email: 'administrator@example.test' },
  } as unknown as Session,
  role: 'ADMINISTRATOR',
}

describe('useAuthentication', () => {
  it('clears privileged state when authentication expires', async () => {
    let emitState: ((state: AuthenticationState) => void) | null = null
    const dependencies: AuthenticationDependencies = {
      getState: async () => administratorState,
      subscribe: (onStateChange) => {
        emitState = onStateChange
        return () => undefined
      },
    }
    const { result } = renderHook(() => useAuthentication(dependencies))
    await waitFor(() => expect(result.current.state.role).toBe('ADMINISTRATOR'))

    act(() => emitState?.(publicState))

    expect(result.current.state).toEqual(publicState)
  })

  it('does not restore a stale privileged initial result after sign-out', async () => {
    let resolveInitial: ((state: AuthenticationState) => void) | null = null
    let emitState: ((state: AuthenticationState) => void) | null = null
    const dependencies: AuthenticationDependencies = {
      getState: () =>
        new Promise((resolve) => {
          resolveInitial = resolve
        }),
      subscribe: (onStateChange) => {
        emitState = onStateChange
        return () => undefined
      },
    }
    const { result } = renderHook(() => useAuthentication(dependencies))

    act(() => emitState?.(publicState))
    await act(async () => resolveInitial?.(administratorState))

    expect(result.current.state).toEqual(publicState)
  })

  it('fails closed when authenticated role resolution reports an error', async () => {
    let emitError: ((error: Error) => void) | null = null
    const dependencies: AuthenticationDependencies = {
      getState: async () => administratorState,
      subscribe: (_onStateChange, onError) => {
        emitError = onError
        return () => undefined
      },
    }
    const { result } = renderHook(() => useAuthentication(dependencies))
    await waitFor(() => expect(result.current.state.role).toBe('ADMINISTRATOR'))

    act(() => emitError?.(new Error('Session role expired.')))

    expect(result.current.state).toEqual(publicState)
    expect(result.current.error).toBe('Session role expired.')
  })
})
