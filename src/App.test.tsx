import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('./pages/PlayerDashboard', () => ({
  PlayerDashboardPage: () => <div>Public dashboard route</div>,
}))

vi.mock('./pages/StaffSubmissions', () => ({
  StaffSubmissionsPage: () => <div>Protected submission route</div>,
}))

vi.mock('./pages/StaffLogin', () => ({
  StaffLoginPage: () => <div>Staff login route</div>,
}))

import { App } from './App'

describe('App routes', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('renders the public dashboard for the root route', () => {
    window.history.replaceState(null, '', '/')
    render(<App />)

    expect(screen.getByText('Public dashboard route')).toBeInTheDocument()
  })

  it('renders the protected staff submission page at /admin/submissions', () => {
    window.history.replaceState(null, '', '/admin/submissions')
    render(<App />)

    expect(screen.getByText('Protected submission route')).toBeInTheDocument()
    expect(screen.queryByText('Public dashboard route')).not.toBeInTheDocument()
  })

  it('renders the email OTP entry page at /staff/login', () => {
    window.history.replaceState(
      null,
      '',
      '/staff/login?returnTo=%2Fadmin%2Fsubmissions',
    )
    render(<App />)

    expect(screen.getByText('Staff login route')).toBeInTheDocument()
    expect(screen.queryByText('Protected submission route')).not.toBeInTheDocument()
  })
})
