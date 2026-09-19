export const DISCORD_EPHEMERAL_MESSAGE_FLAG = 64
export const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export type SubmissionEventType =
  | 'TERMINUS_KILL'
  | 'OBJECTIVE'
  | 'MISSION_COMPLETION'

export type DiscordSubmissionInput = {
  interactionId: string
  discordUserId: string
  eventType: SubmissionEventType
  scoringTargetKey?: string
  evidenceOriginalFilename: string
  evidenceContentType: string
  evidenceSourceReference: string
  evidenceFileSizeBytes: number
}

export type SubmissionEvidenceCommand = DiscordSubmissionInput & {
  campaignId: string
  missionId: string
}

export type SubmissionEvidenceStore = {
  persist: (command: SubmissionEvidenceCommand) => Promise<string>
}

export type DiscordSubmissionReceipt = {
  receiptReference: string
  killTeamName: string
  eventType: SubmissionEventType
  targetName: string | null
  status: 'PENDING'
}

export type StaffSubmissionNotification = DiscordSubmissionReceipt & {
  interactionId: string
  discordUserId: string
  reviewUrl: string
}

export type DiscordSubmissionIntake = {
  createSubmission: (
    input: DiscordSubmissionInput,
  ) => Promise<DiscordSubmissionReceipt>
}

export type StaffSubmissionNotifier = (
  notification: StaffSubmissionNotification,
) => Promise<void>

export type DiscordIntakeErrorCode =
  | 'NO_ACTIVE_MISSION'
  | 'NOT_ASSIGNED'
  | 'INVALID_TARGET'
  | 'IDEMPOTENCY_CONFLICT'
  | 'EVIDENCE_STORAGE_FAILED'
  | 'BACKEND_UNAVAILABLE'

export class DiscordIntakeError extends Error {
  constructor(
    public readonly code: DiscordIntakeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DiscordIntakeError'
  }
}
export type DiscordTeamRegistrationCampaign = {
  id: string
  name: string
}

export type DiscordTeamRegistrationResult = {
  campaignKillTeamId: string
  missionTeamCount: number
  newRevision: number
}

export type DiscordTeamRegistrationService = {
  findRegistrationCampaign: () => Promise<DiscordTeamRegistrationCampaign>

  registerTeam: (input: {
    campaignId: string
    name: string
    leaderDiscordUserId: string
    leaderDisplayName: string
  }) => Promise<DiscordTeamRegistrationResult>
}

export type DiscordTeamRegistrationErrorCode =
  | 'NO_REGISTRATION_CAMPAIGN'
  | 'NAME_TAKEN'
  | 'ALREADY_REGISTERED'
  | 'REGISTRATION_LOCKED'
  | 'BACKEND_UNAVAILABLE'

export class DiscordTeamRegistrationError extends Error {
  constructor(
    public readonly code: DiscordTeamRegistrationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DiscordTeamRegistrationError'
  }
}

