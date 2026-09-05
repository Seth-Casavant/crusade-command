import type { PublicCampaignState } from '../../data/services/publicCampaign'
import { Panel, ProgressMeter } from '../ui'

export type CampaignProgressProps = {
  value: PublicCampaignState['campaignProgress']
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export function CampaignProgress({ value }: CampaignProgressProps) {
  return (
    <Panel
      className="dashboard-panel campaign-progress"
      eyebrow="Campaign telemetry"
      title="Crusade Progress"
    >
      <ProgressMeter
        label="Campaign progress"
        value={normalizeProgress(value)}
      />
    </Panel>
  )
}
