import { vi } from 'vitest'

const otpMocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: otpMocks,
  },
}))

import {
  requestCommandStaffOtp,
  signOutCommandStaff,
  StaffAuthenticationError,
  verifyCommandStaffOtp,
} from './auth'

describe('command staff email OTP service', () => {
  beforeEach(() => {
    otpMocks.signInWithOtp.mockReset()
    otpMocks.signOut.mockReset()
    otpMocks.verifyOtp.mockReset()
    otpMocks.signInWithOtp.mockResolvedValue({ error: null })
    otpMocks.verifyOtp.mockResolvedValue({
      data: { session: {} },
      error: null,
    })
    otpMocks.signOut.mockResolvedValue({ error: null })
  })

  it('requests an OTP without allowing automatic user creation', async () => {
    await expect(
      requestCommandStaffOtp('  ADMINISTRATOR@Example.Test  '),
    ).resolves.toBe('administrator@example.test')

    expect(otpMocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'administrator@example.test',
      options: { shouldCreateUser: false },
    })
  })

  it('verifies a transient email code using the email OTP type', async () => {
    await verifyCommandStaffOtp('moderator@example.test', ' 123456 ')

    expect(otpMocks.verifyOtp).toHaveBeenCalledWith({
      email: 'moderator@example.test',
      token: '123456',
      type: 'email',
    })
  })

  it('returns controlled service failures without exposing provider details', async () => {
    otpMocks.signInWithOtp.mockResolvedValueOnce({
      error: new Error('provider detail'),
    })
    otpMocks.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('provider detail'),
    })

    await expect(
      requestCommandStaffOtp('administrator@example.test'),
    ).rejects.toThrow('authentication service could not send')
    await expect(
      verifyCommandStaffOtp('administrator@example.test', '123456'),
    ).rejects.toThrow('invalid or expired')
  })

  it('identifies an account that is not provisioned without exposing raw Auth details', async () => {
    otpMocks.signInWithOtp.mockResolvedValueOnce({
      error: {
        code: 'otp_disabled',
        status: 422,
        message: 'Signups not allowed for otp',
      },
    })

    await expect(
      requestCommandStaffOtp('unknown@example.test'),
    ).rejects.toMatchObject<Partial<StaffAuthenticationError>>({
      code: 'ACCOUNT_NOT_PROVISIONED',
      message: 'This email is not provisioned for Crusade Command staff access.',
    })
  })

  it('distinguishes local Auth rate limiting from an unprovisioned account', async () => {
    otpMocks.signInWithOtp.mockResolvedValueOnce({
      error: {
        code: 'over_email_send_rate_limit',
        status: 429,
        message: 'raw provider detail',
      },
    })

    await expect(
      requestCommandStaffOtp('administrator@example.test'),
    ).rejects.toMatchObject<Partial<StaffAuthenticationError>>({
      code: 'OTP_RATE_LIMITED',
    })
  })

  it('delegates sign-out to Supabase Auth', async () => {
    await signOutCommandStaff()
    expect(otpMocks.signOut).toHaveBeenCalledTimes(1)
  })
})
