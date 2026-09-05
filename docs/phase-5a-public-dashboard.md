# Phase 5A: Public Player dashboard foundation

Phase 5A replaces the temporary development-first presentation with the first
Player-facing Crusade dashboard. It is a presentation layer over the existing
Phase 3 public read model and Phase 4 synchronization coordinator. It does not
change database authority, authorization, mission lifecycle rules, or the
public Realtime boundary.

## Scope and authority

The dashboard is public, requires no session, and is strictly read-only. Its
only campaign input is the validated `PublicCampaignSnapshot` maintained by
`useCampaignSynchronization`. PostgreSQL remains authoritative; rendered React
state, receipt timestamps, Realtime messages, browser storage, and URL state
must never become sources of campaign truth.

Phase 5A must not:

- query restricted campaign tables or subscribe to them directly;
- expose drafts, audit records, roles, actor identities, evidence, or internal
  identifiers;
- add anonymous writes or expand anonymous grants;
- calculate campaign progress, infer objective state, or invent threat data;
- create a second synchronization coordinator or a child-component Realtime
  subscription;
- add or alter database schema merely to improve the presentation;
- implement command-staff editing, Player authentication, or later-phase
  features.

The existing email-OTP entry point may remain as a visually secondary
command-staff control. It must not gate, obscure, or delay public campaign
content.

## Presentation architecture

The page-level dashboard owns the single synchronization hook and maps its
output into focused, presentation-only children. Recommended responsibilities
are:

- `CrusadeHeader`: product label, authoritative Crusade name, mission status,
  and compact connection status;
- `MissionSummary`: mission name and the locked battlefield name, with optional
  public descriptions where the hierarchy remains clear;
- `CampaignProgress`: the authoritative numeric percentage and accessible
  progress meter;
- `ObjectivePanel`: ordered, read-only objective cards and a deliberate empty
  message;
- `ThreatPanel`: public enemy faction and ordered enemy entries;
- `SynchronizationStatus`: server update time, client receipt time, connection
  detail, and manual resynchronization;
- dedicated loading, no-active-operation, and initial-error presentations.

Exact component names may differ, but data access stays outside presentational
children. Children receive typed values and callbacks; they do not import the
Supabase client or synchronize independently.

The Player information hierarchy is:

1. Crusade name and mission status.
2. Mission name and active battlefield.
3. Campaign progress.
4. Current objectives.
5. Enemy and threat information.
6. Connection state and synchronization timestamps.

Normal Player content must not show database IDs, update IDs, revision numbers,
RPC terminology, or implementation diagnostics. Useful diagnostics may remain
in a clearly separated development-only area, but must not appear as part of
the normal Player dashboard.

## Authoritative field presentation

All names, descriptions, statuses, timestamps, and ordered entries come from
the current public snapshot.

- `campaignName` is the Crusade heading; it is never hardcoded.
- `missionName` and `missionStatus` identify the current operation.
- `battlefieldName` identifies the already locked active battlefield. There is
  no Player selector or other battlefield mutation control.
- `campaignProgress` is displayed directly as a percentage and progress bar.
  The service validates the inclusive `0` through `100` range. The presentation
  must remain legible and valid at `0`, `1`, `50`, `99`, and `100`, and must
  never render `NaN`, `Infinity`, `undefined`, or a blank value.
- `objectives` are presented in authoritative order. Each item shows its title,
  optional public description, and textual status. An empty array produces a
  deliberate "No current objectives" message rather than an empty panel.
- `enemyFaction` labels the overall threat and `enemies` supplies each public
  name, optional type, and optional description. An empty list must not cause
  invented enemies or statistics.
- `authoritativeUpdatedAt` is labeled as the server-owned state update time.
  `lastSynchronizedAt` is labeled separately as the browser's last confirmed
  synchronization time and is never used for ordering.

The current public read contract exposes only an `ACTIVE` mission. `READY`
missions remain private. When an active mission completes or aborts, the public
sync signal becomes inactive and the authoritative snapshot contains no active
campaign; Phase 5A therefore renders the no-active-operation state. The UI must
not manufacture a public `COMPLETE`, `ABORTED`, or `READY` record that the
current read model does not provide.

## Render-state contract

The dashboard distinguishes these states without showing sample campaign data:

| Condition | Player presentation |
| --- | --- |
| First authoritative request is pending | `RECEIVING CRUSADE DATA...`; no sample names or progress |
| Successful snapshot contains an active campaign | Full public dashboard |
| Successful snapshot contains no active campaign | `NO ACTIVE OPERATION` and `Awaiting deployment orders.` |
| First request fails and no confirmed campaign exists | Controlled `CRUSADE DATA UNAVAILABLE` view with retry |
| A later request fails after state was confirmed | Preserve the last confirmed dashboard and show the appropriate offline/error notice |

