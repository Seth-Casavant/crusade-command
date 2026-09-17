import {
  navigateTo,
  PUBLIC_DASHBOARD_PATH,
  staffLoginPath,
  staffReturnPath,
  STAFF_SUBMISSIONS_PATH,
} from './navigation'

describe('application navigation', () => {
  afterEach(() => {
    window.history.replaceState(null, '', PUBLIC_DASHBOARD_PATH)
  })

  it('navigates to the protected staff submission route', () => {
    navigateTo(STAFF_SUBMISSIONS_PATH)

    expect(window.location.pathname).toBe('/admin/submissions')
  })

  it('preserves an approved staff return route through login', () => {
    const path = staffLoginPath(STAFF_SUBMISSIONS_PATH)
    navigateTo(path)

    expect(window.location.pathname).toBe('/staff/login')
    expect(staffReturnPath(window.location.search)).toBe(
      '/admin/submissions',
    )
  })

  it('rejects an unapproved return target', () => {
    expect(staffLoginPath('https://attacker.example.test')).toBe(
      '/staff/login?returnTo=%2F',
    )
    expect(staffReturnPath('?returnTo=https://attacker.example.test')).toBe('/')
  })
})
