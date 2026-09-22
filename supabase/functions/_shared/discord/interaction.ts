import { formatSubmissionEventType } from './notification.ts'
import { verifyDiscordRequestSignature } from './signature.ts'
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  DISCORD_EPHEMERAL_MESSAGE_FLAG,
  DiscordIntakeError,
  DiscordTeamRegistrationError,
type DiscordTeamRegistrationService, 
  type DiscordSubmissionInput,
  type DiscordSubmissionIntake,
  type DiscordSubmissionReceipt,
  type StaffSubmissionNotifier,
  type SubmissionEventType,
} from './types.ts'

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }
const snowflakePattern = /^[0-9]{17,20}$/
const supportedImageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])
const subcommandEventTypes = {
  objective: 'OBJECTIVE',
  terminus: 'TERMINUS_KILL',
  'mission-completion': 'MISSION_COMPLETION',
} as const satisfies Record<string, SubmissionEventType>

type DiscordInteractionHandlerConfig = {
  applicationId: string
  publicKey: string
  publicAppUrl: string
  guildId?: string
maxAttachmentBytes?: number
intake: DiscordSubmissionIntake
teamRegistration?: DiscordTeamRegistrationService
notifyStaff: StaffSubmissionNotifier
  waitUntil: (promise: Promise<void>) => void
  fetcher?: typeof fetch
  verifySignature?: typeof verifyDiscordRequestSignature
}

type DiscordOption = {
  type: number
  value: unknown
}

class InvalidInteractionError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  })
}

function ephemeralResponse(content: string) {
  return jsonResponse({
    type: 4,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_MESSAGE_FLAG,
      allowed_mentions: { parse: [] },
    },
  })
}

function deferredEphemeralResponse() {
  return jsonResponse({
    type: 5,
    data: { flags: DISCORD_EPHEMERAL_MESSAGE_FLAG },
  })
}

async function editOriginalResponse(
  fetcher: typeof fetch,
  applicationId: string,
  interactionToken: string,
  content: string,
) {
  const response = await fetcher(
    `https://discord.com/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Discord response finalization failed (${response.status}).`)
  }
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidInteractionError('The Discord command payload was invalid.')
  }

  return value
}

function readSnowflake(record: Record<string, unknown>, key: string) {
  const value = readString(record, key)

  if (!snowflakePattern.test(value)) {
    throw new InvalidInteractionError('The Discord command payload was invalid.')
  }

  return value
}

function parseOptions(value: unknown): Map<string, DiscordOption> {
  if (!Array.isArray(value)) {
    throw new InvalidInteractionError('The Discord command payload was invalid.')
  }

  const options = new Map<string, DiscordOption>()

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      throw new InvalidInteractionError('The Discord command payload was invalid.')
    }

    const name = readString(candidate, 'name')
    const type = candidate.type

    if (
      !['screenshot', 'target'].includes(name) ||
      typeof type !== 'number' ||
      options.has(name)
    ) {
      throw new InvalidInteractionError('The Discord command payload was invalid.')
    }

    options.set(name, { type, value: candidate.value })
  }

  return options
}

function parseTarget(
  options: Map<string, DiscordOption>,
  eventType: SubmissionEventType,
) {
  const option = options.get('target')

  if (eventType !== 'TERMINUS_KILL') {
    if (option) {
      throw new InvalidInteractionError(
        'A Terminus target is only valid for Terminus submissions.',
      )
    }

    return undefined
  }

  if (option?.type !== 3 || typeof option.value !== 'string') {
    throw new InvalidInteractionError(
      'Choose the configured Terminus target for this submission.',
    )
  }

  const value = option.value.trim()

  if (value.length === 0 || value.length > 100) {
    throw new InvalidInteractionError(
      'Choose the configured Terminus target for this submission.',
    )
  }

  return value
}

