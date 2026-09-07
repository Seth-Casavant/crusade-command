# Future feature: Operational Standings

Operational Standings is an approved future public ranking system for
participating Kill Teams. This document records its durable product and data
integrity requirements. Phase 5B does not implement standings, Kill Team data,
scoring, evidence processing, or any related user interface.

## Authority and scoring model

PostgreSQL remains authoritative for points and ranking inputs. Players never
directly edit points, and browsers never independently award or calculate
authoritative rewards. Points derive only from validated scoring events applied
by trusted backend logic.

The initial configurable example scoring model is:

- Mission Completion: `+50`
- Terminus Kill: `+10`
- Objective Completion: `+20`

These values are examples of Crusade configuration, not client constants or an
authorization to implement scoring during Phase 5B.

## Auditable ledger

Authoritative scoring uses an auditable event ledger instead of arbitrary
direct overwrites of a Kill Team total. A future scoring event must be capable
of recording:

- campaign;
- mission;
- Kill Team;
- controlled accomplishment type;
- point delta;
- evidence or submission identifier;
- resulting authoritative revision;
- server-generated timestamp;
- trusted source or actor.

Stable evidence, interaction, and submission identifiers must enforce
idempotency. Duplicate evidence must never award points twice. Corrections
should preferably append auditable compensating entries rather than silently
rewrite prior history. Displayed totals derive from authoritative scoring
records.

## Public presentation

The future Operational Standings view is expected to display:

- rank;
- Kill Team name;
- total points;
- mission progress;
- Terminus kills;
- objectives completed;
- operational status.

A future Kill Team detail view may show the team's score breakdown. Public
presentation must consume an intentionally approved read model and the existing
revision/recovery architecture; it must not expose private evidence, actor
identity, audit detail, or administrative data.

Ranking uses these tie rules in order:

1. Total points.
2. Mission completions.
3. Terminus kills.
4. Remaining exact ties share placement.

## Expected future event flow

```text
Discord evidence or accomplishment
  -> validated backend transaction
  -> scoring ledger
  -> authoritative mission revision
  -> public realtime synchronization signal
  -> Operational Standings refresh
```

Discord remains a validated interaction layer, never an independent authority.
Scoring, the evidence pipeline, database schema, public read grants, Realtime
payload changes, and standings UI all require an explicitly authorized future
phase.
