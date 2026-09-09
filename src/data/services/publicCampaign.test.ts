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
  crusade_points: 24,
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
      name: 'Sandbox Hostile Contact',
      enemy_type: 'Fixture contact',
      description: null,
      sort_order: 0,
    },
  ],
  mission_boss: {
    id: 'sandbox-mission-boss',
    name: 'Sandbox Mission Boss',
    description: 'Fixture-only Terminus designation.',
  },
  crusade_scoring_targets: [
    {
      id: 'sandbox-terminus-target-alpha',
      name: 'Sandbox Terminus Target Alpha',
      description: null,
      sort_order: 0,
    },
    {
      id: 'sandbox-terminus-target-beta',
      name: 'Sandbox Terminus Target Beta',
      description: 'Fixture-only Crusade scoring designation.',
      sort_order: 1,
    },
  ],
  battlefield_checkpoints: [
    {
      id: '00000000-0000-4000-8000-000000000712',
      key: 'sandbox-relay',
      name: 'Sandbox Relay Node',
      x: 0.48,
      y: 0.46,
      sort_order: 1,
    },
  ],
  kill_teams: [
    {
      id: '00000000-0000-4000-8000-000000000501',
      name: 'Sandbox Kill Team Alpha',
      members: [
        { display_name: 'Sandbox Alpha One' },
        { display_name: 'Sandbox Alpha Two' },
      ],
      current_checkpoint_id: '00000000-0000-4000-8000-000000000712',
      operational_status: 'ADVANCING',
      crusade_points: 27,
      terminus_kills: 2,
      objectives_completed: 2,
    },
    {
      id: '00000000-0000-4000-8000-000000000502',
      name: 'Sandbox Kill Team Beta',
      members: [{ display_name: 'Sandbox Beta One' }],
      current_checkpoint_id: null,
      operational_status: 'DEPLOYED',
      crusade_points: 4,
      terminus_kills: 0,
      objectives_completed: 0,
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
      crusadePoints: 24,
      revision: 4,
      missionBoss: {
        id: 'sandbox-mission-boss',
        name: 'Sandbox Mission Boss',
      },
      crusadeScoringTargets: [
        { name: 'Sandbox Terminus Target Alpha' },
        { name: 'Sandbox Terminus Target Beta' },
      ],
      battlefieldCheckpoints: [
        { key: 'sandbox-relay', x: 0.48, y: 0.46 },
      ],
      killTeams: [
        {
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
          name: 'Sandbox Kill Team Beta',
          members: [{ displayName: 'Sandbox Beta One' }],
          currentCheckpointId: null,
          operationalStatus: 'DEPLOYED',
          crusadePoints: 4,
          terminusKills: 0,
          objectivesCompleted: 0,
        },
      ],
    })
    expect(result.signal?.updateId).toBe(validSignal.update_id)
  })

  it('defaults unconfigured Terminus fields without rejecting the public snapshot', () => {
    const campaignWithoutTerminus: Record<string, unknown> = {
      ...validCampaign,
    }
    delete campaignWithoutTerminus.mission_boss
    delete campaignWithoutTerminus.crusade_scoring_targets
    delete campaignWithoutTerminus.battlefield_checkpoints
    delete campaignWithoutTerminus.kill_teams

    const result = parsePublicCampaignSnapshot({
      active_campaign_count: 1,
      campaign: campaignWithoutTerminus,
      signal: validSignal,
    })

    expect(result.campaign).toMatchObject({
      missionBoss: null,
      crusadeScoringTargets: [],
      battlefieldCheckpoints: [],
      killTeams: [],
    })
  })

  it('accepts an explicitly unavailable mission boss and no scoring targets', () => {
    const result = parsePublicCampaignSnapshot({
      active_campaign_count: 1,
      campaign: {
        ...validCampaign,
        mission_boss: null,
        crusade_scoring_targets: null,
        battlefield_checkpoints: null,
        kill_teams: null,
      },
      signal: validSignal,
    })

    expect(result.campaign).toMatchObject({
      missionBoss: null,
      crusadeScoringTargets: [],
      battlefieldCheckpoints: [],
      killTeams: [],
    })
  })

  it('accepts an explicit empty Kill Team list', () => {
    const result = parsePublicCampaignSnapshot({
      active_campaign_count: 1,
      campaign: { ...validCampaign, kill_teams: [] },
      signal: validSignal,
    })

    expect(result.campaign?.killTeams).toEqual([])
  })

  it('rejects malformed optional Kill Team transport data', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 1,
        campaign: {
          ...validCampaign,
          kill_teams: [
            {
              id: '00000000-0000-4000-8000-000000000501',
              name: 'Malformed Team',
              members: [{ display_name: 42 }],
              operational_status: 'STAGING',
            },
          ],
        },
        signal: validSignal,
      }),
    ).toThrow(SynchronizationError)
  })

  it('does not map Discord identities into the public Kill Team model', () => {
    const result = parsePublicCampaignSnapshot({
      active_campaign_count: 1,
      campaign: {
        ...validCampaign,
        kill_teams: [
          {
            id: '00000000-0000-4000-8000-000000000501',
            name: 'Sandbox Kill Team Alpha',
            operational_status: 'ADVANCING',
            crusade_points: 27,
            terminus_kills: 2,
            objectives_completed: 2,
            members: [
              {
                display_name: 'Sandbox Alpha One',
                discord_user_id: '900000000000000001',
              },
            ],
          },
        ],
      },
      signal: validSignal,
    })

    expect(result.campaign?.killTeams[0]?.members[0]).toEqual({
      displayName: 'Sandbox Alpha One',
    })
  })

  it('rejects unsupported Kill Team operational status values', () => {
    expect(() =>
      parsePublicCampaignSnapshot({
        active_campaign_count: 1,
        campaign: {
          ...validCampaign,
          kill_teams: [
            {
              ...validCampaign.kill_teams[0],
              operational_status: 'UNKNOWN',
            },
          ],
        },
        signal: validSignal,
      }),
    ).toThrow(SynchronizationError)
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
