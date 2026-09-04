import {
  getAuthenticationState,
  signInCommandStaff,
  signOutCommandStaff,
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
      signInCommandStaff('admin@example.test', 'not-stored'),
    ).rejects.toThrow('Supabase is not configured')
    await expect(signOutCommandStaff()).resolves.toBeUndefined()
  })
})
