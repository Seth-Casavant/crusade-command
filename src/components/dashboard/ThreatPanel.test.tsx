import { render, screen } from '@testing-library/react'

import type {
  PublicCrusadeScoringTarget,
  PublicMissionBoss,
} from '../../data/services/publicCampaign'
import { ThreatPanel } from './ThreatPanel'

const missionBoss: PublicMissionBoss = {
  id: 'sandbox-mission-boss',
  name: 'Sandbox Mission Boss',
  description: 'Fixture-only Terminus designation.',
}

const scoringTargets: PublicCrusadeScoringTarget[] = [
  {
    id: 'sandbox-terminus-target-alpha',
    name: 'Sandbox Terminus Target Alpha',
    description: 'Fixture-only Crusade scoring designation.',
    sortOrder: 0,
  },
  {
    id: 'sandbox-terminus-target-beta',
    name: 'Sandbox Terminus Target Beta',
    description: null,
    sortOrder: 1,
  },
]

describe('ThreatPanel', () => {
  it('renders Terminus terminology, a mission boss, and multiple scoring targets', () => {
    render(
      <ThreatPanel
        crusadeScoringTargets={scoringTargets}
        missionBoss={missionBoss}
      />,
    )

    expect(screen.getByText('Terminus threat')).toBeInTheDocument()
    expect(screen.getByText('Mission boss')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Mission Boss')).toBeInTheDocument()
    expect(screen.getByText('Crusade scoring targets')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: 'Sandbox Terminus Target Alpha' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Crusade scoring target')).toHaveLength(2)
    expect(screen.queryByText('Hostile force')).not.toBeInTheDocument()
    expect(screen.queryByText('Sandbox Vanguard')).not.toBeInTheDocument()
  })

  it('renders one scoring target without malformed list content', () => {
    render(
      <ThreatPanel
        crusadeScoringTargets={scoringTargets.slice(0, 1)}
        missionBoss={missionBoss}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Sandbox Terminus Target Alpha')).toBeInTheDocument()
  })

  it('renders safe mission-boss and scoring-target empty states', () => {
    render(<ThreatPanel crusadeScoringTargets={[]} missionBoss={null} />)

    expect(
      screen.getByText('Mission boss data unavailable.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No Crusade scoring targets are currently configured.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
