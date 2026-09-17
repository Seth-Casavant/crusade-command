import {
  STAFF_LOGIN_PATH,
  STAFF_SUBMISSIONS_PATH,
  usePathname,
} from './navigation'
import { PlayerDashboardPage } from './pages/PlayerDashboard'
import { StaffLoginPage } from './pages/StaffLogin'
import { StaffSubmissionsPage } from './pages/StaffSubmissions'

export function App() {
  const pathname = usePathname()

  if (pathname === STAFF_SUBMISSIONS_PATH) {
    return <StaffSubmissionsPage />
  }

  if (pathname === STAFF_LOGIN_PATH) {
    return <StaffLoginPage />
  }

  return <PlayerDashboardPage />
}
