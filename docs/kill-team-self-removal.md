# Kill Team self-removal

The October 27 request allows every registered member, including a leader, to
use `/crusade-team remove member:@yourself` before activation. No Discord command
re-registration, frontend rebuild, or Edge Function deployment is required: the
existing trusted adapter already forwards the invoking account and target.

Migration `20261028020000` replaces the existing service-role-only removal RPC.
It keeps its signature and response contract. Members may target themselves;
only the current leader may target someone else on that leader's own team.
A departing leader passes leadership to the remaining member with the earliest
registration timestamp (membership ID breaks ties). When the final member
leaves, only the unlocked empty registration and its mission projections are
removed through existing audited functions. The departure, caller, leadership
handover, and all projection revisions are recorded atomically.

Mission lifecycle locks remain unchanged: ACTIVE, COMPLETE, and ABORTED mission
rosters cannot be rewritten through this path. This change does not activate
The Midnight Hunt, alter campaign selection, reset scores, or remove historical
evidence. Existing team switching/registration restrictions still apply.

The replacement also qualifies the membership DELETE column names to avoid
ambiguity with the RPC's output parameters.

Validation: build, lint, and all 63 Discord tests pass. The isolated PostgreSQL
WASM test harness applied every repository migration, then ran the SQL fixture
with assertions for ordinary self-removal, leader handover, final-member exit,
re-registration, cross-team/other-member denial, service-only access, audits,
monotonic revisions, projection mismatch, downstream rollback, and live-roster
locks. The harness supplies minimal Supabase Auth/Storage schemas. The same assertions
also passed against hosted Supabase with the candidate function installed inside
a transaction that rolled back. A signed live Discord interaction remains a
separate post-deployment user check.
The checked-in pgTAP scenario runs through `pnpm db:test` on Supabase as well.

Rollback: restore the previous removal-function definition through a new
versioned migration. Do not roll back real membership changes or audit history.