The initial error presentation must not expose stack traces, Supabase error
objects, SQL, or secrets. Retry and manual resynchronization use the coordinator's
existing authoritative fetch path, not a page reload.

## Synchronization behavior

The Phase 4 coordinator continues to own initial fetch, the one Realtime
subscription, duplicate and stale revision handling, gap recovery, 45-second
verification, browser-resume verification, and cleanup.

The Player-facing connection indicator supports text labels for `SYNCING`,
`LIVE`, `RECONNECTING`, and `OFFLINE`. It is always readable without relying on
color. `LIVE` remains compact and does not compete with mission information.
`OFFLINE` adds the explicit message "Showing last known campaign state" while
retaining the last confirmed campaign. `RECONNECTING` retains that state until
a complete authoritative resync succeeds.

The manual **RESYNC** control calls `manualResynchronize`. It does not reload the
document or create another subscription. While a resync is in flight, the
control is disabled and exposes an accessible busy/loading label so repeated
clicks cannot create duplicate work.

## Visual, responsive, and accessibility contract

The dashboard preserves the established blackened-steel, gunmetal, bone,
antique-brass, and restrained-crimson visual language. Panels use square or
clipped geometry, restrained grid/mechanical detail, gothic or classical major
headings, and highly readable technical body text. Styling avoids neon terminal
effects, rounded SaaS cards, heavy glow, excessive animation, and proprietary
game assets.

Desktop and laptop layouts may use two columns for mission/progress and
objectives/threats. Tablet and phone layouts collapse to one logical vertical
sequence without changing content order. The document must not gain horizontal
page scrolling, and long authoritative names and descriptions must wrap inside
their panels rather than clip or force overflow.

Semantic requirements include one clear page heading, ordered heading levels,
landmark regions where useful, native accessible buttons, visible keyboard
focus, sufficient contrast, textual status labels, and a progress bar with an
accessible name and numeric value. Loading and connection changes should be
announced politely; initial retrieval failures should use an alert without
repeatedly announcing stable offline content.

## Manual visual testing procedure

Run this procedure against local test data only. Keep browser developer tools
open so requests and viewport overflow can be inspected. Restore the local
database fixture after any state-changing setup.

1. Start the local Supabase stack and development server. Open a fresh Chrome
   or Edge window at desktop size (for example, 1440 by 900). Confirm an active
   fixture renders the authoritative Crusade, mission, battlefield, percentage,
   objectives, threats, and `LIVE` indicator without a login prompt.
2. Before a hard refresh, select a slow network throttle. Confirm the loading
   presentation appears without placeholder names or percentages, then resolves
   cleanly to the dashboard.
3. Use a local no-active-campaign fixture whose public snapshot returns null.
   Confirm the deliberate `NO ACTIVE OPERATION` presentation, connection
   indicator, and resync control remain usable, with no draft or stale sample
   data exposed.
4. In a fresh window with no confirmed snapshot, temporarily make the local API
   unavailable and reload. Confirm the controlled error presentation and retry
   control. Restore the API, select retry, and confirm recovery occurs without a
   full browser reload.
5. With an active campaign visible, set DevTools Network to **Offline**. Confirm
   the dashboard retains the last confirmed values and clearly shows `OFFLINE`
   plus "Showing last known campaign state." Restore a throttled online
   connection and confirm `RECONNECTING` appears before a successful
   authoritative resync returns the indicator to `LIVE`.
6. Select **RESYNC** and confirm the control becomes disabled/busy, a rapid
   second activation does not start duplicate work, content remains stable, and
   the browser document does not reload. Confirm only the existing Realtime
   channel remains subscribed.
7. In Chrome DevTools responsive mode, inspect at least a tablet viewport, a
   representative phone viewport (390 by 844), and a narrow phone viewport
   (320 pixels wide). Repeat active, empty, offline, and error checks. Confirm
   there is no horizontal page overflow or clipped focus outline; long Crusade,
   mission, objective, and enemy text wraps; progress text and bar remain
   readable; objectives and threats keep a clear reading order; and connection
   status and resync remain visible and keyboard accessible.

Record the browsers, viewport sizes, fixture/state used, and any visual defect
in the Phase 5A completion report. This document defines the procedure and does
not itself assert that manual or automated validation has been performed.

## Phase boundary

Phase 5A ends at the responsive, synchronized public information dashboard. It
does not implement later-phase work, command-staff dashboards, Discord
functionality, evidence uploads, Kill Team data, or Player writes.
