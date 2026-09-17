import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'

import type {
  PublicBattlefieldCheckpoint,
  PublicKillTeam,
} from '../../data/services/publicCampaign'
import { KillTeamBattlefieldPresentation } from './index'

const checkpoint: PublicBattlefieldCheckpoint = {
  id: '00000000-0000-4000-8000-000000000712',
  key: 'sandbox-relay',
  name: 'Sandbox Relay Node',
  x: 0.48,
  y: 0.46,
  sortOrder: 1,
}

const teams: PublicKillTeam[] = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    name: 'Friendly Fire',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Alpha One' }],
    operationalStatus: 'ADVANCING',
    crusadePoints: 27,
    terminusKills: 2,
    objectivesCompleted: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    name: 'Vanguard',
    currentCheckpointId: checkpoint.id,
    members: [{ displayName: 'Beta One' }],
    operationalStatus: 'DEPLOYED',
    crusadePoints: 0,
    terminusKills: 0,
    objectivesCompleted: 0,
  },
]

function renderPresentation() {
  const result = render(
    <KillTeamBattlefieldPresentation
      battlefieldId="00000000-0000-4000-8000-000000000101"
      battlefieldName="Termination"
      checkpoints={[checkpoint]}
      killTeams={teams}
    />,
  )
  const asset = result.container.querySelector<HTMLImageElement>(
    '.tactical-battlefield__asset',
  )
  if (!asset) throw new Error('Expected a tactical asset.')
  fireEvent.load(asset)
  return result
}

describe('KillTeamBattlefieldPresentation', () => {
  it('keeps a restrained Intel empty state outside the transformed map scene', () => {
    const { container } = renderPresentation()
    const panel = screen.getByRole('complementary', { name: 'Kill Team Intel' })
    const scene = container.querySelector('.tactical-battlefield__scene')
    const layout = container.querySelector('.kill-team-battlefield-presentation')
    const intelColumn = container.querySelector(
      '.kill-team-battlefield-presentation__intel-column',
    )

    expect(panel).toHaveTextContent(
      'Select a Kill Team marker to view deployment data.',
    )
    expect(scene).not.toContainElement(panel)
    expect(layout?.children).toHaveLength(2)
    expect(layout?.lastElementChild).toBe(intelColumn)
    expect(intelColumn).toContainElement(panel)
  })

  it('selects one team, replaces the selection, and clears it on a second activation', () => {
    renderPresentation()
    const panel = screen.getByRole('complementary', { name: 'Kill Team Intel' })
    const friendlyFire = screen.getByRole('button', {
      name: 'Friendly Fire at Sandbox Relay Node',
    })
    const vanguard = screen.getByRole('button', {
      name: 'Vanguard at Sandbox Relay Node',
    })

    expect(friendlyFire).toHaveTextContent('FF')
    expect(vanguard).toHaveTextContent('VA')
    expect(friendlyFire).not.toHaveTextContent('Friendly Fire')
    expect(vanguard).not.toHaveTextContent('Sandbox Relay Node')
    expect(friendlyFire).not.toHaveTextContent('ADVANCING')
    expect(vanguard).not.toHaveTextContent('DEPLOYED')

    fireEvent.click(friendlyFire)
    expect(friendlyFire).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel).getByText('Friendly Fire')).toBeInTheDocument()
    expect(within(panel).getByText('Sandbox Relay Node')).toBeInTheDocument()
    expect(within(panel).getByText('Alpha One')).toBeInTheDocument()
    expect(within(panel).getByText('ADVANCING')).toBeInTheDocument()
    expect(
      within(panel).getByText('Crusade points').parentElement,
    ).toHaveTextContent('27')
    expect(
      within(panel).getByText('Terminus kills').parentElement,
    ).toHaveTextContent('2')
    expect(
      within(panel).getByText('Objectives').parentElement,
    ).toHaveTextContent('2')

    fireEvent.click(vanguard)
    expect(friendlyFire).toHaveAttribute('aria-pressed', 'false')
    expect(vanguard).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel).queryByText('Friendly Fire')).not.toBeInTheDocument()
    expect(within(panel).getByText('Vanguard')).toBeInTheDocument()
    expect(within(panel).getByText('Beta One')).toBeInTheDocument()
    expect(within(panel).getByText('DEPLOYED')).toBeInTheDocument()
    expect(within(panel).queryByText('ADVANCING')).not.toBeInTheDocument()
    expect(
      within(panel).getByText('Crusade points').parentElement,
    ).toHaveTextContent('0')
    expect(
      within(panel).getByText('Terminus kills').parentElement,
    ).toHaveTextContent('0')
    expect(
      within(panel).getByText('Objectives').parentElement,
    ).toHaveTextContent('0')

    fireEvent.click(vanguard)
    expect(vanguard).toHaveAttribute('aria-pressed', 'false')
    expect(panel).toHaveTextContent(
      'Select a Kill Team marker to view deployment data.',
    )
    expect(within(panel).queryByText('Beta One')).not.toBeInTheDocument()
  })

  it('keeps the stationary Intel panel separate while map controls transform the scene', () => {
    const measurement = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        toJSON: () => ({}),
        top: 0,
        width: 800,
        x: 0,
        y: 0,
      })
    const { container } = renderPresentation()
    const panel = screen.getByTestId('kill-team-intel-panel')
    const scene = container.querySelector<HTMLElement>(
      '.tactical-battlefield__scene',
    )
    if (!scene) throw new Error('Expected a transformed tactical scene.')
    const initialTransform = scene.style.transform

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }))
    expect(scene.style.transform).not.toBe(initialTransform)
    expect(scene).not.toContainElement(panel)
    expect(panel).not.toHaveAttribute('style')

    fireEvent.click(screen.getByRole('button', { name: 'Show Full Map' }))
    expect(scene).not.toContainElement(panel)
    measurement.mockRestore()
  })
})
