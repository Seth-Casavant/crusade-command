import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import type { Enums } from '../../shared/types'
import { supabase } from './supabase'

export type ApplicationRole = Enums<'app_role'>

export type AuthenticationState =
  | {
      status: 'loading'
      session: null
      role: null
    }
  | {
      status: 'unconfigured' | 'public'
      session: null
      role: null
    }
  | {
      status: 'authenticated'
      session: Session
      role: ApplicationRole | null
    }

export const initialAuthenticationState: AuthenticationState = {
  status: supabase ? 'loading' : 'unconfigured',
  session: null,
  role: null,
}

async function resolveSession(
  session: Session | null,
): Promise<AuthenticationState> {
  if (!supabase) {
    return { status: 'unconfigured', session: null, role: null }
  }

  if (!session) {
    return { status: 'public', session: null, role: null }
  }

  const { data: role, error } = await supabase.rpc('current_app_role')

  if (error) {
    throw new Error('The authenticated application role could not be loaded.')
  }

  return { status: 'authenticated', session, role }
}

export async function getAuthenticationState(): Promise<AuthenticationState> {
  if (!supabase) {
    return { status: 'unconfigured', session: null, role: null }
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error('The current Supabase session could not be loaded.')
  }

  return resolveSession(data.session)
}

export function subscribeToAuthentication(
  onStateChange: (state: AuthenticationState) => void,
  onError: (error: Error) => void,
) {
  if (!supabase) {
    return () => undefined
  }

  let isActive = true
  let eventRevision = 0
  let pendingResolution: ReturnType<typeof setTimeout> | null = null

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, session: Session | null) => {
      eventRevision += 1
      const currentRevision = eventRevision

      if (pendingResolution !== null) {
        clearTimeout(pendingResolution)
        pendingResolution = null
      }

      if (!session) {
        onStateChange({ status: 'public', session: null, role: null })
        return
      }

      // Defer database work until after Supabase releases its auth callback.
      // The revision guard prevents a delayed role lookup from restoring writer
      // state after a later SIGNED_OUT or token-expiration event.
      pendingResolution = setTimeout(() => {
        pendingResolution = null
        void resolveSession(session)
          .then((state) => {
            if (isActive && currentRevision === eventRevision) {
              onStateChange(state)
            }
          })
          .catch((error: unknown) => {
            if (isActive && currentRevision === eventRevision) {
              onError(
                error instanceof Error
                  ? error
                  : new Error('Authentication state resolution failed.'),
              )
            }
          })
      }, 0)
    },
  )

  return () => {
    isActive = false
    eventRevision += 1

    if (pendingResolution !== null) {
      clearTimeout(pendingResolution)
    }

    subscription.unsubscribe()
  }
}

export async function signInCommandStaff(
  email: string,
  password: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser build.')
  }

  const normalizedEmail = email.trim()

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    throw new Error('Sign-in failed. Verify the command staff credentials.')
  }
}

export async function signOutCommandStaff(): Promise<void> {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error('Sign-out failed. Please try again.')
  }
}
