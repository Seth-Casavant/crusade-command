# Future feature: Kill Team tactical layer

This document is a permanent project-scope addendum. The Kill Team tactical
layer is planned for a dedicated phase after authentication, authorization,
realtime synchronization, and the base live-mission interface are proven
stable. It is explicitly excluded from Phase 3.

The future Discord registration and evidence workflow is specified separately
in `discord-kill-team-workflow.md`. Discord remains an interaction layer over
the same authoritative database and revision stream.

## Purpose and player access

During an ACTIVE mission, the battlefield may eventually show every
participating Kill Team at its current tactical checkpoint. A Player may select
a team to inspect its progress, checkpoint, operational status, assigned
objective, last authoritative update time, and an overall textual status list.

Players remain strictly read-only. They cannot move markers, submit progress,
change checkpoints, statuses, or objectives, alter another team, or modify any
shared campaign state. The Version 1 authorization model remains:

- one Administrator and at most one Moderator as the only writers;
- unlimited read-only public or Player viewers.

## Authoritative positioning model

Kill Team locations must reference predefined battlefield checkpoints or
zones. Arbitrary dragged pixels, device coordinates, and responsive-screen
coordinates must never become authoritative mission state. A future battlefield
definition may store normalized rendering coordinates for checkpoints, but
those definitions are configuration rather than live campaign state.

An illustrative Inferno route could contain Deployment Zone, Approach,
Refinery Exterior, Refinery Interior, Promethium Controls, Final Defense, and
Extraction checkpoints. Exact names and battlefield definitions are deferred.

Battlefield checkpoints extend the ACTIVE battlefield lock. While a mission is
ACTIVE, the battlefield, checkpoint identities and coordinates, route layout,
tactical zones, map dimensions, and normalized coordinate system are
immutable.

Multiple teams may occupy the same checkpoint. The client may apply temporary
visual offsets to prevent overlap, but those offsets must never be persisted as
authoritative state.

## Progress and operational state

Checkpoint and progress are separate concepts. Checkpoint answers where a team
is; progress records how much of its assigned mission is complete. Precise
position must not be derived from progress percentage.

Progress is numeric from 0 through 100 inclusive and must have a database CHECK
constraint. Reaching 100 does not automatically complete a Kill Team or its
mission. Mission completion remains an explicit authoritative action.

Operational status must use controlled values rather than unrestricted text. A
future model may refine values similar to STAGING, DEPLOYED, ADVANCING,
OBJECTIVE, DELAYED, COMPLETE, and WITHDRAWN.

## Deferred data model

A future normalized Kill Team mission-state record must be capable of
representing:

- identifier and mission reference;
- name, short name, and display order;
- progress;
- current battlefield checkpoint;
- controlled operational status;
- assigned objective;
- server-derived update time and authenticated actor.

The dedicated implementation phase will determine the exact normalized schema.
No Kill Team or checkpoint table is created during Phase 3.

The later implementation must enforce at least these rules:

- each Kill Team belongs to a mission;
- team identity is unique within its mission where appropriate;
- progress remains between 0 and 100;
- the current checkpoint belongs to the mission's battlefield;
- cross-battlefield checkpoint references are rejected;
- Players cannot modify Kill Team state;
- ACTIVE teams require a valid battlefield and checkpoint;
- completed historical mission data is immutable except through a future,
  explicit correction process;
- checkpoint definitions remain immutable while their mission is ACTIVE.

## Updates, revision, concurrency, and audit

Kill Team mutations must use the existing authoritative update architecture:
expected revision, server validation, one atomic transaction, one revision
increment, server timestamp, append-only audit record, and realtime delivery.
They must not introduce a separate synchronization architecture.

Administrator and Moderator conflicts use the existing optimistic concurrency
rule. The first valid command based on a revision succeeds; a second command
based on that stale revision fails. Stale changes are neither merged nor
accepted with last-write-wins behavior.

Kill Team changes should participate in the shared mission/campaign revision
stream unless a later technical review proves a compelling reason otherwise.
An audit entry must identify the actor and describe changes such as progress,
checkpoint, and operational-status transitions.

## Future interface

Both map and textual representations must derive from the same authoritative
records. Suitable list terminology includes `KILL TEAM STATUS`,
`OPERATIONAL PROGRESS`, or `STRIKE FORCE STATUS`; it need not be presented as a
leaderboard.

On desktop, selecting a marker may open a side panel while preserving the map.
On mobile, an accessible responsive panel may appear beneath or over the map.
Selection should not navigate away from the ACTIVE mission unnecessarily.

## Explicit exclusions from the initial Kill Team version

The initial tactical layer must not include:

- Player-submitted progress or other Player writes;
- free marker dragging or GPS-style positioning;
- individual player positions;
- kill counters, team chat, or automated scoring;
- automatic completion at 100 percent;
- animated route simulation or complex movement interpolation;
- Player voting;
- cross-team buffs or debuffs;
- fog of war or strategic AI.

These ideas may be considered only after the basic authoritative Kill Team
layer is stable and only through an explicit future scope change.
