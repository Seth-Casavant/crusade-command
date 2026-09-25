import {
  navigateTo,
  PUBLIC_DASHBOARD_PATH,
  staffLoginPath,
  staffReturnPath,
  staffSubmissionReceipt,
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
      '/staff/login?returnTo=%2Fdashboard',
    )
    expect(staffReturnPath('?returnTo=https://attacker.example.test')).toBe(PUBLIC_DASHBOARD_PATH)
  })

  it('preserves a validated receipt deep link through staff authentication', () => {
    const returnTo = '/admin/submissions?receipt=CR-00482'

    expect(staffLoginPath(returnTo)).toBe(
      '/staff/login?returnTo=%2Fadmin%2Fsubmissions%3Freceipt%3DCR-00482',
    )
    expect(
      staffReturnPath(`?returnTo=${encodeURIComponent(returnTo)}`),
    ).toBe(returnTo)
    expect(
      staffReturnPath(
        '?returnTo=%2Fadmin%2Fsubmissions%3Freceipt%3D..%252Fprivate',
      ),
    ).toBe(PUBLIC_DASHBOARD_PATH)
  })

  it('accepts only authoritative receipt references for staff deep links', () => {
    expect(staffSubmissionReceipt('?receipt=CR-00482')).toBe('CR-00482')
    expect(staffSubmissionReceipt('?receipt=../../private')).toBeNull()
    expect(staffSubmissionReceipt('?receipt=CRS-00482')).toBeNull()
  })
})
