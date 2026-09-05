import type { PublicCampaignState } from '../../data/services/publicCampaign'
import { Panel } from '../ui'

export type MissionSummaryCampaign = Pick<
  PublicCampaignState,
  | 'battlefieldDescription'
  | 'battlefieldName'
  | 'missionDescription'
  | 'missionName'
>

export type MissionSummaryProps = {
  campaign: MissionSummaryCampaign
}

export function MissionSummary({ campaign }: MissionSummaryProps) {
  return (
    <Panel
      className="dashboard-panel mission-summary"
      eyebrow="Primary campaign section"
      title="Mission Briefing"
    >
      <div className="mission-summary__mission">
        <p className="dashboard-field-label">Current mission</p>
        <h3 className="mission-summary__name">{campaign.missionName}</h3>
        {campaign.missionDescription ? (
          <p className="dashboard-copy">{campaign.missionDescription}</p>
        ) : null}
      </div>

      <div className="mission-summary__battlefield">
        <p className="dashboard-field-label">Active battlefield</p>
        <p className="mission-summary__battlefield-name">
          {campaign.battlefieldName}
        </p>
        {campaign.battlefieldDescription ? (
          <p className="dashboard-copy">{campaign.battlefieldDescription}</p>
        ) : null}
        <p className="mission-summary__lock-note">
          Battlefield designation locked for this active operation.
        </p>
      </div>
    </Panel>
  )
}
