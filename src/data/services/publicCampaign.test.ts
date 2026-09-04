import {
  parsePublicCampaignSnapshot,
  SynchronizationError,
} from './publicCampaign'

const validCampaign = {
  campaign_id: '00000000-0000-4000-8000-000000000001',
  campaign_name: 'Sandbox Crusade',
  campaign_description: 'Sandbox data',
  mission_id: '00000000-0000-4000-8000-000000000201',
  mission_name: 'Sandbox Mission',
  mission_description: 'Sandbox mission data',
  mission_status: 'ACTIVE',
  battlefield_id: '00000000-0000-4000-8000-000000000101',
  battlefield_name: 'Termination',
  battlefield_description: 'Sandbox battlefield',
  enemy_faction: 'Sandbox Hostiles',
  campaign_progress: 12,
  revision: 4,
  updated_at: '2026-09-04T12:00:00.000Z',
  objectives: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      title: 'Secure the relay',
      description: null,
      status: 'ACTIVE',
      sort_order: 0,
    },
  ],
  enemies: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      name: 'Sandbox Vanguard',
      enemy_type: 'Major threat',
      description: null,
      sort_order: 0,
    },
  ],
}

const validSignal = {
  campaign_id: '00000000-0000-4000-8000-000000000001',
  revision: 4,
  update_id: '90000000-0000-4000-8000-000000000001',
  is_active: true,
  published_at: '2026-09-04T12:00:00.000Z',
}

describe('public campaign response validation', () => {
  it('normalizes a complete authoritative snapshot', () => {
    const result = parsePublicCampaignSnapshot({
      active_campaign_count: 1,
      campaign: validCampaign,
      signal: validSignal,
    })

    expect(result.campaign).toMatchObject({
      campaignName: 'Sandbox Crusade',
      missionStatus: 'ACTIVE',
      campaignProgress: 12,
      revision: 4,
    })
    expect(result.signal?.updateId).toBe(validSignal.update_id)
  })

  it('accepts a valid snapshot with no published ACTIVE campaign', () => {
    expect(
      parsePublicCampaignSnapshot({
        active_campaign_count: 0,
        campaign: null,
        signal: { ...validSignal, is_active: false },
      }),
    ).toMatchObject({ campaign: null })
  })

  it('rejects progress outside the authoritative database range', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 1,
        campaign: { ...validCampaign, campaign_progress: 101 },
        signal: validSignal,
      }),
    ).toThrow(SynchronizationError)
  })

  it('rejects non-ACTIVE mission data from the public channel', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 1,
        campaign: { ...validCampaign, mission_status: 'DRAFT' },
        signal: validSignal,
      }),
    ).toThrow('only ACTIVE missions')
  })

  it('rejects an ambiguous multiple-campaign response', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 2,
        campaign: validCampaign,
        signal: validSignal,
      }),
    ).toThrow('active_campaign_count')
  })

  it('rejects disagreement between full state and notification metadata', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 1,
        campaign: validCampaign,
        signal: { ...validSignal, revision: 5 },
      }),
    ).toThrow('campaign and synchronization signal disagree')
  })
})
