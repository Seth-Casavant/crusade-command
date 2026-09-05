# Crusade Command project scope

This file is the durable high-level product specification for the Space Marine
2 Crusade Command application. It consolidates approved decisions through Phase
4.5. Detailed implementation contracts remain in `docs/` and should be read
when working in their area.

## Product and deployment

Crusade Command is a responsive Version 1 web application for multiple Discord
communities to view and run one shared Crusade experience. Reliability,
synchronization, security, data integrity, recoverability, compatibility, and
simplicity take priority over visual complexity or feature count.

The frontend uses React and TypeScript and is planned for Cloudflare Pages.
Supabase supplies authentication, Realtime, and the authoritative PostgreSQL
backend. Production deployment occurs only after local development and testing
are stable. Version 1 must not add unnecessary services, databases, queues, or
paid-only infrastructure.

## Authority and public access

PostgreSQL is always authoritative. Browsers, Discord, Realtime messages, local
storage, and UI state are never sources of authoritative campaign truth.

Public Players do not sign in. They may retrieve only intentionally published
ACTIVE Crusade information: the current campaign, mission, locked battlefield,
progress, objectives, and enemy information. They cannot read drafts, audit
history, application roles, private administration data, evidence, or actor
identities, and they cannot perform authoritative writes.

Version 1 has one Administrator and at most one designated Moderator as its
normal direct writers. Both authenticate through Supabase Auth, primarily with
email one-time passwords. Discord OAuth is an optional future convenience and
must never be the Administrator's only access path. An authenticated identity
has no authority until the database maps `auth.uid()` to an approved role.

The future Discord bot has a separate identity boundary. Slash-command Players
are identified by immutable Discord user IDs supplied by Discord; they do not
need Discord web login. See `docs/phase-3-auth-authorization.md` and
`docs/discord-kill-team-workflow.md`.

## Mission lifecycle and integrity

The mission lifecycle is `DRAFT`, `READY`, `ACTIVE`, `COMPLETE`, with explicit
`ABORTED` support. Draft preparation must not leak into the active public view.
Only one mission may be ACTIVE per campaign.

An ACTIVE mission's battlefield is locked at the database layer until the
mission becomes COMPLETE or ABORTED. Battlefield selection uses predefined
battlefield records, not arbitrary text. These rules may not depend only on
disabled frontend controls.

Every authoritative live state has a monotonically increasing revision.
Administrator and Moderator mutations use optimistic concurrency: stale
expected revisions are rejected rather than merged or silently overwritten.
Related changes are committed atomically, use server-generated timestamps, and
append an immutable audit record containing the actor and before/after values.
Database constraints, RLS, and validated RPCs enforce the rules. See
`docs/phase-2-database.md` and `docs/phase-3-auth-authorization.md`.

## Realtime and recovery

Supabase Realtime carries a narrow public change signal, not complete
authoritative state or private data. Clients initially fetch the full approved
snapshot, subscribe once, and perform another authoritative fetch when a newer
revision arrives. Duplicate and older revisions are ignored; revision gaps
cause a full resync.

Clients verify freshness approximately every 45 seconds and after browser
resume. Reconnection asks what is true now through a complete authoritative
resync before returning to LIVE. Players may retain visibly stale last-known
state while offline. Administrator and Moderator writes are disabled while
offline; Version 1 has no offline write queue or conflict merge. See
`docs/phase-4-synchronization.md`.

## Future Kill Team tactical layer

The Kill Team tactical layer is approved future work but is not yet
implemented. Teams will occupy predefined battlefield checkpoints or zones;
arbitrary dragged pixels are never authoritative. Checkpoint definitions and
the ACTIVE battlefield remain locked during an ACTIVE mission. Team updates
must reuse the same revisions, atomic transactions, audit history, and Realtime
recovery model. See `docs/future-kill-team-tactical-layer.md`.

## Future Discord registration and evidence

The future Discord bot is a validated interaction layer over the same
authoritative backend. Administrator/Moderator commands will register Kill
Teams and immutable Discord membership before activation. The planned Player
`/crusade-submit` workflow accepts screenshot evidence for Mission Completion,
Terminus Kill, and Objective Completion.

Players submit evidence events, never arbitrary progress, checkpoints, counts,
objective state, or authoritative values. The backend identifies their team
from immutable Discord user ID, validates ACTIVE mission membership and
configuration, rejects duplicate interactions/attachments, stores evidence
privately, and applies only predefined effects in one revision-checked atomic
transaction. See `docs/discord-kill-team-workflow.md` and
`docs/KILL_TEAM_QUICK_GUIDE.md`.

## Scope discipline

Implement only the explicitly requested phase or subphase. Do not automatically
begin the next phase. Finished dashboard work, tactical maps, Kill Team schema,
Discord commands, and evidence storage remain deferred until separately
authorized.
