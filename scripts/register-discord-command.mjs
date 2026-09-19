import { readFile } from 'node:fs/promises'

import { registerDiscordCommand } from './discord-registration.mjs'

const scope = process.argv[2]
const command = JSON.parse(
  await readFile(
    new URL('../discord/crusade-submit-command.json', import.meta.url),
    'utf8',
  ),
)

try {
  const registered = await registerDiscordCommand({
    scope,
    environment: process.env,
    command,
  })
  console.log(
    `Registered /${registered.name ?? command.name} as a ${scope} command.`,
  )
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Discord command registration failed.',
  )
  process.exitCode = 1
}
