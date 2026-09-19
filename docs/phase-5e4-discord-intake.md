# Phase 5E.4 Discord screenshot intake

Phase 5E.4 adds a single Supabase Edge Function for the
`/crusade-submit` interaction. Discord is an authenticated transport; Supabase
remains authoritative for the active campaign, Kill Team membership, scoring
targets, submission validation, receipts, and idempotency.

## Request path and security boundary

```text
Discord HTTPS interaction
  -> Ed25519 signature verification over timestamp + raw body
  -> command routing and interaction-token validation
  -> deferred ephemeral acknowledgement (response type 5)
  -> EdgeRuntime.waitUntil background intake
  -> narrow command/attachment parsing
  -> immutable Discord user ID membership lookup
  -> active public campaign/target lookup
  -> server-side attachment download and private Storage upload
  -> existing create_crusade_submission service-role RPC
  -> edit original interaction response with the final player result
  -> idempotent staff-channel notification
```

`supabase/config.toml` deliberately disables Supabase JWT verification only for
`discord-interactions`: Discord cannot send a Supabase JWT, so the function
authenticates every request with Discord's Ed25519 signature before parsing or
performing intake. Missing or invalid signatures receive HTTP 401. Privileged
Supabase and Discord credentials exist only in the Edge Function environment;
the React application neither imports nor receives them.

The service resolves the signed Discord member ID against authoritative
`kill_team_members` data for the current ACTIVE mission. Nicknames, usernames,
Discord roles, command text, and browser state never select a Kill Team. The
service then calls the existing `create_crusade_submission` RPC. It never
inserts directly into `crusade_submissions`, approves a submission, writes the
progress ledger, or increments the campaign revision.

Accepted evidence is copied into the private `crusade-evidence` Storage bucket
before the submission RPC runs. Objects use the deterministic path
`campaign/<campaign-id>/mission/<mission-id>/interaction/<interaction-id>/screenshot`;
the Discord filename is retained only as submission metadata and never controls
the object key. The Edge Function streams the download with the configured byte
limit, checks the downloaded length and any supplied response MIME type against
the validated attachment metadata, and uploads with overwrite disabled.

The Discord interaction ID becomes `discord-interaction:<id>`, the existing
RPC idempotency key. Exact retries return the existing receipt. The staff
message uses the same interaction ID as a Discord message nonce with
`enforce_nonce`, preventing a successful retry from duplicating the channel
notification during Discord's nonce window.

The deterministic object path makes Storage retries idempotent as well. An
existing object at that path is accepted as the prior attempt; it is never
overwritten. If the submission RPC fails after upload, the object is retained
because the RPC result can be commit-ambiguous and deleting it could remove the
evidence referenced by a committed idempotent retry. The stable path makes that
retained object safe and reusable without creating duplicate objects.

## Command behavior

`discord/crusade-submit-command.json` defines three focused subcommands:

- `/crusade-submit objective` requires one screenshot;
- `/crusade-submit terminus` requires one screenshot and target;
- `/crusade-submit mission-completion` requires one screenshot.

The subcommands map internally to `OBJECTIVE`, `TERMINUS_KILL`, and
`MISSION_COMPLETION`; players do not choose a separate Type field. No Note
field is exposed. The service accepts only PNG, JPEG, or WebP attachments,
requires a positive size no greater than `DISCORD_MAX_ATTACHMENT_BYTES`, and
requires an HTTPS Discord source URL.
The private submission row stores the durable object path together with the
original filename, MIME type, Discord source reference, and size.

The Storage bucket is not public and has no anonymous or browser-write policy.
The service-role Edge Function performs uploads. Authenticated Administrators
and Moderators may read evidence under the existing database-authoritative role
mapping; the staff queue batches five-minute signed URLs for review. Legacy
rows without a Storage path may still use their validated HTTP source reference
as a migration fallback. Players and anonymous users cannot create signed URLs
or read objects directly.

For `terminus`, `target` is a configured scoring-target key from the ACTIVE
mission. The other subcommands reject a target. Discord
cannot populate ordinary slash-command choices dynamically at invocation time,
so the MVP uses a short target-key text option and validates it against the
authoritative snapshot. This avoids duplicating scoring-target configuration in
Discord. Autocomplete can be added later without changing the database model.

Valid commands receive Discord's deferred channel-message response with the
ephemeral flag before authoritative intake begins. The background task then
edits that original response through Discord's interaction webhook; it does
not send a second player message. Successful final responses contain the
authoritative receipt, resolved Kill Team, friendly event label, applicable
target name, and `PENDING REVIEW`. Failed intake replaces the deferred loading
state with a sanitized error and does not notify staff. Staff notification runs
only after the successful player response is finalized, so a notification
failure cannot turn a committed submission into a player-visible failure. A
created submission posts to the configured channel, mentions only the
configured staff role, and contains a `VIEW SUBMISSION` button linking to
`/admin/submissions?receipt=<receipt>`. The review page safely accepts only
receipt references shaped like `CR-` followed by at least five digits.

## Environment configuration

Copy `.env.discord.example` to the Git-ignored `.env.discord.local` for command
registration:

```dotenv
DISCORD_APPLICATION_ID=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
```

Copy `supabase/functions/.env.example` to the Git-ignored
`supabase/functions/.env.local` for local function execution. Configure:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID` (optional runtime restriction; recommended for local use)
- `DISCORD_STAFF_CHANNEL_ID`
- `DISCORD_STAFF_ROLE_ID`
- `PUBLIC_APP_URL`
- `DISCORD_MAX_ATTACHMENT_BYTES` (optional; defaults to 10 MiB)

Supabase supplies `SUPABASE_URL` and the service-role/secret key to the deployed
function. Do not copy either privileged key into Vite variables or frontend
source. Production secrets must be provisioned explicitly with the Supabase
project's server-side secret-management workflow.

The bot needs permission to view and send messages in the configured staff
channel. The configured role must be mentionable by the bot (or covered by the
bot's role-mention permission). The notification request constrains
`allowed_mentions` to that one role.

## Local workflow

1. Start the local Supabase stack with `pnpm db:start`.
2. Serve the function with:

   ```text
   pnpm supabase functions serve discord-interactions --no-verify-jwt --env-file supabase/functions/.env.local
   ```

3. Expose the local function through a public HTTPS tunnel supplied outside the
   application, then set the Discord application's Interactions Endpoint URL to
   the tunnel URL ending in `/functions/v1/discord-interactions`.
4. Register the development command with `pnpm discord:register:guild`.

Signature verification remains enabled locally. No tunneling package is added
to the application. Discord's endpoint validation PING is answered with PONG
only after its signature has been verified.

Guild-scoped registration is intentionally separate from global production
registration:

```text
pnpm discord:register:guild
pnpm discord:register:global
```

Neither command runs during application or function startup. Global commands
should be registered only after the production endpoint and server-side secrets
are configured.

## Focused validation

Use `pnpm test:discord` for request-signature, interaction, input, identity,
target, idempotency, player-response, staff-notification, command-schema, and
registration coverage. The existing Phase 5E submission-intake pgTAP suite
remains the authoritative database-contract coverage.