function parseSubcommand(value: unknown) {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new InvalidInteractionError('The Discord command payload was invalid.')
  }

  const subcommand = value[0]
  const name = readString(subcommand, 'name')
  if (
    subcommand.type !== 1 ||
    !Object.hasOwn(subcommandEventTypes, name)
  ) {
    throw new InvalidInteractionError(
      'Choose objective, terminus, or mission-completion.',
    )
  }

  return {
    eventType:
      subcommandEventTypes[name as keyof typeof subcommandEventTypes],
    options: parseOptions(subcommand.options),
  }
}

function parseAttachment(
  options: Map<string, DiscordOption>,
  resolved: unknown,
  maximumBytes: number,
) {
  const option = options.get('screenshot')

  if (option?.type !== 11 || typeof option.value !== 'string') {
    throw new InvalidInteractionError(
      'Attach exactly one PNG, JPEG, or WebP screenshot.',
    )
  }

  if (!isRecord(resolved) || !isRecord(resolved.attachments)) {
    throw new InvalidInteractionError(
      'Attach exactly one PNG, JPEG, or WebP screenshot.',
    )
  }

  const attachments = resolved.attachments
  const attachment = attachments[option.value]

  if (Object.keys(attachments).length !== 1 || !isRecord(attachment)) {
    throw new InvalidInteractionError(
      'Attach exactly one PNG, JPEG, or WebP screenshot.',
    )
  }

  const filename = readString(attachment, 'filename')
  const contentType = readString(attachment, 'content_type')
    .toLowerCase()
    .split(';', 1)[0]
  const sourceReference = readString(attachment, 'url')
  const size = attachment.size

  if (!contentType || !supportedImageTypes.has(contentType)) {
    throw new InvalidInteractionError(
      'Screenshot must be a PNG, JPEG, or WebP image.',
    )
  }

  if (!Number.isSafeInteger(size) || (size as number) <= 0) {
    throw new InvalidInteractionError('The screenshot size was invalid.')
  }

  if ((size as number) > maximumBytes) {
    throw new InvalidInteractionError(
      `Screenshot exceeds the configured ${Math.floor(maximumBytes / 1_048_576)} MiB limit.`,
    )
  }

  try {
    const url = new URL(sourceReference)
    if (url.protocol !== 'https:') {
      throw new Error('not https')
    }
  } catch {
    throw new InvalidInteractionError('The screenshot reference was invalid.')
  }

  return {
    evidenceOriginalFilename: filename,
    evidenceContentType: contentType,
    evidenceSourceReference: sourceReference,
    evidenceFileSizeBytes: size as number,
  }
}

