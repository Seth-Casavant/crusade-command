# Phase 2 database foundation

This document records the Phase 2 foundation. Phase 3 subsequently adds the
grants, policies, protected wrappers, and public read RPC documented in
`phase-3-auth-authorization.md`; the Phase 2 state constraints remain intact.

The PostgreSQL database is authoritative. Phase 2 intentionally exposes no
tables or RPCs to `anon` or `authenticated`; Row Level Security is enabled with
no permissive policies. Authentication-aware grants and policies belong to a
later phase.

## Authoritative state

Each campaign automatically receives exactly one `live_campaign_states` row.
It stores the current mission reference, manually controlled progress, the
monotonic campaign command revision, the latest update identifier, and
server-derived update metadata.

`current_mission_id` is assigned only when a READY mission is activated. It is
preserved after COMPLETE or ABORTED so the final mission state remains
available until a later mission is explicitly activated. Objective state is
not duplicated into the live-state row; the objectives belonging to the
current mission are the authoritative relational records.

## Revision and concurrency interpretation

The revision is a campaign-wide command sequence. Every successful mission
transition, including DRAFT to READY, and every successful live-state RPC
increments it exactly once. This gives the two future writers one ordering and
conflict boundary for all authoritative commands. Ordinary draft field edits
do not use the live-state update RPC and do not increment this revision.

Both RPCs lock the campaign live-state row and require the caller's expected
revision. A mismatch raises `REVISION_CONFLICT`; the failed transaction changes
neither state nor audit history. Repeating the same request with its now-stale
revision therefore cannot advance state twice.

## Mission and battlefield rules

Missions must begin in DRAFT. The only normal transitions are:

- DRAFT to READY
- READY to ACTIVE
- ACTIVE to COMPLETE
- ACTIVE to ABORTED

Mission status changes must use `transition_mission_state`. Database triggers
also reject invalid transitions and enforce activation requirements. A partial
unique index permits at most one ACTIVE mission per campaign.

Battlefields may change in DRAFT or READY. Once a mission has ever been ACTIVE,
its battlefield remains immutable in ACTIVE, COMPLETE, and ABORTED to preserve
history.

## Atomic live updates

`update_campaign_live_state` accepts an expected revision and optional progress
and objective-state changes. It validates the complete request before writing,
then applies the logical update, increments the revision once, assigns a
server-generated update UUID and timestamp, and appends one audit row in the
same transaction.

Expected application error identifiers are returned as database messages such
as `REVISION_CONFLICT`, `INVALID_STATE_TRANSITION`, `ACTIVE_MISSION_EXISTS`,
`BATTLEFIELD_LOCKED`, `ACTIVATION_VALIDATION_FAILED:*`, and
`INVALID_CAMPAIGN_PROGRESS`. A future API layer should translate these stable
identifiers into user-facing messages instead of displaying raw SQL details.

## Audit and security preparation

`campaign_updates` is relational metadata plus limited JSONB old/new payloads.
An update identifier is the audit row primary key and is copied to the live
state. An unconditional trigger rejects audit UPDATE and DELETE operations.

Actor UUID columns are nullable until identity support exists. They are not
foreign keys to `auth.users` yet, preventing Phase 2 from prematurely coupling
the database to an authentication design.

## Generated TypeScript types

The project script `pnpm db:types` regenerates
`src/shared/types/database.generated.ts` from the running local database. The
file is not hand-maintained because the migration schema is the source of
truth. Run it after Docker is installed and `pnpm db:reset` succeeds.

## Local verification sequence

```powershell
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:test
pnpm db:types
```

Docker Desktop or another Docker-compatible container runtime must be running
before these commands can start the local Supabase stack.
