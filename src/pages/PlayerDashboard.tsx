import {
  KillTeamBattlefieldPresentation,
} from '../components/battlefield'
import {
  CampaignProgress,
  ConnectionIndicator,
  CrusadeHeader,
  FriendlyForcesPanel,
  MissionSummary,
  NoActiveCrusade,
  ObjectivePanel,
  StaffAccessControl,
  SubmissionReviewControl,
  SynchronizationStatus,
  ThreatPanel,
} from '../components/dashboard'
import { Button } from '../components/ui'
import type { AuthenticationState } from '../data/services/auth'
import type { SyncErrorCode } from '../data/services/publicCampaign'
import {
  navigateTo,
  STAFF_SUBMISSIONS_PATH,
  staffLoginPath,
} from '../navigation'
import { useAuthentication } from '../state/auth/useAuthentication'
import {
  useCampaignSynchronization,
  type CampaignSynchronizationState,
} from '../state/campaignSync/useCampaignSynchronization'

export type PlayerDashboardSynchronization = CampaignSynchronizationState & {
  isConfigured: boolean
  manualResynchronize: () => Promise<void>
}

export type PlayerDashboardProps = {
  synchronization: PlayerDashboardSynchronization
  authentication?: AuthenticationState
  onNavigateToStaffLogin?: () => void
  onNavigateToSubmissions?: () => void
}

const publicAuthentication: AuthenticationState = {
  status: 'public',
  session: null,
  role: null,
}

const retainedStateMessages: Record<SyncErrorCode, string> = {
  AUTH_EXPIRED:
    'Command access expired. The public campaign view remains available.',
  NETWORK_UNAVAILABLE:
    'The campaign link is unavailable. Showing the last confirmed operational state.',
  PUBLIC_STATE_FETCH_FAILED:
    'The campaign state could not be refreshed. Showing the last confirmed operational state.',
  PUBLIC_STATE_INVALID:
    'The latest campaign transmission could not be verified. Showing the last confirmed operational state.',
  REALTIME_DISCONNECTED:
    'The live campaign link is interrupted. Showing the last confirmed operational state.',
  RESYNC_FAILED:
    'Campaign resynchronization failed. Showing the last confirmed operational state.',
}

function SystemFooter() {
  return (
    <footer className="player-dashboard__footer">
      <span>Public operations feed</span>
      <span>Read-only campaign state</span>
    </footer>
  )
}

function InitialLoading({
  connectionStatus,
}: Pick<PlayerDashboardSynchronization, 'connectionStatus'>) {
  return (
    <section
      aria-busy="true"
      aria-labelledby="dashboard-loading-title"
      aria-live="polite"
      className="dashboard-state dashboard-state--loading"
    >
      <p className="dashboard-state__eyebrow">Crusade Command</p>
      <h1 id="dashboard-loading-title">Receiving Crusade Data...</h1>
      <p>Establishing an authoritative campaign link.</p>
      <ConnectionIndicator showDetail={false} status={connectionStatus} />
    </section>
  )
}

function InitialError({
  connectionStatus,
  isConfigured,
  isResynchronizing,
  manualResynchronize,
}: Pick<
  PlayerDashboardSynchronization,
  | 'connectionStatus'
  | 'isConfigured'
  | 'isResynchronizing'
  | 'manualResynchronize'
>) {
  return (
    <section
      aria-labelledby="dashboard-error-title"
      className="dashboard-state dashboard-state--error"
      role="alert"
    >
      <p className="dashboard-state__eyebrow">Crusade Command</p>
      <h1 id="dashboard-error-title">Crusade Data Unavailable</h1>
      <p>Unable to retrieve current operational state.</p>
      <ConnectionIndicator showDetail={false} status={connectionStatus} />
      <Button
        disabled={!isConfigured || isResynchronizing}
        isLoading={isResynchronizing}
        loadingLabel="Retrying"
        onClick={() => void manualResynchronize()}
      >
        Retry
      </Button>
    </section>
  )
}

