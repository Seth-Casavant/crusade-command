import { createClient } from '@supabase/supabase-js'

import { createAuthoritativeSubmissionIntake } from '../_shared/discord/intake.ts'
import { createDiscordInteractionHandler } from '../_shared/discord/interaction.ts'
import { DEFAULT_MAX_ATTACHMENT_BYTES } from '../_shared/discord/types.ts'
import { createDiscordStaffNotifier } from '../_shared/discord/discord-notifier.ts'
import { createSupabaseEvidenceStore } from './evidence-storage.ts'
import { createSupabaseSubmissionDatabase } from './supabase-database.ts'

type EdgeRuntime = {
  env: { get: (name: string) => string | undefined }
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void
}

type BackgroundRuntime = {
  waitUntil: (promise: Promise<unknown>) => void
}

const edgeRuntime = (globalThis as typeof globalThis & { Deno: EdgeRuntime })
  .Deno
const backgroundRuntime = (
  globalThis as typeof globalThis & { EdgeRuntime: BackgroundRuntime }
).EdgeRuntime

function requiredEnvironmentValue(name: string) {
  const value = edgeRuntime.env.get(name)?.trim()
  if (!value) {
    throw new Error(`Missing required server configuration: ${name}`)
  }

  return value
}

function supabaseSecretKey() {
  const secretKeys = edgeRuntime.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.default === 'string'
      ) {
        return parsed.default
      }
    } catch {
      throw new Error('SUPABASE_SECRET_KEYS is invalid.')
    }
  }

  return requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY')
}

function maximumAttachmentBytes() {
  const configured = edgeRuntime.env.get('DISCORD_MAX_ATTACHMENT_BYTES')
  if (!configured) {
    return DEFAULT_MAX_ATTACHMENT_BYTES
  }

  const value = Number(configured)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('DISCORD_MAX_ATTACHMENT_BYTES must be a positive integer.')
  }

  return value
}

const client = createClient(
  requiredEnvironmentValue('SUPABASE_URL'),
  supabaseSecretKey(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

const maxAttachmentBytes = maximumAttachmentBytes()
const intake = createAuthoritativeSubmissionIntake(
  createSupabaseSubmissionDatabase(client),
  createSupabaseEvidenceStore(client, maxAttachmentBytes),
)
const handler = createDiscordInteractionHandler({
  applicationId: requiredEnvironmentValue('DISCORD_APPLICATION_ID'),
  publicKey: requiredEnvironmentValue('DISCORD_PUBLIC_KEY'),
  publicAppUrl: requiredEnvironmentValue('PUBLIC_APP_URL'),
  guildId: edgeRuntime.env.get('DISCORD_GUILD_ID')?.trim() || undefined,
  maxAttachmentBytes,
  intake,
  waitUntil: (promise) => backgroundRuntime.waitUntil(promise),
  notifyStaff: createDiscordStaffNotifier({
    botToken: requiredEnvironmentValue('DISCORD_BOT_TOKEN'),
    channelId: requiredEnvironmentValue('DISCORD_STAFF_CHANNEL_ID'),
    staffRoleId: requiredEnvironmentValue('DISCORD_STAFF_ROLE_ID'),
  }),
})

edgeRuntime.serve(handler)
