import { vi } from 'vitest'

const submissionMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: submissionMocks,
}))

import {
  approveSubmission,
  fetchPendingSubmissionCount,
  fetchSubmissionQueue,
  rejectSubmission,
  resolveEvidencePreviewUrl,
  StaffSubmissionError,
} from './staffSubmissions'

const queueRow = {
  submission_id: '00000000-0000-4000-8000-000000000901',
  receipt_reference: 'CRS-000901',
  submitted_at: '2026-09-17T12:00:00.000Z',
  campaign_id: '00000000-0000-4000-8000-000000000001',
  mission_id: '00000000-0000-4000-8000-000000000201',
  event_type: 'TERMINUS_KILL',
  kill_team_id: '00000000-0000-4000-8000-000000000501',
  kill_team_name: 'Kill Team Alpha',
  submitting_member_display_name: 'Brother Titus',
  scoring_target_key: 'terminus-alpha',
  scoring_target_name: 'Carnifex Prime',
  player_note: 'Target eliminated at the relay.',
  evidence_original_filename: 'victory.png',
  evidence_content_type: 'image/png',
  evidence_source_reference: 'https://cdn.example.test/victory.png',
  evidence_storage_path: null,
  evidence_file_size_bytes: 1024,
  review_status: 'PENDING',
  reviewer_id: null,
  reviewer_role: null,
  moderator_note: null,
  awarded_point_delta: null,
  reviewed_at: null,
}

describe('staff submission service', () => {
  beforeEach(() => {
    submissionMocks.rpc.mockReset()
  })

  it('maps the private queue response and requests the selected scope', async () => {
    submissionMocks.rpc.mockResolvedValue({ data: [queueRow], error: null })

    const result = await fetchSubmissionQueue({
      status: 'PENDING',
      campaignId: queueRow.campaign_id,
      missionId: queueRow.mission_id,
    })

    expect(submissionMocks.rpc).toHaveBeenCalledWith(
      'get_crusade_submission_queue',
      {
        p_status: 'PENDING',
        p_campaign_id: queueRow.campaign_id,
        p_mission_id: queueRow.mission_id,
      },
    )
    expect(result[0]).toMatchObject({
      id: queueRow.submission_id,
      receiptReference: 'CRS-000901',
      eventType: 'TERMINUS_KILL',
      scoringTargetName: 'Carnifex Prime',
      evidencePreviewUrl: 'https://cdn.example.test/victory.png',
    })
  })

  it('accepts only HTTP evidence references as directly previewable', () => {
    expect(resolveEvidencePreviewUrl('discord-attachment:123')).toBeNull()
    expect(resolveEvidencePreviewUrl('javascript:alert(1)')).toBeNull()
    expect(
      resolveEvidencePreviewUrl('https://evidence.example.test/image.jpg'),
    ).toBe('https://evidence.example.test/image.jpg')
  })

  it('retrieves the authoritative pending count', async () => {
    submissionMocks.rpc.mockResolvedValue({ data: 3, error: null })

    await expect(
      fetchPendingSubmissionCount({ campaignId: queueRow.campaign_id }),
    ).resolves.toBe(3)
    expect(submissionMocks.rpc).toHaveBeenCalledWith(
      'get_pending_crusade_submission_count',
      { p_campaign_id: queueRow.campaign_id },
    )
  })

  it('passes the expected campaign revision only to the approval RPC', async () => {
    submissionMocks.rpc.mockResolvedValueOnce({
      data: [
        {
          submission_id: queueRow.submission_id,
          receipt_reference: queueRow.receipt_reference,
          submission_status: 'APPROVED',
          awarded_point_delta: 10,
          ledger_entry_id: '00000000-0000-4000-8000-000000000999',
          new_revision: 9,
          kill_team_crusade_points: 30,
          campaign_crusade_points: 34,
          reviewed_at: '2026-09-17T12:05:00.000Z',
        },
      ],
      error: null,
    })

    await approveSubmission({
      submissionId: queueRow.submission_id,
      awardedPointDelta: 10,
      expectedRevision: 8,
      moderatorNote: 'Confirmed.',
    })

    expect(submissionMocks.rpc).toHaveBeenCalledWith(
      'approve_crusade_submission',
      {
        p_submission_id: queueRow.submission_id,
        p_awarded_point_delta: 10,
        p_expected_revision: 8,
        p_moderator_note: 'Confirmed.',
      },
    )
  })

  it('uses the authoritative rejection RPC without ledger-writing arguments', async () => {
    submissionMocks.rpc.mockResolvedValueOnce({
      data: [
        {
          submission_id: queueRow.submission_id,
          receipt_reference: queueRow.receipt_reference,
          submission_status: 'REJECTED',
          moderator_note: 'Unreadable evidence.',
          reviewed_at: '2026-09-17T12:05:00.000Z',
        },
      ],
      error: null,
    })

    await rejectSubmission({
      submissionId: queueRow.submission_id,
      moderatorNote: 'Unreadable evidence.',
    })

    expect(submissionMocks.rpc).toHaveBeenCalledWith(
      'reject_crusade_submission',
      {
        p_submission_id: queueRow.submission_id,
        p_moderator_note: 'Unreadable evidence.',
      },
    )
  })

  it.each([
    ['SUBMISSION_ALREADY_REVIEWED', 'ALREADY_REVIEWED'],
    ['REVISION_CONFLICT', 'STALE_REVISION'],
    ['AUTHORIZATION_REQUIRED', 'AUTHORIZATION_REQUIRED'],
  ] as const)('classifies the %s database response', async (message, code) => {
    submissionMocks.rpc.mockResolvedValue({
      data: null,
      error: { message },
    })

    await expect(
      fetchSubmissionQueue({ status: 'PENDING' }),
    ).rejects.toMatchObject<Partial<StaffSubmissionError>>({ code })
  })
})
