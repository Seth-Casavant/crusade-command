import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(
  projectRoot,
  'src',
  'shared',
  'types',
  'database.generated.ts',
)
const supabaseCliPath = resolve(
  projectRoot,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
)

const result = spawnSync(
  process.execPath,
  [
    supabaseCliPath,
    'gen',
    'types',
    'typescript',
    '--local',
    '--schema',
    'public',
  ],
  {
    cwd: projectRoot,
    encoding: 'utf8',
  },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'Type generation failed.\n')
  process.exit(result.status ?? 1)
}

if (!result.stdout.includes('export type Database')) {
  process.stderr.write('Supabase returned an unexpected type definition.\n')
  process.exit(1)
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${result.stdout.trimEnd()}\n`, 'utf8')
process.stdout.write(`Generated ${outputPath}\n`)
