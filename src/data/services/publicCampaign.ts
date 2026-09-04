import type { RealtimeChannel } from '@supabase/supabase-js'

import type { Tables } from '../../shared/types'
import { supabase } from './supabase'

export type SyncErrorCode =
  | 'AUTH_EXPIRED'
  | 'NETWORK_UNAVAILABLE'
  | 'PUBLIC_STATE_FETCH_FAILED'
  | 'PUBLIC_STATE_INVALID'
  | 'REALTIME_DISCONNECTED'
  | 'RESYNC_FAILED'

export class SynchronizationError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SynchronizationError'
  }
}

export type PublicObjective = {
  id: string
  title: string
  description: string | null
  status: 'PENDING' | 'ACTIVE' | 'COMPLETE'
  sortOrder: number
}

export type PublicEnemy = {
  id: string
  name: string
  enemyType: string | null
  description: string | null
  sortOrder: number
}

export type PublicCampaignState = {
  campaignId: string
  campaignName: string
  campaignDescription: string
  missionId: string
  missionName: string
  missionDescription: string
  missionStatus: 'ACTIVE'
  battlefieldId: string
  battlefieldName: string
  battlefieldDescription: string
  enemyFaction: string
  campaignProgress: number
  revision: number
  authoritativeUpdatedAt: string
  objectives: PublicObjective[]
  enemies: PublicEnemy[]
}

export type PublicSyncSignal = {
  campaignId: string
  revision: number
  updateId: string
  isActive: boolean
  publishedAt: string
}

export type PublicCampaignSnapshot = {
  campaign: PublicCampaignState | null
  signal: PublicSyncSignal | null
}

export type RealtimeTransportStatus =
  | 'SUBSCRIBED'
  | 'DISCONNECTED'

export type PublicSyncSubscription = {
  unsubscribe: () => Promise<void>
}

type PublicSignalRow = Tables<'public_campaign_sync_signals'>

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidPublicState(detail: string): never {
  throw new SynchronizationError(
    'PUBLIC_STATE_INVALID',
    `The public campaign response is invalid: ${detail}.`,
  )
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key]

  if (typeof value !== 'string') {
    return invalidPublicState(`${key} must be text`)
  }

  return value
}

function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key)

  if (!uuidPattern.test(value)) {
    return invalidPublicState(`${key} must be a UUID`)
  }

  return value
}

function readTimestamp(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = readString(record, key)

  if (Number.isNaN(Date.parse(value))) {
    return invalidPublicState(`${key} must be a timestamp`)
  }

  return value
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = record[key]

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return invalidPublicState(`${key} is outside its valid range`)
  }

  return value
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key]

  if (value !== null && typeof value !== 'string') {
    return invalidPublicState(`${key} must be text or null`)
  }

  return value
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]

  if (!Array.isArray(value)) {
    return invalidPublicState(`${key} must be a list`)
  }

  return value
}

function parseObjective(value: unknown): PublicObjective {
  if (!isRecord(value)) {
    return invalidPublicState('objective entries must be objects')
  }

  const status = readString(value, 'status')

  if (!['PENDING', 'ACTIVE', 'COMPLETE'].includes(status)) {
    return invalidPublicState('objective status is not supported')
  }

  return {
    id: readUuid(value, 'id'),
    title: readString(value, 'title'),
    description: readNullableString(value, 'description'),
    status: status as PublicObjective['status'],
    sortOrder: readInteger(value, 'sort_order', 0),
  }
}

function parseEnemy(value: unknown): PublicEnemy {
  if (!isRecord(value)) {
    return invalidPublicState('enemy entries must be objects')
  }

  return {
    id: readUuid(value, 'id'),
    name: readString(value, 'name'),
    enemyType: readNullableString(value, 'enemy_type'),
    description: readNullableString(value, 'description'),
    sortOrder: readInteger(value, 'sort_order', 0),
  }
}

