# Repository development rules

- Read `PROJECT_SCOPE.md` and the relevant `docs/` specifications before
  implementation.
- Implement only the requested phase or subphase. Never begin a later phase
  automatically.
- Do not invent unapproved product features. Report assumptions instead of
  silently changing architecture.
- PostgreSQL/Supabase is authoritative. Realtime events and client state are
  notifications or representations, never independent authority.
- Never weaken RLS, grants, database constraints, validation, or audit
  protections for convenience.
- Preserve monotonic revisions, optimistic concurrency, and atomic updates.
- Preserve ACTIVE battlefield locking and the one-ACTIVE-mission-per-campaign
  rule.
- Keep public, authenticated, administrative, Discord, and evidence data
  boundaries explicit.
- Never expose service-role credentials, database passwords, OAuth secrets,
  session tokens, or OTPs in source, browser configuration, logs, or Git.
- Apply schema changes only through versioned migrations; never bypass migration
  history with undocumented manual database changes.
- Prefer simple, testable implementations and the existing project stack.
- Preserve existing tests and run relevant regression, typecheck, lint, build,
  and database checks before completion.
- Treat security and data-integrity defects as higher severity than cosmetic
  defects.
