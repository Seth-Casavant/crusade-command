# Phase 1 decisions and deferred items

The provided project scope is the authoritative product specification. This
phase creates only the development foundation and does not settle product or
security choices assigned to later phases.

## Decisions made for the foundation

- React, Vite, and TypeScript form the client application.
- The production output is a static `dist` directory suitable for Cloudflare
  Pages.
- Supabase is represented by one optional, centralized client boundary. The
  application can start without Supabase environment values during Phase 1.
- Public browser configuration uses only a Supabase URL and publishable key.
  Privileged credentials must never use the `VITE_` prefix or enter client
  source.
- Feature state, validation, domain types, and data access have separate source
  boundaries so database operations do not spread through UI components.
- pnpm is the pinned package manager for deterministic local setup.

## Decisions deliberately deferred

- The exact normalized PostgreSQL schema, RLS policies, transaction functions,
  audit format, and recovery process.
- Which mission fields remain editable during an active mission.
- Battlefield asset formats and tactical map representation.
- Current free-tier quotas and inactivity behavior. These are operationally
  changeable and must be verified against the provider documentation when the
  sandbox projects are created.

## Decisions finalized after Phase 1

- Public Players use unauthenticated, intentionally narrow ACTIVE-campaign
  reads and never receive authoritative write access.
- One Administrator and at most one Moderator map Supabase Auth identities to
  protected database roles.
- Email OTP is the primary Administrator/Moderator login method. Discord OAuth
  is only an optional future convenience and is separate from future Discord
  bot identity.
- Detailed current decisions live in `PROJECT_SCOPE.md`,
  `phase-3-auth-authorization.md`, and `phase-4-synchronization.md`.

## Scope observations for later phases

- The scope uses both “DRAFT” and “DRAFT / PREPARATION.” A single canonical
  database value should be selected before state-transition migrations are
  written; the UI may display a friendlier label.
- The scope names both a current Crusade and one active mission per campaign,
  but does not decide whether multiple campaigns may exist while exactly one is
  globally presented. The database design must make that ownership explicit.
- Moderator activation, completion, and abort rights are described as
  configurable, but the configuration mechanism is unspecified. It should not
  be inferred during Phase 1.
