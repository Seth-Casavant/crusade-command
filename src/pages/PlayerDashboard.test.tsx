import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

import type {
  PublicCampaignState,
  PublicSyncSignal,
} from '../data/services/publicCampaign'
import {
  PlayerDashboard,
  type PlayerDashboardSynchronization,
} from './PlayerDashboard'

const campaign: PublicCampaignState = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  campaignName: 'The Kharon Purgation',
  campaignDescription: 'A public Crusade description.',
  missionId: '00000000-0000-4000-8000-000000000201',
  missionName: 'Operation Ashen Spear',
  missionDescription: 'Break the synaptic cordon.',
  missionStatus: 'ACTIVE',
  battlefieldId: '00000000-0000-4000-8000-000000000101',
  battlefieldName: 'Termination',
  battlefieldDescription: 'A fortress under xenos assault.',
  enemyFaction: 'Tyranid Swarm',
  campaignProgress: 67,
  crusadePoints: 24,
  revision: 8,
  authoritativeUpdatedAt: '2026-09-05T16:14:00.000Z',
  objectives: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      title: 'Secure the relay nexus',
      description: 'Restore the command uplink.',
      status: 'ACTIVE',
      sortOrder: 0,
    },
    {
      id: '00000000-0000-4000-8000-000000000302',
      title: 'Purge the lower bastion',
      description: null,
      status: 'PENDING',
      sortOrder: 1,
    },
  ],
  enemies: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      name: 'Sandbox Hostile Contact',
      enemyType: 'Fixture contact',
      description: 'Legacy general enemy data is not a Terminus designation.',
      sortOrder: 0,
    },
  ],
  missionBoss: {
    id: 'sandbox-mission-boss',
    name: 'Sandbox Mission Boss',
    description: 'Fixture-only Terminus designation.',
  },
  crusadeScoringTargets: [
    {
      id: 'sandbox-terminus-target-alpha',
      name: 'Sandbox Terminus Target Alpha',
      description: null,
      sortOrder: 0,
    },
    {
      id: 'sandbox-terminus-target-beta',
      name: 'Sandbox Terminus Target Beta',
      description: 'Fixture-only Crusade scoring designation.',
      sortOrder: 1,
    },
  ],
  battlefieldCheckpoints: [
    {
      id: '00000000-0000-4000-8000-000000000712',
      key: 'sandbox-relay',
      name: 'Sandbox Relay Node',
      x: 0.48,
      y: 0.46,
      sortOrder: 1,
    },
  ],
  killTeams: [
    {
      id: '00000000-0000-4000-8000-000000000501',
      name: 'Sandbox Kill Team Alpha',
      members: [
        { displayName: 'Sandbox Alpha One' },
        { displayName: 'Sandbox Alpha Two' },
      ],
      currentCheckpointId: '00000000-0000-4000-8000-000000000712',
      operationalStatus: 'ADVANCING',
      crusadePoints: 27,
      terminusKills: 2,
      objectivesCompleted: 2,
    },
    {
      id: '00000000-0000-4000-8000-000000000502',
      name: 'Sandbox Kill Team Beta',
      members: [
        { displayName: 'Sandbox Beta One' },
        { displayName: 'Sandbox Beta Two' },
      ],
      currentCheckpointId: '00000000-0000-4000-8000-000000000712',
      operationalStatus: 'DEPLOYED',
      crusadePoints: 4,
      terminusKills: 0,
      objectivesCompleted: 0,
    },
  ],
}

const signal: PublicSyncSignal = {
  campaignId: campaign.campaignId,
  revision: campaign.revision,
  updateId: '90000000-0000-4000-8000-000000000008',
  isActive: true,
  publishedAt: '2026-09-05T16:14:00.000Z',
}

