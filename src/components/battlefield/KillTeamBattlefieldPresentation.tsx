import { useState, type ReactNode } from 'react'

import type {
  BattlefieldCheckpointPresentation,
  KillTeamPresentation,
} from './killTeamPresentation'
import { KillTeamCheckpointMarkers } from './KillTeamCheckpointMarkers'
import { KillTeamIntelPanel } from './KillTeamIntelPanel'
import { TacticalBattlefield } from './TacticalBattlefield'

export type KillTeamBattlefieldPresentationProps = {
  battlefieldId: string
  battlefieldName: string
  checkpoints: readonly BattlefieldCheckpointPresentation[]
  battlefieldFooter?: ReactNode
  intelPanelFooter?: ReactNode
  killTeams: readonly KillTeamPresentation[]
}

export function KillTeamBattlefieldPresentation({
  battlefieldId,
  battlefieldName,
  checkpoints,
  battlefieldFooter,
  intelPanelFooter,
  killTeams,
}: KillTeamBattlefieldPresentationProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const selectedTeam =
    killTeams.find(({ id }) => id === selectedTeamId) ?? null
  const selectedCheckpoint =
    checkpoints.find(({ id }) => id === selectedTeam?.currentCheckpointId) ??
    null

  const selectTeam = (teamId: string) => {
    setSelectedTeamId((currentTeamId) =>
      currentTeamId === teamId ? null : teamId,
    )
  }

  return (
    <div className="kill-team-battlefield-presentation">
      <div className="kill-team-battlefield-presentation__map-column">
        <TacticalBattlefield
          battlefieldId={battlefieldId}
          battlefieldName={battlefieldName}
        >
          <KillTeamCheckpointMarkers
            checkpoints={checkpoints}
            killTeams={killTeams}
            onSelectTeam={selectTeam}
            selectedTeamId={selectedTeamId}
          />
        </TacticalBattlefield>
        {battlefieldFooter}
      </div>
      <div className="kill-team-battlefield-presentation__intel-column">
        <KillTeamIntelPanel
          checkpoint={selectedCheckpoint}
          team={selectedTeam}
        />
        {intelPanelFooter}
      </div>
    </div>
  )
}
