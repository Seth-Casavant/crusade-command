# Phase 3 authentication and authorization

Phase 3 establishes identity and database authorization only. Realtime,
Discord OAuth, campaign-management screens, map graphics, and the Kill Team
tactical layer remain deferred.

## Identity and roles

Supabase Auth (`auth.users`) owns authentication identities. The application
stores only the linked user UUID and controlled `app_role` value in
`public.app_users`; passwords, OAuth tokens, and service-role credentials are
never stored there. Live-state and append-only audit actor UUIDs now have
restrictive foreign keys to the corresponding Supabase Auth identity.

Version 1 roles are `ADMINISTRATOR`, `MODERATOR`, and `PLAYER`. Partial unique
indexes enforce one Administrator and at most one Moderator. A trigger prevents
ordinary updates or deletion of the primary Administrator row. There is no
account-transfer path in this phase.

The sandbox seed creates non-login test identities with no password or reusable
credential. pgTAP tests simulate the trusted JWT claims that Supabase/PostgREST
normally derives from a verified session. The frontend provides a minimal
email/password Supabase Auth entry point for externally provisioned command
staff accounts; Discord OAuth remains the preferred future sign-in mechanism.

## Authorization boundary

The database derives roles by joining `auth.uid()` to `app_users`. JWT metadata
or role strings supplied by the browser are ignored. The Administrator and
Moderator can invoke the authoritative mission-transition and live-state RPCs.
Those RPCs now wrap the unchanged Phase 2 transaction functions and replace any
caller-supplied audit actor with the authenticated user ID.

Authenticated writers may read management tables and audit history under RLS.
Only the Administrator may read role assignments. Browser roles receive no
direct INSERT, UPDATE, or DELETE grants on application tables, so authoritative
state changes remain confined to validated RPCs. Administrator status does not
bypass revision checks, transition rules, progress constraints, atomicity, or
battlefield locking.

The `assign_moderator` RPC is Administrator-only and accepts only a target Auth
user ID; it does not accept a requested role. It is idempotent for the current
Moderator and fails when a different Moderator already exists.

## Public read model

Anonymous and authenticated viewers may execute only
`get_public_active_campaign`. This security-definer function explicitly filters
for ACTIVE campaign and mission records, then returns the published campaign,
mission, battlefield, progress, revision, objective, and enemy information.
It omits drafts, audit history, application roles, actor identifiers, and Auth
data.

Anonymous clients have no direct table grants. Authenticated Players may call
the same public read RPC, while RLS hides all management and role rows from
them. The function does not expose or implement realtime subscriptions.

## Sandbox and production provisioning

Sandbox users in `supabase/seed.sql` exist only to exercise database policies.
They cannot log in because no password or provider credential is seeded.

For a hosted environment, create the primary Administrator through a trusted
deployment/bootstrap operation after its Supabase Auth identity exists. Do not
expose an open "first user becomes Administrator" flow. Moderator assignment
then uses the protected Administrator path. Production provisioning and future
account transfer require an explicit later operational design.

Only `VITE_SUPABASE_URL` and a browser-safe publishable/anon key belong in the
frontend environment. Service-role keys, database passwords, provider secrets,
and session tokens must remain outside Vite variables and Git.

## Authorization test strategy

The Phase 3 pgTAP suite impersonates `anon` and `authenticated` API roles with
Administrator, Moderator, Player, and forged JWT claims. It directly attacks
tables and RPCs to verify public filtering, role secrecy, write denial,
authenticated actor attribution, revision conflicts, battlefield protection,
invalid transitions, primary Administrator protection, and the single-Moderator
rule. The Phase 2 suite remains an independent regression test for all state
integrity behavior.
