import { useMemo, useState } from 'react'

import type {
  PublicBattlefieldCheckpoint,
  PublicKillTeam,
} from '../../data/services/publicCampaign'
import { TacticalOverlayItem } from './TacticalOverlay'

type MarkerOffset = Readonly<{ x: number; y: number }>

const collisionOffsets: readonly MarkerOffset[] = [
  { x: 0, y: 0 },
  { x: -18, y: -18 },
  { x: 18, y: 18 },
  { x: 18, y: -18 },
  { x: -18, y: 18 },
  { x: 0, y: -26 },
  { x: 26, y: 0 },
  { x: 0, y: 26 },
  { x: -26, y: 0 },
]

export function getKillTeamCheckpointMarkerOffset(index: number): MarkerOffset {
  return collisionOffsets[index % collisionOffsets.length] ?? collisionOffsets[0]
}

type PositionedKillTeam = Readonly<{
  checkpoint: PublicBattlefieldCheckpoint
  collisionIndex: number
  team: PublicKillTeam
}>

export type KillTeamCheckpointMarkersProps = {
  checkpoints: readonly PublicBattlefieldCheckpoint[]
  killTeams: readonly PublicKillTeam[]
}

function positionKillTeams(
  checkpoints: readonly PublicBattlefieldCheckpoint[],
  killTeams: readonly PublicKillTeam[],
): PositionedKillTeam[] {
  const checkpointsById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]))
  const teamsByCheckpoint = new Map<string, PublicKillTeam[]>()

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

export function KillTeamCheckpointMarkers({ checkpoints, killTeams }: KillTeamCheckpointMarkersProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const positionedTeams = useMemo(() => positionKillTeams(checkpoints, killTeams), [checkpoints, killTeams])
  const selectedTeam = positionedTeams.find(({ team }) => team.id === selectedTeamId)

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
              onClick={() => setSelectedTeamId(team.id)}
              onPointerDown={(event) => event.stopPropagation()}
              style={{ '--kill-team-marker-offset-x': `${offset.x}px`, '--kill-team-marker-offset-y': `${offset.y}px` } as React.CSSProperties}
              type="button"
            >
              <span aria-hidden="true" className="kill-team-checkpoint-marker__glyph">◆</span>
              <span className="sr-only">Friendly Kill Team marker for {team.name}</span>
            </button>
          </TacticalOverlayItem>
        )
      })}
      {selectedTeam ? (
        <aside aria-label={`${selectedTeam.team.name} checkpoint detail`} className="kill-team-checkpoint-detail" onPointerDown={(event) => event.stopPropagation()}>
          <button aria-label={`Dismiss ${selectedTeam.team.name} checkpoint detail`} className="kill-team-checkpoint-detail__dismiss" onClick={() => setSelectedTeamId(null)} type="button">×</button>
          <p className="kill-team-checkpoint-detail__eyebrow">Friendly Kill Team</p>
          <h3>{selectedTeam.team.name}</h3>
          <p><span>Checkpoint</span>{selectedTeam.checkpoint.name}</p>
          <ul aria-label={`${selectedTeam.team.name} members`}>
            {selectedTeam.team.members.map((member) => <li key={member.displayName}>{member.displayName}</li>)}
          </ul>
        </aside>
      ) : null}
    </>
  )
}
