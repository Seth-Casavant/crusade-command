import { render, screen } from '@testing-library/react'

import type { PublicEnemy } from '../../data/services/publicCampaign'
import { ThreatPanel } from './ThreatPanel'

const enemies: PublicEnemy[] = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    name: 'Neurothrope',
    enemyType: 'Terminus threat',
    description: 'A synaptic command organism.',
    sortOrder: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    name: 'Carnifex',
    enemyType: 'Heavy bioform',
    description: null,
    sortOrder: 1,
  },
]

describe('ThreatPanel', () => {
  it('renders the faction and multiple published enemy entries', () => {
    render(
      <ThreatPanel enemies={enemies} enemyFaction="Tyranid Swarm" />,
    )

    expect(screen.getByText('Tyranid Swarm')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: 'Neurothrope' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Terminus threat')).toBeInTheDocument()
    expect(screen.getByText('Carnifex')).toBeInTheDocument()
    expect(screen.getByText('Heavy bioform')).toBeInTheDocument()
  })

  it('renders a safe empty state when no threats are published', () => {
    render(<ThreatPanel enemies={[]} enemyFaction="Tyranid Swarm" />)

    expect(
      screen.getByText('No hostile contacts are currently published.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
