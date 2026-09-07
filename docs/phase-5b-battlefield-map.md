# Phase 5B: Battlefield map framework

Phase 5B adds a reusable tactical cartography presentation to the public Player
dashboard. It builds on the Phase 5A dashboard and consumes the same validated
Phase 4 campaign snapshot. PostgreSQL remains authoritative, and the map never
queries Supabase, subscribes to Realtime, mutates campaign state, or maintains
an independent state model.

Operational Standings is documented separately in
`future-operational-standings.md`. Phase 5B does not implement standings,
scoring, Kill Teams, Discord, evidence, command-staff editing, map editing,
zoom, pan, dragging, or animated movement.

## Composition and identity

The rendering model is:

```text
controlled battlefield definition
  + authoritative ACTIVE mission battlefield identity
  = tactical Player presentation
```

Battlefield definitions are reusable configuration. They contain stable slugs,
display names, exact known authoritative UUID aliases, a controlled local asset
identifier, logical dimensions, and coordinate metadata. They do not contain a
campaign ID, mission ID, progress, objectives, enemies, Kill Teams, or other
live state.

The current public snapshot exposes `battlefieldId` and `battlefieldName`, but
does not expose the database battlefield slug or `asset_reference`. Phase 5B
therefore resolves only exact UUID aliases registered in source. It does not
derive a filename from the UUID or name, and it does not change the public RPC.
The seeded Termination UUID is mapped to an original development schematic.
Vox Liberatis, Reclamation, and Disruption retain their seeded UUID aliases but
deliberately report unavailable cartography until appropriate original assets
exist. Inferno is registered by stable slug for future configuration without
inventing an authoritative database UUID.

A future Admin/Moderator selector may enumerate the same registry before
mission activation, but no selector is built in this phase. During an ACTIVE
mission, Players see only the battlefield already locked by the database.

## Controlled asset resolution

The registry stores a controlled asset identifier, not a database-provided URL.
A second static asset registry maps that identifier to a Vite-bundled local
asset. Unknown UUIDs, absent asset identifiers, and failed image loads all
produce the same safe local fallback:

```text
TACTICAL CARTOGRAPHY UNAVAILABLE
Battlefield: [authoritative battlefield name]
```

The original development SVG contains no script, event handler, external
reference, embedded HTML, or proprietary map artwork. Rendering uses no dynamic
imports, `dangerouslySetInnerHTML`, iframe, object, embed, remote URL, or user
constructed path.

## Coordinate and aspect-ratio model

The tactical overlay uses normalized coordinates with a top-left origin:

- `x = 0` is the left edge and `x = 1` is the right edge;
- `y = 0` is the top edge and `y = 1` is the bottom edge;
- valid values include both endpoints;
- non-finite or out-of-range coordinates are rejected rather than clamped.

Overlay items convert normalized values to percentage `left` and `top`
positions inside the same ratio-owning stage as the image. The registered
logical width and height define CSS `aspect-ratio`; the asset and overlay are
both absolutely aligned to that stage. No viewport or device pixel coordinate
is stored as a tactical location. Resizing therefore preserves both map shape
and overlay alignment.

## Loading and failure containment

The aspect-ratio stage remains mounted throughout image loading so the page does
not collapse or jump. While decoding is pending, the map displays
`LOADING TACTICAL CARTOGRAPHY...` with a polite status and busy state. An image
load error hides the broken resource and replaces it with the unavailable
fallback.

A map-scoped React error boundary handles unexpected rendering errors from the
map or future overlay children. Its fallback is local to the tactical region;
the Crusade heading, mission, progress, objectives, threats, connection state,
and RESYNC control remain mounted and usable.

## Player dashboard and responsive layout

Only the confirmed ACTIVE-campaign branch renders a battlefield. Initial
loading, initial failure, and the confirmed `NO ACTIVE OPERATION` state never
invent a map or sample battlefield.

Desktop and laptop layouts place the battlefield beside a mission/progress rail
so the map remains substantial without consuming excessive vertical space. At
the existing tablet breakpoint the layout becomes a single column, with the
map and operational panels retaining their reading order. The map stage has a
maximum width of 100 percent, child grids use `min-width: 0`, long battlefield
labels wrap, and the page must not gain horizontal overflow. Phase 5B adds no
zoom, pan, hover-only information, or pointer-only interaction.

The tactical region has a visible heading and authoritative battlefield name in
loaded, loading, and fallback states. Graphical content is supplementary;
Mission Briefing continues to provide the textual locked-battlefield identity.

## Security and synchronization boundaries

Battlefield modules are presentation/configuration code. ESLint prevents them
from importing Supabase or the campaign synchronization coordinator. The
`PlayerDashboardPage` remains the single synchronization-hook owner, and the
map receives only the authoritative battlefield ID/name and optional overlay
children as props.

Phase 5B makes no database migration, RLS policy, grant, authentication,
revision, Realtime, mission-transition, or battlefield-locking change.

## Manual responsive verification

The completion check covers approximately 1920 by 1080, 1366 by 768, 768 pixels
wide, and 390 pixels wide. At each size verify no horizontal overflow, the
registered aspect ratio, normalized overlay alignment, readable text, clean
panel reflow, and visible connection/RESYNC controls. Loading and unavailable
cartography must preserve the same map footprint and leave operational content
intact.

## Phase boundary

Phase 5B ends with the reusable battlefield registry, one original development
schematic, tactical rendering/error states, normalized overlay primitives,
Player dashboard integration, and their tests. Phase 5C, Kill Team data and
markers, Operational Standings, Discord, evidence uploads, Player writes,
command-staff map selection, map editing, zoom, and pan remain deferred.