function createSynchronization(
  overrides: Partial<PlayerDashboardSynchronization> = {},
): PlayerDashboardSynchronization {
  return {
    campaign,
    signal,
    connectionStatus: 'LIVE',
    lastSynchronizedAt: '2026-09-05T16:15:00.000Z',
    errorCode: null,
    isResynchronizing: false,
    isConfigured: true,
    manualResynchronize: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('PlayerDashboard', () => {
  it('renders the authoritative ACTIVE Crusade hierarchy without development data', () => {
    render(<PlayerDashboard synchronization={createSynchronization()} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Kharon Purgation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
    expect(screen.getAllByText('Termination')).toHaveLength(2)
    expect(
      screen.getByRole('region', {
        name: 'Tactical Battlefield Termination',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Loading Tactical Cartography...')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent('24')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('region', { name: 'Friendly Forces' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sandbox Kill Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Kill Team Beta')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Alpha One')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Beta Two')).toBeInTheDocument()
    expect(screen.queryByText('Phase 4 Foundation')).not.toBeInTheDocument()
    expect(screen.queryByText('Revision')).not.toBeInTheDocument()
    expect(screen.queryByText(campaign.campaignId)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /battlefield/i })).not.toBeInTheDocument()
  })

  it.each([0, 24])('renders %i authoritative Crusade points', (value) => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: { ...campaign, crusadePoints: value },
        })}
      />,
    )

    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent(String(value))
  })

  it('renders one or multiple public objectives in authoritative order', () => {
    const { rerender } = render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: { ...campaign, objectives: campaign.objectives.slice(0, 1) },
        })}
      />,
    )
    let objectiveRegion = screen.getByRole('region', {
      name: 'Current Objectives',
    })

    expect(within(objectiveRegion).getAllByRole('listitem')).toHaveLength(1)
    expect(within(objectiveRegion).getByText('Secure the relay nexus')).toBeInTheDocument()

    rerender(<PlayerDashboard synchronization={createSynchronization()} />)
    objectiveRegion = screen.getByRole('region', {
      name: 'Current Objectives',
    })
    expect(within(objectiveRegion).getAllByRole('listitem')).toHaveLength(2)
    expect(within(objectiveRegion).getByText('Purge the lower bastion')).toBeInTheDocument()
  })

  it('renders a deliberate empty objective state', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: { ...campaign, objectives: [] },
        })}
      />,
    )

    expect(
      screen.getByText('No objectives are currently published for this operation.'),
    ).toBeInTheDocument()
  })

  it('renders the Terminus threat model without displaying legacy friendly units', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: {
            ...campaign,
            enemies: [
              {
                id: '00000000-0000-4000-8000-000000000499',
                name: 'Sandbox Vanguard',
                enemyType: 'Friendly fixture',
                description: null,
                sortOrder: 0,
              },
            ],
          },
        })}
      />,
    )
    const threatRegion = screen.getByRole('region', {
      name: 'Threat Assessment',
    })

    expect(within(threatRegion).getByText('Terminus threat')).toBeInTheDocument()
    expect(within(threatRegion).getByText('Sandbox Mission Boss')).toBeInTheDocument()
    expect(within(threatRegion).getAllByRole('listitem')).toHaveLength(2)
    expect(
      within(threatRegion).getByText('Sandbox Terminus Target Alpha'),
    ).toBeInTheDocument()
    expect(
      within(threatRegion).queryByText('Sandbox Vanguard'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Sandbox Vanguard')).not.toBeInTheDocument()
  })

  it('keeps friendly Kill Teams semantically separate from Terminus threats', () => {
    render(<PlayerDashboard synchronization={createSynchronization()} />)

    const friendlyRegion = screen.getByRole('region', {
      name: 'Friendly Forces',
    })
    const threatRegion = screen.getByRole('region', {
      name: 'Threat Assessment',
    })

    expect(
      within(friendlyRegion).getByText('Sandbox Kill Team Alpha'),
    ).toBeInTheDocument()
    expect(
      within(friendlyRegion).queryByText('Sandbox Mission Boss'),
    ).not.toBeInTheDocument()
    expect(
      within(threatRegion).getByText('Sandbox Mission Boss'),
    ).toBeInTheDocument()
    expect(
      within(threatRegion).queryByText('Sandbox Kill Team Alpha'),
    ).not.toBeInTheDocument()
  })

  it('renders a safe empty Terminus threat state without inventing configuration', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: {
            ...campaign,
            missionBoss: null,
            crusadeScoringTargets: [],
            killTeams: [],
          },
        })}
      />,
    )

    expect(
      screen.getByText('Mission boss data unavailable.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No Crusade scoring targets are currently configured.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No Kill Teams are currently assigned to this mission.'),
    ).toBeInTheDocument()
  })

  it('renders a deliberate loading state without sample campaign values', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: null,
          signal: null,
          connectionStatus: 'SYNCING',
          lastSynchronizedAt: null,
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Receiving Crusade Data...' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Syncing')).toBeInTheDocument()
    expect(screen.queryByText('The Kharon Purgation')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders the confirmed no-active-operation state without private fallback data', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: null,
          signal: null,
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'No Active Operation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Awaiting deployment orders.')).toBeInTheDocument()
    expect(screen.queryByText('Operation Ashen Spear')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: /Tactical Battlefield/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps all operational information and RESYNC available while the map loads', () => {
    const manualResynchronize = vi.fn(async () => undefined)
    render(
      <PlayerDashboard
        synchronization={createSynchronization({ manualResynchronize })}
      />,
    )

    expect(screen.getByText('Loading Tactical Cartography...')).toBeInTheDocument()
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent('24')
    expect(
      screen.getByRole('region', { name: 'Current Objectives' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Threat Assessment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Friendly Forces' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Resync' }))
    expect(manualResynchronize).toHaveBeenCalledTimes(1)
  })

  it('contains an asset failure without disabling the Player dashboard', () => {
    const manualResynchronize = vi.fn(async () => undefined)
    const { container } = render(
      <PlayerDashboard
        synchronization={createSynchronization({ manualResynchronize })}
      />,
    )
    const tacticalAsset = container.querySelector<HTMLImageElement>(
      '.tactical-battlefield__asset',
    )

    expect(tacticalAsset).not.toBeNull()
    fireEvent.error(tacticalAsset as HTMLImageElement)

    const trackedFallback = container.querySelector<HTMLImageElement>(
      '.tactical-battlefield__asset',
    )
    expect(trackedFallback).toHaveAttribute(
      'data-tactical-asset-id',
      'termination-development',
    )
    fireEvent.error(trackedFallback as HTMLImageElement)

    expect(
      screen.getByText('Tactical Cartography Unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('The Kharon Purgation')).toBeInTheDocument()
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent('24')
    expect(screen.getByText('Secure the relay nexus')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Mission Boss')).toBeInTheDocument()
    expect(screen.getByText('Sandbox Kill Team Alpha')).toBeInTheDocument()
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Resync' }))
    expect(manualResynchronize).toHaveBeenCalledTimes(1)
  })

  it('uses a safe map fallback for an unregistered authoritative battlefield', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: {
            ...campaign,
            battlefieldId: '00000000-0000-4000-8000-000000000999',
            battlefieldName: 'Uncharted Bastion',
          },
        })}
      />,
    )

    expect(
      screen.getByRole('region', {
        name: 'Tactical Battlefield Uncharted Bastion',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tactical Cartography Unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Battlefield: Uncharted Bastion')).toBeInTheDocument()
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resync' })).toBeEnabled()
  })

  it('renders a controlled initial error and retries through the coordinator', () => {
    const manualResynchronize = vi.fn(async () => undefined)
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          campaign: null,
          signal: null,
          connectionStatus: 'OFFLINE',
          lastSynchronizedAt: null,
          errorCode: 'PUBLIC_STATE_FETCH_FAILED',
          manualResynchronize,
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Crusade Data Unavailable' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Unable to retrieve current operational state.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(manualResynchronize).toHaveBeenCalledTimes(1)
  })

  it('invokes manual resync and disables repeated activation while syncing', () => {
    const manualResynchronize = vi.fn(async () => undefined)
    const { rerender } = render(
      <PlayerDashboard
        synchronization={createSynchronization({ manualResynchronize })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resync' }))
    expect(manualResynchronize).toHaveBeenCalledTimes(1)

    rerender(
      <PlayerDashboard
        synchronization={createSynchronization({
          connectionStatus: 'SYNCING',
          isResynchronizing: true,
          manualResynchronize,
        })}
      />,
    )
    expect(screen.getByRole('button', { name: 'Synchronizing' })).toBeDisabled()
  })

  it('retains the last confirmed campaign while visibly offline', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          connectionStatus: 'OFFLINE',
          errorCode: 'REALTIME_DISCONNECTED',
        })}
      />,
    )

    expect(screen.getByText('The Kharon Purgation')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Current Crusade points' }),
    ).toHaveTextContent('24')
    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Showing last known campaign state.'),
    ).toBeInTheDocument()
  })

  it('renders reconnecting state without blanking authoritative content', () => {
    render(
      <PlayerDashboard
        synchronization={createSynchronization({
          connectionStatus: 'RECONNECTING',
        })}
      />,
    )

    expect(screen.getByText('The Kharon Purgation')).toBeInTheDocument()
    expect(screen.getAllByText('Reconnecting').length).toBeGreaterThan(0)
  })

  it('keeps the public dashboard available without an authentication prompt', () => {
    const onNavigateToStaffLogin = vi.fn()
    render(
      <PlayerDashboard
        onNavigateToStaffLogin={onNavigateToStaffLogin}
        synchronization={createSynchronization()}
      />,
    )

    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'STAFF ACCESS' }))
    expect(onNavigateToStaffLogin).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Command Staff Access')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Send verification code' }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['ADMINISTRATOR', 'Administrator session'],
    ['MODERATOR', 'Moderator session'],
  ] as const)('shows staff controls for an authorized %s', (role, identity) => {
    const { container } = render(
      <PlayerDashboard
        authentication={{
          status: 'authenticated',
          session: {} as Session,
          role,
        }}
        synchronization={createSynchronization()}
      />,
    )

    expect(screen.getByText(identity)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SIGN OUT' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'VIEW SUBMISSIONS' }),
    ).toBeInTheDocument()
    expect(
      container.querySelector(
        '.kill-team-battlefield-presentation__intel-column',
      ),
    ).toContainElement(container.querySelector('.submission-review-control'))
    expect(
      container.querySelector('.player-dashboard__primary-rail'),
    ).not.toContainElement(
      container.querySelector('.submission-review-control'),
    )
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
  })

  it('keeps VIEW SUBMISSIONS absent for an authenticated Player', () => {
    render(
      <PlayerDashboard
        authentication={{
          status: 'authenticated',
          session: {} as Session,
          role: 'PLAYER',
        }}
        synchronization={createSynchronization()}
      />,
    )

    expect(screen.queryByText(/VIEW SUBMISSIONS/)).not.toBeInTheDocument()
    expect(screen.getByText('Operation Ashen Spear')).toBeInTheDocument()
  })
})
