import {
  isCommandStaffRole,
  type ApplicationRole,
} from '../../data/services/auth'
import type {
  PublicCampaignState,
  PublicSyncSignal,
} from '../../data/services/publicCampaign'

export const REVISION_VERIFICATION_INTERVAL_MS = 45_000
export const RESUME_VERIFICATION_THROTTLE_MS = 2_000

export type ConnectionStatus =
  | 'LIVE'
  | 'SYNCING'
  | 'RECONNECTING'
  | 'OFFLINE'

export type SignalDisposition =
  | 'DUPLICATE'
  | 'STALE'
  | 'NEXT_REVISION'
  | 'REVISION_GAP'
  | 'CAMPAIGN_CHANGED'

export function classifySyncSignal(
  campaign: PublicCampaignState | null,
  currentSignal: PublicSyncSignal | null,
  incomingSignal: PublicSyncSignal,
): SignalDisposition {
  if (currentSignal?.updateId === incomingSignal.updateId) {
    return 'DUPLICATE'
  }

  const campaignRevision =
    campaign?.campaignId === incomingSignal.campaignId
      ? campaign.revision
      : null
  const signalRevision =
    currentSignal?.campaignId === incomingSignal.campaignId
      ? currentSignal.revision
      : null
  const currentRevision = Math.max(
    campaignRevision ?? 0,
    signalRevision ?? 0,
  )

  if (currentRevision > 0) {
    if (incomingSignal.revision === currentRevision) {
      return 'DUPLICATE'
    }

    if (incomingSignal.revision < currentRevision) {
      return 'STALE'
    }

    if (incomingSignal.revision === currentRevision + 1) {
      return 'NEXT_REVISION'
    }

    return 'REVISION_GAP'
  }

  if (currentSignal) {
    if (
      Date.parse(incomingSignal.publishedAt) <=
      Date.parse(currentSignal.publishedAt)
    ) {
      return 'STALE'
    }

    return 'CAMPAIGN_CHANGED'
  }

  return 'CAMPAIGN_CHANGED'
}

export function signalsMatch(
  first: PublicSyncSignal | null,
  second: PublicSyncSignal | null,
): boolean {
  if (!first || !second) {
    return first === second
  }

  return (
    first.campaignId === second.campaignId &&
    first.revision === second.revision &&
    first.updateId === second.updateId &&
    first.isActive === second.isActive
  )
}

export function canPerformAuthoritativeWrite(
  role: ApplicationRole | null,
  connectionStatus: ConnectionStatus,
): boolean {
  return connectionStatus === 'LIVE' && isCommandStaffRole(role)
}
