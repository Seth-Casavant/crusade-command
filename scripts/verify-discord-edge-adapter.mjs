import { execSync, spawnSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'

import { createAuthoritativeSubmissionIntake } from '../supabase/functions/_shared/discord/intake.ts'
import { createDiscordInteractionHandler } from '../supabase/functions/_shared/discord/interaction.ts'
import { DiscordIntakeError } from '../supabase/functions/_shared/discord/types.ts'
import {
  CRUSADE_EVIDENCE_BUCKET,
  createSupabaseEvidenceStore,
} from '../supabase/functions/discord-interactions/evidence-storage.ts'
import { createSupabaseSubmissionDatabase } from '../supabase/functions/discord-interactions/supabase-database.ts'

function readLocalSupabaseEnvironment() {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_ANON_KEY
  ) {
    return process.env
  }

  const command =
    process.platform === 'win32'
      ? 'node_modules\\.bin\\supabase.cmd status -o env'
      : 'node_modules/.bin/supabase status -o env'
  const status = execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const environment = {}

  for (const line of status.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/)
    if (match) {
      environment[match[1]] = match[2]
    }
  }

  return environment
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function expectIntakeError(action, code) {
  try {
    await action()
  } catch (error) {
    assert(
      error instanceof DiscordIntakeError && error.code === code,
      `Expected ${code}, received ${error instanceof Error ? error.message : String(error)}.`,
    )
    return
  }

  throw new Error(`Expected ${code}, but the request succeeded.`)
}

function queryDatabase(sql) {
  const result = spawnSync(
    process.env.DOCKER_PATH ?? 'docker',
    [
      'exec',
      process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_crusade-command',
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--command',
      sql,
    ],
    { encoding: 'utf8', windowsHide: true },
  )

  if (result.error) {
    throw result.error
  }
  assert(result.status === 0, 'The local submission-row check failed.')
  return result.stdout.trim()
}

function submissionCount(interactionId) {
  assert(/^\d{17,20}$/.test(interactionId), 'Unsafe diagnostic interaction ID.')
  return queryDatabase(
    `select count(*) from public.crusade_submissions where external_idempotency_key = 'discord-interaction:${interactionId}';`,
  )
}

function diagnosticInput(interactionId) {
  return { ...baseInput, interactionId }
}

const localEnvironment = readLocalSupabaseEnvironment()
const supabaseUrl =
  process.env.SUPABASE_URL ??
  localEnvironment.SUPABASE_URL ??
  localEnvironment.API_URL
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  localEnvironment.SUPABASE_SERVICE_ROLE_KEY ??
  localEnvironment.SERVICE_ROLE_KEY
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  localEnvironment.SUPABASE_ANON_KEY ??
  localEnvironment.ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are required.',
  )
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const database = createSupabaseSubmissionDatabase(serviceClient)
const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const evidenceFetcher = async (url) => {
  assert(
    String(url).startsWith('https://cdn.discordapp.com/attachments/'),
    'The evidence adapter requested an unexpected source.',
  )
  return new Response(imageBytes, {
    status: 200,
    headers: {
      'content-length': String(imageBytes.byteLength),
      'content-type': 'image/png',
    },
  })
}
const evidenceStore = createSupabaseEvidenceStore(
  serviceClient,
  imageBytes.byteLength,
  evidenceFetcher,
)
const intake = createAuthoritativeSubmissionIntake(database, evidenceStore)
const applicationId = '100000000000000001'
const interactionToken = 'local-runtime-transport-token'
const baseInput = {
  interactionId: '990000000000000102',
  discordUserId: '900000000000000001',
  eventType: 'OBJECTIVE',
  evidenceOriginalFilename: 'runtime-adapter.png',
  evidenceContentType: 'image/png',
  evidenceSourceReference:
    'https://cdn.discordapp.com/attachments/runtime-adapter.png',
  evidenceFileSizeBytes: imageBytes.byteLength,
}
const evidenceStoragePath =
  'campaign/00000000-0000-4000-8000-000000000001/mission/00000000-0000-4000-8000-000000000201/interaction/990000000000000102/screenshot'
const evidencePrefix = evidenceStoragePath.slice(
  0,
  evidenceStoragePath.lastIndexOf('/'),
)