function parseSubmission(
  interaction: Record<string, unknown>,
  maximumBytes: number,
  allowedGuildId?: string,
): DiscordSubmissionInput {
  const interactionId = readSnowflake(interaction, 'id')
  const guildId = readSnowflake(interaction, 'guild_id')

  if (allowedGuildId && guildId !== allowedGuildId) {
    throw new InvalidInteractionError(
      'This command is not available in this Discord server.',
    )
  }

  if (!isRecord(interaction.member) || !isRecord(interaction.member.user)) {
    throw new InvalidInteractionError(
      'Use this command from the configured Crusade Discord server.',
    )
  }

  const discordUserId = readSnowflake(interaction.member.user, 'id')

  if (!isRecord(interaction.data)) {
    throw new InvalidInteractionError('The Discord command payload was invalid.')
  }

  const { eventType, options } = parseSubcommand(interaction.data.options)
  const scoringTargetKey = parseTarget(options, eventType)

  return {
    interactionId,
    discordUserId,
    eventType,
    scoringTargetKey,
    ...parseAttachment(options, interaction.data.resolved, maximumBytes),
  }
}
function parseTeamRegistration(
  interaction: Record<string, unknown>,
  allowedGuildId?: string,
) {
  const guildId = readSnowflake(interaction, 'guild_id')

  if (allowedGuildId && guildId !== allowedGuildId) {
    throw new InvalidInteractionError(
      'This command is not available in this Discord server.',
    )
  }

  const member = interaction.member

  if (!isRecord(member) || !isRecord(member.user)) {
    throw new InvalidInteractionError(
      'Use this command from the configured Crusade Discord server.',
    )
  }

  const user = member.user
  const discordUserId = readSnowflake(user, 'id')

  let leaderDisplayName: string | null = null

  if (typeof member.nick === 'string' && member.nick.trim().length > 0) {
    leaderDisplayName = member.nick.trim()
  } else if (
    typeof user.global_name === 'string' &&
    user.global_name.trim().length > 0
  ) {
    leaderDisplayName = user.global_name.trim()
  } else if (
    typeof user.username === 'string' &&
    user.username.trim().length > 0
  ) {
    leaderDisplayName = user.username.trim()
  }

  if (!leaderDisplayName) {
    throw new InvalidInteractionError(
      'Your Discord display name could not be determined.',
    )
  }

  if (!isRecord(interaction.data)) {
    throw new InvalidInteractionError(
      'The Discord command payload was invalid.',
    )
  }

  const topLevelOptions = interaction.data.options

  if (
    !Array.isArray(topLevelOptions) ||
    topLevelOptions.length !== 1 ||
    !isRecord(topLevelOptions[0])
  ) {
    throw new InvalidInteractionError(
      'Choose a Kill Team command.',
    )
  }

  const subcommand = topLevelOptions[0]

  if (subcommand.type !== 1 || typeof subcommand.name !== 'string') {
    throw new InvalidInteractionError(
      'Choose a Kill Team command.',
    )
  }

  if (subcommand.name === 'register') {
    if (
      !Array.isArray(subcommand.options) ||
      subcommand.options.length !== 1 ||
      !isRecord(subcommand.options[0])
    ) {
      throw new InvalidInteractionError(
        'Enter a valid Kill Team name.',
      )
    }

    const nameOption = subcommand.options[0]

    if (
      nameOption.name !== 'name' ||
      nameOption.type !== 3 ||
      typeof nameOption.value !== 'string'
    ) {
      throw new InvalidInteractionError(
        'Enter a valid Kill Team name.',
      )
    }

    const name = nameOption.value.trim()

    if (name.length < 2 || name.length > 50) {
      throw new InvalidInteractionError(
        'Kill Team name must be between 2 and 50 characters.',
      )
    }

    return {
      action: 'register' as const,
      discordUserId,
      leaderDisplayName,
      name,
    }
  }

  if (
  subcommand.name === 'add' ||
  subcommand.name === 'remove'
) {
    if (
      !Array.isArray(subcommand.options) ||
      subcommand.options.length !== 1 ||
      !isRecord(subcommand.options[0])
    ) {
      throw new InvalidInteractionError(
        'Choose a Discord member to add.',
      )
    }

    const memberOption = subcommand.options[0]

    if (
      memberOption.name !== 'member' ||
      memberOption.type !== 6 ||
      typeof memberOption.value !== 'string' ||
      !snowflakePattern.test(memberOption.value)
    ) {
      throw new InvalidInteractionError(
        'Choose a Discord member to add.',
      )
    }

    const selectedUserId = memberOption.value

    if (!isRecord(interaction.data.resolved)) {
      throw new InvalidInteractionError(
        'The selected Discord member could not be resolved.',
      )
    }

    const resolved = interaction.data.resolved

    if (
      !isRecord(resolved.users) ||
      !isRecord(resolved.users[selectedUserId])
    ) {
      throw new InvalidInteractionError(
        'The selected Discord member could not be resolved.',
      )
    }

    const selectedUser = resolved.users[selectedUserId]
    const selectedMember =
      isRecord(resolved.members) &&
      isRecord(resolved.members[selectedUserId])
        ? resolved.members[selectedUserId]
        : null

    let selectedDisplayName: string | null = null

    if (
      selectedMember &&
      typeof selectedMember.nick === 'string' &&
      selectedMember.nick.trim().length > 0
    ) {
      selectedDisplayName = selectedMember.nick.trim()
    } else if (
      typeof selectedUser.global_name === 'string' &&
      selectedUser.global_name.trim().length > 0
    ) {
      selectedDisplayName = selectedUser.global_name.trim()
    } else if (
      typeof selectedUser.username === 'string' &&
      selectedUser.username.trim().length > 0
    ) {
      selectedDisplayName = selectedUser.username.trim()
    }

    if (!selectedDisplayName) {
      throw new InvalidInteractionError(
        'The selected Discord member name could not be determined.',
      )
    }

    return {
      action: subcommand.name as 'add' | 'remove',
       discordUserId,
       memberDiscordUserId: selectedUserId,
       memberDisplayName: selectedDisplayName,
}
  }

  throw new InvalidInteractionError(
    'Choose register, add, or remove.',
  )
}

