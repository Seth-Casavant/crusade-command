import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import type { Enums } from '../../shared/types'
import { supabase } from './supabase'

export type ApplicationRole = Enums<'app_role'>
export type CommandStaffRole = Extract<
  ApplicationRole,
  'ADMINISTRATOR' | 'MODERATOR'
>

export function isCommandStaffRole(
  role: ApplicationRole | null,
): role is CommandStaffRole {
  return role === 'ADMINISTRATOR' || role === 'MODERATOR'
}

export type StaffAuthenticationErrorCode =
  | 'ACCOUNT_NOT_PROVISIONED'
  | 'OTP_RATE_LIMITED'
  | 'OTP_REQUEST_FAILED'
  | 'OTP_VERIFICATION_FAILED'

export class StaffAuthenticationError extends Error {
  constructor(
    public readonly code: StaffAuthenticationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'StaffAuthenticationError'
  }
}

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

function normalizedEmailAddress(email: string): string {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    throw new Error('Email is required.')
  }

  return normalizedEmail
}

function authErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }

  return null
}

function authErrorStatus(error: unknown): number | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }

  return null
}

function otpRequestError(error: unknown): StaffAuthenticationError {
  const code = authErrorCode(error)
  const status = authErrorStatus(error)

  if (code === 'otp_disabled' || code === 'user_not_found') {
    return new StaffAuthenticationError(
      'ACCOUNT_NOT_PROVISIONED',
      'This email is not provisioned for Crusade Command staff access.',
    )
  }

  if (status === 429 || code?.includes('rate_limit')) {
    return new StaffAuthenticationError(
      'OTP_RATE_LIMITED',
      'Too many verification codes were requested. Wait briefly and try again.',
    )
  }

  return new StaffAuthenticationError(
    'OTP_REQUEST_FAILED',
    'The authentication service could not send a verification code. Try again shortly.',
  )
}

function otpVerificationError(error: unknown): StaffAuthenticationError {
  const code = authErrorCode(error)
  const status = authErrorStatus(error)

  if (status === 429 || code?.includes('rate_limit')) {
    return new StaffAuthenticationError(
      'OTP_RATE_LIMITED',
      'Too many verification attempts were made. Wait briefly and request a new code.',
    )
  }

  return new StaffAuthenticationError(
    'OTP_VERIFICATION_FAILED',
    'The verification code is invalid or expired. Request a new code and try again.',
  )
}

export async function requestCommandStaffOtp(email: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser build.')
  }

  const normalizedEmail = normalizedEmailAddress(email)
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: false },
  })

  if (error) {
    throw otpRequestError(error)
  }

  return normalizedEmail
}

export async function verifyCommandStaffOtp(
  email: string,
  token: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser build.')
  }

  const normalizedEmail = normalizedEmailAddress(email)
  const normalizedToken = token.trim()

  if (!normalizedToken) {
    throw new Error('Verification code is required.')
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  })

  if (error || !data.session) {
    throw otpVerificationError(error)
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
