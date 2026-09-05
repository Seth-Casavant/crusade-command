import type { PublicCampaignState } from '../../data/services/publicCampaign'
import { StatusBadge, type CommandStatus } from '../ui'

export type PublicMissionStatus =
  | PublicCampaignState['missionStatus']
  | 'READY'
  | 'COMPLETE'
  | 'ABORTED'

const missionStatusPresentation: Record<
  PublicMissionStatus,
  { badge: CommandStatus; label: string }
> = {
  READY: { badge: 'ready', label: 'Ready' },
  ACTIVE: { badge: 'active', label: 'Active' },
  COMPLETE: { badge: 'complete', label: 'Complete' },
  ABORTED: { badge: 'hostile', label: 'Aborted' },
}

export type MissionStatusIndicatorProps = {
  status: PublicMissionStatus
}

export function MissionStatusIndicator({
  status,
}: MissionStatusIndicatorProps) {
  const presentation = missionStatusPresentation[status]

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="dashboard-status"
      role="status"
    >
      <span className="dashboard-status__label">Mission status</span>
      <StatusBadge
        label={presentation.label}
        status={presentation.badge}
      />
    </div>
  )
}
