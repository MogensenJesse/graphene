# Paid tier: accounts, sync and collaboration

Status: plan, nothing built yet. Written 2026-11-21.

Related plans: [01-audit-fixes.md](01-audit-fixes.md), [02-android-app.md](02-android-app.md).

Evidence markers used below: **[V]** verified against a current source on 2026-11-20 or 2026-11-21 (URLs at the end), **[M]** from
memory or my own estimate, **[C]** read in this repository.

## Summary in plain language

Graphene has two tiers.

- **Free:** no account. Notes and tasks work exactly as they do today, on the desktop and on the phone. Nothing goes to the cloud, so
  free users cost nothing to host.
- **Paid:** an account that syncs notes and tasks between a user's devices and lets people edit shared folders and task lists
  together.

The notes stay plain `.md` files on every device. The hosted side lives entirely on Neon (database, sign-in, file storage and a
little server code). A sync engine on each device compares its files with Neon, merges changes, and uploads what is new. It only
runs while the app is open.

## Decisions made

| Topic | Decision |
|---|---|
| Tiers | Free = local only, as today. Paid = account, sync, collaboration |
| Hosting | Everything hosted goes on Neon. Interpretation to confirm: Neon is the whole hosted backend, and devices still keep plain files locally, so the free tier, the MCP server and "no lock-in" stay as they are |
| Money | Start on Neon's free plan. No billing yet; during testing the paid tier is a flag on the user row that we set by hand. Payment provider and price are decided later |
| Encryption | Normal server-side encryption (encrypted at rest and in transit). End-to-end encryption not now; keep the stored format versioned so it can be added |
| Collaboration | Editing only. Two roles: **owner** (the creator: invites and removes people, stops sharing) and **editor**. No viewer role. No live co-editing |
| Conflicts | A delete wins over a concurrent edit, but deleted items go to a restorable trash (a shared trash for shared items) |
| AI assistants | May edit notes in shared folders (the MCP server edits local files like any local edit; they sync when the app is next open) |
| Sync timing | Only while the app is open, on desktop and Android |
| Region | EU if possible, no strict preference. Neon offers `aws-eu-central-1` (Frankfurt), `aws-eu-west-2` (London) and `azure-gwc` (Frankfurt) [V]. Default to `aws-eu-central-1`, because Neon Auth was reported as AWS-only [M] |
| Naming | Rename the vault flag `shared` to `assistantAccess` (keep reading the old key), so "shared" can mean collaboration. Today `shared` means "AI assistants may use this vault" [C] |
| iOS | Later, with the same app-private vault approach |

## Do we need a database?

Yes on the server, no for the notes themselves.

| Where | Needed? | What it holds |
|---|---|---|
| Source of truth on each device | No: keep files | A database as the truth would break plain `.md` files and the MCP server, which edits the vault with the app closed [C] |
| On each device | Only a small sync-state file | For each item: id, path, content hash, revision, the text as of the last sync, deleted-at. A local SQLite is only worth it if Android scans get slow |
| On the server (paid tier) | Yes: Postgres on Neon | Users, devices, workspaces and members, item metadata and revisions, a change log, invites, an audit trail |
| Attachments | Object storage on Neon | Images and other files, uploaded before the note that uses them |

## Architecture: all on Neon

What Neon's documentation confirms [V]:

- **Neon Auth** is managed Better Auth. It supports email one-time codes and OAuth providers. The built-in email sender is for
  development only; production needs your own email provider.
- The **Data API** is a REST layer over Postgres. It checks the sign-in token and exposes the user's id inside the database, so
  **row-level security (RLS) policies can decide who may read or write which rows**. Neon Auth sets the token's role claim for it.
- **Neon Functions** are serverless compute next to the database, with a public URL.
- **Neon Object Storage** supports presigned URLs. They are signed with a credential held on the server, so a function has to
  create them.

Design (to be proven by a short spike at the start of the paid-tier work [M]):

```
 Desktop (Tauri)          Android (Tauri)          MCP server (node, app may be closed)
 plain files + .tasks     app-private vault        reads and writes the vault files
        |                        |                          |
        +------ sync engine on the device (TypeScript, pure) -------+
                 3-way merge, sync-state file, runs while the app is open
                                 |
                  signed-in requests (Neon Auth token)
                                 |
        +------------------------+-------------------------+
        |                        |                         |
   Neon Auth             Data API + RLS             Neon Function
   (email code,          (Postgres: items,          (presigned URLs
    OAuth)                revisions, change log,     for attachments)
                          members, invites)                |
                                                    Neon Object Storage
```

