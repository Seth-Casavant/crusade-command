import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import type {
  PublicBattlefieldCheckpoint,
  PublicKillTeam,
} from '../../data/services/publicCampaign'
import {
  KillTeamCheckpointMarkers,
  TacticalBattlefield,
  TacticalOverlay,
  getKillTeamAbbreviation,
  getKillTeamCheckpointMarkerOffset,
} from './index'

const checkpoint: PublicBattlefieldCheckpoint = {
  id: '00000000-0000-4000-8000-000000000712',
  key: 'sandbox-relay',
  name: 'Sandbox Relay Node',
  x: 0.48,
  y: 0.46,
  sortOrder: 1,
}

const killTeams: PublicKillTeam[] = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    name: 'Sandbox Kill Team Alpha',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Sandbox Alpha One' }],
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    name: 'Sandbox Kill Team Beta',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Sandbox Beta One' }],
  },
]

function renderMarkers(teams = killTeams) {
  const onSelectTeam = vi.fn()

  return render(
    <TacticalOverlay>
      <KillTeamCheckpointMarkers
        checkpoints={[checkpoint]}
        killTeams={teams}
        onSelectTeam={onSelectTeam}
        selectedTeamId={null}
      />
    </TacticalOverlay>,
  )
}

describe('KillTeamCheckpointMarkers', () => {
  it.each([
    ['Friendly Fire', 'FF'],
    ['Alpha Team', 'AT'],
    ['Killteam Terra', 'KT'],
    ['Vanguard', 'VA'],
  ])('derives %s as the two-character abbreviation %s', (name, expected) => {
    expect(getKillTeamAbbreviation(name)).toBe(expected)
  })

  it('renders checkpoint-assigned teams at the authoritative normalized location', () => {
    renderMarkers()

    const marker = screen.getByRole('button', {
      name: 'Sandbox Kill Team Alpha at Sandbox Relay Node',
    })
    const anchor = marker.parentElement

    expect(anchor).toHaveAttribute('data-tactical-x', '0.48')
    expect(anchor).toHaveAttribute('data-tactical-y', '0.46')
    expect(marker).not.toHaveAttribute('draggable')
    expect(marker).toHaveTextContent('SK')
    expect(marker).not.toHaveTextContent('Sandbox Kill Team Alpha')
  })

  it('omits unassigned teams and ignores unknown checkpoint references', () => {
    renderMarkers([
      { ...killTeams[0], currentCheckpointId: null },
      { ...killTeams[1], currentCheckpointId: '10000000-0000-4000-8000-000000000001' },
    ])

    expect(screen.queryByRole('button', { name: /Sandbox Kill Team/ })).not.toBeInTheDocument()
  })

  it('uses deterministic, presentation-only offsets for teams sharing a checkpoint', () => {
    renderMarkers([...killTeams].reverse())

    const alpha = screen.getByRole('button', { name: /Alpha at Sandbox Relay/ })
    const beta = screen.getByRole('button', { name: /Beta at Sandbox Relay/ })
    expect(alpha).toHaveAttribute('data-collision-index', '0')
    expect(beta).toHaveAttribute('data-collision-index', '1')
    expect(alpha).toHaveAttribute('data-offset-x', '0')
    expect(beta).toHaveAttribute('data-offset-x', '-18')
    expect(getKillTeamCheckpointMarkerOffset(1)).toEqual({ x: -18, y: -18 })
  })

  it('keeps markers in the shared scene through zoom and SHOW FULL MAP', () => {
    const { container } = render(
      <TacticalBattlefield
        battlefieldId="00000000-0000-4000-8000-000000000101"
        battlefieldName="Termination"
      >
        <KillTeamCheckpointMarkers
          checkpoints={[checkpoint]}
          killTeams={killTeams}
          onSelectTeam={vi.fn()}
          selectedTeamId={null}
        />
      </TacticalBattlefield>,
    )
    const asset = container.querySelector<HTMLImageElement>(
      '.tactical-battlefield__asset',
    )
    if (!asset) throw new Error('Expected a tactical asset.')
    fireEvent.load(asset)

    const marker = screen.getByRole('button', { name: /Alpha at Sandbox Relay/ })
    const anchor = marker.parentElement
    const scene = marker.closest('.tactical-battlefield__scene')
    expect(scene).toContainElement(anchor)
    expect(anchor).toHaveStyle({ left: '48%', top: '46%' })

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Full Map' }))

    expect(scene).toContainElement(anchor)
    expect(anchor).toHaveStyle({ left: '48%', top: '46%' })
  })
})
