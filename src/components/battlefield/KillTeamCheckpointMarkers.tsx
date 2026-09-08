import { useMemo, type CSSProperties } from 'react'

import {
  getKillTeamAbbreviation,
  getKillTeamCheckpointMarkerOffset,
  type BattlefieldCheckpointPresentation,
  type KillTeamPresentation,
} from './killTeamPresentation'
import { TacticalOverlayItem } from './TacticalOverlay'

type PositionedKillTeam = Readonly<{
  checkpoint: BattlefieldCheckpointPresentation
  collisionIndex: number
  team: KillTeamPresentation
}>

export type KillTeamCheckpointMarkersProps = {
  checkpoints: readonly BattlefieldCheckpointPresentation[]
  killTeams: readonly KillTeamPresentation[]
  onSelectTeam: (teamId: string) => void
  selectedTeamId: string | null
}

function positionKillTeams(
  checkpoints: readonly BattlefieldCheckpointPresentation[],
  killTeams: readonly KillTeamPresentation[],
): PositionedKillTeam[] {
  const checkpointsById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]))
  const teamsByCheckpoint = new Map<string, KillTeamPresentation[]>()

  for (const team of killTeams) {
    if (!team.currentCheckpointId || !checkpointsById.has(team.currentCheckpointId)) continue
    const group = teamsByCheckpoint.get(team.currentCheckpointId) ?? []
    group.push(team)
    teamsByCheckpoint.set(team.currentCheckpointId, group)
  }

  return [...teamsByCheckpoint.entries()].flatMap(([checkpointId, teams]) => {
    const checkpoint = checkpointsById.get(checkpointId)
    if (!checkpoint) return []
    return [...teams]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((team, collisionIndex) => ({ checkpoint, collisionIndex, team }))
  })
}

export function KillTeamCheckpointMarkers({
  checkpoints,
  killTeams,
  onSelectTeam,
  selectedTeamId,
}: KillTeamCheckpointMarkersProps) {
  const positionedTeams = useMemo(() => positionKillTeams(checkpoints, killTeams), [checkpoints, killTeams])

  return (
    <>
      {positionedTeams.map(({ checkpoint, collisionIndex, team }) => {
        const offset = getKillTeamCheckpointMarkerOffset(collisionIndex)
        return (
          <TacticalOverlayItem className="kill-team-checkpoint-marker-anchor" key={team.id} position={{ x: checkpoint.x, y: checkpoint.y }}>
            <button
              aria-label={`${team.name} at ${checkpoint.name}`}
              className="kill-team-checkpoint-marker"
              data-collision-index={collisionIndex}
              data-offset-x={offset.x}
              data-offset-y={offset.y}
              aria-pressed={selectedTeamId === team.id}
              onClick={() => onSelectTeam(team.id)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{ '--kill-team-marker-offset-x': `${offset.x}px`, '--kill-team-marker-offset-y': `${offset.y}px` } as CSSProperties}
              type="button"
            >
              {getKillTeamAbbreviation(team.name)}
            </button>
          </TacticalOverlayItem>
        )
      })}
    </>
  )
}