- The merging happens on the device. The server stores revisions and enforces who may touch what.
- Reads and plain writes go through the Data API with RLS, so no custom API server is needed for them. The "push this change if the
  revision is still X" step is a Postgres function called over the Data API; confirm in the spike that the Data API supports calling
  it, and otherwise use one Neon Function.
- One small Neon Function creates presigned URLs for attachments after checking the token and membership. Fallback during testing:
  store attachments as rows in Postgres (limited by the free plan's 1 GB).
- The sync engine talks to the server through a small "remote" interface, so another remote (for example a plain S3 or WebDAV
  bucket) could be added later. It is not built now.

### What the free plan gives us, and its limits [V]

- Per project: **1 GB Postgres storage**, **100 CU-hours of compute per month**, **5 GB network transfer**; 20 GB of storage across all
  projects.
- Running out of CU-hours or transfer suspends compute until the next period. Going over 1 GB of storage blocks writes.
- Compute scales to zero when idle, so the first sync after a quiet period is slower [M].
- The paid Launch plan is pay-as-you-go: $0.106 per CU-hour and $0.35 per GB-month, with 500 GB of transfer included [V].
- Not verified yet: Neon Object Storage's free allowance and price, and Neon Auth's general-availability status. The first research
  pass read that Neon Auth includes 60k monthly users on the free plan and is available in AWS regions only; the docs did not state
  its status [V for the 60k figure, M for the rest].

For a handful of test users this is plenty. Plan to move to Launch before the first wider test, and re-estimate the hosted cost for
an all-Neon stack once the spike is done. The earlier estimate (about $35 to $70 a month at 1,000 users and $220 to $330 at 10,000)
assumed Cloudflare Workers and R2, so treat it as a rough upper bound only.

## Accounts

- **Who needs one:** only paid users. Free users never sign in and the app makes no network calls for them.
- **Sign-in:** an **email code** first (no browser redirect, so it behaves the same on desktop and phone), then "Sign in with
  Google or GitHub" later. OAuth on the desktop uses the system browser with a loopback redirect (`tauri-plugin-oauth`, which needs
  state and PKCE checks); loopback does not work on mobile, so the phone uses a deep link [V]. On Windows a deep link relaunches the
  app, so the single-instance plugin must carry the deep-link feature and stay the first plugin registered [V]. Avoid sign-in inside
  an embedded webview [M].
- **Keeping the user signed in:** the token goes in the operating system's secure store (Windows Credential Manager, Android
  Keystore), through a community plugin such as `tauri-plugin-keyring-store` (young and immature [V]) or the Rust `keyring` crate [M].
  Each device has its own session, and the user can see and revoke devices.
- **Tier:** a `tier` field (`free` or `paid`) on the user row, enforced by the RLS policies, set by hand while testing.
- **Leaving:** the user's notes are already plain files on their devices, so export is trivial. Deleting an account removes the
  server rows and blobs; local files are untouched. Define a backup retention period. Neon has EU regions, and a data-processing
  agreement is needed with each processor [M].
- **Encryption trade-off to remember:** with server-side encryption the server can merge, preview and notify. End-to-end encryption
  later would remove that, and would need per-member keys for sharing and a recovery story, so design the stored format with room for it.

## How sync works

Each device keeps a sync-state file in the vault (`.graphene/`) with, for every note, task list and folder: its id, last known path,
a content hash, the server revision it last saw, and the text as of the last sync (the "base"). When the app is open it syncs on
launch, on resume, and shortly after edits:

1. **Pull:** ask the server for everything that changed since this device's cursor.
2. For each remote change: if the local copy is unchanged since the base, apply the remote one. If both sides changed, **merge**
   (below).
3. **Push:** send local changes with "expected revision". If the server has a newer revision, pull, merge and retry.
4. Update the sync state. Deletions are recorded as tombstones (a deleted-at marker), never silently dropped.

Merge rules:

- **Note text:** line-level three-way merge against the base. Non-overlapping changes merge automatically. If the same lines
  changed on both sides, keep the local text and save the other version as a visible, linked conflict copy. Never write conflict
  markers into a note silently. A diff3 library such as `node-diff3` (MIT) provides the building block [V].
