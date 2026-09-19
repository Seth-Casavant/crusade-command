// @vitest-environment node

import { readdir, readFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import command from '../../../../discord/crusade-submit-command.json'

async function sourceFiles(directory: string): Promise<string[]> {
  const entries: Dirent[] = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`
      return entry.isDirectory() ? sourceFiles(path) : [path]
    }),
  )

  return nested.flat()
}

describe('/crusade-submit registration schema', () => {
  it('uses three event subcommands instead of a separate Type option', () => {
    expect(command.name).toBe('crusade-submit')
    expect(command.contexts).toEqual([0])
    expect(command.options.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: 'objective', type: 1 },
      { name: 'terminus', type: 1 },
      { name: 'mission-completion', type: 1 },
    ])
  })

  it('requires only a screenshot for objective and mission completion', () => {
    for (const index of [0, 2]) {
      expect(command.options[index]?.options).toEqual([
        expect.objectContaining({
          name: 'screenshot',
          type: 11,
          required: true,
        }),
      ])
    }
  })

  it('requires a screenshot and target only for terminus', () => {
    expect(command.options[1]?.options).toEqual([
      expect.objectContaining({
        name: 'screenshot',
        type: 11,
        required: true,
      }),
      expect.objectContaining({
        name: 'target',
        type: 3,
        required: true,
      }),
    ])
  })

  it('does not expose Type, Note, or Kill Team options', () => {
    const optionNames = JSON.stringify(command)

    expect(optionNames).not.toContain('"name":"type"')
    expect(optionNames).not.toContain('"name":"note"')
    expect(optionNames).not.toContain('"name":"kill_team"')
    expect(command.options[1]?.options[1]).toMatchObject({
      max_length: 100,
    })
  })
})

describe('Discord secret isolation', () => {
  it('keeps Discord and Supabase privileged secret names out of browser source', async () => {
    const sourceDirectory = fileURLToPath(
      new URL('../../../../src', import.meta.url),
    )
    const files = (await sourceFiles(sourceDirectory)).filter((path) =>
      /\.(css|ts|tsx)$/.test(path),
    )
    const browserSource = (
      await Promise.all(files.map((path) => readFile(path, 'utf8')))
    ).join('\n')

    expect(browserSource).not.toMatch(
      /DISCORD_BOT_TOKEN|DISCORD_PUBLIC_KEY|SUPABASE_SERVICE_ROLE_KEY/,
    )
  })
})
