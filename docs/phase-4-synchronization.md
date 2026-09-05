# Phase 4: Realtime synchronization and recovery

Phase 4 adds recovery-aware public synchronization without changing the Phase
2 authoritative write model or the Phase 3 authorization boundary. PostgreSQL
remains the source of truth. Realtime messages are notifications that state
changed; clients never construct authoritative campaign state from an event
payload.

## Public synchronization boundary

`public.public_campaign_sync_signals` is the only application table added to
the `supabase_realtime` publication. Each row contains only a campaign ID,
monotonic revision, opaque update ID, active flag, and server timestamp. It
contains no actor identity, role, audit change set, draft data, or privileged
configuration.

The table is populated only by the database after a committed ACTIVE mission
transition, ACTIVE live-state update, completion, or abort. Anonymous and
authenticated clients can select it, but no browser role can insert, update,
or delete it. Existing campaign tables remain inaccessible to anonymous
clients.

The public client uses two security-definer read functions:

- `get_public_sync_snapshot()` returns the complete permitted ACTIVE campaign
  read model and its signal as one validated snapshot.
- `get_public_latest_sync_signal()` returns only the current notification
  metadata for inexpensive periodic verification.

## Client synchronization lifecycle

On mount, a configured client fetches the complete public snapshot before it
creates one Realtime channel. Once the channel reports `SUBSCRIBED`, the client
performs another complete fetch before declaring itself `LIVE`. That second
fetch closes the small fetch-before-subscribe race.

For a signal concerning the displayed campaign:

- the same update ID or revision is a duplicate and is ignored;
- a lower revision is stale/out of order and is ignored;
- the next revision causes a complete authoritative fetch;
- a jump of more than one revision is a gap and causes the same complete
  authoritative fetch, never event replay;
- a newer signal for a changed campaign also causes a complete fetch.

Concurrent notifications are coalesced behind one in-flight fetch. The newest
pending notification is re-evaluated after that fetch. Repeated
`SUBSCRIBED`/disconnect statuses are transition-guarded so they do not create
duplicate requests or channels.

## Verification and recovery

A lightweight revision check runs every 45 seconds. When its signal differs
from the last authoritative snapshot, the client retrieves the complete
snapshot. A visible-tab or focused-window resume performs the same check, with
a two-second throttle to collapse duplicate browser events.

On Realtime disconnect or a browser `offline` event, the last confirmed state
remains visible and the connection is explicitly `OFFLINE`. No offline writes
or queued mutations exist. A browser `online` event enters `RECONNECTING` and
starts recovery; the client cannot return to `LIVE` until the channel is
subscribed and a complete authoritative fetch succeeds. A successful HTTP
fetch while Realtime remains disconnected does not hide the offline state.

The manual **Resync campaign state** control performs a complete authoritative
fetch without a page reload. It does not create another subscription. The
component removes its timer, browser listeners, and Realtime channel on
unmount.

`canPerformAuthoritativeWrite()` is the reusable Phase 4 UI guard for future
command screens. It returns true only for an Administrator or Moderator while
the synchronization state is `LIVE`. Database RLS and mutation RPC checks
remain authoritative. There is no campaign editor in Phase 4.

Supabase auth events immediately replace an expired or signed-out session with
the public, role-null state. Delayed role or initial-session lookups are
revision-guarded so stale asynchronous results cannot restore privileged UI
state.

Campaign `updated_at` and signal `published_at` values come from PostgreSQL.
The panel's “Last sync” value is only local receipt telemetry and is not used
for ordering, concurrency, or authoritative history.

## Automated local multi-client test

With the local Supabase stack running, set process-local `SUPABASE_URL` and
`SUPABASE_ANON_KEY` from `supabase status` and run:

```powershell
pnpm test:sync:local
```

The script creates two independent browser-compatible Supabase clients using
only the anonymous key. It confirms equal initial snapshots, delivers a real
authorized database update through Realtime to both clients, exercises
duplicate and stale notification handling, disconnects one client across two
committed revisions, and verifies full gap recovery on reconnect. It also
checks manual refetch and that reconnect has exactly one channel. The script
changes local sandbox progress; run `pnpm db:reset` afterward.

The local write is made inside the database container with the seeded
Administrator JWT claims. No service-role key or database password enters the
browser clients or source tree.

## Manual two-browser procedure

1. Copy `.env.example` to the ignored `.env.local` and fill it with the local
   API URL and anonymous/publishable key from `pnpm exec supabase status`.
2. Run `pnpm dev`, then open the application in a normal browser window and a
   private/incognito window.
3. Confirm both windows show the same campaign, revision, progress, and `LIVE`
   state.
4. Run `pnpm test:sync:local` while both windows remain open. Confirm both
   advance to the same latest revision without a page reload.
5. Use browser developer tools to set one window offline. Confirm it retains
   the last campaign and shows `OFFLINE`; the other window remains current.
6. Restore the network. Confirm the stale window shows `RECONNECTING`, replaces
   its state with the current authoritative snapshot, then returns to `LIVE`.
7. Use **Resync campaign state**, suspend/resume the tab, and repeat a quick
   disconnect/reconnect. Confirm revisions never regress and only one signal
   channel appears in the Realtime inspector/network connection.

## Phase boundary

Phase 4 does not include the finished campaign dashboard, map, Kill Team data,
Discord integration, evidence uploads, Player writes, offline queues, or any
Phase 5 feature. The future Discord and Kill Team contracts remain documented
separately and unimplemented.
