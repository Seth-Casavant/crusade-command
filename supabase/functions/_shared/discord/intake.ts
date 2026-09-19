import {
  DiscordIntakeError,
  type DiscordSubmissionInput,
  type DiscordSubmissionIntake,
  type SubmissionEvidenceStore,
  type SubmissionEventType,
} from './types.ts'

export type ActiveSubmissionCampaign = {
  campaignId: string
  missionId: string
  killTeams: Array<{ id: string; name: string }>
  scoringTargets: Array<{ key: string; name: string }>
}

export type DiscordMembership = {
  killTeamId: string
  missionId: string
}

export type SubmissionDatabaseCommand = DiscordSubmissionInput & {
  campaignId: string
  missionId: string
  killTeamId: string
  evidenceStoragePath: string
}

export type SubmissionDatabaseResult = {
  receiptReference: string
  status: string
  eventType: SubmissionEventType
  killTeamId: string
}

export type AuthoritativeSubmissionDatabase = {
  findMemberships: (discordUserId: string) => Promise<DiscordMembership[]>
  getActiveCampaign: () => Promise<ActiveSubmissionCampaign | null>
  createSubmission: (
    command: SubmissionDatabaseCommand,
  ) => Promise<SubmissionDatabaseResult>
}

export function createAuthoritativeSubmissionIntake(
  database: AuthoritativeSubmissionDatabase,
  evidenceStore: SubmissionEvidenceStore,
): DiscordSubmissionIntake {
  return {
    async createSubmission(input) {
      const [memberships, campaign] = await Promise.all([
        database.findMemberships(input.discordUserId),
        database.getActiveCampaign(),
      ])

      if (!campaign) {
        throw new DiscordIntakeError(
          'NO_ACTIVE_MISSION',
          'No ACTIVE mission is accepting submissions.',
        )
      }

      const membership = memberships.find(
        ({ missionId }) => missionId === campaign.missionId,
      )
      if (!membership) {
        throw new DiscordIntakeError(
          'NOT_ASSIGNED',
          'Discord user is not assigned to the ACTIVE mission.',
        )
      }

      const killTeam = campaign.killTeams.find(
        ({ id }) => id === membership.killTeamId,
      )
      if (!killTeam) {
        throw new DiscordIntakeError(
          'NOT_ASSIGNED',
          'Discord membership does not resolve to an ACTIVE Kill Team.',
        )
      }

      const target = input.scoringTargetKey
        ? campaign.scoringTargets.find(
            ({ key }) => key === input.scoringTargetKey,
          )
        : null

      if (input.eventType === 'TERMINUS_KILL' && !target) {
        throw new DiscordIntakeError(
          'INVALID_TARGET',
          'Terminus target is not configured for the ACTIVE mission.',
        )
      }

      const evidenceStoragePath = await evidenceStore.persist({
        ...input,
        campaignId: campaign.campaignId,
        missionId: campaign.missionId,
      })

      const result = await database.createSubmission({
        ...input,
        campaignId: campaign.campaignId,
        missionId: campaign.missionId,
        killTeamId: membership.killTeamId,
        evidenceStoragePath,
      })

      if (
        result.status !== 'PENDING' ||
        result.eventType !== input.eventType ||
        result.killTeamId !== membership.killTeamId
      ) {
        throw new DiscordIntakeError(
          'BACKEND_UNAVAILABLE',
          'The authoritative submission response was invalid.',
        )
      }

      return {
        receiptReference: result.receiptReference,
        killTeamName: killTeam.name,
        eventType: result.eventType,
        targetName: target?.name ?? null,
        status: 'PENDING',
      }
    },
  }
}