- **Note metadata (frontmatter):** merged field by field; title, folder and order use last-writer-wins.
- **Tasks:** merged per task and per field, so one person ticking a task while another edits its title keeps both. Steps merge by
  step id. Use a hybrid logical clock for ordering so a device with a wrong clock cannot win unfairly.
- **Delete versus edit:** the delete wins, and the item goes to the restorable trash. Deleting a folder tombstones each child
  individually, so a note someone else just added to it survives.
- **Order:** replace today's integer ranks (`placeNear` takes the middle or renumbers the list) with fractional-index string keys
  plus jitter (the `fractional-indexing` library is CC0 [V]), tie-broken by id, never renumbered.
- **Attachments:** immutable. Upload first, then the note that references them.

What the existing code already gives us [C]: `mergeItems` and `mergeFolders` (`src/lib/mergeScan.ts`) and the `writeState` guard
from the focus rescan keep working, and notes are always written through `itemFilePath`, so the app and the MCP server never
disagree on a file name.

## Prerequisite refactors (do these before the engine)

Items 1 and 2 are already scheduled in [01-audit-fixes.md](01-audit-fixes.md) (WP1) because they fix data-loss risks on their own.

1. **Atomic note writes:** write a dot temp file and rename, with one helper shared by the app and the MCP server. Today `saveItem`
   uses a plain `writeTextFile` [C].
2. **Rename order:** write the new file first and delete the old one after. Today `replaceItemFile` (`src/lib/storage.ts:193`) deletes
   first [C]. Also make the duplicate-id tiebreak deterministic (newest revision wins) instead of "last in scan order".
3. **Vault identity and sync state:** `.graphene/vault.json` holding a vault id, plus the sync-state file. Hash canonical text; do
   not trust `updatedAt`.
4. **Stable folder ids:** a folder manifest with id, name and rank. A folder's id is its path today [C], so renaming a folder
   re-identifies its whole subtree.
5. **Tombstones** instead of hard deletes (`deleteItemFile`, `emptyTrashFiles`, task `removeTask`), and rescan the trash too.
6. **Keep unknown frontmatter keys** on rewrite and add a schema version. `parseNoteFile` drops unknown keys today; tasks keep them
   (reported by the research pass, to be re-checked when the work starts).
7. **Task merge** per task id, steps by step id, field-level last-writer-wins on a hybrid logical clock, with tombstones.
8. **Fractional-index ranks** (above) for notes, folders, tasks, lists and groups.
9. **Image sweep** (`sweepUnusedImages`) made sync-aware: it must not delete an image that a not-yet-synced note on another device
   still uses; the server collects unused images after a grace period.
10. **Dirty editor:** the open editor keeps its base revision and three-way merges on save. Today its autosave silently overwrites
    outside changes.
11. **Reuse the focus rescan** and add the Android lifecycle triggers; the engine writes through `itemFilePath`.
12. **A `VaultFs` interface:** generalise `TaskFs` (already a small file layer shared by the app and the MCP server) so the app,
    Android, Node (MCP) and tests share one implementation.
13. **Rename `vaults[].shared`** to `assistantAccess`, still reading the old key.

The Rust `scan_vault` command from WP5 is the natural place to compute hashes and modified times for the sync manifest.

## Collaboration (editing only)

**What can be shared:** a folder of notes, or a task list.

**Roles:** owner and editor. The owner invites people by email, can remove an editor, and can stop sharing. Editors can create, edit,
move and delete items inside the shared folder or list. The owner may add a person only if that person has an account.

**What it looks like to the recipient:** a shared folder appears in their vault as a real folder, marked with a small share-id file,
and syncs on its own scope separate from their personal items. A shared task list appears in their Tasks tab.

**Server model (sketch):**

- `users` (with `tier`), `devices`.
- `shares` (the shared root: a folder or a task list; its owner), `members` (share, user, role: owner or editor), `invites`.
- `nodes` (id, kind, parent, name, rank, revision, content hash, blob key, deleted-at, updated-by), `changes` (sequence number, node,
  revision, operation, actor), `audit`.
- RLS policies: a row is visible and writable only to its owner or to members of the share it belongs to, and only while the
  owner's tier is `paid`. Access is checked on every request; the client is never trusted.

**Behaviour:**

- Merge and conflict rules are the ones above, so two people editing different parts of a note merge automatically.
- An "edited by Anna" activity feed comes from the change log. Notification by email or push is optional later.
- Version history: keep revisions server-side, and restoring one creates a new revision. Do not rely on Neon's point-in-time
  restore for this; it covers the database as a whole, not one note, and not stored files [M].
