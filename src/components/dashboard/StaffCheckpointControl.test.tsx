import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { StaffCheckpointControl } from './StaffCheckpointControl'

const team = {
  id: '00000000-0000-4000-8000-000000000501',
  name: 'Vanguard',
  currentCheckpointId: null,
  members: [],
  operationalStatus: 'STAGING' as const,
  crusadePoints: 0,
  terminusKills: 0,
  objectivesCompleted: 0,
}

const checkpoint = {
  id: '00000000-0000-4000-8000-000000000711',
  name: 'Deployment Zone',
  x: 0.2,
  y: 0.3,
}

describe('StaffCheckpointControl', () => {
  it('hides movement from public players', () => {
    const { container } = render(
      <StaffCheckpointControl
        assignCheckpoint={vi.fn()}
        checkpoints={[checkpoint]}
        connectionStatus="LIVE"
        killTeams={[team]}
        onResynchronize={vi.fn()}
        revision={7}
        role={null}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('assigns an unpositioned team through the authoritative RPC and resynchronizes', async () => {
    const assignCheckpoint = vi.fn().mockResolvedValue(undefined)
    const onResynchronize = vi.fn().mockResolvedValue(undefined)
    render(
      <StaffCheckpointControl
        assignCheckpoint={assignCheckpoint}
        checkpoints={[checkpoint]}
        connectionStatus="LIVE"
        killTeams={[team]}
        onResynchronize={onResynchronize}
        revision={7}
        role="MODERATOR"
      />,
    )

    fireEvent.change(screen.getByLabelText('Kill Team'), { target: { value: team.id } })
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: checkpoint.id } })
    fireEvent.click(screen.getByRole('button', { name: 'MOVE TEAM' }))

    await waitFor(() => expect(assignCheckpoint).toHaveBeenCalledWith(team.id, checkpoint.id, 7))
    await waitFor(() => expect(onResynchronize).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('Kill Team checkpoint updated.')
  })

  it('disables movement when the connection is not live', () => {
    const assignCheckpoint = vi.fn()
    render(
      <StaffCheckpointControl
        assignCheckpoint={assignCheckpoint}
        checkpoints={[checkpoint]}
        connectionStatus="OFFLINE"
        killTeams={[team]}
        onResynchronize={vi.fn()}
        revision={7}
        role="ADMINISTRATOR"
      />,
    )
    fireEvent.change(screen.getByLabelText('Kill Team'), { target: { value: team.id } })
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: checkpoint.id } })
    expect(screen.getByRole('button', { name: 'MOVE TEAM' })).toBeDisabled()
    expect(assignCheckpoint).not.toHaveBeenCalled()
  })
})