export function parsePublicCampaignState(value: unknown): PublicCampaignState {
  if (!isRecord(value)) {
    return invalidPublicState('campaign must be an object')
  }

  if (value.mission_status !== 'ACTIVE') {
    return invalidPublicState('only ACTIVE missions may be synchronized')
  }

  return {
    campaignId: readUuid(value, 'campaign_id'),
    campaignName: readString(value, 'campaign_name'),
    campaignDescription: readString(value, 'campaign_description'),
    missionId: readUuid(value, 'mission_id'),
    missionName: readString(value, 'mission_name'),
    missionDescription: readString(value, 'mission_description'),
    missionStatus: 'ACTIVE',
    battlefieldId: readUuid(value, 'battlefield_id'),
    battlefieldName: readString(value, 'battlefield_name'),
    battlefieldDescription: readString(value, 'battlefield_description'),
    enemyFaction: readString(value, 'enemy_faction'),
    campaignProgress: readInteger(value, 'campaign_progress', 0, 100),
    revision: readInteger(value, 'revision', 1),
    authoritativeUpdatedAt: readTimestamp(value, 'updated_at'),
    objectives: readArray(value, 'objectives').map(parseObjective),
    enemies: readArray(value, 'enemies').map(parseEnemy),
  }
}

export function parsePublicSyncSignal(value: unknown): PublicSyncSignal {
  if (!isRecord(value)) {
    return invalidPublicState('synchronization signal must be an object')
  }

  if (typeof value.is_active !== 'boolean') {
    return invalidPublicState('is_active must be boolean')
  }

  return {
    campaignId: readUuid(value, 'campaign_id'),
    revision: readInteger(value, 'revision', 1),
    updateId: readUuid(value, 'update_id'),
    isActive: value.is_active,
    publishedAt: readTimestamp(value, 'published_at'),
  }
}

export function parsePublicCampaignSnapshot(
  value: unknown,
): PublicCampaignSnapshot {
  if (!isRecord(value)) {
    return invalidPublicState('snapshot must be an object')
  }

  const activeCampaignCount = readInteger(
    value,
    'active_campaign_count',
    0,
    1,
  )
  const campaign =
    value.campaign === null ? null : parsePublicCampaignState(value.campaign)
  const signal =
    value.signal === null ? null : parsePublicSyncSignal(value.signal)

  if ((activeCampaignCount === 1) !== Boolean(campaign)) {
    return invalidPublicState('active campaign count does not match payload')
  }

  if (
    campaign &&
    (!signal ||
      !signal.isActive ||
      signal.campaignId !== campaign.campaignId ||
      signal.revision !== campaign.revision)
  ) {
    return invalidPublicState('campaign and synchronization signal disagree')
  }

  return { campaign, signal }
}

function requireSupabase() {
  if (!supabase) {
    throw new SynchronizationError(
      'NETWORK_UNAVAILABLE',
      'Supabase is not configured for this browser build.',
    )
  }

  return supabase
}

export async function fetchPublicCampaignSnapshot(): Promise<PublicCampaignSnapshot> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_public_sync_snapshot')

  if (error) {
    throw new SynchronizationError(
      'PUBLIC_STATE_FETCH_FAILED',
      'The authoritative public campaign state could not be retrieved.',
    )
  }

  return parsePublicCampaignSnapshot(data)
}

export async function fetchLatestPublicSyncSignal(): Promise<PublicSyncSignal | null> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_public_latest_sync_signal')

  if (error) {
    throw new SynchronizationError(
      'NETWORK_UNAVAILABLE',
      'The authoritative revision could not be verified.',
    )
  }

  if (data.length === 0) {
    return null
  }

  return parsePublicSyncSignal(data[0])
}

function mapRealtimeStatus(status: string): RealtimeTransportStatus | null {
  if (status === 'SUBSCRIBED') {
    return 'SUBSCRIBED'
  }

  if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
    return 'DISCONNECTED'
  }

  return null
}

export function subscribeToPublicSyncSignals(
  onSignal: (signal: PublicSyncSignal) => void,
  onStatus: (status: RealtimeTransportStatus) => void,
  onError: (error: SynchronizationError) => void,
): PublicSyncSubscription {
  const client = requireSupabase()
  let channel: RealtimeChannel | null = client.channel(
    'public-campaign-sync-signals',
  )

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'public_campaign_sync_signals',
      },
      (payload) => {
        try {
          onSignal(parsePublicSyncSignal(payload.new as PublicSignalRow))
        } catch (error) {
          onError(
            error instanceof SynchronizationError
              ? error
              : new SynchronizationError(
                  'PUBLIC_STATE_INVALID',
                  'A Realtime notification could not be validated.',
                ),
          )
        }
      },
    )
    .subscribe((status) => {
      const mappedStatus = mapRealtimeStatus(status)

      if (mappedStatus) {
        onStatus(mappedStatus)
      }
    })

  return {
    unsubscribe: async () => {
      if (channel) {
        const activeChannel = channel
        channel = null
        await client.removeChannel(activeChannel)
      }
    },
  }
}
