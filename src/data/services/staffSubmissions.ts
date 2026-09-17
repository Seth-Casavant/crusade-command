import type { Enums } from '../../shared/types'
import { supabase } from './supabase'

export type SubmissionStatus = Enums<'crusade_submission_status'>
export type SubmissionEventType = Enums<'crusade_submission_event_type'>

export type StaffSubmission = {
  id: string
  receiptReference: string
  submittedAt: string
  campaignId: string
  missionId: string
  eventType: SubmissionEventType
  killTeamId: string
  killTeamName: string
  submittingMemberDisplayName: string
  scoringTargetKey: string | null
  scoringTargetName: string | null
  playerNote: string | null
  evidenceOriginalFilename: string
  evidenceContentType: string
  evidenceSourceReference: string
  evidenceStoragePath: string | null
  evidenceFileSizeBytes: number | null
  evidencePreviewUrl: string | null
  reviewStatus: SubmissionStatus
  reviewerId: string | null
  reviewerRole: Enums<'app_role'> | null
  moderatorNote: string | null
  awardedPointDelta: number | null
  reviewedAt: string | null
}

export type SubmissionQueueFilters = {
  status: SubmissionStatus
  campaignId?: string
  missionId?: string
}

export type SubmissionScope = {
  campaignId?: string
  missionId?: string
}

export type ApproveSubmissionCommand = {
  submissionId: string
  awardedPointDelta: number
  expectedRevision: number
  moderatorNote?: string
}

export type ApproveSubmissionResult = {
  submissionId: string
  receiptReference: string
  awardedPointDelta: number
  newRevision: number
  killTeamCrusadePoints: number
  campaignCrusadePoints: number
  reviewedAt: string
}

export type RejectSubmissionCommand = {
  submissionId: string
  moderatorNote?: string
}

export type RejectSubmissionResult = {
  submissionId: string
  receiptReference: string
  moderatorNote: string | null
  reviewedAt: string
}

export type StaffSubmissionErrorCode =
  | 'ALREADY_REVIEWED'
  | 'STALE_REVISION'
  | 'AUTHORIZATION_REQUIRED'
  | 'REQUEST_FAILED'

export class StaffSubmissionError extends Error {
  constructor(
    public readonly code: StaffSubmissionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'StaffSubmissionError'
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new StaffSubmissionError(
      'REQUEST_FAILED',
      'The staff submission service is unavailable.',
    )
  }