- The shared trash keeps deleted shared items so a delete can be undone by any member until the owner empties it [proposed].
- AI assistants: the MCP server edits the local files, which then sync like any other edit (label them "via AI" in the activity
  feed). Text written by other people is untrusted input to the assistant [M].

**Later, not now:** live co-editing needs a different editor (CodeMirror 6 or ProseMirror), a CRDT such as Yjs, and a real-time
server. It is a large piece of work (L to XL) [M].

## Roadmap

Sizes: S up to 1 week, M 2 to 4 weeks, L 1 to 3 months, XL more than 3 months (rough, for one developer) [M].

0. **Audit work packages first** ([01-audit-fixes.md](01-audit-fixes.md)), including the two data-safety fixes and the Rust
   `scan_vault`.
1. **Android app, local only** (L), see [02-android-app.md](02-android-app.md). Needs no account.
2. **Paid tier: backend, accounts and sync** (L):
   - Start with a short spike: Data API with RLS, the "push if revision is X" function, presigned URLs from a Neon Function, email-code
     sign-in from Tauri on desktop and Android.
   - Then prerequisites 3 to 13 above, the sync engine core in pure TypeScript with property-based tests, the Neon schema and RLS,
     sign-in (email code, then OAuth), the device list, the `tier` flag, and export and delete account.
   - Desktop and Android both sync while the app is open.
3. **Collaboration** (L): shares, invites, owner and editor roles, mounted shared folders and task lists, the activity feed, version
   history and restore, the shared trash.

Not now: Play Store, automatic Android updates, background sync, live co-editing, a viewer role, end-to-end encryption, payments,
bring-your-own-storage sync.

## Risks

- **Merge correctness** is the heart of the work. Build the engine as pure functions and test it with random edit sequences.
- **Free-plan ceilings** (1 GB, 100 CU-hours) and scale-to-zero latency during testing; plan the move to Launch.
- **Unverified Neon pieces:** Object Storage limits and price, Neon Auth's status, and whether the Data API can call the atomic push
  function. The spike answers these before committing.
- **Sign-in on Android and Windows** involves deep links and secure storage plugins that are young; keep email-code sign-in as the
  fallback.
- **Clock skew** between devices; handled by the logical clock.
- **No background sync** means a phone only catches up when opened.
- **Server-side encryption** means the host can technically read notes; say so plainly in the product copy.

## Open questions

Remaining:

1. **Payments:** which provider and what price? (Deferred; the flag is set by hand meanwhile.)
2. **Neon free plan:** how many test users does it carry, and when do we move to Launch?
3. **Unverified Neon facts:** Object Storage free limits and price; Neon Auth general availability.
4. **Data API:** can it call the atomic "push with expected revision" function? (The spike answers this.)
5. **All-Neon reading:** confirm that Neon is the hosted backend while devices keep plain local files. If paid users should drop
   local files entirely, the MCP server and the free-tier path must be re-planned.
6. **Removing people:** proposed that only the owner can remove an editor or stop sharing.
7. **Lapsed paid tier:** proposed that members keep access for 30 days, then the shared folder becomes a local copy for each member.

Settled by the product owner (see the decision table): encryption level, free-plan start, delete-wins, no viewer role, Android 12 and
sideloading, foreground-only sync, EU region if possible, assistants may edit shared notes, the `assistantAccess` rename, and iOS later.

## Sources

Verified on 2026-11-21 (Neon):

- https://neon.com/faqs/free-plan-limits-and-quotas
- https://neon.com/pricing
- https://neon.com/docs/guides/row-level-security
- https://neon.com/docs/data-api/access-control
- https://neon.com/docs/auth/guides/plugins/email-otp
- https://neon.com/docs/auth/production-checklist
- https://neon.com/docs/compute/functions/deploy
- https://neon.com/docs/storage/objects
- https://neon.com/docs/get-started/backend-overview
- Region list from the Neon API (`list_regions`).

Verified on 2026-11-20 (research pass):

- https://v2.tauri.app/plugin/deep-linking/
- https://docs.rs/crate/tauri-plugin-oauth/2.0.0/source/README.md
- https://docs.rs/crate/tauri-plugin-keyring-store/latest/source/README.md
- https://github.com/bhousel/node-diff3
- https://github.com/rocicorp/fractional-indexing
- https://neon.com/docs/auth/about
