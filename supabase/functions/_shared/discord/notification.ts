import type {
  StaffSubmissionNotification,
  SubmissionEventType,
} from './types.ts'

const eventLabels: Record<SubmissionEventType, string> = {
  TERMINUS_KILL: 'Terminus Kill',
  OBJECTIVE: 'Objective',
  MISSION_COMPLETION: 'Mission Completion',
}

export type DiscordStaffMessage = {
  content: string
  allowed_mentions: {
    parse: []
    roles: string[]
    users: string[]
  }
  components: Array<{
    type: 1
    components: Array<{
      type: 2
      style: 5
      label: 'VIEW SUBMISSION'
      url: string
    }>
  }>
  nonce: string
  enforce_nonce: true
}

export function formatSubmissionEventType(eventType: SubmissionEventType) {
  return eventLabels[eventType]
}

export function buildStaffSubmissionMessage(
  notification: StaffSubmissionNotification,
  staffRoleId: string,
): DiscordStaffMessage {
  const targetLine = notification.targetName
    ? `\nTarget: ${notification.targetName}`
    : ''

  return {
    content: [
      `<@&${staffRoleId}>`,
      '',
      '**NEW CRUSADE SUBMISSION**',
      '',
      `Receipt: ${notification.receiptReference}`,
      `Kill Team: ${notification.killTeamName}`,
      `Submitted by: <@${notification.discordUserId}>`,
      `Type: ${formatSubmissionEventType(notification.eventType)}${targetLine}`,
      'Status: PENDING REVIEW',
    ].join('\n'),
    allowed_mentions: {
      parse: [],
      roles: [staffRoleId],
      users: [],
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'VIEW SUBMISSION',
            url: notification.reviewUrl,
          },
        ],
      },
    ],
    nonce: notification.interactionId,
    enforce_nonce: true,
  }
}
