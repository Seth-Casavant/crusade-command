// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { createDiscordInteractionHandler } from './interaction.ts'

import {
  DiscordIntakeError,
  DiscordTeamRegistrationError,
  type DiscordTeamRegistrationService,
  type DiscordSubmissionInput,
  type DiscordSubmissionIntake,
  type StaffSubmissionNotifier,
  type SubmissionEventType,
} from './types.ts'

const applicationId = '100000000000000001'
const guildId = '200000000000000002'
const interactionId = '300000000000000003'
const discordUserId = '900000000000000001'
const attachmentId = '500000000000000005'
const interactionToken = 'server-only-interaction-token'

function interaction({
  subcommand = 'objective',
  contentType = 'image/png',
  size = 2048,
  includeScreenshot = true,
  target,
}: {
  subcommand?: string
  contentType?: string
  size?: number
  includeScreenshot?: boolean
  target?: string
} = {}) {
  const options: Array<Record<string, unknown>> = []
  if (includeScreenshot) {
    options.push({ name: 'screenshot', type: 11, value: attachmentId })
  }
  if (target) {
    options.push({ name: 'target', type: 3, value: target })
  }

  return {
    id: interactionId,
    application_id: applicationId,
    token: interactionToken,
    guild_id: guildId,
    type: 2,
    member: { user: { id: discordUserId } },
    data: {
      name: 'crusade-submit',
      options: [{ name: subcommand, type: 1, options }],
      resolved: {
        attachments: includeScreenshot
          ? {
              [attachmentId]: {
                id: attachmentId,
                filename: 'result.png',
                content_type: contentType,
                size,
                url: 'https://cdn.discordapp.com/attachments/1/2/result.png',
              },
            }
          : {},
      },
    },
  }
}

function teamInteraction(name = 'Blood Reavers') {
  return {
    id: interactionId,
    application_id: applicationId,
    token: interactionToken,
    guild_id: guildId,
    type: 2,
    member: {
      nick: 'Omnial',
      user: {
        id: discordUserId,
        username: 'omnial',
      },
    },
    data: {
      name: 'crusade-team',
      options: [
        {
          name: 'register',
          type: 1,
          options: [
            {
              name: 'name',
              type: 3,
              value: name,
            },
          ],
        },
      ],
    },
  }
}

function teamAddInteraction() {
  const addedDiscordUserId = '900000000000000002'

  return {
    id: interactionId,
    application_id: applicationId,
    token: interactionToken,
    guild_id: guildId,
    type: 2,
    member: {
      nick: 'Omnial',
      user: {
        id: discordUserId,
        username: 'omnial',
      },
    },
    data: {
      name: 'crusade-team',
      options: [
        {
          name: 'add',
          type: 1,
          options: [
            {
              name: 'member',
              type: 6,
              value: addedDiscordUserId,
            },
          ],
        },
      ],
      resolved: {
        users: {
          [addedDiscordUserId]: {
            id: addedDiscordUserId,
            username: 'decimus',
            global_name: 'Decimus',
          },
        },
        members: {
          [addedDiscordUserId]: {
            nick: 'Decimus',
          },
        },
      },
    },
  }
}

function teamRemoveInteraction() {
  const removedDiscordUserId = '900000000000000002'

  return {
    id: interactionId,
    application_id: applicationId,
    token: interactionToken,
    guild_id: guildId,
    type: 2,
    member: {
      nick: 'Omnial',
      user: {
        id: discordUserId,
        username: 'omnial',
      },
    },
    data: {
      name: 'crusade-team',
      options: [
        {
          name: 'remove',
          type: 1,
          options: [
            {
              name: 'member',
              type: 6,
              value: removedDiscordUserId,
            },
          ],
        },
      ],
      resolved: {
        users: {
          [removedDiscordUserId]: {
            id: removedDiscordUserId,
            username: 'decimus',
            global_name: 'Decimus',
          },
        },
        members: {
          [removedDiscordUserId]: {
            nick: 'Decimus',
          },
        },
      },
    },
  }
}