const backgroundTasks = []
const responseEdits = []
const handler = createDiscordInteractionHandler({
  applicationId,
  publicKey: '11'.repeat(32),
  publicAppUrl: 'http://localhost:5173',
  intake,
  notifyStaff: async () => undefined,
  waitUntil: (promise) => backgroundTasks.push(promise),
  fetcher: async (url, init) => {
    assert(
      String(url) ===
        `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      'The deferred response used the wrong Discord endpoint.',
    )
    assert(init?.method === 'PATCH', 'The deferred response was not edited.')
    responseEdits.push(JSON.parse(String(init?.body)))
    return new Response(null, { status: 200 })
  },
  verifySignature: async () => true,
})

function interactionRequest() {
  return new Request('http://localhost/functions/v1/discord-interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': '22'.repeat(64),
      'x-signature-timestamp': '1789650000',
    },
    body: JSON.stringify({
      id: baseInput.interactionId,
      application_id: applicationId,
      token: interactionToken,
      guild_id: '200000000000000002',
      type: 2,
      member: { user: { id: baseInput.discordUserId } },
      data: {
        name: 'crusade-submit',
        options: [
          {
            name: 'objective',
            type: 1,
            options: [
              {
                name: 'screenshot',
                type: 11,
                value: '500000000000000005',
              },
            ],
          },
        ],
        resolved: {
          attachments: {
            '500000000000000005': {
              filename: baseInput.evidenceOriginalFilename,
              content_type: baseInput.evidenceContentType,
              url: baseInput.evidenceSourceReference,
              size: baseInput.evidenceFileSizeBytes,
            },
          },
        },
      },
    }),
  })
}

async function invokeInteraction() {
  const response = await handler(interactionRequest())
  const acknowledgement = await response.json()
  assert(
    acknowledgement.type === 5 && acknowledgement.data?.flags === 64,
    'The real handler did not return a deferred ephemeral acknowledgement.',
  )
  await Promise.all(backgroundTasks.splice(0))
}

await invokeInteraction()
await invokeInteraction()
assert(responseEdits.length === 2, 'The deferred response was not finalized.')
assert(
  responseEdits.every((edit) =>
    edit.content?.includes('SUBMISSION RECEIVED'),
  ),
  'The real success path did not finalize with the player receipt.',
)
const receiptReference = responseEdits[0].content.match(/Receipt: (CR-[0-9]+)/)?.[1]
assert(receiptReference, 'The real intake did not return an authoritative receipt.')

await expectIntakeError(
  () =>
    intake.createSubmission({
      ...baseInput,
      interactionId: '990000000000000100',
      discordUserId: '999000000000000001',
    }),
  'NOT_ASSIGNED',
)
await expectIntakeError(
  () =>
    intake.createSubmission({
      ...baseInput,
      interactionId: '990000000000000101',
      eventType: 'TERMINUS_KILL',
      scoringTargetKey: 'not-a-configured-target',
    }),
  'INVALID_TARGET',
)

const { data: bucket, error: bucketError } =
  await serviceClient.storage.getBucket(CRUSADE_EVIDENCE_BUCKET)
assert(!bucketError && bucket?.public === false, 'The evidence bucket is not private.')

const persistedEvidence = queryDatabase(
  `select evidence_storage_path from public.crusade_submissions where external_idempotency_key = 'discord-interaction:${baseInput.interactionId}';`,
)
assert(
  submissionCount(baseInput.interactionId) === '1',
  'The authoritative submission row is missing or duplicated.',
)
assert(
  persistedEvidence === evidenceStoragePath,
  'The authoritative submission did not retain the durable object path.',
)

const { data: objectList, error: listError } = await serviceClient.storage
  .from(CRUSADE_EVIDENCE_BUCKET)
  .list(evidencePrefix)
assert(!listError, 'The durable evidence object could not be listed.')
assert(
  objectList?.filter(({ name }) => name === 'screenshot').length === 1,
  'The idempotent retry created a missing or duplicate evidence object.',
)

const { data: storedEvidence, error: downloadError } =
  await serviceClient.storage
    .from(CRUSADE_EVIDENCE_BUCKET)
    .download(evidenceStoragePath)
assert(!downloadError && storedEvidence, 'Stored evidence could not be downloaded.')
assert(
  Buffer.from(await storedEvidence.arrayBuffer()).equals(imageBytes),
  'Stored evidence bytes do not match the downloaded test image.',
)

const anonymousClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: anonymousEvidence, error: anonymousError } =
  await anonymousClient.storage
    .from(CRUSADE_EVIDENCE_BUCKET)
    .download(evidenceStoragePath)
assert(
  anonymousError && !anonymousEvidence,
  'Anonymous access unexpectedly read private evidence.',
)

const staffEmail = 'administrator@crusade-command.invalid'
const { data: staffLink, error: staffLinkError } =
  await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: staffEmail,
  })
assert(
  !staffLinkError && staffLink.properties.hashed_token,
  'The local staff identity could not be authenticated for Storage verification.',
)
const staffClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { error: staffVerificationError } = await staffClient.auth.verifyOtp({
  token_hash: staffLink.properties.hashed_token,
  type: 'magiclink',
})
assert(!staffVerificationError, 'The local staff session could not be verified.')
const { data: signedEvidence, error: signedUrlError } =
  await staffClient.storage
    .from(CRUSADE_EVIDENCE_BUCKET)
    .createSignedUrl(evidenceStoragePath, 60)
assert(
  !signedUrlError && signedEvidence?.signedUrl,
  'Authorized staff could not create a short-lived evidence URL.',
)
const signedResponse = await fetch(signedEvidence.signedUrl)
assert(signedResponse.ok, 'The authorized signed evidence URL was unreadable.')
assert(
  Buffer.from(await signedResponse.arrayBuffer()).equals(imageBytes),
  'The authorized signed URL returned unexpected evidence bytes.',
)
await staffClient.auth.signOut()

const failedDownloadId = '990000000000000103'
const failedDownloadIntake = createAuthoritativeSubmissionIntake(
  database,
  createSupabaseEvidenceStore(
    serviceClient,
    imageBytes.byteLength,
    async () => new Response(null, { status: 503 }),
  ),
)
await expectIntakeError(
  () => failedDownloadIntake.createSubmission(diagnosticInput(failedDownloadId)),
  'EVIDENCE_STORAGE_FAILED',
)
assert(
  submissionCount(failedDownloadId) === '0',
  'A failed evidence download created a submission.',
)

const failedUploadId = '990000000000000104'
const missingBucketClient = {
  storage: {
    from: () => serviceClient.storage.from('missing-crusade-evidence'),
  },
}
const failedUploadIntake = createAuthoritativeSubmissionIntake(
  database,
  createSupabaseEvidenceStore(
    missingBucketClient,
    imageBytes.byteLength,
    evidenceFetcher,
  ),
)
await expectIntakeError(
  () => failedUploadIntake.createSubmission(diagnosticInput(failedUploadId)),
  'EVIDENCE_STORAGE_FAILED',
)
assert(
  submissionCount(failedUploadId) === '0',
  'A failed evidence upload created a submission.',
)

const failedRpcId = '990000000000000105'
const failedRpcInput = diagnosticInput(failedRpcId)
const failedRpcPath = evidenceStoragePath.replace(
  baseInput.interactionId,
  failedRpcId,
)
const failedRpcIntake = createAuthoritativeSubmissionIntake(
  {
    ...database,
    createSubmission: async () => {
      throw new DiscordIntakeError(
        'BACKEND_UNAVAILABLE',
        'Simulated ambiguous RPC failure.',
      )
    },
  },
  evidenceStore,
)
await expectIntakeError(
  () => failedRpcIntake.createSubmission(failedRpcInput),
  'BACKEND_UNAVAILABLE',
)
await expectIntakeError(
  () => failedRpcIntake.createSubmission(failedRpcInput),
  'BACKEND_UNAVAILABLE',
)
const failedRpcPrefix = failedRpcPath.slice(0, failedRpcPath.lastIndexOf('/'))
const { data: failedRpcObjects, error: failedRpcListError } =
  await serviceClient.storage
    .from(CRUSADE_EVIDENCE_BUCKET)
    .list(failedRpcPrefix)
assert(
  !failedRpcListError &&
    failedRpcObjects?.filter(({ name }) => name === 'screenshot').length === 1,
  'An ambiguous RPC retry created duplicate evidence objects.',
)
assert(
  submissionCount(failedRpcId) === '0',
  'The simulated failed RPC unexpectedly created a submission.',
)
const { error: cleanupError } = await serviceClient.storage
  .from(CRUSADE_EVIDENCE_BUCKET)
  .remove([failedRpcPath])
assert(!cleanupError, 'The diagnostic orphan could not be safely removed.')

console.log(
  `PASS: ${receiptReference} persisted one private evidence object and one ` +
    'authoritative row; anonymous denial, staff signed access, byte integrity, ' +
    'idempotent retry, download/upload failure, and ambiguous-RPC recovery passed.',
)
