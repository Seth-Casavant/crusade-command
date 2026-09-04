import { Button, Panel, ProgressMeter, StatusBadge } from '../ui'
import { useCampaignSynchronization } from '../../state/campaignSync/useCampaignSynchronization'

const connectionPresentation = {
  LIVE: { badge: 'live', label: 'Connection: Live' },
  SYNCING: { badge: 'ready', label: 'Connection: Syncing' },
  RECONNECTING: {
    badge: 'reconnecting',
    label: 'Connection: Reconnecting',
  },
  OFFLINE: { badge: 'offline', label: 'Connection: Offline' },
} as const

const errorMessages = {
  AUTH_EXPIRED: 'The privileged session expired. Writer access is disabled.',
  NETWORK_UNAVAILABLE:
    'The network is unavailable. Showing the last confirmed campaign state.',
  PUBLIC_STATE_FETCH_FAILED:
    'The public campaign state could not be retrieved.',
  PUBLIC_STATE_INVALID:
    'The server returned campaign data that failed validation.',
  REALTIME_DISCONNECTED:
    'Realtime is disconnected. Showing the last confirmed campaign state.',
  RESYNC_FAILED:
    'Resynchronization failed. The last confirmed state remains visible.',
} as const

function formatLastSynchronization(timestamp: string | null): string {
  if (!timestamp) {
    return 'Not yet confirmed'
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(timestamp)) / 1000),
  )

  if (elapsedSeconds < 10) {
    return 'Just now'
  }

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} seconds ago`
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`
}

export function CampaignSyncPanel() {
  const synchronization = useCampaignSynchronization()
  const connection =
    connectionPresentation[synchronization.connectionStatus]

  return (
    <Panel
      className="synchronization-panel"
      eyebrow="Authoritative state channel"
      footer="Realtime signals trigger complete public-state retrieval"
      title="Campaign Synchronization"
    >
      <div className="synchronization-panel__status">
        <StatusBadge status={connection.badge} label={connection.label} />
        <dl>
          <div>
            <dt>Revision</dt>
            <dd>
              {synchronization.campaign?.revision ??
                synchronization.signal?.revision ??
                '—'}
            </dd>
          </div>
          <div>
            <dt>Last sync</dt>
            <dd>
              {formatLastSynchronization(
                synchronization.lastSynchronizedAt,
              )}
            </dd>
          </div>
        </dl>
        <Button
          disabled={!synchronization.isConfigured}
          isLoading={synchronization.isResynchronizing}
          loadingLabel="Synchronizing"
          onClick={() => void synchronization.manualResynchronize()}
          variant="secondary"
        >
          Resync campaign state
        </Button>
      </div>

      <div className="synchronization-panel__campaign" aria-live="polite">
        {synchronization.campaign ? (
          <>
            <dl>
              <div>
                <dt>Campaign</dt>
                <dd>{synchronization.campaign.campaignName}</dd>
              </div>
              <div>
                <dt>Mission</dt>
                <dd>{synchronization.campaign.missionName}</dd>
              </div>
              <div>
                <dt>Battlefield</dt>
                <dd>{synchronization.campaign.battlefieldName}</dd>
              </div>
            </dl>
            <ProgressMeter value={synchronization.campaign.campaignProgress} />
          </>
        ) : (
          <p className="synchronization-panel__empty">
            No published ACTIVE campaign is currently available.
          </p>
        )}

        {synchronization.errorCode && (
          <p className="synchronization-panel__error" role="alert">
            {errorMessages[synchronization.errorCode]}
          </p>
        )}
      </div>
    </Panel>
  )
}
