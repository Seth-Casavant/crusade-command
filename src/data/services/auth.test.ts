import { vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: null,
}))

import {
  getAuthenticationState,
  requestCommandStaffOtp,
  signOutCommandStaff,
  verifyCommandStaffOtp,
} from './auth'

describe('authentication service without browser configuration', () => {
  it('returns an explicit unconfigured read-only state', async () => {
    await expect(getAuthenticationState()).resolves.toEqual({
      status: 'unconfigured',
      session: null,
      role: null,
    })
  })

  it('does not attempt writer authentication without Supabase configuration', async () => {
    await expect(
      requestCommandStaffOtp('admin@example.test'),
    ).rejects.toThrow('Supabase is not configured')
    await expect(
      verifyCommandStaffOtp('admin@example.test', '123456'),
    ).rejects.toThrow('Supabase is not configured')
    await expect(signOutCommandStaff()).resolves.toBeUndefined()
  })
})
