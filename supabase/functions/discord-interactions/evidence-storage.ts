import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DiscordIntakeError,
  type SubmissionEvidenceCommand,
  type SubmissionEvidenceStore,
} from '../_shared/discord/types.ts'

export const CRUSADE_EVIDENCE_BUCKET = 'crusade-evidence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeProviderDetails(error: unknown) {
  if (!isRecord(error)) {
    return { name: error instanceof Error ? error.name : 'UnknownError' }
  }

  return Object.fromEntries(
    ['name', 'code', 'error', 'status', 'statusCode', 'message']
      .filter((key) => ['string', 'number'].includes(typeof error[key]))
      .map((key) => [
        key,
        String(error[key]).replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]'),
      ]),
  )
}

function evidenceFailure(operation: string, error: unknown) {
  console.error('[discord-evidence] provider failure', {
    operation,
    provider: safeProviderDetails(error),
  })
  return new DiscordIntakeError(
    'EVIDENCE_STORAGE_FAILED',
    'Discord evidence could not be stored.',
  )
}

function normalizedContentType(value: string | null) {
  return value?.toLowerCase().split(';', 1)[0].trim() || null
}

function isDuplicateObject(error: unknown) {
  if (!isRecord(error)) {
    return false
  }

  return ['code', 'error', 'statusCode'].some((key) =>
    ['Duplicate', 'KeyAlreadyExists', 'ResourceAlreadyExists'].includes(
      String(error[key]),
    ),
  )
}

function evidencePath(command: SubmissionEvidenceCommand) {
  return [
    'campaign',
    command.campaignId,
    'mission',
    command.missionId,
    'interaction',
    command.interactionId,
    'screenshot',
  ].join('/')
}

async function downloadEvidence(
  fetcher: typeof fetch,
  command: SubmissionEvidenceCommand,
  maximumBytes: number,
) {
  let response: Response
  try {
    response = await fetcher(command.evidenceSourceReference)
  } catch (error) {
    throw evidenceFailure('download_evidence', error)
  }

  if (!response.ok || !response.body) {
    throw evidenceFailure('download_evidence', {
      name: 'EvidenceDownloadError',
      status: response.status,
    })
  }

  const responseContentType = normalizedContentType(
    response.headers.get('content-type'),
  )
  if (
    responseContentType &&
    responseContentType !== command.evidenceContentType
  ) {
    throw evidenceFailure('download_evidence', {
      name: 'EvidenceContentTypeMismatch',
    })
  }

  const contentLengthHeader = response.headers.get('content-length')
  const contentLength =
    contentLengthHeader === null ? null : Number(contentLengthHeader)
  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    (contentLength !== command.evidenceFileSizeBytes ||
      contentLength > maximumBytes)
  ) {
    throw evidenceFailure('download_evidence', {
      name: 'EvidenceContentLengthMismatch',
    })
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    size += value.byteLength
    if (size > maximumBytes) {
      await reader.cancel()
      throw evidenceFailure('download_evidence', {
        name: 'EvidenceDownloadTooLarge',
      })
    }
    chunks.push(value)
  }

  if (size === 0 || size !== command.evidenceFileSizeBytes) {
    throw evidenceFailure('download_evidence', {
      name: 'EvidenceDownloadedSizeMismatch',
    })
  }

  const evidence = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    evidence.set(chunk, offset)
    offset += chunk.byteLength
  }

  return evidence
}

export function createSupabaseEvidenceStore(
  client: SupabaseClient,
  maximumBytes: number,
  fetcher: typeof fetch = fetch,
): SubmissionEvidenceStore {
  return {
    async persist(command) {
      const path = evidencePath(command)
      const evidence = await downloadEvidence(fetcher, command, maximumBytes)
      const { error } = await client.storage
        .from(CRUSADE_EVIDENCE_BUCKET)
        .upload(path, evidence, {
          contentType: command.evidenceContentType,
          upsert: false,
        })

      if (error && !isDuplicateObject(error)) {
        throw evidenceFailure('upload_evidence', error)
      }

      return path
    },
  }
}