function errorMessage(error: unknown) {
  if (error instanceof InvalidInteractionError) {
    return error.message
  }

  if (error instanceof DiscordIntakeError) {
    const messages: Record<typeof error.code, string> = {
      NO_ACTIVE_MISSION: 'No ACTIVE Crusade mission is accepting submissions.',
      NOT_ASSIGNED:
        'Your Discord account is not assigned to a Kill Team in the ACTIVE mission.',
      INVALID_TARGET:
        'The selected Terminus target is not configured for the ACTIVE mission.',
      IDEMPOTENCY_CONFLICT:
        'This Discord interaction conflicts with an existing submission.',
      EVIDENCE_STORAGE_FAILED:
        'Your screenshot could not be stored. Please try again.',
      BACKEND_UNAVAILABLE:
        'Crusade Command is temporarily unavailable. Try again shortly.',
    }

    return messages[error.code]
  }

  if (error instanceof DiscordIntakeError) {
  const messages: Record<typeof error.code, string> = {
    NO_ACTIVE_MISSION: 'No ACTIVE Crusade mission is accepting submissions.',
    NOT_ASSIGNED:
      'Your Discord account is not assigned to a Kill Team in the ACTIVE mission.',
    INVALID_TARGET:
      'The selected Terminus target is not configured for the ACTIVE mission.',
    IDEMPOTENCY_CONFLICT:
      'This Discord interaction conflicts with an existing submission.',
    EVIDENCE_STORAGE_FAILED:
      'Your screenshot could not be stored. Please try again.',
    BACKEND_UNAVAILABLE:
      'Crusade Command is temporarily unavailable. Try again shortly.',
  }

  return messages[error.code]
}

/* PASTE STEP 3 RIGHT HERE */

if (error instanceof DiscordTeamRegistrationError) {
  const messages: Record<typeof error.code, string> = {
    NO_REGISTRATION_CAMPAIGN:
      'No Crusade campaign is currently accepting Kill Team registration.',
    NAME_TAKEN:
      'That Kill Team name is already registered. Choose another name.',
    ALREADY_REGISTERED:
      'Your Discord account is already registered to a Kill Team in this campaign.',
      LEADER_NOT_FOUND:
  'You must be the registered Kill Team Leader to manage this roster.',
    ROSTER_FULL:
  'Your Kill Team already has the maximum of four members.',
    MEMBER_NOT_FOUND:
  'That Discord member is not on your Kill Team.',
    LEADER_CANNOT_REMOVE_SELF:
  'The Kill Team Leader cannot remove themselves from the roster.',
    REGISTRATION_LOCKED:
      'Kill Team registration is locked because Crusade scoring has started.',
    BACKEND_UNAVAILABLE:
      'Crusade Command is temporarily unavailable. Try again shortly.',
  }

  return messages[error.code]
}

return 'Crusade Command is temporarily unavailable. Try again shortly.'

  return 'Crusade Command is temporarily unavailable. Try again shortly.'
}

