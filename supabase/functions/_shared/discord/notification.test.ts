// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildStaffSubmissionMessage } from './notification.ts'

describe('Discord staff submission notifications', () => {
  it('includes the scoped role mention, submission details, and review link', () => {
    const message = buildStaffSubmissionMessage(
      {
        interactionId: '300000000000000003',
        discordUserId: '900000000000000001',
        receiptReference: 'CR-00482',
        killTeamName: 'Alpha',
        eventType: 'TERMINUS_KILL',
        targetName: 'Neurothrope',
        status: 'PENDING',
        reviewUrl:
          'https://crusade.example/admin/submissions?receipt=CR-00482',
      },
      '400000000000000004',
    )

    expect(message.content).toContain('<@&400000000000000004>')
    expect(message.content).toContain('Receipt: CR-00482')
    expect(message.content).toContain('Kill Team: Alpha')
    expect(message.content).toContain('<@900000000000000001>')
    expect(message.content).toContain('Type: Terminus Kill')
    expect(message.content).toContain('Target: Neurothrope')
    expect(message.allowed_mentions).toEqual({
      parse: [],
      roles: ['400000000000000004'],
      users: [],
    })
    expect(message.components[0]?.components[0]).toMatchObject({
      label: 'VIEW SUBMISSION',
      url: 'https://crusade.example/admin/submissions?receipt=CR-00482',
    })
  })

  it('uses the stable interaction ID as an enforced notification nonce', () => {
    const notification = {
      interactionId: '300000000000000003',
      discordUserId: '900000000000000001',
      receiptReference: 'CR-00482',
      killTeamName: 'Alpha',
      eventType: 'OBJECTIVE' as const,
      targetName: null,
      status: 'PENDING' as const,
      reviewUrl:
        'https://crusade.example/admin/submissions?receipt=CR-00482',
    }

    const first = buildStaffSubmissionMessage(
      notification,
      '400000000000000004',
    )
    const retry = buildStaffSubmissionMessage(
      notification,
      '400000000000000004',
    )

    expect(first.nonce).toBe(notification.interactionId)
    expect(first.enforce_nonce).toBe(true)
    expect(retry.nonce).toBe(first.nonce)
    expect(first.content).not.toContain('Target:')
  })
})
