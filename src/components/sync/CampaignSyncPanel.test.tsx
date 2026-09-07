import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import type { CampaignSynchronizationState } from '../../state/campaignSync/useCampaignSynchronization'

type CampaignSynchronizationViewModel = CampaignSynchronizationState & {
  isConfigured: boolean
  manualResynchronize: () => Promise<void>
  verifyRevision: () => Promise<void>
}

const synchronizationMocks = vi.hoisted(() => ({
  useCampaignSynchronization: vi.fn(),
}))

vi.mock('../../state/campaignSync/useCampaignSynchronization', () => ({
  useCampaignSynchronization:
    synchronizationMocks.useCampaignSynchronization,
}))

import { CampaignSyncPanel } from './CampaignSyncPanel'

function createSynchronizationViewModel(
  overrides: Partial<CampaignSynchronizationViewModel> = {},
): CampaignSynchronizationViewModel {
  return {
    campaign: null,
    signal: null,
    connectionStatus: 'OFFLINE',
    lastSynchronizedAt: null,
    errorCode: null,
    isResynchronizing: false,
    isConfigured: false,
    manualResynchronize: vi.fn(async () => undefined),
    verifyRevision: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('CampaignSyncPanel', () => {
  beforeEach(() => {
    synchronizationMocks.useCampaignSynchronization.mockReset()
    synchronizationMocks.useCampaignSynchronization.mockReturnValue(
      createSynchronizationViewModel(),
    )
  })

  it('shows a safe offline state when Supabase is not configured', () => {
    render(<CampaignSyncPanel />)

    expect(screen.getByText('Connection: Offline')).toBeInTheDocument()
    expect(
      screen.getByText('No published ACTIVE campaign is currently available.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resync campaign state' }),
    ).toBeDisabled()
  })

  it('communicates synchronization using text instead of color alone', () => {
    synchronizationMocks.useCampaignSynchronization.mockReturnValue(
      createSynchronizationViewModel({
        connectionStatus: 'SYNCING',
        isConfigured: true,
        isResynchronizing: true,
      }),
    )

    render(<CampaignSyncPanel />)

    expect(screen.getByText('Connection: Syncing')).toBeInTheDocument()
    expect(screen.getByText('Revision')).toBeInTheDocument()
    expect(screen.getByText('Last sync')).toBeInTheDocument()
    expect(screen.getByText('State updated')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Synchronizing' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Realtime signals trigger complete public-state/i),
    ).toBeInTheDocument()
  })
})
