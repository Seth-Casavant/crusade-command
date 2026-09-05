import type { PublicCampaignState } from '../../data/services/publicCampaign'
import type { ConnectionStatus } from '../../state/campaignSync/synchronization'
import { ConnectionIndicator } from './ConnectionIndicator'
import {
  MissionStatusIndicator,
  type PublicMissionStatus,
} from './MissionStatusIndicator'

export type CrusadeHeaderCampaign = Pick<
  PublicCampaignState,
  'campaignName'
> & {
  missionStatus: PublicMissionStatus
}

export type CrusadeHeaderProps = {
  campaign: CrusadeHeaderCampaign
  connectionStatus: ConnectionStatus
}

export function CrusadeHeader({
  campaign,
  connectionStatus,
}: CrusadeHeaderProps) {
  return (
    <header className="crusade-header">
      <div className="crusade-header__identity">
        <p className="crusade-header__eyebrow">Crusade Command</p>
        <h1 className="crusade-header__title">{campaign.campaignName}</h1>
      </div>
      <div
        aria-label="Operation status"
        className="crusade-header__statuses"
        role="group"
      >
        <MissionStatusIndicator status={campaign.missionStatus} />
        <ConnectionIndicator
          showDetail={false}
          status={connectionStatus}
        />
      </div>
    </header>
  )
}
