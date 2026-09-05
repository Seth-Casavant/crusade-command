# Space Marine 2 Crusade Command

Development foundation for a responsive Crusade event web application. Phase 2
provides the migration-driven authoritative database. Phase 3 adds Supabase
Auth identities, protected application roles, deny-by-default RLS, secured
mutation RPCs, and a narrow public ACTIVE-mission read model. Phase 4 adds a
minimal public Realtime notification channel, complete authoritative client
refreshes, revision verification, and offline/reconnect recovery. Finished
campaign-management screens, Discord integration, and map graphics remain
intentionally unimplemented.

Phase 4.5 adds durable repository scope/rules and makes Supabase email OTP the
primary command-staff authentication path. Public viewing remains sign-in free.

## Prerequisites

- Node.js 22.22.2 or newer (Node.js 24 LTS is recommended)
- pnpm 11.19.0 (Corepack can install the pinned version from `package.json`)
- Git
- Docker Desktop or another Docker-compatible container runtime for local
  Supabase database work

## Local setup

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Supabase values remain optional for the landing screen. Without browser-safe
local values, the application explicitly remains in public read-only mode and
disables command staff sign-in.

Open `http://localhost:5173` after the Vite server starts.

With the local Supabase stack running, command-staff OTP messages appear in the
local Mailpit/Inbucket viewer at `http://127.0.0.1:54324`. Local and hosted
email templates must use the Supabase OTP token rather than require a
magic-link redirect.

## Quality checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Local database checks

The Supabase CLI is installed as a project dependency. With Docker running:

```powershell
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:test
pnpm db:types
pnpm test:auth:local
```

`test:auth:local` discovers the browser-safe local Supabase values, reads OTPs
from the local mail viewer without printing them, verifies Administrator and
Moderator database role resolution, and confirms the anonymous read/no-write
boundary.

Use `pnpm db:stop` when local database work is complete. Database architecture
and security decisions are documented in `docs/phase-2-database.md` and
`docs/phase-3-auth-authorization.md`. Phase 4 synchronization and its local
multi-client verification procedure are documented in
`docs/phase-4-synchronization.md`. The later Kill Team feature specification is
preserved in `docs/future-kill-team-tactical-layer.md`; it is not implemented
in Phase 4. The approved future Discord registration/evidence workflow and
player guide are preserved in `docs/discord-kill-team-workflow.md` and
`docs/KILL_TEAM_QUICK_GUIDE.md`.

`PROJECT_SCOPE.md` is the durable product authority, and `AGENTS.md` contains
the development rules that apply to future repository work.

## Source boundaries

```text
src/
├── components/       Reusable UI components
├── config/           Browser-safe configuration parsing
├── data/services/    Centralized external data access
├── pages/            Page-level views
├── shared/types/     Shared TypeScript domain types
├── state/            Shared and local state management
├── styles/           Global styles and design tokens
├── test/             Test environment setup
└── validation/       Runtime input and response validation

supabase/migrations/  Versioned authoritative PostgreSQL schema and functions
```
