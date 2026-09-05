import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  callback: null as
    | ((event: AuthChangeEvent, session: Session | null) => void)
    | null,
  onAuthStateChange: vi.fn(),
  resolveRole: null as
    | ((result: { data: 'ADMINISTRATOR'; error: null }) => void)
    | null,
  rpc: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: authMocks.onAuthStateChange,
    },
    rpc: authMocks.rpc,
  },
}))

import { subscribeToAuthentication } from './auth'

const session = {
  user: { email: 'administrator@example.test' },
} as unknown as Session

describe('authentication subscription safety', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authMocks.callback = null
    authMocks.resolveRole = null
    authMocks.unsubscribe.mockReset()
    authMocks.rpc.mockReset()
    authMocks.onAuthStateChange.mockReset()
    authMocks.onAuthStateChange.mockImplementation((callback) => {
      authMocks.callback = callback
      return { data: { subscription: { unsubscribe: authMocks.unsubscribe } } }
    })
    authMocks.rpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          authMocks.resolveRole = resolve
        }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not restore writer state from a role lookup that resolves after sign-out', async () => {
    const onStateChange = vi.fn()
    const onError = vi.fn()
    const unsubscribe = subscribeToAuthentication(onStateChange, onError)

    authMocks.callback?.('SIGNED_IN', session)
    await vi.runOnlyPendingTimersAsync()
    expect(authMocks.rpc).toHaveBeenCalledWith('current_app_role')

    authMocks.callback?.('SIGNED_OUT', null)
    expect(onStateChange).toHaveBeenCalledWith({
      status: 'public',
      session: null,
      role: null,
    })

    authMocks.resolveRole?.({ data: 'ADMINISTRATOR', error: null })
    await Promise.resolve()

    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    unsubscribe()
    expect(authMocks.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