function logUnexpectedError(operation: string, error: unknown) {
  if (error instanceof InvalidInteractionError) {
    return
  }

  if (
    error instanceof DiscordIntakeError &&
    error.code !== 'BACKEND_UNAVAILABLE'
  ) {
    return
  }

  console.error('[discord-interactions] request failed', {
    operation,
    name: error instanceof Error ? error.name : 'UnknownError',
    code: error instanceof DiscordIntakeError ? error.code : undefined,
    message:
      error instanceof DiscordIntakeError
        ? error.message
        : 'Unexpected interaction failure.',
  })
}

function teamRegistrationSuccessMessage(
  teamName: string,
  campaignName: string,
  missionTeamCount: number,
) {
  return [
    '**KILL TEAM REGISTERED**',
    '',
    `Kill Team: ${teamName}`,
    `Campaign: ${campaignName}`,
    'Kill Team Leader: You',
    `Mission Rosters Prepared: ${missionTeamCount}`,
    '',
    'Your Kill Team registration is complete.',
  ].join('\n')
}

function successMessage(
  receiptReference: string,
  killTeamName: string,
  eventType: SubmissionEventType,
  targetName: string | null,
) {
  return [
    '**SUBMISSION RECEIVED**',
    '',
    `Receipt: ${receiptReference}`,
    `Kill Team: ${killTeamName}`,
    `Type: ${formatSubmissionEventType(eventType)}`,
    ...(targetName ? [`Target: ${targetName}`] : []),
    'Status: PENDING REVIEW',
    '',
    'Your screenshot has been submitted for verification.',
  ].join('\n')
}

function reviewUrl(publicAppUrl: string, receiptReference: string) {
  const url = new URL('/admin/submissions', publicAppUrl)
  url.searchParams.set('receipt', receiptReference)
  return url.toString()
}

export function createDiscordInteractionHandler({
  applicationId,
  publicKey,
  publicAppUrl,
  guildId,
  maxAttachmentBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  intake,
teamRegistration,
notifyStaff,
  waitUntil,
  fetcher = fetch,
  verifySignature = verifyDiscordRequestSignature,
}: DiscordInteractionHandlerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405)
    }

    const signature = request.headers.get('x-signature-ed25519')
    const timestamp = request.headers.get('x-signature-timestamp')

    if (!signature || !timestamp) {
      return jsonResponse({ error: 'Invalid request signature.' }, 401)
    }

    const rawBody = await request.text()
    if (!(await verifySignature(publicKey, signature, timestamp, rawBody))) {
      return jsonResponse({ error: 'Invalid request signature.' }, 401)
    }

    let interaction: unknown
    try {
      interaction = JSON.parse(rawBody)
    } catch {
      return jsonResponse({ error: 'Invalid request payload.' }, 400)
    }

    if (!isRecord(interaction) || typeof interaction.type !== 'number') {
      return jsonResponse({ error: 'Invalid request payload.' }, 400)
    }

    if (interaction.type === 1) {
      return jsonResponse({ type: 1 })
    }

if (
  interaction.type !== 2 ||
  !isRecord(interaction.data)
) {
  return ephemeralResponse('This Discord interaction is not supported.')
}

const commandName = interaction.data.name

if (
  commandName !== 'crusade-submit' &&
  commandName !== 'crusade-team'
) {
  return ephemeralResponse('This Discord interaction is not supported.')
}

    if (interaction.application_id !== applicationId) {
      return jsonResponse({ error: 'Invalid request signature.' }, 401)
    }

    let interactionToken: string
    try {
      interactionToken = readString(interaction, 'token')
    } catch (error) {
      return ephemeralResponse(errorMessage(error))
    }

