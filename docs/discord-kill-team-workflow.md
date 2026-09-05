# Future Discord and Kill Team workflow

This permanent scope document defines the approved future Discord/Kill Team
workflow. It is not implemented in Phase 4. Supabase remains authoritative;
Discord is a validated interaction layer, never a second campaign database.

## Responsibility boundary

Discord will eventually handle Kill Team registration, membership association,
mission evidence, Terminus kill evidence, and objective evidence. The web
application remains responsible for the tactical display, map positions,
progress visualization, campaign and mission state, administrative views, and
realtime display.

Discord bot identity is separate from web authentication. Administrator and
Moderator primarily use Supabase email OTP for the web application. Discord
OAuth may be added later as convenience, but it is not required for command
staff or Players. Slash-command Players are identified by immutable Discord
user IDs delivered by Discord, not by a web session or self-reported identity.

The future authoritative path is:

```text
Discord evidence submission
  -> validated backend event
  -> authoritative database transaction
  -> mission revision increment
  -> append-only audit record
  -> realtime notification
  -> Kill Team tactical display refresh
```

Discord and web controls must use the same revision-checked mutation
architecture.

## Administrative registration commands

The planned `/killteam-create`, `/killteam-edit`, and `/killteam-remove`
commands are restricted to the Administrator and designated Moderator.

`/killteam-create` collects a valid Kill Team name and Discord member mentions.
The bot resolves immutable Discord user IDs rather than storing display names.
Before any registration mutation, the backend must verify that:

- the mission exists and is DRAFT or READY;
- the team name is valid and unique within that mission where required;
- every Discord identity is valid;
- at least one member is assigned;
- no member belongs to another Kill Team for the same mission.

A Discord user may belong to at most one Kill Team per mission. This requires a
database constraint; bot-side validation alone is insufficient.

During DRAFT and READY, an authorized writer may create, rename, change
membership, or remove an upcoming team. Once the mission is ACTIVE, team name,
membership, mission assignment, and starting identity are locked. COMPLETE and
ABORTED historical membership remains preserved.

Expected administrative responses should identify success or a controlled
validation failure without exposing database or authentication details.

## Player submission command

The planned `/crusade-submit` command is available only to a Discord user whose
immutable Discord ID belongs to a participating Kill Team in the ACTIVE
mission. The player never selects a team manually; the backend resolves:

```text
Discord user ID -> registered Kill Team -> ACTIVE mission
```

Before displaying submission choices, the backend validates an ACTIVE Crusade
and mission, active-mission membership, enabled submission type, allowed media,
and stable Discord interaction/attachment identifiers that have not already
been processed.

Initial submission types are:

- MISSION COMPLETION
- TERMINUS KILL
- OBJECTIVE COMPLETION

Routine valid submissions are processed automatically. Version 1 must not add
a separate moderator approval channel. Administrator or Moderator intervention
is reserved for exceptions and later correction tooling.

## Evidence events do not directly set state

Players submit an event type plus evidence. They never supply arbitrary
authoritative progress, kill counts, checkpoints, objectives, or statuses. The
backend maps an allowed event to predefined Crusade behavior inside one
validated, atomic, revision-checked transaction.

MISSION COMPLETION requires a screenshot. Its configured effect may set team
progress to 100, status to COMPLETE, and a configured final checkpoint. It must
be idempotent: an already completed team receives no second completion credit.

TERMINUS KILL requires a separate screenshot for each legitimate kill. It may
increment a configured count or invoke another explicit future rule. It must
not change mission progress unless the Crusade configuration expressly defines
that behavior. The same Discord interaction or attachment cannot be processed
twice.

OBJECTIVE COMPLETION requires evidence when configured. The backend limits the
available objectives and effects to those configured for the active mission and
team; the player cannot submit an arbitrary objective ID or state.

## Media and evidence records

Initially accepted media types are PNG, JPG/JPEG, and WebP. Executables,
archives, SVG, unsupported documents, and files over configured limits are
rejected. Implementations should validate actual media type where practical,
must not trust original filenames, and should generate UUID-based internal
identifiers.

A future evidence record must be capable of linking an evidence ID, campaign,
mission, Kill Team, immutable Discord user ID, Discord interaction and optional
attachment IDs, controlled submission type, private storage reference,
server-derived submission time, resulting authoritative revision, and
processing status. The exact schema is deferred to the dedicated Discord phase.

Evidence must be retained for audit and troubleshooting. Supabase Storage or
another approved store may be used later, but uploads must not be globally
public or publicly writable by default.

## Duplicate and permission protection

Stable Discord interaction, message, and attachment identifiers provide
idempotency keys. Replaying the same interaction must never apply the same
reward twice. A duplicate completion may return a controlled message explaining
that completion was already recorded and no additional progress was applied.

The two-writer rule remains the rule for direct human edits: only Administrator
and Moderator directly mutate campaign state. A registered Player gains only a
narrow evidence-submission action. The future bot uses a trusted backend path
that validates the identity, membership, mission, event, evidence, idempotency
key, and expected revision. Players never receive general database UPDATE
permission.

## Planned command reference

### `/killteam-create`

- Permission: Administrator or Moderator.
- Mission state: DRAFT or READY only.
- Validation: valid unique team name, valid Discord IDs, at least one member,
  and one-team-per-member-per-mission.
- Effect: creates normalized team and membership records atomically.
- Response: confirms the team and resolved members, or a controlled reason the
  registration was rejected.

### `/killteam-edit`

- Permission: Administrator or Moderator.
- Mission state: DRAFT or READY only.
- Validation: the same naming, membership, and mission constraints as create.
- Effect: atomically changes only unlocked registration fields.
- Response: confirms the new registration or explains the lock/validation
  failure.

### `/killteam-remove`

- Permission: Administrator or Moderator.
- Mission state: DRAFT or READY only.
- Validation: team belongs to the selected upcoming mission and has not become
  historical ACTIVE data.
- Effect: removes only an unlocked upcoming team and its membership according
  to future foreign-key rules.
- Response: confirms removal or explains why historical data is locked.

### `/crusade-submit`

- Permission: Discord user registered to a team in the ACTIVE mission.
- Identification: automatic from immutable Discord user ID; no team selector.
- Validation: active campaign/mission, membership, enabled event type, media
  policy, permitted objective where applicable, and unused idempotency IDs.
- Effect: stores evidence and applies only the configured backend event in one
  revision-checked transaction.
- Duplicate protection: the same interaction/attachment cannot award twice.
- Response: confirms the identified team and applied result, or returns a safe
  validation/duplicate message directly to the player.

This command reference is intended for future Discord server documentation. No
bot commands, evidence tables, storage buckets, or Kill Team records are added
in Phase 4.
