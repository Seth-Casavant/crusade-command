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

  it('returns controlled failures without exposing provider details', async () => {
    otpMocks.signInWithOtp.mockResolvedValueOnce({
      error: new Error('provider detail'),
    })
    otpMocks.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('provider detail'),
    })

    await expect(
      requestCommandStaffOtp('administrator@example.test'),
    ).rejects.toThrow('verification code could not be requested')
    await expect(
      verifyCommandStaffOtp('administrator@example.test', '123456'),
    ).rejects.toThrow('Verification failed')
  })

  it('delegates sign-out to Supabase Auth', async () => {
    await signOutCommandStaff()
    expect(otpMocks.signOut).toHaveBeenCalledTimes(1)
  })
})