function createIntake(
  createSubmission = vi.fn(
    async (input: DiscordSubmissionInput) => ({
      receiptReference: 'CR-00482',
      killTeamName: 'Sandbox Kill Team Alpha',
      eventType: input.eventType,
      targetName:
        input.eventType === 'TERMINUS_KILL' ? 'Neurothrope' : null,
      status: 'PENDING' as const,
    }),
  ),
): DiscordSubmissionIntake {
  return { createSubmission }
}

function createTeamRegistration(): DiscordTeamRegistrationService {
  return {
    findRegistrationCampaign: vi.fn(async () => ({
      id: '13000000-0000-4000-8000-000000000001',
      name: 'Nexovar Crusade',
    })),

    registerTeam: vi.fn(async () => ({
      campaignKillTeamId: '23000000-0000-4000-8000-000000000001',
      missionTeamCount: 4,
      newRevision: 12,
    })),

    addMember: vi.fn(async () => ({
      campaignKillTeamId: '23000000-0000-4000-8000-000000000001',
      killTeamName: 'Blood Reavers',
      memberCount: 2,
      missionTeamCount: 4,
      newRevision: 13,
    })),

    removeMember: vi.fn(async () => ({
      campaignKillTeamId: '23000000-0000-4000-8000-000000000001',
      killTeamName: 'Blood Reavers',
      memberCount: 1,
      missionTeamCount: 4,
      newRevision: 14,
})),
  }
}


function createHandler({
  intake = createIntake(),
  teamRegistration = createTeamRegistration(),
  notifyStaff = vi.fn(async () => undefined),
  signatureValid = true,
  fetcher = vi.fn(async () => new Response(null, { status: 200 })),
}: {
  intake?: DiscordSubmissionIntake
  teamRegistration?: DiscordTeamRegistrationService
  notifyStaff?: StaffSubmissionNotifier
  signatureValid?: boolean
  fetcher?: ReturnType<typeof vi.fn>
} = {}) {
  const backgroundTasks: Promise<void>[] = []
  const waitUntil = vi.fn((promise: Promise<void>) => {
    backgroundTasks.push(promise)
  })

  return {
  intake,
  teamRegistration,
  notifyStaff,
    fetcher,
    waitUntil,
    finishBackground: () => Promise.all(backgroundTasks),
    handler: createDiscordInteractionHandler({
      applicationId,
      publicKey: '11'.repeat(32),
      publicAppUrl: 'https://crusade.example',
      guildId,
      maxAttachmentBytes: 5_000_000,
      intake,
      teamRegistration,
      notifyStaff,
      waitUntil,
      fetcher: fetcher as typeof fetch,
      verifySignature: vi.fn(async () => signatureValid),
    }),
  }
}

function request(payload: unknown, includeSignature = true) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (includeSignature) {
    headers.set('x-signature-ed25519', '22'.repeat(64))
    headers.set('x-signature-timestamp', '1789650000')
  }

  return new Request('https://edge.example/discord-interactions', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
}

async function responseData(response: Response) {
  return (await response.json()) as {
    type?: number
    data?: { content?: string; flags?: number }
    error?: string
  }
}

function finalizedMessage(fetcher: ReturnType<typeof vi.fn>, call = 0) {
  const init = fetcher.mock.calls[call]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as {
    content: string
    allowed_mentions: { parse: string[] }
  }
}