  return supabase
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function resolveEvidencePreviewUrl(
  evidenceSourceReference: string,
): string | null {
  try {
    const url = new URL(evidenceSourceReference)

    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function classifyProviderError(error: unknown): StaffSubmissionError {
  const providerText =
    typeof error === 'object' && error !== null
      ? [
          'message' in error ? String(error.message) : '',
          'details' in error ? String(error.details) : '',
          'hint' in error ? String(error.hint) : '',
        ].join(' ')
      : String(error)

  if (providerText.includes('SUBMISSION_ALREADY_REVIEWED')) {
    return new StaffSubmissionError(
      'ALREADY_REVIEWED',
      'This submission has already been reviewed.',
    )
  }

  if (providerText.includes('REVISION_CONFLICT')) {
    return new StaffSubmissionError(
      'STALE_REVISION',
      'Campaign state changed before the review was processed.',
    )
  }

  if (
    providerText.includes('AUTHORIZATION_REQUIRED') ||
    providerText.includes('permission denied')
  ) {
    return new StaffSubmissionError(
      'AUTHORIZATION_REQUIRED',
      'Command-staff authorization is required.',
    )
  }

  return new StaffSubmissionError(
    'REQUEST_FAILED',
    'The authoritative submission request could not be completed.',
  )
}

function mapQueueRow(row: Record<string, unknown>): StaffSubmission {
  const sourceReference = String(row.evidence_source_reference)

  return {
    id: String(row.submission_id),
    receiptReference: String(row.receipt_reference),
    submittedAt: String(row.submitted_at),
    campaignId: String(row.campaign_id),
    missionId: String(row.mission_id),
    eventType: row.event_type as SubmissionEventType,
    killTeamId: String(row.kill_team_id),
    killTeamName: String(row.kill_team_name),
    submittingMemberDisplayName: String(
      row.submitting_member_display_name,
    ),
    scoringTargetKey: nullableString(row.scoring_target_key),
    scoringTargetName: nullableString(row.scoring_target_name),
    playerNote: nullableString(row.player_note),
    evidenceOriginalFilename: String(row.evidence_original_filename),
    evidenceContentType: String(row.evidence_content_type),
    evidenceSourceReference: sourceReference,
    evidenceStoragePath: nullableString(row.evidence_storage_path),
    evidenceFileSizeBytes: nullableNumber(row.evidence_file_size_bytes),
    evidencePreviewUrl: resolveEvidencePreviewUrl(sourceReference),
    reviewStatus: row.review_status as SubmissionStatus,
    reviewerId: nullableString(row.reviewer_id),
    reviewerRole: nullableString(row.reviewer_role) as Enums<'app_role'> | null,
    moderatorNote: nullableString(row.moderator_note),
    awardedPointDelta: nullableNumber(row.awarded_point_delta),
    reviewedAt: nullableString(row.reviewed_at),
  }
}

export async function fetchSubmissionQueue(
  filters: SubmissionQueueFilters,
): Promise<StaffSubmission[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_crusade_submission_queue', {
    p_status: filters.status,
    ...(filters.campaignId ? { p_campaign_id: filters.campaignId } : {}),
    ...(filters.missionId ? { p_mission_id: filters.missionId } : {}),
  })

  if (error) {
    throw classifyProviderError(error)
  }

  return (data ?? []).map((row) => mapQueueRow(row))
}

export async function fetchPendingSubmissionCount(
  scope: SubmissionScope = {},
): Promise<number> {
  const client = requireSupabase()
  const { data, error } = await client.rpc(
    'get_pending_crusade_submission_count',
    {
      ...(scope.campaignId ? { p_campaign_id: scope.campaignId } : {}),
      ...(scope.missionId ? { p_mission_id: scope.missionId } : {}),
    },
  )

  if (error) {
    throw classifyProviderError(error)
  }

  return typeof data === 'number' && Number.isSafeInteger(data) && data >= 0
    ? data
    : 0
}

export async function approveSubmission(
  command: ApproveSubmissionCommand,
): Promise<ApproveSubmissionResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('approve_crusade_submission', {
    p_submission_id: command.submissionId,
    p_awarded_point_delta: command.awardedPointDelta,
    p_expected_revision: command.expectedRevision,
    ...(command.moderatorNote
      ? { p_moderator_note: command.moderatorNote }
      : {}),
  })

  if (error) {
    throw classifyProviderError(error)
  }

  const result = data?.[0]

  if (!result) {
    throw new StaffSubmissionError(
      'REQUEST_FAILED',
      'The approval response was empty.',
    )
  }

  return {
    submissionId: result.submission_id,
    receiptReference: result.receipt_reference,
    awardedPointDelta: result.awarded_point_delta,
    newRevision: result.new_revision,
    killTeamCrusadePoints: result.kill_team_crusade_points,
    campaignCrusadePoints: result.campaign_crusade_points,
    reviewedAt: result.reviewed_at,
  }
}

export async function rejectSubmission(
  command: RejectSubmissionCommand,
): Promise<RejectSubmissionResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('reject_crusade_submission', {
    p_submission_id: command.submissionId,
    ...(command.moderatorNote
      ? { p_moderator_note: command.moderatorNote }
      : {}),
  })

  if (error) {
    throw classifyProviderError(error)
  }

  const result = data?.[0]

  if (!result) {
    throw new StaffSubmissionError(
      'REQUEST_FAILED',
      'The rejection response was empty.',
    )
  }

  return {
    submissionId: result.submission_id,
    receiptReference: result.receipt_reference,
    moderatorNote: nullableString(result.moderator_note),
    reviewedAt: result.reviewed_at,
  }
}

export type StaffSubmissionService = {
  fetchQueue: typeof fetchSubmissionQueue
  fetchPendingCount: typeof fetchPendingSubmissionCount
  approve: typeof approveSubmission
  reject: typeof rejectSubmission
}

export const staffSubmissionService: StaffSubmissionService = {
  fetchQueue: fetchSubmissionQueue,
  fetchPendingCount: fetchPendingSubmissionCount,
  approve: approveSubmission,
  reject: rejectSubmission,
}
