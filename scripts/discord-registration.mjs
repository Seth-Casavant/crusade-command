const discordApiBaseUrl = 'https://discord.com/api/v10'
const snowflakePattern = /^[0-9]{17,20}$/

function requiredValue(environment, name) {
  const value = environment[name]?.trim()
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`)
  }

  return value
}

export function discordCommandRegistrationUrl(scope, environment) {
  const applicationId = requiredValue(environment, 'DISCORD_APPLICATION_ID')
  if (!snowflakePattern.test(applicationId)) {
    throw new Error('DISCORD_APPLICATION_ID must be a Discord snowflake.')
  }

  if (scope === 'global') {
    return `${discordApiBaseUrl}/applications/${applicationId}/commands`
  }

  if (scope !== 'guild') {
    throw new Error('Registration scope must be guild or global.')
  }

  const guildId = requiredValue(environment, 'DISCORD_GUILD_ID')
  if (!snowflakePattern.test(guildId)) {
    throw new Error('DISCORD_GUILD_ID must be a Discord snowflake.')
  }

  return `${discordApiBaseUrl}/applications/${applicationId}/guilds/${guildId}/commands`
}

export async function registerDiscordCommand({
  scope,
  environment,
  command,
  fetcher = fetch,
}) {
  const botToken = requiredValue(environment, 'DISCORD_BOT_TOKEN')
  const response = await fetcher(
    discordCommandRegistrationUrl(scope, environment),
    {
      method: 'POST',
      headers: {
        authorization: `Bot ${botToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(command),
    },
  )

  if (!response.ok) {
    throw new Error(`Discord command registration failed (${response.status}).`)
  }

  return response.json()
}