if (commandName === 'crusade-team') {
  waitUntil(
    (async () => {
      try {
        if (!teamRegistration) {
          throw new DiscordTeamRegistrationError(
            'BACKEND_UNAVAILABLE',
            'Kill Team registration service is unavailable.',
          )
        }

        const input = parseTeamRegistration(interaction, guildId)
        const campaign =
          await teamRegistration.findRegistrationCampaign()

        if (input.action === 'register') {
          const result = await teamRegistration.registerTeam({
            campaignId: campaign.id,
            name: input.name,
            leaderDiscordUserId: input.discordUserId,
            leaderDisplayName: input.leaderDisplayName,
          })

          await editOriginalResponse(
            fetcher,
            applicationId,
            interactionToken,
            teamRegistrationSuccessMessage(
              input.name,
              campaign.name,
              result.missionTeamCount,
            ),
          )
        } else if (input.action === 'add') {
          const result = await teamRegistration.addMember({
            campaignId: campaign.id,
            leaderDiscordUserId: input.discordUserId,
            memberDiscordUserId: input.memberDiscordUserId,
            memberDisplayName: input.memberDisplayName,
          })

          await editOriginalResponse(
            fetcher,
            applicationId,
            interactionToken,
            [
              '**KILL TEAM MEMBER ADDED**',
              '',
              `Kill Team: ${result.killTeamName}`,
              `Member: ${input.memberDisplayName}`,
              `Roster: ${result.memberCount}/4`,
              '',
              'The member has been added to all mission rosters.',
            ].join('\n'),
          )
        } else if (input.action === 'remove') {
          const result = await teamRegistration.removeMember({
            campaignId: campaign.id,
            leaderDiscordUserId: input.discordUserId,
            memberDiscordUserId: input.memberDiscordUserId,
          })

          await editOriginalResponse(
            fetcher,
            applicationId,
            interactionToken,
            [
              '**KILL TEAM MEMBER REMOVED**',
              '',
              `Kill Team: ${result.killTeamName}`,
              `Member: ${input.memberDisplayName}`,
              `Roster: ${result.memberCount}/4`,
              '',
              'The member has been removed from all mission rosters.',
            ].join('\n'),
          )
        }
      } catch (error) {
        logUnexpectedError('manage_kill_team', error)

        try {
          await editOriginalResponse(
            fetcher,
            applicationId,
            interactionToken,
            errorMessage(error),
          )
        } catch (finalizationError) {
          logUnexpectedError(
            'finalize_response',
            finalizationError,
          )
        }
      }
    })(),
  )

  return deferredEphemeralResponse()
}

    waitUntil(
      (async () => {
        let input: DiscordSubmissionInput
        let receipt: DiscordSubmissionReceipt

        try {
          input = parseSubmission(interaction, maxAttachmentBytes, guildId)
          receipt = await intake.createSubmission(input)
        } catch (error) {
          logUnexpectedError(
            error instanceof InvalidInteractionError
              ? 'parse_submission'
              : 'create_submission',
            error,
          )

          try {
            await editOriginalResponse(
              fetcher,
              applicationId,
              interactionToken,
              errorMessage(error),
            )
          } catch (finalizationError) {
            logUnexpectedError('finalize_response', finalizationError)
          }
          return
        }

        try {
          await editOriginalResponse(
            fetcher,
            applicationId,
            interactionToken,
            successMessage(
              receipt.receiptReference,
              receipt.killTeamName,
              receipt.eventType,
              receipt.targetName,
            ),
          )
        } catch (error) {
          logUnexpectedError('finalize_response', error)
          return
        }

        try {
          await notifyStaff({
            ...receipt,
            interactionId: input.interactionId,
            discordUserId: input.discordUserId,
            reviewUrl: reviewUrl(publicAppUrl, receipt.receiptReference),
          })
        } catch (error) {
          logUnexpectedError('notify_staff', error)
        }
      })(),
    )

    return deferredEphemeralResponse()
  }
}
