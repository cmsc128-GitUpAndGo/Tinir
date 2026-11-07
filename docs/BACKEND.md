# Tinir backend development

Tinir uses the existing Expo client with Supabase Auth, PostgreSQL RPCs, Storage, and an image-processing Edge Function. This guide sets up an independent **local** stack; it does not provision a Supabase cloud project. Architecture and requirement mapping are in [TRD](TRD.md) and [REQUIREMENTS](REQUIREMENTS.md).

Related work: [schema #5](https://github.com/cmsc128-GitUpAndGo/Tinir/issues/5), [architecture #6](https://github.com/cmsc128-GitUpAndGo/Tinir/issues/6), [setup #7](https://github.com/cmsc128-GitUpAndGo/Tinir/issues/7). Backend operations support the story issues; feature screens still need their own implementation/review.

## Start locally

Install Docker with a running daemon and Node/npm as specified in the main README. Run from the repository root:

```bash
npm ci
npm run backend:start
npm run backend:env
npm run backend:types
npm start
```

`backend:start` prepares WASM and bundles pinned Edge dependencies, then starts the minimal Supabase stack. On enforcing SELinux systems the helper labels `supabase/functions` as `container_file_t` so the Edge Runtime can read the bind mount. To restore the default label after stopping, run `restorecon -R supabase/functions`.

The first start downloads Docker images and applies migrations/seeds. Subsequent starts preserve the local data volume. `backend:env` creates ignored `.env.local` containing only the API URL and publishable/legacy anon key; it refuses to overwrite an existing file unless explicitly called with `--force`. Never put a secret/service-role key or database password in an `EXPO_PUBLIC_` variable.

| Local service | Address |
|---|---|
| API / Auth / Storage / Functions | `http://127.0.0.1:54621` |
| PostgreSQL | `127.0.0.1:54622` |
| Captured verification email | `http://127.0.0.1:54624` |
| Optional Studio | Port 54623 (disabled in the minimal configuration) |

Android emulator clients use `10.0.2.2` instead of `127.0.0.1`; physical phones use the development computer’s reachable LAN address. Update only the public URL in `.env.local` and restart Expo. Auth’s external URL and allowed redirects must also be reachable for verification on that device. Local Docker ports can be exposed to your LAN: use trusted development networks and never treat the local stack as production.

If a VPN blocks Docker’s subnet, the CLI may time out even though `docker exec supabase_db_tinir pg_isready` succeeds. Permit the specific local development network in your VPN configuration; this project does not persistently change firewall/VPN settings.

To stop Tinir while preserving its data:

```bash
npm run backend:stop
```

### Rebuild and tests

`backend:reset` **recreates Tinir’s local database**. Use it only when local data can be replaced. It never targets the other projects or a linked cloud database.

```bash
npm run backend:reset
npm run backend:types
npm run test:db
npm test
npm run test:backend
npm run lint
npm run typecheck
```

Integration tests refuse a target outside the Tinir local API port and create/remove their own synthetic users, listings, and reference points. Do not run them against a shared/production project. They exercise real RPC/Auth/Storage/media endpoints, not frontend screens. No real campus coordinates or semester dates are seeded.

`npm run backend:functions` prepares the assets and serves the media function separately with hot reload. The usual `backend:start` already starts Edge Runtime. If changing import maps or the WASM dependency while it is running, restart Tinir’s Edge Runtime or restart the local stack.

### Coexisting with the other local projects

The optional helpers can pause explicitly selected Supabase projects and restore only containers they recorded:

```bash
npm run backend:pause-other -- <other-project-id> [another-project-id]
# Start Tinir and run checks.
npm run backend:stop
npm run backend:restore-other
```

Pass the project IDs from their Supabase config files. The helper rejects Tinir itself and records only running containers matching the selected IDs. It preserves volumes and restores only the recorded set. A pending pause record prevents accidental overwriting. Normal startup never stops unrelated services automatically.

## Use the backend from Expo

- `src/services/auth.ts`: register/login/logout/resend/PKCE code exchange. Registration returns a generic check-email message, including for an already-registered address or a repeat signup throttled by Auth's one-email-per-minute limit; confirmation is required for login and protected actions. Client validation (`src/services/registration.ts`) mirrors the server profile rules, which still reject signups that bypass the form.
- `src/services/backend.ts`: typed listings, inquiries, bookmarks, reminders, current profile, campus reference and distance operations.
- `src/services/media.ts`: processed upload, short-lived photo URL, and removal. Native upload accepts `{uri, name, type}`; web accepts a Blob.
- `useSession()` exposes loading/current session through the root provider. This does not replace server authorization or implement the role screens.

Amounts are integer **PHP centavos**. Discovery filters use the same units. Hidden amounts are absent from non-owner data; show “Contact owner for price” when `price_visible` is false. Backend errors expose `.error.code`, `.error.message`, and optional `.error.fields`; do not display raw provider/SQL errors.

Owner flow: create internal draft → upload at least one photo → publish → edit/availability/archive. Uploads accept JPEG/PNG/WebP at most 5 MiB and 8 million pixels, re-encode to metadata-free WebP, and enforce ten slots. Deleted/expired photo metadata queues object keys durably. Uploads retry up to 50 queued removals for that listing, acknowledging them only after Storage succeeds. With no later upload, an operator must process `app_private.photo_cleanup` through the server-only `tinir_media` cleanup/cleanup_done operations; keys remain private and retryable. Signed photo URLs expire after 60 seconds and must be refreshed; cached URLs may work until that expiry after archiving.

Verification callback: native `tinir://auth/callback`, web `/auth/callback`. PKCE confirmation must finish in the browser/device that initiated signup. On web it can open a new tab: only the temporary PKCE verifier is shared through localStorage; session tokens remain in per-tab sessionStorage. Test emails are captured locally; successful local verification does not prove hosted SMTP or handset delivery.

## Configure campus and semester reference data

These are operator-controlled reference tables, not client-writable APIs. After confirming the real reference point/dates with the team, insert them through a reviewed SQL migration. Do not copy synthetic integration-test coordinates into production.

- `app_private.campuses`: UUID, name, latitude, longitude. Discovery services can list configured campuses; `listings.distance(listingId, campusId)` returns a labeled straight-line result or an unavailable reason.
- `app_private.semesters`: ID, `starts_at`, `ends_at`, with end after start. The hourly `tinir-semester-reminders` job creates one dashboard reminder per published listing/active semester when the owner has not reconfirmed. No configured semester means no reminders.

Owner reconfirmation updates `last_confirmed_at` and dismisses reminders; ordinary price edits do not count as explicit reconfirmation. There is no automatic expiry or reservation guarantee.

## Backup and recovery

```bash
npm run backend:backup
npm run backend:restore-check
```

Dumps include application and Supabase Auth schemas and data, compressed under `~/.local/share/tinir/backups` with directory mode 0700/file mode 0600. They contain sensitive account data: protect the folder, never commit or upload dumps, and agree a retention policy. Image object bytes are **not included**; hosted media needs a separate recovery plan.

The restore check loads the latest backup into a separate temporary database, verifies representative table counts, and drops only that temporary database. It never restores over the app database. Keep local passwords out of command history and use the helper rather than embedding credentials in commands.

Example daily user-service/timer units are in `scripts/backend/systemd/`. Set their absolute repository/Node paths, install them under `~/.config/systemd/user/`, then enable the timer with `systemctl --user enable --now tinir-backup.timer`. They are **not installed automatically**. The local stack must be running for a dump to succeed; inspect timer failures rather than claiming daily backups merely because a unit file exists.

## Link a hosted project later

No remote push is part of local setup. Before deployment, choose the project/region/plan, inspect any existing remote schema, configure SMTP/redirect allowlists/HTTPS, and confirm backup/storage/scheduler capacity.

When authorized for that specific project:

```bash
npx supabase login
npx supabase link --project-ref <confirmed-project-reference>
npx supabase db push --dry-run
# Review the migration plan before applying to that project.
node scripts/backend/media-assets.mjs
# Deploy the reviewed migrations and media function only after the target is confirmed.
```

Keep privileged configuration in Supabase/server secrets, regenerate types from reviewed migrations, and test production disclosure/auth policies independently. Do not infer hosted uptime, daily backups, email delivery, browser support, native behavior, or the 3-second mobile target from passing local backend tests.
