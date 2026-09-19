import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'vitest'
import { join } from 'node:path'

import {
  discordCommandRegistrationUrl,
  registerDiscordCommand,
} from './discord-registration.mjs'

const environment = {
  DISCORD_APPLICATION_ID: '100000000000000001',
  DISCORD_BOT_TOKEN: 'server-only-test-token',
  DISCORD_GUILD_ID: '200000000000000002',
}
const command = JSON.parse(
  await readFile(
    join(process.cwd(), 'discord', 'crusade-submit-command.json'),
    'utf8',
  ),
)

test('builds the guild-scoped registration endpoint', () => {
  assert.equal(
    discordCommandRegistrationUrl('guild', environment),
    'https://discord.com/api/v10/applications/100000000000000001/guilds/200000000000000002/commands',
  )
})

test('builds the separately selected global registration endpoint', () => {
  assert.equal(
    discordCommandRegistrationUrl('global', environment),
    'https://discord.com/api/v10/applications/100000000000000001/commands',
  )
})

test('registers the command without exposing the bot token in its payload', async () => {
  let request
  const fetcher = async (url, init) => {
    request = { url, init }
    return new Response(JSON.stringify(command), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  await registerDiscordCommand({
    scope: 'guild',
    environment,
    command,
    fetcher,
  })

  assert.equal(request.init.method, 'POST')
  assert.equal(
    request.init.headers.authorization,
    `Bot ${environment.DISCORD_BOT_TOKEN}`,
  )
  assert.deepEqual(JSON.parse(request.init.body), command)
  assert.deepEqual(
    command.options.map(({ name, type }) => ({ name, type })),
    [
      { name: 'objective', type: 1 },
      { name: 'terminus', type: 1 },
      { name: 'mission-completion', type: 1 },
    ],
  )
  assert.doesNotMatch(request.init.body, /server-only-test-token/)
})

test('rejects registration when required server configuration is absent', async () => {
  await assert.rejects(
    registerDiscordCommand({
      scope: 'guild',
      environment: {},
      command: { name: 'crusade-submit' },
      fetcher: async () => new Response(),
    }),
    /DISCORD_BOT_TOKEN/,
  )
})
