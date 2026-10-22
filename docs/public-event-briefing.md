# Published event briefing

Requested October 22: display The Midnight Hunt description and targets before
the mission starts, while retaining the registration window. This deliberately
extends the original ACTIVE-only public presentation with announcement copy.

`public.event_briefing` is a singleton publication record. It contains only
public copy, with no campaign or mission foreign keys, internal preparation,
participants, evidence, or scores. RLS hides unpublished copy from both anon
and authenticated clients. Neither role can write. No existing grants, RLS,
lifecycle transitions, synchronization contracts, or scoring logic change.

The welcome page and the dashboard's no-active-mission view read the published
briefing on mount. Retrieval failure has an explicit retry action. This is an
announcement, not realtime mission state. The established synchronization
coordinator continues to own all live campaign state.

Apply migration `20261022140000_public_event_briefing.sql`, then run
`supabase/snippets/publish-midnight-hunt-briefing.sql` to publish the approved
targets and both eligible modes. This does not activate the event or switch
the Discord registration campaign. Individual standings/credit automation are
not implemented by this change. No map is rendered in the briefing; active
event map suppression remains separate work.

To withdraw the announcement, set `published = false` as the database owner.
To roll back the presentation, revert the frontend commit. The new table can
remain unpublished without changing the existing application.

Verification: build and lint pass. New presentation and retry tests pass.
The complete suite has six existing PlayerDashboard failures, reproduced
against checkpoint `1d3fd58`: outdated Friendly Forces, Sandbox labels, and
map loading expectations. No new test failure was introduced.
