import type { ConnectionStatus } from '../../state/campaignSync/synchronization'
import { Button, Panel } from '../ui'
import { ConnectionIndicator } from './ConnectionIndicator'

function formatOperationalTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Awaiting confirmation'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return 'Unavailable'
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export type SynchronizationStatusProps = {
  authoritativeUpdatedAt: string | null
  connectionStatus: ConnectionStatus
  isConfigured: boolean
  isResynchronizing: boolean
  lastSynchronizedAt: string | null
  onResynchronize: () => void | Promise<void>
}

export function SynchronizationStatus({
  authoritativeUpdatedAt,
  connectionStatus,
  isConfigured,
  isResynchronizing,
  lastSynchronizedAt,
  onResynchronize,
}: SynchronizationStatusProps) {
  return (
    <Panel
      className="dashboard-panel synchronization-status"
      eyebrow="System information"
      title="Campaign Synchronization"
    >
      <ConnectionIndicator status={connectionStatus} />
      <dl className="synchronization-status__times">
        <div>
          <dt>State updated</dt>
          <dd>
            {authoritativeUpdatedAt ? (
              <time dateTime={authoritativeUpdatedAt}>
                {formatOperationalTime(authoritativeUpdatedAt)}
              </time>
            ) : (
              formatOperationalTime(null)
            )}
          </dd>
        </div>
        <div>
          <dt>Last sync</dt>
          <dd>
            {lastSynchronizedAt ? (
              <time dateTime={lastSynchronizedAt}>
                {formatOperationalTime(lastSynchronizedAt)}
              </time>
            ) : (
              formatOperationalTime(null)
            )}
          </dd>
        </div>
      </dl>
      <Button
        disabled={!isConfigured || isResynchronizing}
        isLoading={isResynchronizing}
        loadingLabel="Synchronizing"
        onClick={() => void onResynchronize()}
        variant="secondary"
      >
        Resync
      </Button>
    </Panel>
  )
}
