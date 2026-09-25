import {
  STAFF_LOGIN_PATH,
  STAFF_SUBMISSIONS_PATH,
  WELCOME_PATH,
  usePathname,
} from './navigation'
import { PlayerDashboardPage } from './pages/PlayerDashboard'
import { StaffLoginPage } from './pages/StaffLogin'
import { StaffSubmissionsPage } from './pages/StaffSubmissions'
import { WelcomePage } from './pages/Welcome'

export function App() {
  const pathname = usePathname()

  if (pathname === WELCOME_PATH) {
    return <WelcomePage />
  }

  if (pathname === STAFF_SUBMISSIONS_PATH) {
    return <StaffSubmissionsPage />
  }

  if (pathname === STAFF_LOGIN_PATH) {
    return <StaffLoginPage />
  }

  return <PlayerDashboardPage />
}
