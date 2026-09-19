import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DiscordTeamRegistrationError,
  type DiscordTeamRegistrationResult,
} from '../_shared/discord/types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function providerText(error: unknown) {
  if (!isRecord(error)) {
    return String(error)
  }

  return ['message', 'details', 'hint']
    .map((key) => (typeof error[key] === 'string' ? error[key] : ''))
    .join(' ')
}

function classifyRegistrationError(error: unknown) {
  const text = providerText(error)

  if (text.includes('KILL_TEAM_NAME_TAKEN')) {
    return new DiscordTeamRegistrationError(
      'NAME_TAKEN',
      'That Kill Team name is already registered.',
    )
  }

  if (text.includes('KILL_TEAM_MEMBER_ALREADY_REGISTERED')) {
    return new DiscordTeamRegistrationError(
      'ALREADY_REGISTERED',
      'This Discord account is already registered to a Kill Team.',
    )
  }

  if (text.includes('KILL_TEAM_REGISTRATION_LOCKED')) {
    return new DiscordTeamRegistrationError(
      'REGISTRATION_LOCKED',
      'Kill Team registration is currently locked.',
    )
  }

  return new DiscordTeamRegistrationError(
    'BACKEND_UNAVAILABLE',
    'Kill Team registration failed.',
  )
}

function parseRegistrationResult(value: unknown): DiscordTeamRegistrationResult {
  const result = Array.isArray(value) ? value[0] : null

  if (!isRecord(result)) {
    throw new DiscordTeamRegistrationError(
      'BACKEND_UNAVAILABLE',
      'Kill Team registration returned an invalid response.',
    )
  }

  const campaignKillTeamId = result.campaign_kill_team_id
  const missionTeamCount = result.mission_team_count
  const newRevision = result.new_revision

  if (
    typeof campaignKillTeamId !== 'string' ||
    typeof missionTeamCount !== 'number' ||
    typeof newRevision !== 'number'
  ) {
    throw new DiscordTeamRegistrationError(
      'BACKEND_UNAVAILABLE',
      'Kill Team registration returned an invalid response.',
    )
  }

  return {
    campaignKillTeamId,
    missionTeamCount,
    newRevision,
  }
}

export function createSupabaseTeamRegistrationDatabase(
  client: SupabaseClient,
) {
  return {
    async registerTeam(input: {
      campaignId: string
      name: string
      leaderDiscordUserId: string
      leaderDisplayName: string
    }) {
      const { data, error } = await client.rpc(
        'discord_register_campaign_kill_team',
        {
          p_campaign_id: input.campaignId,
          p_name: input.name,
          p_leader_discord_user_id: input.leaderDiscordUserId,
          p_leader_display_name: input.leaderDisplayName,
        },
      )

      if (error) {
        throw classifyRegistrationError(error)
      }

      return parseRegistrationResult(data)
    },

    async findRegistrationCampaign() {
      const { data, error } = await client
        .from('campaigns')
        .select('id, name')
        .eq('status', 'ACTIVE')

      if (error) {
        throw new DiscordTeamRegistrationError(
          'BACKEND_UNAVAILABLE',
          'Campaign lookup failed.',
        )
      }

      if (!Array.isArray(data) || data.length !== 1) {
        throw new DiscordTeamRegistrationError(
          'NO_REGISTRATION_CAMPAIGN',
          'There is no single active campaign accepting registration.',
        )
      }

      const campaign = data[0]

      if (
        !isRecord(campaign) ||
        typeof campaign.id !== 'string' ||
        typeof campaign.name !== 'string'
      ) {
        throw new DiscordTeamRegistrationError(
          'BACKEND_UNAVAILABLE',
          'Campaign lookup returned an invalid response.',
        )
      }

      return {
        id: campaign.id,
        name: campaign.name,
      }
    },
  }
}