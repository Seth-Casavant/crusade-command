import { buildStaffSubmissionMessage } from './notification.ts'
import type {
  StaffSubmissionNotification,
  StaffSubmissionNotifier,
} from './types.ts'

type DiscordNotifierConfig = {
  botToken: string
  channelId: string
  staffRoleId: string
  fetcher?: typeof fetch
}

export function createDiscordStaffNotifier({
  botToken,
  channelId,
  staffRoleId,
  fetcher = fetch,
}: DiscordNotifierConfig): StaffSubmissionNotifier {
  return async (notification: StaffSubmissionNotification) => {
    const response = await fetcher(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bot ${botToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(
          buildStaffSubmissionMessage(notification, staffRoleId),
        ),
      },
    )

    if (!response.ok) {
      throw new Error('Discord staff notification failed.')
    }
  }
}
