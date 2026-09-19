// @vitest-environment node

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { SubmissionEvidenceCommand } from '../_shared/discord/types.ts'
import {
  CRUSADE_EVIDENCE_BUCKET,
  createSupabaseEvidenceStore,
} from './evidence-storage.ts'

const bytes = new Uint8Array([137, 80, 78, 71])
const command: SubmissionEvidenceCommand = {
  interactionId: '300000000000000003',
  discordUserId: '900000000000000001',
  campaignId: '00000000-0000-4000-8000-000000000001',
  missionId: '00000000-0000-4000-8000-000000000201',
  eventType: 'OBJECTIVE',
  evidenceOriginalFilename: '../../unsafe name.png',
  evidenceContentType: 'image/png',
  evidenceSourceReference:
    'https://cdn.discordapp.com/attachments/private?token=secret',
  evidenceFileSizeBytes: bytes.byteLength,
}

type Upload = (
  path: string,
  evidence: Uint8Array,
  options: { contentType: string; upsert: boolean },
) => Promise<{ error: unknown }>

function createClient(
  upload = vi.fn<Upload>(async () => ({ error: null })),
) {
  const bucket = { upload }
  const from = vi.fn(() => bucket)
  return {
    client: { storage: { from } } as unknown as SupabaseClient,
    from,
    upload,
  }
}

function imageResponse(
  body: BodyInit | null = bytes,
  contentType = 'image/png',
) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': contentType },
  })
}

describe('Discord evidence storage adapter', () => {
  it('downloads and uploads to a deterministic traversal-safe path', async () => {
    const { client, from, upload } = createClient()
    const fetcher = vi.fn(async () => imageResponse())
    const store = createSupabaseEvidenceStore(client, 10, fetcher)

    await expect(store.persist(command)).resolves.toBe(
      'campaign/00000000-0000-4000-8000-000000000001/mission/00000000-0000-4000-8000-000000000201/interaction/300000000000000003/screenshot',
    )
    expect(fetcher).toHaveBeenCalledWith(command.evidenceSourceReference)
    expect(from).toHaveBeenCalledWith(CRUSADE_EVIDENCE_BUCKET)
    expect(upload).toHaveBeenCalledWith(
      'campaign/00000000-0000-4000-8000-000000000001/mission/00000000-0000-4000-8000-000000000201/interaction/300000000000000003/screenshot',
      bytes,
      { contentType: 'image/png', upsert: false },
    )
    expect(upload.mock.calls[0]?.[0]).not.toContain('unsafe')
  })

  it('treats an existing deterministic object as an idempotent retry', async () => {
    const { client, upload } = createClient(
      vi.fn(async () => ({
        error: {
          code: 'KeyAlreadyExists',
          statusCode: '409',
          message: 'The resource already exists',
        },
      })),
    )
    const store = createSupabaseEvidenceStore(
      client,
      10,
      vi.fn(async () => imageResponse()),
    )

    await expect(store.persist(command)).resolves.toContain(
      '/interaction/300000000000000003/screenshot',
    )
    expect(upload).toHaveBeenCalledOnce()
  })

  it('rejects a contradictory downloaded MIME type', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, upload } = createClient()
    const store = createSupabaseEvidenceStore(
      client,
      10,
      vi.fn(async () => imageResponse(bytes, 'image/jpeg')),
    )

    await expect(store.persist(command)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_FAILED',
    })
    expect(upload).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('stops a download that exceeds the configured limit', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, upload } = createClient()
    const store = createSupabaseEvidenceStore(
      client,
      3,
      vi.fn(async () => imageResponse()),
    )

    await expect(store.persist(command)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_FAILED',
    })
    expect(upload).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('rejects failed downloads without exposing the source URL in logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, upload } = createClient()
    const store = createSupabaseEvidenceStore(
      client,
      10,
      vi.fn(async () => new Response(null, { status: 503 })),
    )

    await expect(store.persist(command)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_FAILED',
    })
    expect(upload).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('token=secret')
    consoleError.mockRestore()
  })

  it('rejects failed uploads with sanitized diagnostics', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = createClient(
      vi.fn(async () => ({
        error: {
          code: 'StorageFailure',
          message: 'failed at https://storage.invalid/object?token=secret',
        },
      })),
    )
    const store = createSupabaseEvidenceStore(
      client,
      10,
      vi.fn(async () => imageResponse()),
    )

    await expect(store.persist(command)).rejects.toMatchObject({
      code: 'EVIDENCE_STORAGE_FAILED',
    })
    expect(JSON.stringify(consoleError.mock.calls)).toContain('[redacted-url]')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('token=secret')
    consoleError.mockRestore()
  })
})
