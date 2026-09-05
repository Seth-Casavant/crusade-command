import { render, screen } from '@testing-library/react'

import { CampaignSyncPanel } from './CampaignSyncPanel'

describe('CampaignSyncPanel', () => {
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
    render(<CampaignSyncPanel />)

    expect(screen.getByText('Revision')).toBeInTheDocument()
    expect(screen.getByText('Last sync')).toBeInTheDocument()
    expect(screen.getByText('State updated')).toBeInTheDocument()
    expect(
      screen.getByText(/Realtime signals trigger complete public-state/i),
    ).toBeInTheDocument()
  })
})