export function PlayerDashboard({
  synchronization,
  authentication = publicAuthentication,
  onNavigateToStaffLogin = () => navigateTo(staffLoginPath()),
  onNavigateToSubmissions = () => navigateTo(STAFF_SUBMISSIONS_PATH),
}: PlayerDashboardProps) {
  const {
    campaign,
    connectionStatus,
    errorCode,
    isConfigured,
    isResynchronizing,
    lastSynchronizedAt,
    manualResynchronize,
  } = synchronization
  const isAwaitingInitialState =
    isConfigured &&
    campaign === null &&
    lastSynchronizedAt === null &&
    errorCode === null
  const hasInitialFailure =
    campaign === null &&
    lastSynchronizedAt === null &&
    (errorCode !== null || !isConfigured)
  const staffRole =
    authentication.status === 'authenticated' ? authentication.role : null

  return (
    <main className="player-dashboard">
      <div className="player-dashboard__shell">
        <StaffAccessControl
          authentication={authentication}
          onNavigateToLogin={onNavigateToStaffLogin}
        />
        {isAwaitingInitialState ? (
          <InitialLoading connectionStatus={connectionStatus} />
        ) : hasInitialFailure ? (
          <InitialError
            connectionStatus={connectionStatus}
            isConfigured={isConfigured}
            isResynchronizing={isResynchronizing}
            manualResynchronize={manualResynchronize}
          />
        ) : campaign ? (
          <>
            <CrusadeHeader
              campaign={campaign}
              connectionStatus={connectionStatus}
            />

            <div className="player-dashboard__primary">
              <KillTeamBattlefieldPresentation
                battlefieldId={campaign.battlefieldId}
                battlefieldName={campaign.battlefieldName}
                checkpoints={campaign.battlefieldCheckpoints}
                intelPanelFooter={
                  <SubmissionReviewControl
                    campaignId={campaign.campaignId}
                    missionId={campaign.missionId}
                    onNavigate={onNavigateToSubmissions}
                    role={staffRole}
                  />
                }
                key={campaign.missionId}
                killTeams={campaign.killTeams}
              />
              <div className="player-dashboard__primary-rail">
                <MissionSummary campaign={campaign} />
                <CampaignProgress value={campaign.crusadePoints} />
              </div>
            </div>

            <div className="player-dashboard__grid">
              <ObjectivePanel objectives={campaign.objectives} />
              <ThreatPanel
                crusadeScoringTargets={campaign.crusadeScoringTargets}
                missionBoss={campaign.missionBoss}
              />
              <FriendlyForcesPanel killTeams={campaign.killTeams} />
              <SynchronizationStatus
                authoritativeUpdatedAt={campaign.authoritativeUpdatedAt}
                connectionStatus={connectionStatus}
                isConfigured={isConfigured}
                isResynchronizing={isResynchronizing}
                lastSynchronizedAt={lastSynchronizedAt}
                onResynchronize={manualResynchronize}
              />
            </div>

            {errorCode ? (
              <p className="player-dashboard__notice" role="status">
                {retainedStateMessages[errorCode]}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <NoActiveCrusade />
            <div className="player-dashboard__system">
              <SynchronizationStatus
                authoritativeUpdatedAt={null}
                connectionStatus={connectionStatus}
                isConfigured={isConfigured}
                isResynchronizing={isResynchronizing}
                lastSynchronizedAt={lastSynchronizedAt}
                onResynchronize={manualResynchronize}
              />
            </div>
          </>
        )}

        <SystemFooter />
      </div>
    </main>
  )
}

export function PlayerDashboardPage() {
  const synchronization = useCampaignSynchronization()
  const { state: authentication } = useAuthentication()

  return (
    <PlayerDashboard
      authentication={authentication}
      synchronization={synchronization}
    />
  )
}
