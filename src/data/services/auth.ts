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

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event: AuthChangeEvent, session: Session | null) => {
      void resolveSession(session).then(onStateChange).catch(onError)
    },
  )

  return () => subscription.unsubscribe()
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
