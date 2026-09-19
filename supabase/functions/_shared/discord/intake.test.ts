// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  createAuthoritativeSubmissionIntake,
  type AuthoritativeSubmissionDatabase,
} from './intake.ts'
import {
  DiscordIntakeError,
  type DiscordSubmissionInput,
  type SubmissionEvidenceStore,
} from './types.ts'

const input: DiscordSubmissionInput = {
  interactionId: '300000000000000003',
  discordUserId: '900000000000000001',
  eventType: 'OBJECTIVE',
  evidenceOriginalFilename: 'objective.png',
  evidenceContentType: 'image/png',
  evidenceSourceReference:
    'https://cdn.discordapp.com/attachments/1/2/objective.png',
  evidenceFileSizeBytes: 2048,
}
const evidenceStoragePath =
  'campaign/00000000-0000-4000-8000-000000000001/mission/00000000-0000-4000-8000-000000000201/interaction/300000000000000003/screenshot'

function createDatabase(
  overrides: Partial<AuthoritativeSubmissionDatabase> = {},
): AuthoritativeSubmissionDatabase {
  return {
    findMemberships: vi.fn(async () => [
      {
        killTeamId: '00000000-0000-4000-8000-000000000501',
        missionId: '00000000-0000-4000-8000-000000000201',
      },
    ]),
    getActiveCampaign: vi.fn(async () => ({
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
      killTeams: [
        {
          id: '00000000-0000-4000-8000-000000000501',
          name: 'Sandbox Kill Team Alpha',
        },
      ],
      scoringTargets: [
        { key: 'neurothrope', name: 'Neurothrope' },
      ],
    })),
    createSubmission: vi.fn(async (command) => ({
      receiptReference: 'CR-00482',
      status: 'PENDING',
      eventType: command.eventType,
      killTeamId: command.killTeamId,
    })),
    ...overrides,
  }
}

function createEvidenceStore(): SubmissionEvidenceStore {
  return {
    persist: vi.fn(async () => evidenceStoragePath),
  }
}

describe('authoritative Discord submission intake', () => {
  it('derives campaign, mission, and Kill Team exclusively from authoritative membership', async () => {
    const database = createDatabase()
    const evidenceStore = createEvidenceStore()
    const intake = createAuthoritativeSubmissionIntake(database, evidenceStore)

    await expect(intake.createSubmission(input)).resolves.toEqual({
      receiptReference: 'CR-00482',
      killTeamName: 'Sandbox Kill Team Alpha',
      eventType: 'OBJECTIVE',
      targetName: null,
      status: 'PENDING',
    })
    expect(database.findMemberships).toHaveBeenCalledWith(
      input.discordUserId,
    )
    expect(database.createSubmission).toHaveBeenCalledWith({
      ...input,
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
      killTeamId: '00000000-0000-4000-8000-000000000501',
      evidenceStoragePath,
    })
    expect(evidenceStore.persist).toHaveBeenCalledWith({
      ...input,
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
    })
    expect(
      vi.mocked(evidenceStore.persist).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(database.createSubmission).mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    )
  })

  it('rejects an unassigned Discord identity before authoritative intake', async () => {
    const database = createDatabase({
      findMemberships: vi.fn(async () => []),
    })

    await expect(
      createAuthoritativeSubmissionIntake(
        database,
        createEvidenceStore(),
      ).createSubmission(input),
    ).rejects.toMatchObject<Partial<DiscordIntakeError>>({
      code: 'NOT_ASSIGNED',
    })
    expect(database.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects submissions when no ACTIVE mission exists', async () => {
    const database = createDatabase({
      getActiveCampaign: vi.fn(async () => null),
    })

    await expect(
      createAuthoritativeSubmissionIntake(
        database,
        createEvidenceStore(),
      ).createSubmission(input),
    ).rejects.toMatchObject<Partial<DiscordIntakeError>>({
      code: 'NO_ACTIVE_MISSION',
    })
    expect(database.createSubmission).not.toHaveBeenCalled()
  })

  it('accepts a configured target from the ACTIVE mission', async () => {
    const database = createDatabase()
    const receipt = await createAuthoritativeSubmissionIntake(
      database,
      createEvidenceStore(),
    ).createSubmission({
      ...input,
      eventType: 'TERMINUS_KILL',
      scoringTargetKey: 'neurothrope',
    })

    expect(receipt.targetName).toBe('Neurothrope')
    expect(database.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ scoringTargetKey: 'neurothrope' }),
    )
  })

  it('rejects an invalid or cross-mission Terminus target', async () => {
    const database = createDatabase()

    await expect(
      createAuthoritativeSubmissionIntake(
        database,
        createEvidenceStore(),
      ).createSubmission({
        ...input,
        eventType: 'TERMINUS_KILL',
        scoringTargetKey: 'foreign-target',
      }),
    ).rejects.toMatchObject<Partial<DiscordIntakeError>>({
      code: 'INVALID_TARGET',
    })
    expect(database.createSubmission).not.toHaveBeenCalled()
  })

  it.each(['OBJECTIVE', 'MISSION_COMPLETION'] as const)(
    '%s does not require a Terminus target',
    async (eventType) => {
      const database = createDatabase()

      await expect(
        createAuthoritativeSubmissionIntake(
          database,
          createEvidenceStore(),
        ).createSubmission({
          ...input,
          eventType,
        }),
      ).resolves.toMatchObject({ eventType, targetName: null })
    },
  )

  it('returns the existing authoritative receipt for an idempotent retry', async () => {
    const database = createDatabase()
    const intake = createAuthoritativeSubmissionIntake(
      database,
      createEvidenceStore(),
    )

    const first = await intake.createSubmission(input)
    const retry = await intake.createSubmission(input)

    expect(retry).toEqual(first)
    expect(database.createSubmission).toHaveBeenCalledTimes(2)
    expect(database.createSubmission).toHaveBeenNthCalledWith(1, {
      ...input,
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
      killTeamId: '00000000-0000-4000-8000-000000000501',
      evidenceStoragePath,
    })
    expect(database.createSubmission).toHaveBeenNthCalledWith(2, {
      ...input,
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
      killTeamId: '00000000-0000-4000-8000-000000000501',
      evidenceStoragePath,
    })
  })

  it('rejects a malformed authoritative response instead of trusting it', async () => {
    const database = createDatabase({
      createSubmission: vi.fn(async () => ({
        receiptReference: 'CR-00482',
        status: 'APPROVED',
        eventType: 'OBJECTIVE' as const,
        killTeamId: '00000000-0000-4000-8000-000000000501',
      })),
    })

    await expect(
      createAuthoritativeSubmissionIntake(
        database,
        createEvidenceStore(),
      ).createSubmission(input),
    ).rejects.toMatchObject<Partial<DiscordIntakeError>>({
      code: 'BACKEND_UNAVAILABLE',
    })
  })

  it('does not create a submission when durable evidence storage fails', async () => {
    const database = createDatabase()
    const evidenceStore: SubmissionEvidenceStore = {
      persist: vi.fn(async () => {
        throw new DiscordIntakeError(
          'EVIDENCE_STORAGE_FAILED',
          'private provider detail',
        )
      }),
    }

    await expect(
      createAuthoritativeSubmissionIntake(
        database,
        evidenceStore,
      ).createSubmission(input),
    ).rejects.toMatchObject<Partial<DiscordIntakeError>>({
      code: 'EVIDENCE_STORAGE_FAILED',
    })
    expect(database.createSubmission).not.toHaveBeenCalled()
  })
})
