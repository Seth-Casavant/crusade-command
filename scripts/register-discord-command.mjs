import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { registerDiscordCommand } from './discord-registration.mjs'

const scope = process.argv[2]
const commandName = process.argv[3] ?? 'crusade-submit'

const commandFiles = {
  'crusade-submit': 'crusade-submit-command.json',
  'crusade-team': 'crusade-team-command.json',
}

const commandFile = commandFiles[commandName]

if (!commandFile) {
  console.error(
    `Unknown Discord command "${commandName}". Use crusade-submit or crusade-team.`,
  )
  process.exitCode = 1
} else {
  const command = JSON.parse(
    await readFile(
      join(process.cwd(), 'discord', commandFile),
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
      error instanceof Error
        ? error.message
        : 'Discord command registration failed.',
    )
    process.exitCode = 1
  }
}