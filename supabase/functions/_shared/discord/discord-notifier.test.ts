import { describe, expect, it, vi } from 'vitest'

import { createDiscordStaffNotifier } from './discord-notifier.ts'

const notification = {
  interactionId: '123456789012345678',
  discordUserId: '223456789012345678',
  receiptReference: 'CR-00482',
  killTeamName: 'Alpha',
  eventType: 'TERMINUS_KILL' as const,
  targetName: 'Neurothrope',
  status: 'PENDING' as const,
  reviewUrl: 'https://crusade.example/admin/submissions?receipt=CR-00482',
}

describe('Discord staff notifier', () => {
  it('posts the constrained notification to the configured staff channel', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      requests.push({ input, init })
      return new Response(null, { status: 204 })
    })
    const notify = createDiscordStaffNotifier({
      botToken: 'server-only-token',
      channelId: '323456789012345678',
      staffRoleId: '423456789012345678',
      fetcher,
    })

    await notify(notification)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/323456789012345678/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bot server-only-token',
          'content-type': 'application/json',
        },
      }),
    )

    const body = JSON.parse(
      String(requests[0]?.init?.body),
    ) as Record<string, unknown>
    expect(body).toMatchObject({
      nonce: notification.interactionId,
      enforce_nonce: true,
      allowed_mentions: { parse: [], roles: ['423456789012345678'] },
    })
  })

  it('fails closed when Discord rejects the staff notification', async () => {
    const notify = createDiscordStaffNotifier({
      botToken: 'server-only-token',
      channelId: '323456789012345678',
      staffRoleId: '423456789012345678',
      fetcher: vi.fn(async () => new Response(null, { status: 500 })),
    })

    await expect(notify(notification)).rejects.toThrow(
      'Discord staff notification failed.',
    )
  })
})
