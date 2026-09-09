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

const nativeDimensions = { width: 1179, height: 1546 }

const killTeams: PublicKillTeam[] = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    name: 'Sandbox Kill Team Alpha',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Sandbox Alpha One' }],
    operationalStatus: 'ADVANCING',
    crusadePoints: 27,
    terminusKills: 2,
    objectivesCompleted: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    name: 'Sandbox Kill Team Beta',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Sandbox Beta One' }],
    operationalStatus: 'DEPLOYED',
    crusadePoints: 4,
    terminusKills: 0,
    objectivesCompleted: 0,
  },
]

function renderMarkers(teams = killTeams) {
  const onSelectTeam = vi.fn()

  const result = render(
    <TacticalOverlay dimensions={nativeDimensions}>
      <KillTeamCheckpointMarkers
        checkpoints={[checkpoint]}
        killTeams={teams}
        onSelectTeam={onSelectTeam}
        selectedTeamId={null}
      />
    </TacticalOverlay>,
  )

  return { ...result, onSelectTeam }
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
    expect(marker).not.toHaveTextContent('27')
    expect(marker).not.toHaveTextContent('Terminus')
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
    expect(alpha).toHaveAttribute('data-collision-count', '2')
    expect(alpha).toHaveAttribute('data-offset-x', '-30')
    expect(alpha).toHaveAttribute('data-offset-y', '0')
    expect(beta).toHaveAttribute('data-offset-x', '30')
    expect(beta).toHaveAttribute('data-offset-y', '0')
    expect(getKillTeamCheckpointMarkerOffset(1, 2)).toEqual({ x: 30, y: 0 })

    for (const marker of [alpha, beta]) {
      expect(marker.parentElement).toHaveStyle({
        left: '565.92px',
        top: '711.16px',
      })
    }
    expect(checkpoint).toMatchObject({ x: 0.48, y: 0.46 })
  })

  it('keeps shared-checkpoint markers independently clickable', () => {
    const { onSelectTeam } = renderMarkers()
    const alpha = screen.getByRole('button', { name: /Alpha at Sandbox Relay/ })
    const beta = screen.getByRole('button', { name: /Beta at Sandbox Relay/ })

    fireEvent.click(alpha)
    fireEvent.click(beta)

    expect(onSelectTeam).toHaveBeenNthCalledWith(1, killTeams[0].id)
    expect(onSelectTeam).toHaveBeenNthCalledWith(2, killTeams[1].id)
  })

  it('distributes three or more teams into stable, distinct radial offsets', () => {
    const thirdTeam: PublicKillTeam = {
      ...killTeams[1],
      id: '00000000-0000-4000-8000-000000000503',
      name: 'Crimson Watch',
    }
    const sharedTeams = [thirdTeam, ...killTeams]
    const { rerender } = renderMarkers(sharedTeams)

    const readOffsets = () =>
      [...screen.getAllByRole('button')]
        .map((marker) => ({
          id: marker.getAttribute('aria-label'),
          x: marker.getAttribute('data-offset-x'),
          y: marker.getAttribute('data-offset-y'),
        }))
        .sort((left, right) => (left.id ?? '').localeCompare(right.id ?? ''))

    const firstOffsets = readOffsets()
    expect(new Set(firstOffsets.map(({ x, y }) => `${x}:${y}`)).size).toBe(3)

    rerender(
      <TacticalOverlay dimensions={nativeDimensions}>
        <KillTeamCheckpointMarkers
          checkpoints={[checkpoint]}
          killTeams={[...sharedTeams].reverse()}
          onSelectTeam={vi.fn()}
          selectedTeamId={null}
        />
      </TacticalOverlay>,
    )

    expect(readOffsets()).toEqual(firstOffsets)
    expect(getKillTeamCheckpointMarkerOffset(0, 3)).toEqual({ x: 0, y: -32 })
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
    expect(anchor).toHaveStyle({ left: '565.92px', top: '711.16px' })

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Full Map' }))

    expect(scene).toContainElement(anchor)
    expect(anchor).toHaveStyle({ left: '565.92px', top: '711.16px' })
  })
})
