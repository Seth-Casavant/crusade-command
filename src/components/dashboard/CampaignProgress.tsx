import type { PublicCampaignState } from '../../data/services/publicCampaign'
import { Panel } from '../ui'

export type CampaignProgressProps = {
  value: PublicCampaignState['crusadePoints']
}

function normalizeCrusadePoints(value: number): number {
  if (!Number.isSafeInteger(value)) {
    return 0
  }

  return value
}

export function CampaignProgress({ value }: CampaignProgressProps) {
  return (
    <Panel
      className="dashboard-panel campaign-progress"
      eyebrow="Campaign telemetry"
      title="Crusade Progress"
    >
      <div
        aria-label="Current Crusade points"
        className="campaign-progress__points"
        role="group"
      >
        <span>Current Crusade points</span>
        <strong>{normalizeCrusadePoints(value)}</strong>
      </div>
      <p className="campaign-progress__source">Authoritative ledger total</p>
    </Panel>
  )
}
