import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type ActiveSubmissionCampaign,
  type AuthoritativeSubmissionDatabase,
  type DiscordMembership,
  type SubmissionDatabaseCommand,
} from '../_shared/discord/intake.ts'
import {
  DiscordIntakeError,
  type SubmissionEventType,
} from '../_shared/discord/types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseMemberships(value: unknown): DiscordMembership[] {
  if (!Array.isArray(value)) {
    throw new DiscordIntakeError(
      'BACKEND_UNAVAILABLE',
      'Kill Team membership response was invalid.',
    )
  }

  return value.map((candidate) => {
    if (!isRecord(candidate)) {
      throw new DiscordIntakeError(
        'BACKEND_UNAVAILABLE',
        'Kill Team membership response was invalid.',
      )
    }

    const killTeamId = stringValue(candidate, 'kill_team_id')
    const missionId = stringValue(candidate, 'mission_id')
    if (!killTeamId || !missionId) {
      throw new DiscordIntakeError(
        'BACKEND_UNAVAILABLE',
        'Kill Team membership response was invalid.',
      )
    }

    return { killTeamId, missionId }
  })
}

function parseKillTeams(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) {
      return []
    }

    const id = stringValue(candidate, 'id')
    const name = stringValue(candidate, 'name')
    return id && name ? [{ id, name }] : []
  })
}

function parseScoringTargets(value: unknown) {
  return parseKillTeams(value).map(({ id, name }) => ({ key: id, name }))
}

function parseActiveCampaign(value: unknown): ActiveSubmissionCampaign | null {
  if (!isRecord(value) || value.campaign === null) {
    return null
  }

  if (!isRecord(value.campaign)) {
    throw new DiscordIntakeError(
      'BACKEND_UNAVAILABLE',
      'Active campaign response was invalid.',
    )
  }

  const campaignId = stringValue(value.campaign, 'campaign_id')
  const missionId = stringValue(value.campaign, 'mission_id')
  if (!campaignId || !missionId) {
    throw new DiscordIntakeError(
      'BACKEND_UNAVAILABLE',
      'Active campaign response was invalid.',
    )
  }

  return {
    campaignId,
    missionId,
    killTeams: parseKillTeams(value.campaign.kill_teams),
    scoringTargets: parseScoringTargets(
      value.campaign.crusade_scoring_targets,
    ),
  }
}

function providerText(error: unknown) {
  if (!isRecord(error)) {
    return String(error)
  }

  return ['message', 'details', 'hint']
    .map((key) => (typeof error[key] === 'string' ? error[key] : ''))
    .join(' ')
}

function providerLogDetails(error: unknown) {
  if (!isRecord(error)) {
    return { message: String(error) }
  }

  return Object.fromEntries(
    ['code', 'message', 'hint']
      .filter((key) => typeof error[key] === 'string' && error[key] !== '')
      .map((key) => [
        key,
        (error[key] as string).replace(
          /https:\/\/[^\s"']+/g,
          '[redacted-url]',
        ),
      ]),
  )
}

function classifyProviderError(
  operation: string,
  error: unknown,
): DiscordIntakeError {
  const text = providerText(error)

  if (text.includes('SUBMISSION_IDEMPOTENCY_CONFLICT')) {
    return new DiscordIntakeError(
      'IDEMPOTENCY_CONFLICT',
      'Discord interaction idempotency conflict.',
    )
  }

  if (
    text.includes('SUBMISSION_TARGET_NOT_FOUND_FOR_MISSION') ||
    text.includes('SUBMISSION_TARGET_EVENT_INVALID')
  ) {
    return new DiscordIntakeError(
      'INVALID_TARGET',
      'Terminus target is not valid for the ACTIVE mission.',
    )
  }

  if (text.includes('SUBMISSION_MISSION_NOT_ACTIVE')) {
    return new DiscordIntakeError(
      'NO_ACTIVE_MISSION',
      'No ACTIVE mission is accepting submissions.',
    )
  }

  if (text.includes('SUBMITTER_NOT_KILL_TEAM_MEMBER')) {
    return new DiscordIntakeError(
      'NOT_ASSIGNED',
      'Discord user is not assigned to the ACTIVE Kill Team.',
    )
  }

  console.error('[discord-submission-database] provider failure', {
    operation,
    provider: providerLogDetails(error),
  })

  return new DiscordIntakeError(
    'BACKEND_UNAVAILABLE',
    'The authoritative submission request failed.',
  )
}

function parseSubmissionResult(value: unknown) {
  const result = Array.isArray(value) ? value[0] : null
  if (!isRecord(result)) {
    throw new DiscordIntakeError(
      'BACKEND_UNAVAILABLE',
      'The authoritative submission response was empty.',
    )
  }

  const receiptReference = stringValue(result, 'receipt_reference')
  const status = stringValue(result, 'submission_status')
  const eventType = stringValue(result, 'submission_event_type')
  const killTeamId = stringValue(result, 'kill_team_id')

  if (!receiptReference || !status || !eventType || !killTeamId) {
    throw new DiscordIntakeError(
      'BACKEND_UNAVAILABLE',
      'The authoritative submission response was invalid.',
    )
  }

  return {
    receiptReference,
    status,
    eventType: eventType as SubmissionEventType,
    killTeamId,
  }
}

export function createSupabaseSubmissionDatabase(
  client: SupabaseClient,
): AuthoritativeSubmissionDatabase {
  return {
    async findMemberships(discordUserId) {
      const { data, error } = await client
        .from('kill_team_members')
        .select('kill_team_id, mission_id')
        .eq('discord_user_id', discordUserId)

      if (error) {
        throw classifyProviderError('find_memberships', error)
      }

      return parseMemberships(data)
    },

    async getActiveCampaign() {
      const { data, error } = await client.rpc('get_public_sync_snapshot')

      if (error) {
        throw classifyProviderError('get_active_campaign', error)
      }

      return parseActiveCampaign(data)
    },

    async createSubmission(command: SubmissionDatabaseCommand) {
      const { data, error } = await client.rpc('create_crusade_submission', {
        p_campaign_id: command.campaignId,
        p_mission_id: command.missionId,
        p_kill_team_id: command.killTeamId,
        p_submitting_discord_user_id: command.discordUserId,
        p_event_type: command.eventType,
        p_evidence_original_filename: command.evidenceOriginalFilename,
        p_evidence_content_type: command.evidenceContentType,
        p_evidence_source_reference: command.evidenceSourceReference,
        p_evidence_storage_path: command.evidenceStoragePath,
        p_evidence_file_size_bytes: command.evidenceFileSizeBytes,
        p_external_idempotency_key: `discord-interaction:${command.interactionId}`,
        ...(command.scoringTargetKey
          ? { p_scoring_target_key: command.scoringTargetKey }
          : {}),
      })

      if (error) {
        throw classifyProviderError('create_submission', error)
      }

      return parseSubmissionResult(data)
    },
  }
}
