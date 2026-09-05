import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'

function readLocalSupabaseEnvironment() {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.INBUCKET_URL
  ) {
    return process.env
  }

  const status = execSync('pnpm exec supabase status -o env', {
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

const localEnvironment = readLocalSupabaseEnvironment()
const supabaseUrl =
  process.env.SUPABASE_URL ?? localEnvironment.SUPABASE_URL ?? localEnvironment.API_URL
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ??
  localEnvironment.SUPABASE_ANON_KEY ??
  localEnvironment.ANON_KEY
const inbucketUrl =
  process.env.INBUCKET_URL ??
  localEnvironment.INBUCKET_URL ??
  localEnvironment.MAILPIT_URL

if (!supabaseUrl || !supabaseAnonKey || !inbucketUrl) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_ANON_KEY, and INBUCKET_URL are required.',
  )
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function mailboxName(email) {
  return email.slice(0, email.indexOf('@'))
}

async function requestJson(url, allowNotFound = false) {
  const response = await fetch(url)

  if (allowNotFound && response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Local email API returned HTTP ${response.status}.`)
  }

  return response.json()
}

async function listMailbox(email) {
  const inbucketData = await requestJson(
    `${inbucketUrl}/api/v1/mailbox/${encodeURIComponent(mailboxName(email))}`,
    true,
  )

  if (inbucketData) {
    if (Array.isArray(inbucketData)) {
      return inbucketData
    }

    return Array.isArray(inbucketData.messages)
      ? inbucketData.messages
      : []
  }

  const mailpitData = await requestJson(`${inbucketUrl}/api/v1/messages`)
  const messages = Array.isArray(mailpitData.messages)
    ? mailpitData.messages
    : []

  return messages.filter((message) =>
    JSON.stringify(message).toLowerCase().includes(email.toLowerCase()),
  )
}

async function readMessage(email, messageId) {
  const inbucketMessage = await requestJson(
    `${inbucketUrl}/api/v1/mailbox/${encodeURIComponent(
      mailboxName(email),
    )}/${encodeURIComponent(messageId)}`,
    true,
  )

  return (
    inbucketMessage ??
    requestJson(
      `${inbucketUrl}/api/v1/message/${encodeURIComponent(messageId)}`,
    )
  )
}

function messageId(message) {
  return message.id ?? message.ID ?? message.MessageID ?? message.messageId
}

function extractOtp(message) {
  const content = [
    message.body?.html,
    message.body?.text,
    message.html,
    message.text,
    message.HTML,
    message.Text,
  ]
    .filter((value) => typeof value === 'string')
    .join('\n')
  const tokenMatch =
    content.match(/<strong>\s*(\d{6,10})\s*<\/strong>/i) ??
    content.match(/one-time code[^0-9]*(\d{6,10})/i)

  if (!tokenMatch) {
    throw new Error('The local email did not contain an OTP token.')
  }

  return tokenMatch[1]
}

async function waitForNewMessage(email, existingIds) {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    const messages = await listMailbox(email)
    const newMessage = messages.find(
      (message) => !existingIds.has(messageId(message)),
    )

    if (newMessage) {
      return readMessage(email, messageId(newMessage))
    }

    await delay(100)
  }

  throw new Error(`No new local OTP message arrived for ${email}.`)
}

async function verifyRoleThroughOtp(email, expectedRole) {
  const client = createBrowserClient()
  const existingMessages = await listMailbox(email)
  const existingIds = new Set(existingMessages.map(messageId))
  const { error: requestError } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })

  if (requestError) {
    throw new Error(`OTP request failed for ${expectedRole}.`)
  }

  const message = await waitForNewMessage(email, existingIds)
  const token = extractOtp(message)
  const { data, error: verificationError } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (verificationError || !data.session) {
    throw new Error(`OTP verification failed for ${expectedRole}.`)
  }

  const { data: role, error: roleError } = await client.rpc('current_app_role')

  if (roleError || role !== expectedRole) {
    throw new Error(`Database role resolution failed for ${expectedRole}.`)
  }

  const { error: signOutError } = await client.auth.signOut()

  if (signOutError) {
    throw new Error(`Sign-out failed for ${expectedRole}.`)
  }
}

const publicClient = createBrowserClient()
const { data: publicSnapshot, error: publicReadError } = await publicClient.rpc(
  'get_public_sync_snapshot',
)
assert(
  !publicReadError && publicSnapshot?.campaign?.mission_status === 'ACTIVE',
  'Unauthenticated public ACTIVE-campaign reading failed.',
)

const { error: publicWriteError } = await publicClient.rpc(
  'update_campaign_live_state',
  {
    p_campaign_id: '00000000-0000-4000-8000-000000000001',
    p_expected_revision: 3,
    p_new_progress: 50,
  },
)
assert(publicWriteError, 'An unauthenticated authoritative write succeeded.')

await verifyRoleThroughOtp(
  'administrator@crusade-command.invalid',
  'ADMINISTRATOR',
)
await verifyRoleThroughOtp('moderator@crusade-command.invalid', 'MODERATOR')

console.log(
  'PASS: public read/no-write and email OTP role resolution passed for Administrator and Moderator.',
)
