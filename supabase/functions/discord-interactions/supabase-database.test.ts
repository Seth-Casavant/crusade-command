// @vitest-environment node

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { createSupabaseSubmissionDatabase } from './supabase-database.ts'

describe('Discord Supabase database adapter', () => {
  it('persists the durable evidence path through the authoritative RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          receipt_reference: 'CR-00482',
          submission_status: 'PENDING',
          submission_event_type: 'OBJECTIVE',
          kill_team_id: '00000000-0000-4000-8000-000000000501',
        },
      ],
      error: null,
    }))
    const client = { rpc } as unknown as SupabaseClient

    await createSupabaseSubmissionDatabase(client).createSubmission({
      interactionId: '300000000000000003',
      discordUserId: '900000000000000001',
      campaignId: '00000000-0000-4000-8000-000000000001',
      missionId: '00000000-0000-4000-8000-000000000201',
      killTeamId: '00000000-0000-4000-8000-000000000501',
      eventType: 'OBJECTIVE',
      evidenceOriginalFilename: 'objective.png',
      evidenceContentType: 'image/png',
      evidenceSourceReference:
        'https://cdn.discordapp.com/attachments/1/2/objective.png',
      evidenceStoragePath:
        'campaign/campaign-id/mission/mission-id/interaction/300000000000000003/screenshot',
      evidenceFileSizeBytes: 2048,
    })

    expect(rpc).toHaveBeenCalledWith(
      'create_crusade_submission',
      expect.objectContaining({
        p_evidence_storage_path:
          'campaign/campaign-id/mission/mission-id/interaction/300000000000000003/screenshot',
      }),
    )
  })

  it('logs an unexpected provider failure with operation context and no URL', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(async () => ({
        data: null,
        error: {
          code: '42501',
          message:
            'permission denied while reading https://example.invalid/private?token=secret',
          details: 'private provider details',
          hint: 'Grant the minimum required privilege.',
        },
      })),
    }
    const client = {
      from: vi.fn(() => query),
    } as unknown as SupabaseClient

    await expect(
      createSupabaseSubmissionDatabase(client).findMemberships(
        '900000000000000001',
      ),
    ).rejects.toMatchObject({ code: 'BACKEND_UNAVAILABLE' })

    expect(consoleError).toHaveBeenCalledWith(
      '[discord-submission-database] provider failure',
      {
        operation: 'find_memberships',
        provider: {
          code: '42501',
          message: 'permission denied while reading [redacted-url]',
          hint: 'Grant the minimum required privilege.',
        },
      },
    )
    consoleError.mockRestore()
  })
})
