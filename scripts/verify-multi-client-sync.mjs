import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const dockerPath = process.env.DOCKER_PATH || 'docker'
const databaseContainer =
  process.env.SUPABASE_DB_CONTAINER || 'supabase_db_crusade-command'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_ANON_KEY are required for the local synchronization test.',
  )
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function validateSnapshot(value) {
  assert(value && typeof value === 'object', 'Snapshot must be an object.')
  assert(
    value.active_campaign_count === 1,
    'The integration test requires exactly one seeded ACTIVE campaign.',
  )
  assert(value.campaign, 'The seeded ACTIVE campaign was not returned.')
  assert(value.signal, 'The seeded synchronization signal was not returned.')
  assert(
    value.campaign.campaign_id === value.signal.campaign_id &&
      value.campaign.revision === value.signal.revision,
    'The authoritative campaign and signal revisions disagree.',
  )
  return value
}

function validateSignal(value) {
  assert(value && typeof value === 'object', 'Realtime signal is missing.')
  assert(
    typeof value.campaign_id === 'string' &&
      Number.isSafeInteger(value.revision) &&
      typeof value.update_id === 'string',
    'Realtime signal has an invalid public shape.',
  )
  return value
}

async function fetchSnapshot(client) {
  const { data, error } = await client.rpc('get_public_sync_snapshot')

  if (error) {
    throw new Error(`Authoritative snapshot fetch failed: ${error.message}`)
  }

  return validateSnapshot(data)
}

function createHarness(name) {
  const client = createBrowserClient()
  let channel = null
  let state = null
  let inFlightRefresh = null
  let pendingSignal = null
  let authoritativeFetches = 0
  let realtimeEvents = 0
  let duplicateEventsIgnored = 0
  let staleEventsIgnored = 0
  let revisionGapsDetected = 0

  const refresh = async () => {
    authoritativeFetches += 1
    state = await fetchSnapshot(client)
    return state
  }

  const classify = (signal) => {
    const currentSignal = state?.signal

    if (
      currentSignal?.update_id === signal.update_id ||
      (currentSignal?.campaign_id === signal.campaign_id &&
        currentSignal.revision === signal.revision)
    ) {
      return 'DUPLICATE'
    }

    if (
      currentSignal?.campaign_id === signal.campaign_id &&
      signal.revision < currentSignal.revision
    ) {
      return 'STALE'
    }

    if (
      currentSignal?.campaign_id === signal.campaign_id &&
      signal.revision > currentSignal.revision + 1
    ) {
      return 'GAP'
    }

    return 'NEWER'
  }

  const processSignal = async (rawSignal) => {
    const signal = validateSignal(rawSignal)
    const disposition = classify(signal)

    if (disposition === 'DUPLICATE') {
      duplicateEventsIgnored += 1
      return
    }

    if (disposition === 'STALE') {
      staleEventsIgnored += 1
      return
    }

    if (disposition === 'GAP') {
      revisionGapsDetected += 1
    }

    if (inFlightRefresh) {
      if (!pendingSignal || signal.revision > pendingSignal.revision) {
        pendingSignal = signal
      }
      return inFlightRefresh
    }

    inFlightRefresh = refresh().finally(async () => {
      inFlightRefresh = null
      const nextSignal = pendingSignal
      pendingSignal = null

      if (nextSignal) {
        await processSignal(nextSignal)
      }
    })

    return inFlightRefresh
  }

  const subscribe = async () => {
    if (channel) {
      return
    }

    const nextChannel = client.channel(
      `phase-4-multi-client-${name}-${randomUUID()}`,
    )
    channel = nextChannel

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`${name} did not subscribe within 15 seconds.`)),
        15_000,
      )

      nextChannel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'public_campaign_sync_signals',
          },
          (payload) => {
            realtimeEvents += 1
            void processSignal(payload.new).catch(reject)
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout)
            resolve()
          } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
            clearTimeout(timeout)
            reject(new Error(`${name} Realtime status: ${status}`))
          }
        })
    })

    // Close the fetch-before-subscribe race before this client is considered live.
    await refresh()
  }

  const unsubscribe = async () => {
    if (!channel) {
      return
    }

    const activeChannel = channel
    channel = null
    await client.removeChannel(activeChannel)
  }

  const waitForRevision = async (revision) => {
    const deadline = Date.now() + 15_000

    while (state?.campaign?.revision !== revision) {
      if (Date.now() >= deadline) {
        throw new Error(`${name} did not reach revision ${revision}.`)
      }

      await delay(25)
    }
  }

  return {
    client,
    get metrics() {
      return {
        authoritativeFetches,
        duplicateEventsIgnored,
        realtimeEvents,
        revisionGapsDetected,
        staleEventsIgnored,
      }
    },
    get state() {
      return state
    },
    initialLoad: refresh,
    manualResync: refresh,
    processSignal,
    subscribe,
    unsubscribe,
    waitForRevision,
  }
}

