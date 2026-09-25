# Crusade Command Friday readiness

## Verified from the uploaded project

- Frontend build, typecheck, lint, and 334 frontend/Edge tests pass in the
  reviewed copy. The user's local database suite passed 427 tests before this
  update. Docker was unavailable in the review environment, so database tests
  were not rerun after this update; this update makes no schema changes.
- Discord `/crusade-team register`, `add`, and `remove` have command handlers
  and database RPCs. The Discord intake creates pending submissions from
  registered active-mission members. Staff can approve or reject through the
  `/admin/submissions` screen; approved point deltas enter the ledger.
- The approved, revision-checked `assign_kill_team_checkpoint` RPC exists.
  The staff-only `Assign Checkpoint` control now calls it and refreshes the
  authoritative campaign snapshot. A team without a visible marker can be
  selected from the control's list. Public users cannot use it; disconnected
  staff cannot write. Positions are checkpoint IDs, not dragged pixels.
- The four battlefield IDs in `supabase/production/nexovar-bootstrap.sql` now
  map to the bundled frontend assets.
- The local sandbox seed now contains only four synthetic members. Real names
  and Discord IDs previously inserted into `supabase/seed.sql` were removed.

## Apply this update on the Windows project

Extract the Friday update ZIP into the existing `crusade-command` folder,
preserving relative paths and replacing the matching source files. Check for
newer edits in the local project before replacing any file. Then run:

```powershell
pnpm build
pnpm test
pnpm db:test
```

To remove the previously seeded real members from the **local** running
database, run `pnpm db:reset` after installing the changed `supabase/seed.sql`.
This recreates the entire local database and deletes **all local data**, not
just the former sandbox roster. It does not change hosted production. The
four synthetic sandbox members remain so local test flows can be exercised.

## Must verify before Friday

1. Confirm which Supabase project and app URL Discord is currently using.
   Local green tests do not establish hosted deployment health.
2. Confirm the Nexovar campaign, objectives, enemy entries, scoring targets,
   and checkpoint positions in the actual hosted database. The checked-in
   `supabase/production/nexovar-bootstrap.sql` creates only the campaign,
   four battlefields, and four DRAFT missions. Mission activation requires at
   least one objective and one enemy entry. Map markers require configured
   checkpoints and a staff assignment per team/mission.
3. With a designated test team while registration is open, run `/crusade-team
   register`, `add`, and `remove`; confirm that all linked mission teams mirror
   its roster. Avoid changing actual event rosters during this check.
4. Run one Discord screenshot submission through the deployed Edge Function,
   verify durable evidence opens in staff review, approve it, and verify the
   right team's public total changes. Reject a separate test submission.
5. Confirm Administrator and Moderator OTP login, access limits, review,
   checkpoint assignment, and rejection of public writes in the hosted app.

## Gaps found in source

- There is no all-team ranked standings panel. The selected-team panel shows
  points and progress, while the public dashboard shows aggregate points.
- The screenshot evidence path uses interaction and object-path idempotency;
  the reviewed source does not compute or persist a SHA-256 image-content hash.
  Identical images submitted as separate Discord interactions are therefore
  not flagged by content hash yet.
- The checked-in production bootstrap does not configure real mission
  checkpoints or the event's final scoring amounts. Those values should be
  approved before any live scoring or team movement is used.
