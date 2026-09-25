import { useState, type FormEvent } from 'react'

import type { ApplicationRole } from '../../data/services/auth'
import {
  assignKillTeamCheckpoint,
} from '../../data/services/killTeamMovement'
import { canPerformAuthoritativeWrite, type ConnectionStatus } from '../../state/campaignSync/synchronization'
import { Button } from '../ui'
import type { BattlefieldCheckpointPresentation, KillTeamPresentation } from '../battlefield/killTeamPresentation'

export type StaffCheckpointControlProps = {
  checkpoints: readonly BattlefieldCheckpointPresentation[]
  connectionStatus: ConnectionStatus
  killTeams: readonly KillTeamPresentation[]
  revision: number
  role: ApplicationRole | null
  onResynchronize: () => Promise<void>
  assignCheckpoint?: typeof assignKillTeamCheckpoint
}

export function StaffCheckpointControl({
  checkpoints,
  connectionStatus,
  killTeams,
  revision,
  role,
  onResynchronize,
  assignCheckpoint = assignKillTeamCheckpoint,
}: StaffCheckpointControlProps) {
  const [teamId, setTeamId] = useState('')
  const [checkpointId, setCheckpointId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const selectedTeam = killTeams.find((team) => team.id === teamId)
  const canWrite = canPerformAuthoritativeWrite(role, connectionStatus)

  if (role !== 'ADMINISTRATOR' && role !== 'MODERATOR') {
    return null
  }

  async function moveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || isSaving || !selectedTeam ||
        !checkpoints.some((checkpoint) => checkpoint.id === checkpointId) ||
        selectedTeam.currentCheckpointId === checkpointId) {
      return
    }

    setIsSaving(true)
    setMessage(null)
    try {
      await assignCheckpoint(teamId, checkpointId, revision)
      await onResynchronize()
      setMessage('Kill Team checkpoint updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkpoint update failed.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section aria-label="Staff checkpoint control" className="staff-checkpoint-control">
      <p className="staff-checkpoint-control__eyebrow">Command movement</p>
      <h2>Assign Checkpoint</h2>
      <p>Place a Kill Team at a prepared point on the active battlefield.</p>
      <form onSubmit={(event) => void moveTeam(event)}>
        <label htmlFor="staff-checkpoint-team">Kill Team</label>
        <select
          id="staff-checkpoint-team"
          onChange={(event) => { setTeamId(event.target.value); setCheckpointId(''); setMessage(null) }}
          value={teamId}
        >
          <option value="">Select a Kill Team</option>
          {killTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <label htmlFor="staff-checkpoint-destination">Destination</label>
        <select
          id="staff-checkpoint-destination"
          onChange={(event) => { setCheckpointId(event.target.value); setMessage(null) }}
          value={checkpointId}
        >
          <option value="">Select a checkpoint</option>
          {checkpoints.map((checkpoint) => <option key={checkpoint.id} value={checkpoint.id}>{checkpoint.name}</option>)}
        </select>
        <Button
          disabled={!canWrite || isSaving || !selectedTeam || !checkpointId ||
            selectedTeam.currentCheckpointId === checkpointId}
          isLoading={isSaving}
          loadingLabel="UPDATING"
          type="submit"
        >
          MOVE TEAM
        </Button>
      </form>
      {checkpoints.length === 0 ? <p>No checkpoints are configured for this mission.</p> : null}
      {!canWrite ? <p>Movement is available when the campaign connection is live.</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  )
}