describe('Discord interaction handler', () => {
  it('rejects a request with a missing signature before intake', async () => {
    const { handler, intake } = createHandler()
    const response = await handler(request(interaction(), false))

    expect(response.status).toBe(401)
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects an invalid signature before intake', async () => {
    const { handler, intake } = createHandler({ signatureValid: false })
    const response = await handler(request(interaction()))

    expect(response.status).toBe(401)
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('returns Discord PONG for a signed PING', async () => {
    const { handler } = createHandler()
    const response = await handler(request({ type: 1 }))

    await expect(responseData(response)).resolves.toEqual({ type: 1 })
  })

  it('routes /crusade-submit and derives the immutable Discord identity', async () => {
    const { handler, intake, finishBackground } = createHandler()
    await handler(request(interaction()))
    await finishBackground()

    expect(intake.createSubmission).toHaveBeenCalledWith({
      interactionId,
      discordUserId,
      eventType: 'OBJECTIVE',
      evidenceOriginalFilename: 'result.png',
      evidenceContentType: 'image/png',
      evidenceSourceReference:
        'https://cdn.discordapp.com/attachments/1/2/result.png',
      evidenceFileSizeBytes: 2048,
    })
  })

it('routes /crusade-team register using the Discord identity', async () => {
  const teamRegistration = createTeamRegistration()

  const {
    handler,
    fetcher,
    finishBackground,
  } = createHandler({
    teamRegistration,
  })

  const response = await handler(
    request(teamInteraction()),
  )

  const body = await responseData(response)

  await finishBackground()

  expect(body).toEqual({
    type: 5,
    data: { flags: 64 },
  })

  expect(
    teamRegistration.findRegistrationCampaign,
  ).toHaveBeenCalledOnce()

  expect(
    teamRegistration.registerTeam,
  ).toHaveBeenCalledWith({
    campaignId: '13000000-0000-4000-8000-000000000001',
    name: 'Blood Reavers',
    leaderDiscordUserId: discordUserId,
    leaderDisplayName: 'Omnial',
  })

  expect(finalizedMessage(fetcher).content).toContain(
    'KILL TEAM REGISTERED',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Kill Team: Blood Reavers',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Campaign: Nexovar Crusade',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Mission Rosters Prepared: 4',
  )
})

it('routes /crusade-team add using the selected Discord member', async () => {
  const teamRegistration = createTeamRegistration()

  const {
    handler,
    fetcher,
    finishBackground,
  } = createHandler({
    teamRegistration,
  })

  const response = await handler(
    request(teamAddInteraction()),
  )

  const body = await responseData(response)

  await finishBackground()

  expect(body).toEqual({
    type: 5,
    data: { flags: 64 },
  })

  expect(
    teamRegistration.addMember,
  ).toHaveBeenCalledWith({
    campaignId: '13000000-0000-4000-8000-000000000001',
    leaderDiscordUserId: discordUserId,
    memberDiscordUserId: '900000000000000002',
    memberDisplayName: 'Decimus',
  })

  expect(finalizedMessage(fetcher).content).toContain(
    'KILL TEAM MEMBER ADDED',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Member: Decimus',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Roster: 2/4',
  )
})

it('routes /crusade-team remove using the selected Discord member', async () => {
  const teamRegistration = createTeamRegistration()

  const {
    handler,
    fetcher,
    finishBackground,
  } = createHandler({
    teamRegistration,
  })

  const response = await handler(
    request(teamRemoveInteraction()),
  )

  const body = await responseData(response)

  await finishBackground()

  expect(body).toEqual({
    type: 5,
    data: { flags: 64 },
  })

  expect(
    teamRegistration.removeMember,
  ).toHaveBeenCalledWith({
    campaignId: '13000000-0000-4000-8000-000000000001',
    leaderDiscordUserId: discordUserId,
    memberDiscordUserId: '900000000000000002',
  })

  expect(finalizedMessage(fetcher).content).toContain(
    'KILL TEAM MEMBER REMOVED',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Member: Decimus',
  )

  expect(finalizedMessage(fetcher).content).toContain(
    'Roster: 1/4',
  )
})

it.each([
  ['NAME_TAKEN', /already registered/i],
  ['ALREADY_REGISTERED', /already registered to a Kill Team/i],
  ['REGISTRATION_LOCKED', /registration is locked/i],
] as const)(
  'finalizes /crusade-team register with a safe %s error',
  async (code, message) => {
    const teamRegistration = createTeamRegistration()

    teamRegistration.registerTeam = vi.fn(async () => {
      throw new DiscordTeamRegistrationError(
        code,
        'private backend detail',
      )
    })

    const {
      handler,
      intake,
      notifyStaff,
      fetcher,
      finishBackground,
    } = createHandler({
      teamRegistration,
    })

    const response = await handler(
      request(teamInteraction()),
    )

    const body = await responseData(response)

    await finishBackground()

    const finalContent = finalizedMessage(fetcher).content

    expect(body).toEqual({
      type: 5,
      data: { flags: 64 },
    })

    expect(finalContent).toMatch(message)
    expect(finalContent).not.toContain('private backend detail')

    expect(intake.createSubmission).not.toHaveBeenCalled()
    expect(notifyStaff).not.toHaveBeenCalled()
  },
)

it('returns a safe message when no campaign is accepting registration', async () => {
  const teamRegistration = createTeamRegistration()

  teamRegistration.findRegistrationCampaign = vi.fn(async () => {
    throw new DiscordTeamRegistrationError(
      'NO_REGISTRATION_CAMPAIGN',
      'private campaign lookup detail',
    )
  })

  const {
    handler,
    intake,
    notifyStaff,
    fetcher,
    finishBackground,
  } = createHandler({
    teamRegistration,
  })

  const response = await handler(
    request(teamInteraction()),
  )

  await finishBackground()

  expect((await responseData(response)).type).toBe(5)

  const finalContent = finalizedMessage(fetcher).content

  expect(finalContent).toMatch(
    /No Crusade campaign is currently accepting Kill Team registration/i,
  )

  expect(finalContent).not.toContain(
    'private campaign lookup detail',
  )

  expect(teamRegistration.registerTeam).not.toHaveBeenCalled()
  expect(intake.createSubmission).not.toHaveBeenCalled()
  expect(notifyStaff).not.toHaveBeenCalled()
})

it('rejects an invalid Kill Team name before calling the registration service', async () => {
  const teamRegistration = createTeamRegistration()

  const {
    handler,
    intake,
    notifyStaff,
    fetcher,
    finishBackground,
  } = createHandler({
    teamRegistration,
  })

  const response = await handler(
    request(teamInteraction('A')),
  )

  await finishBackground()

  expect((await responseData(response)).type).toBe(5)

  expect(finalizedMessage(fetcher).content).toMatch(
    /between 2 and 50 characters/i,
  )

  expect(
    teamRegistration.findRegistrationCampaign,
  ).not.toHaveBeenCalled()

  expect(
    teamRegistration.registerTeam,
  ).not.toHaveBeenCalled()

  expect(intake.createSubmission).not.toHaveBeenCalled()
  expect(notifyStaff).not.toHaveBeenCalled()
})

  it.each([
    ['objective', 'OBJECTIVE', undefined],
    ['terminus', 'TERMINUS_KILL', 'neurothrope'],
    ['mission-completion', 'MISSION_COMPLETION', undefined],
  ] as const)(
    'maps the %s subcommand to %s',
    async (subcommand, eventType, target) => {
      const { handler, intake, finishBackground } = createHandler()
      await handler(request(interaction({ subcommand, target })))
      await finishBackground()

      expect(intake.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ eventType, scoringTargetKey: target }),
      )
    },
  )

  it('rejects an invalid subcommand', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(
      request(interaction({ subcommand: 'arbitrary-score' })),
    )
    const body = await responseData(response)
    await finishBackground()

    expect(body.type).toBe(5)
    expect(body.data?.flags).toBe(64)
    expect(finalizedMessage(fetcher).content).toMatch(
      /Choose objective, terminus/i,
    )
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('requires exactly one screenshot attachment', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(
      request(interaction({ includeScreenshot: false })),
    )
    await finishBackground()

    expect((await responseData(response)).type).toBe(5)
    expect(finalizedMessage(fetcher).content).toMatch(/Attach exactly one/i)
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it.each(['image/png', 'image/jpeg', 'image/webp'])(
    'accepts screenshot MIME type %s',
    async (contentType) => {
      const { handler, intake, finishBackground } = createHandler()
      await handler(request(interaction({ contentType })))
      await finishBackground()

      expect(intake.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ evidenceContentType: contentType }),
      )
    },
  )

  it('rejects an unsupported screenshot MIME type', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(
      request(interaction({ contentType: 'image/svg+xml' })),
    )
    await finishBackground()

    expect((await responseData(response)).type).toBe(5)
    expect(finalizedMessage(fetcher).content).toMatch(
      /PNG, JPEG, or WebP/i,
    )
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects an oversized screenshot', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(request(interaction({ size: 5_000_001 })))
    await finishBackground()

    expect((await responseData(response)).type).toBe(5)
    expect(finalizedMessage(fetcher).content).toMatch(/exceeds/i)
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects inappropriate Terminus target input for other event types', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(
      request(interaction({ subcommand: 'objective', target: 'neurothrope' })),
    )
    await finishBackground()

    expect((await responseData(response)).type).toBe(5)
    expect(finalizedMessage(fetcher).content).toMatch(
      /only valid for Terminus/i,
    )
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('requires a target for the terminus subcommand', async () => {
    const { handler, intake, fetcher, finishBackground } = createHandler()
    const response = await handler(
      request(interaction({ subcommand: 'terminus' })),
    )
    await finishBackground()

    expect((await responseData(response)).type).toBe(5)
    expect(finalizedMessage(fetcher).content).toMatch(
      /configured Terminus target/i,
    )
    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('does not accept a client-supplied Kill Team identity', async () => {
    const payload = interaction()
    payload.data.options[0].options.push({
      name: 'kill_team',
      type: 3,
      value: 'spoofed-team',
    })
    const { handler, intake, finishBackground } = createHandler()
    await handler(request(payload))
    await finishBackground()

    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('does not accept the removed note option', async () => {
    const payload = interaction()
    payload.data.options[0].options.push({
      name: 'note',
      type: 3,
      value: 'Obsolete free-form input',
    })
    const { handler, intake, finishBackground } = createHandler()
    await handler(request(payload))
    await finishBackground()

    expect(intake.createSubmission).not.toHaveBeenCalled()
  })

  it('returns the deferred acknowledgement before slow intake completes', async () => {
    let finishIntake: ((receipt: {
      receiptReference: string
      killTeamName: string
      eventType: SubmissionEventType
      targetName: null
      status: 'PENDING'
    }) => void) | undefined
    const createSubmission = vi.fn(
      () =>
        new Promise<{
          receiptReference: string
          killTeamName: string
          eventType: SubmissionEventType
          targetName: null
          status: 'PENDING'
        }>((resolve) => {
          finishIntake = resolve
        }),
    )
    const notifyStaff = vi.fn(async () => undefined)
    const { handler, fetcher, waitUntil, finishBackground } = createHandler({
      intake: createIntake(createSubmission),
      notifyStaff,
    })

    const acknowledgement = await responseData(
      await handler(request(interaction())),
    )

    expect(acknowledgement).toEqual({ type: 5, data: { flags: 64 } })
    expect(waitUntil).toHaveBeenCalledOnce()
    expect(createSubmission).toHaveBeenCalledOnce()
    expect(fetcher).not.toHaveBeenCalled()
    expect(notifyStaff).not.toHaveBeenCalled()

    finishIntake?.({
      receiptReference: 'CR-00482',
      killTeamName: 'Sandbox Kill Team Alpha',
      eventType: 'OBJECTIVE',
      targetName: null,
      status: 'PENDING',
    })
    await finishBackground()

    expect(finalizedMessage(fetcher).content).toContain('Receipt: CR-00482')
    expect(notifyStaff).toHaveBeenCalledOnce()
  })

  it('finalizes the deferred response with authoritative receipt details', async () => {
    const notifyStaff = vi.fn(async () => undefined)
    const { handler, fetcher, finishBackground } = createHandler({ notifyStaff })
    const response = await handler(
      request(
        interaction({
          subcommand: 'terminus',
          target: 'neurothrope',
        }),
      ),
    )
    const body = await responseData(response)
    await finishBackground()
    const finalMessage = finalizedMessage(fetcher)

    expect(body.type).toBe(5)
    expect(body.data?.flags).toBe(64)
    expect(body.data?.content).toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(finalMessage.allowed_mentions).toEqual({ parse: [] })
    expect(finalMessage.content).toContain('SUBMISSION RECEIVED')
    expect(finalMessage.content).toContain('Receipt: CR-00482')
    expect(finalMessage.content).toContain(
      'Kill Team: Sandbox Kill Team Alpha',
    )
    expect(finalMessage.content).toContain('Type: Terminus Kill')
    expect(finalMessage.content).toContain('Target: Neurothrope')
    expect(finalMessage.content).toContain('Status: PENDING REVIEW')
    expect(notifyStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptReference: 'CR-00482',
        reviewUrl:
          'https://crusade.example/admin/submissions?receipt=CR-00482',
      }),
    )
    expect(fetcher.mock.invocationCallOrder[0]).toBeLessThan(
      notifyStaff.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
  })

  it('keeps the successful player receipt when staff notification fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notifyStaff = vi.fn(async () => {
      throw new Error('Discord bot provider failed with a secret URL')
    })
    const { handler, fetcher, finishBackground } = createHandler({ notifyStaff })

    const acknowledgement = await responseData(
      await handler(request(interaction())),
    )
    await finishBackground()

    expect(acknowledgement.type).toBe(5)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(finalizedMessage(fetcher).content).toContain('Receipt: CR-00482')
    expect(consoleError).toHaveBeenCalledWith(
      '[discord-interactions] request failed',
      expect.objectContaining({
        operation: 'notify_staff',
        message: 'Unexpected interaction failure.',
      }),
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      interactionToken,
    )
    consoleError.mockRestore()
  })

  it.each([
    ['NOT_ASSIGNED', /not assigned to a Kill Team/i],
    ['NO_ACTIVE_MISSION', /No ACTIVE Crusade mission/i],
    ['INVALID_TARGET', /not configured for the ACTIVE mission/i],
    ['EVIDENCE_STORAGE_FAILED', /screenshot could not be stored/i],
  ] as const)('finalizes with a safe ephemeral %s error', async (code, message) => {
    const notifyStaff = vi.fn(async () => undefined)
    const intake = createIntake(
      vi.fn(async () => {
        throw new DiscordIntakeError(code, 'private backend detail')
      }),
    )
    const { handler, fetcher, finishBackground } = createHandler({
      intake,
      notifyStaff,
    })
    const response = await handler(request(interaction()))
    const body = await responseData(response)
    await finishBackground()
    const finalContent = finalizedMessage(fetcher).content

    expect(body.type).toBe(5)
    expect(body.data?.flags).toBe(64)
    expect(finalContent).toMatch(message)
    expect(finalContent).not.toContain('private backend detail')
    expect(notifyStaff).not.toHaveBeenCalled()
  })

  it('does not leak internal errors or notify staff after failed intake', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notifyStaff = vi.fn(async () => undefined)
    const intake = createIntake(
      vi.fn(async () => {
        throw new Error('service_role secret SQL create_crusade_submission')
      }),
    )
    const { handler, fetcher, finishBackground } = createHandler({
      intake,
      notifyStaff,
    })
    const body = await responseData(await handler(request(interaction())))
    await finishBackground()
    const finalContent = finalizedMessage(fetcher).content

    expect(body.type).toBe(5)
    expect(finalContent).toMatch(/temporarily unavailable/i)
    expect(finalContent).not.toMatch(/service_role|SQL|create_crusade/i)
    expect(notifyStaff).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      '[discord-interactions] request failed',
      expect.objectContaining({
        operation: 'create_submission',
        message: 'Unexpected interaction failure.',
      }),
    )
    consoleError.mockRestore()
  })

  it('returns the same receipt safely for an idempotent interaction retry', async () => {
    const createSubmission = vi.fn(async (value: DiscordSubmissionInput) => ({
      receiptReference: 'CR-00482',
      killTeamName: 'Sandbox Kill Team Alpha',
      eventType: value.eventType as SubmissionEventType,
      targetName: null,
      status: 'PENDING' as const,
    }))
    const { handler, fetcher, finishBackground } = createHandler({
      intake: createIntake(createSubmission),
    })

    const first = await responseData(await handler(request(interaction())))
    const retry = await responseData(await handler(request(interaction())))
    await finishBackground()

    expect(first.type).toBe(5)
    expect(retry.type).toBe(5)
    expect(finalizedMessage(fetcher, 0).content).toContain('Receipt: CR-00482')
    expect(finalizedMessage(fetcher, 1).content).toContain('Receipt: CR-00482')
    expect(createSubmission).toHaveBeenCalledTimes(2)
    expect(createSubmission.mock.calls[0]?.[0].interactionId).toBe(
      interactionId,
    )
    expect(createSubmission.mock.calls[1]?.[0].interactionId).toBe(
      interactionId,
    )
  })
})