function applyAuthoritativeProgress(campaignId, expectedRevision, progress) {
  assert(
    /^[0-9a-f-]{36}$/i.test(campaignId),
    'Campaign identifier is not safe for the local SQL test.',
  )
  assert(
    Number.isSafeInteger(expectedRevision) && expectedRevision >= 1,
    'Expected revision is invalid.',
  )
  assert(
    Number.isSafeInteger(progress) && progress >= 0 && progress <= 100,
    'Progress is invalid.',
  )

  const sql = `begin;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}',
  true
);
set local role authenticated;
select new_revision
from public.update_campaign_live_state(
  '${campaignId}'::uuid,
  ${expectedRevision}::bigint,
  ${progress}::integer
);
commit;`
  const result = spawnSync(
    dockerPath,
    [
      'exec',
      databaseContainer,
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--quiet',
      '--command',
      sql,
    ],
    { encoding: 'utf8', windowsHide: true },
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      `Authoritative local update failed: ${result.stderr || result.stdout}`,
    )
  }
}

function nextProgressValues(currentProgress) {
  const values = []

  for (let offset = 1; values.length < 3; offset += 1) {
    const candidate = (currentProgress + offset) % 101

    if (candidate !== currentProgress && !values.includes(candidate)) {
      values.push(candidate)
    }
  }

  return values
}

const clientA = createHarness('client-a')
const clientB = createHarness('client-b')

try {
  await Promise.all([clientA.initialLoad(), clientB.initialLoad()])
  assert(
    JSON.stringify(clientA.state) === JSON.stringify(clientB.state),
    'The two clients did not load identical authoritative state.',
  )

  await Promise.all([clientA.subscribe(), clientB.subscribe()])
  // SUBSCRIBED acknowledges the Phoenix channel join. Give the local CDC
  // worker one short scheduling turn to attach its database filter before the
  // first deliberate transaction; production correctness still relies on the
  // authoritative post-subscribe fetch and 45-second verification path.
  await delay(500)
  const campaignId = clientA.state.campaign.campaign_id
  const initialRevision = clientA.state.campaign.revision
  const [progressOne, progressTwo, progressThree] = nextProgressValues(
    clientA.state.campaign.campaign_progress,
  )

  applyAuthoritativeProgress(campaignId, initialRevision, progressOne)
  await Promise.all([
    clientA.waitForRevision(initialRevision + 1),
    clientB.waitForRevision(initialRevision + 1),
  ])
  assert(
    clientA.state.campaign.campaign_progress === progressOne &&
      clientB.state.campaign.campaign_progress === progressOne,
    'The newer authoritative progress did not reach both clients.',
  )

  const duplicateFetchCount = clientA.metrics.authoritativeFetches
  await clientA.processSignal(clientA.state.signal)
  await clientA.processSignal({
    ...clientA.state.signal,
    revision: initialRevision,
    update_id: '90000000-0000-4000-8000-000000000099',
  })
  assert(
    clientA.metrics.authoritativeFetches === duplicateFetchCount,
    'Duplicate or older signals caused an authoritative refetch.',
  )

  const manualFetchCount = clientA.metrics.authoritativeFetches
  await clientA.manualResync()
  assert(
    clientA.metrics.authoritativeFetches === manualFetchCount + 1,
    'Manual resync did not perform an authoritative fetch.',
  )

  await clientB.unsubscribe()
  const retainedRevision = clientB.state.campaign.revision
  assert(
    clientB.client.getChannels().length === 0,
    'The offline client retained a Realtime subscription.',
  )

  applyAuthoritativeProgress(campaignId, initialRevision + 1, progressTwo)
  await clientA.waitForRevision(initialRevision + 2)
  applyAuthoritativeProgress(campaignId, initialRevision + 2, progressThree)
  await clientA.waitForRevision(initialRevision + 3)
  assert(
    clientB.state.campaign.revision === retainedRevision,
    'The offline client did not retain its last known revision.',
  )

  await clientB.subscribe()
  assert(
    clientB.state.campaign.revision === initialRevision + 3,
    'Reconnect did not replace stale state with the authoritative revision.',
  )
  assert(
    clientB.state.campaign.revision > retainedRevision + 1,
    'The reconnect scenario did not contain a missed revision gap.',
  )
  assert(
    clientB.client.getChannels().length === 1,
    'Reconnect created an unexpected subscription count.',
  )
  await clientB.subscribe()
  assert(
    clientB.client.getChannels().length === 1,
    'A duplicate subscribe request accumulated another channel.',
  )

  console.log(
    `PASS: two clients synchronized through revision ${initialRevision + 3}; ` +
      'duplicate/older signals were ignored; offline state was retained; ' +
      'gap recovery, manual resync, and single-subscription reconnect passed.',
  )
} finally {
  await Promise.allSettled([clientA.unsubscribe(), clientB.unsubscribe()])
}
