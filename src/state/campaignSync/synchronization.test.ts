import type {
  PublicCampaignState,
  PublicSyncSignal,
} from '../../data/services/publicCampaign'
import {
  canPerformAuthoritativeWrite,
  classifySyncSignal,
  signalsMatch,
} from './synchronization'

const campaign = {
  campaignId: '00000000-0000-4000-8000-000000000001',
  revision: 10,
} as PublicCampaignState

function signal(
  revision: number,
  updateId = `90000000-0000-4000-8000-${revision.toString().padStart(12, '0')}`,
): PublicSyncSignal {
  return {
    campaignId: campaign.campaignId,
    revision,
    updateId,
    isActive: true,
    publishedAt: `2026-09-04T12:00:${revision.toString().padStart(2, '0')}.000Z`,
  }
}

describe('realtime revision classification', () => {
  it('ignores a repeated update identifier', () => {
    expect(classifySyncSignal(campaign, signal(10), signal(10))).toBe(
      'DUPLICATE',
    )
  })

  it('ignores another event for the current revision', () => {
    expect(
      classifySyncSignal(campaign, signal(10), signal(10, '90000000-0000-4000-8000-999999999999')),
    ).toBe('DUPLICATE')
  })

  it('ignores an older out-of-order revision', () => {
    expect(classifySyncSignal(campaign, signal(10), signal(9))).toBe('STALE')
  })

  it('recognizes the next sequential revision', () => {
    expect(classifySyncSignal(campaign, signal(10), signal(11))).toBe(
      'NEXT_REVISION',
    )
  })

  it('recognizes missed revisions as a gap requiring full resync', () => {
    expect(classifySyncSignal(campaign, signal(10), signal(13))).toBe(
      'REVISION_GAP',
    )
  })

  it('recognizes a newer campaign signal', () => {
    expect(
      classifySyncSignal(campaign, signal(10), {
        ...signal(1),
        campaignId: '10000000-0000-4000-8000-000000000001',
        publishedAt: '2026-09-04T13:00:00.000Z',
      }),
    ).toBe('CAMPAIGN_CHANGED')
  })

  it('ignores an older signal from another campaign', () => {
    expect(
      classifySyncSignal(campaign, signal(10), {
        ...signal(99),
        campaignId: '10000000-0000-4000-8000-000000000001',
        publishedAt: '2026-09-04T11:00:00.000Z',
      }),
    ).toBe('STALE')
  })

  it('compares complete signal identity for periodic checks', () => {
    expect(signalsMatch(signal(10), signal(10))).toBe(true)
    expect(signalsMatch(signal(10), signal(11))).toBe(false)
    expect(signalsMatch(null, null)).toBe(true)
  })
})

describe('offline and authentication write safety', () => {
  it('enables future writes only for a live authenticated writer', () => {
    expect(canPerformAuthoritativeWrite('ADMINISTRATOR', 'LIVE')).toBe(true)
    expect(canPerformAuthoritativeWrite('MODERATOR', 'LIVE')).toBe(true)
    expect(canPerformAuthoritativeWrite('PLAYER', 'LIVE')).toBe(false)
    expect(canPerformAuthoritativeWrite(null, 'LIVE')).toBe(false)
    expect(canPerformAuthoritativeWrite('ADMINISTRATOR', 'OFFLINE')).toBe(false)
    expect(canPerformAuthoritativeWrite('MODERATOR', 'RECONNECTING')).toBe(
      false,
    )
  })
})
