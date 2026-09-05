import type { ConnectionStatus } from '../../state/campaignSync/synchronization'
import { StatusBadge, type CommandStatus } from '../ui'

const connectionPresentation: Record<
  ConnectionStatus,
  { badge: CommandStatus; label: string }
> = {
  LIVE: { badge: 'live', label: 'Live' },
  SYNCING: { badge: 'ready', label: 'Syncing' },
  RECONNECTING: { badge: 'reconnecting', label: 'Reconnecting' },
  OFFLINE: { badge: 'offline', label: 'Offline' },
}

export type ConnectionIndicatorProps = {
  showDetail?: boolean
  status: ConnectionStatus
}

export function ConnectionIndicator({
  showDetail = true,
  status,
}: ConnectionIndicatorProps) {
  const presentation = connectionPresentation[status]

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="dashboard-status dashboard-connection"
      role="status"
    >
      <span className="dashboard-status__label">Connection status</span>
      <StatusBadge
        label={presentation.label}
        status={presentation.badge}
      />
      {showDetail && status === 'OFFLINE' ? (
        <p className="dashboard-connection__detail">
          Showing last known campaign state.
        </p>
      ) : null}
    </div>
  )
}
