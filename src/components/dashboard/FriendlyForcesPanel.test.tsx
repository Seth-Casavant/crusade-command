import { render, screen, within } from '@testing-library/react'

import type { PublicKillTeam } from '../../data/services/publicCampaign'
import { FriendlyForcesPanel } from './FriendlyForcesPanel'

const killTeams: PublicKillTeam[] = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    name: 'Sandbox Kill Team Alpha',
    members: [
      { displayName: 'Sandbox Alpha One' },
      { displayName: 'Sandbox Alpha Two' },
    ],
    currentCheckpointId: '00000000-0000-4000-8000-000000000712',
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    name: 'Sandbox Kill Team Beta',
    members: [
      { displayName: 'Sandbox Beta One' },
      { displayName: 'Sandbox Beta Two' },
    ],
    currentCheckpointId: '00000000-0000-4000-8000-000000000712',
  },
]

describe('FriendlyForcesPanel', () => {
  it('renders multiple deployed Kill Teams and their members as friendly forces', () => {
    render(<FriendlyForcesPanel killTeams={killTeams} />)

    const region = screen.getByRole('region', { name: 'Friendly Forces' })
    const teamList = within(region).getByRole('list', {
      name: 'Deployed Kill Teams',
    })

    expect(within(region).getByText('Operational information')).toBeInTheDocument()
    expect(within(region).getByText('Deployed Kill Teams')).toBeInTheDocument()
    expect(within(teamList).getAllByRole('listitem')).toHaveLength(6)
    expect(
      within(region).getByRole('heading', { name: 'Sandbox Kill Team Alpha' }),
    ).toBeInTheDocument()
    expect(
      within(region).getByRole('heading', { name: 'Sandbox Kill Team Beta' }),
    ).toBeInTheDocument()
    expect(within(region).getByText('Sandbox Alpha One')).toBeInTheDocument()
    expect(within(region).getByText('Sandbox Alpha Two')).toBeInTheDocument()
    expect(within(region).getByText('Sandbox Beta One')).toBeInTheDocument()
    expect(within(region).getByText('Sandbox Beta Two')).toBeInTheDocument()
  })

  it('renders one Kill Team with a coherent member list', () => {
    render(
      <FriendlyForcesPanel
        killTeams={[
          {
            ...killTeams[0],
            members: killTeams[0].members.slice(0, 1),
          },
        ]}
      />,
    )

    const members = screen.getByRole('list', {
      name: 'Sandbox Kill Team Alpha members',
    })

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(within(members).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Sandbox Kill Team Beta')).not.toBeInTheDocument()
  })

  it('renders a deliberate empty state without an empty team list', () => {
    render(<FriendlyForcesPanel killTeams={[]} />)

    expect(
      screen.getByText('No Kill Teams are currently assigned to this mission.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: 'Deployed Kill Teams' }),
    ).not.toBeInTheDocument()
  })

  it('does not render private Discord identity data', () => {
    const teamWithPrivateTransportData = [
      {
        ...killTeams[0],
        members: [
          {
            displayName: 'Sandbox Alpha One',
            discordUserId: '900000000000000001',
          },
        ],
      },
    ]

    render(<FriendlyForcesPanel killTeams={teamWithPrivateTransportData} />)

    expect(screen.getByText('Sandbox Alpha One')).toBeInTheDocument()
    expect(screen.queryByText('900000000000000001')).not.toBeInTheDocument()
  })
})
