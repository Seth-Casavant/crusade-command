import { useEffect, useState } from 'react'

export const PUBLIC_DASHBOARD_PATH = '/'
export const STAFF_LOGIN_PATH = '/staff/login'
export const STAFF_SUBMISSIONS_PATH = '/admin/submissions'

const ALLOWED_STAFF_RETURN_PATHS = new Set([
  PUBLIC_DASHBOARD_PATH,
  STAFF_SUBMISSIONS_PATH,
])

export function staffLoginPath(returnTo = PUBLIC_DASHBOARD_PATH) {
  const safeReturnPath = ALLOWED_STAFF_RETURN_PATHS.has(returnTo)
    ? returnTo
    : PUBLIC_DASHBOARD_PATH

  return `${STAFF_LOGIN_PATH}?returnTo=${encodeURIComponent(safeReturnPath)}`
}

export function staffReturnPath(search = window.location.search) {
  const requestedPath = new URLSearchParams(search).get('returnTo')

  return requestedPath && ALLOWED_STAFF_RETURN_PATHS.has(requestedPath)
    ? requestedPath
    : PUBLIC_DASHBOARD_PATH
}

export function navigateTo(path: string) {
  const currentPath = `${window.location.pathname}${window.location.search}`

  if (currentPath === path) {
    return
  }

  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function usePathname() {
  const [location, setLocation] = useState(
    () => `${window.location.pathname}${window.location.search}`,
  )

  useEffect(() => {
    const updateLocation = () =>
      setLocation(`${window.location.pathname}${window.location.search}`)

    window.addEventListener('popstate', updateLocation)
    return () => window.removeEventListener('popstate', updateLocation)
  }, [])

  return new URL(location, window.location.origin).pathname
}
