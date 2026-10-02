# Local development and build

Use Node.js 22.12 or newer (the existing local runner uses 24.6.0) and npm.
The Supabase SDK requires Node.js 22 or newer. Direct dependencies are pinned
exactly in package.json; commit the npm-generated lockfile alongside it.

For the initial toolchain handoff, run `npm install` to update the lockfile.
Afterward, use `npm ci` for a reproducible install. Verify with:

```sh
npm run build
npm run lint
npm run typecheck
npm test
```

`npm run dev` serves the app at http://127.0.0.1:5173.
`npm run preview` serves the built dist directory at http://127.0.0.1:4173.
Both fail if their port is already occupied. Preview is a local verification
server; production hosting is a separate work package.

## Incremental migration

index.html and app.js/auth.js/storage.js retain their classic script load order
and browser globals. Vite serves them directly in development. A build-only
plugin copies those three scripts byte for byte into dist; Vite processes the
HTML and CSS. Warnings that classic script tags cannot be bundled are expected.
Do not add `type="module"` to those tags until their globals and imports have
been migrated together. New TypeScript modules belong in src/ and use Vite's
module pipeline when wired into the HTML. TypeScript is strict for new modules;
allowJs/checkJs=false permits the legacy scripts without enforcing types on them.

ESLint covers src JavaScript/TypeScript and the existing Node tests. Legacy root
scripts are excluded. Prettier is available through `npm run format` and
`npm run format:check`, scoped to src/ and tests/. The formatting baseline has
been applied; format:check is required in CI after lint.
The test runner remains `node --test`.

## Continuous integration and the main branch gate

`.github/workflows/ci.yml` runs on pull requests and pushes to main. Its
`Quality checks` job uses Node.js 22 LTS, caches npm downloads by package-lock.json,
and runs these commands in order:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
```

`npm test` includes `tests/no-secrets.test.mjs`, which scans tracked source files
without printing credential values. This is a current-tree guard, not a history
scan. No Supabase credentials or other repository secrets are required for these
checks. Actions are pinned to full commit hashes, with version comments; the
workflow token has only contents:read and checkout does not persist it.

The separate `Browser smoke` job installs Chromium and its operating system
dependencies, builds the static app, then runs `npm run test:e2e`. It is enabled
for the same pull requests and main pushes as the quality job. Playwright
1.63.0 is pinned exactly, verified against the
[published package metadata](https://registry.npmjs.org/@playwright/test/latest).
The signed-out smoke runs on desktop Chromium and a 390×844 mobile Chromium
viewport against `vite preview` of dist. This tests sign-in UI visibility,
default demo visibility, removed destructive handlers, uncaught/console errors
and keyboard navigation between the sign-in fields.

Each fresh browser context injects the real pinned Supabase UMD bundle from
node_modules before the classic auth script loads. All HTTP requests outside
the exact local preview origin are aborted; service workers and WebSockets are
blocked too. The CDN script and Google font requests are expected blocked loads,
with an explicit narrow console-error allowlist. Other external attempts and
page exceptions fail the smoke. No login, credentials, auth submission or
production database access occurs. This does not test real authentication,
account isolation, saving, or live service availability.

After dependency installation, run locally:

```sh
npx --no-install playwright install chromium
npm run build
npm run test:e2e
```

On Linux CI, install the operating system dependencies too with
`npx --no-install playwright install --with-deps chromium`. The test config starts
and stops the preview itself; port 4173 must be free, and an existing server is
not reused. Build first so the preview tests the current artifact. Failure traces
and screenshots are written under ignored test-results/. `npm test` continues to
run the Node suite separately. Browser installation and successful actual smoke
execution must be observed before claiming browser verification.

**Founder repository-settings action:** after an authorized push and the first
real GitHub Actions run, open repository **Settings → Branches → Add branch
protection rule**, set the branch pattern to `main`, and enable:

1. Require a pull request before merging.
2. Require status checks to pass before merging; select the `Quality checks`
   check from this workflow, with GitHub Actions as its expected source. Use the
   exact check name shown by the first run if the interface adds context.
3. Require branches to be up to date before merging.
4. Do not allow bypassing the above settings, including administrator bypass.

Save the rule and verify a pull request with a failed required check cannot
merge. After the first observed `Browser smoke` run, add that actual check to the
required checks too. The workflow file alone does not enforce merge protection;
that repository setting and an observed remote run are still required. Michael
owns remote pushes and integration; no push or settings change is authorized by
adding this file. See GitHub's
[branch protection instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

For local command validation use Node.js 22.12 or newer and run the six commands
above. To parse the workflow locally without installing another dependency:

```sh
ruby -e 'require "yaml"; YAML.safe_load(File.read(".github/workflows/ci.yml")); puts "YAML parses"'
git diff --check
```

YAML parsing and local commands do not simulate a GitHub-hosted workflow run.

## Public environment configuration

Copy .env.example to .env.local when preparing the later Supabase module migration.
Only these public client settings should use the VITE_ prefix:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Vite exposes VITE_-prefixed values to module code through import.meta.env, so
never prefix a service-role key, database password or other private credential
with VITE_. The config does not load or inject process.env wholesale. .env.local
is ignored; .env.example contains blank values and is safe to commit.
The current auth.js URL/publishable key remain unchanged and still control the
running app. These new environment values do not override them yet. The later
repository/session migration must validate the public values at startup and
replace the legacy hardcoded configuration. Account isolation requires database
row-level security regardless of where the publishable key is configured.

## Build verification and rollback

After building, confirm dist/index.html preserves the SDK/auth/storage/app
script order, and compare dist/auth.js, dist/storage.js and dist/app.js with
their root sources. Check that both dev and preview return HTML plus all three
script URLs. Full authenticated browser smoke testing still requires the
authorized account and service environment; the external SDK and Google fonts
also require network access.

No data or schema change is part of this toolchain. To roll back a future
authorized deployment, restore the previous complete static artifact, including
its HTML and scripts. For local source rollback, Michael owns reverting the
toolchain commit and restoring its matching lockfile.

## Version verification

Exact versions were confirmed against upstream releases before the handoff:

- [Vite 8.3.2](https://github.com/vitejs/vite/releases/tag/v8.3.2)
- [TypeScript 5.9.3](https://github.com/microsoft/TypeScript/releases/tag/v5.9.3)
- [ESLint 9.36.0](https://github.com/eslint/eslint/releases/tag/v9.36.0)
- [typescript-eslint 8.44.1](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.44.1)
- [globals 16.4.0](https://github.com/sindresorhus/globals/releases/tag/v16.4.0)
- [Prettier 3.6.2](https://github.com/prettier/prettier/releases/tag/3.6.2)

TypeScript 5.9 and ESLint 9 are retained together with the compatible
typescript-eslint 8.44 parser rather than introducing a compiler/linter major
migration alongside the static-app build.

## Pure domain modules and the classic app bridge (WP1.2)

The source of truth for domain logic is `src/domain/`:

- `dates.ts`: `localDateKey(date, timeZone)`, `calendarDate(key, timeZone)`, and
  `dateKeyOffset(date, days, timeZone)`. Inputs use `Date` instants, calendar keys,
  and an explicit IANA timezone. No function reads the current clock or device
  timezone. Internal UTC arithmetic represents calendar components; it does not
  change the app's device-local date policy.
- `scoring.ts`: tier weights, `scoreForAnswer(question, strengthIndex)`, and
  `runEngine(questions, answers, previousVelocity, positiveStreak, negativeStreak)`.
- `history.ts`: `recomputeAll(questions, rows)` and its typed entry/result contract.
- `validation.ts`: question text/option limits, `checkBalance(questions)`, and
  `parseDraft(rawJSON, userId, date)`. Draft parsing checks size, version, owner,
  date and numeric choices; storage access and UI errors remain in the app.

All four modules have explicit inputs and no DOM, network, storage or account
state. Scoring intentionally retains all characterized behavior, including the
known bugs in `tests/engine.characterization.test.mjs`. This extraction does not
choose Engine A/B or change saved scores, answer coercion, historical re-tiering,
completion counts, streak gaps, shadow drag or rounding.

The legacy page remains a classic script. `src/domain/build-legacy.mjs` uses the
existing pinned TypeScript compiler to transpile the four modules to an embedded,
self-contained bundle between `BEGIN GENERATED DOMAIN BUNDLE` and
`END GENERATED DOMAIN BUNDLE` in `app.js`. Its tiny private CommonJS loader only
resolves these four local factories. It uses no runtime `eval`, dynamic import,
network loader or Node dependency. `app.js` delegates to the `MomentumDomain`
namespace: its thin adapters supply current questions and the device timezone.
The clock, demo state, storage and UI remain outside the pure modules.

This checked-in bundle keeps root static serving and the unchanged VM golden
harness working. It also fits the existing Vite allowlist plugin, which copies
`app.js` into `dist` unchanged. No new script tag or Vite/package configuration is
required. Do not manually edit generated code. After editing a domain module:

```sh
node src/domain/build-legacy.mjs
npm test
npm run typecheck
npm run lint
npm run build
```

`tests/domain-wiring.test.mjs` fails if the embedded bundle differs from a fresh
transpile of the TypeScript source. For a standalone read-only check, run
`node src/domain/build-legacy.mjs --check`. `npm run build` itself still copies the
checked-in bundle, so run the test gate before producing a release artifact.
WP1.6 can add direct module cases; the existing 19 engine golden assertions and
all legacy editor/rendering tests remain intact. Once the page uses the module
pipeline, import the TypeScript sources directly and remove the generated bridge
and its classic adapters together.

## Typed data repositories and native Storage (WP1.3)

`src/data/repositories.ts` exports `createRepositories({client, getUserId, now})`.
The injected client uses the existing Supabase SDK; account identity and the
migration timestamp clock are explicit dependencies. The factory returns typed
`entries`, `questions`, and `settings` repositories, with typed input/row/results.
Every public operation checks the current account before starting a query.
Every read, upsert and delete includes `.eq('user_id', currentUserId)`; upsert
payloads also stamp that identity. Supplied foreign ownership is rejected rather
than forwarded. A result from an operation whose account has since changed is
rejected. A write already sent cannot be cancelled by this result check.

These client checks are defence in depth, not database authorization. Supabase
row-level security, grants and ownership constraints remain required. Table
names, selected columns, payload columns, conflict keys and legacy delete-date
filter are unchanged. History reads remain unpaginated; only the separate
owner/date-specific `entries.get(date)` can establish that an editor day is
absent. No production policies, data or schema were inspected or changed here.

Reads normalize legacy numeric answer strings (including whitespace) to `1`,
`2`, or `3`. Invalid answer fields are dropped independently; invalid timestamps
become null. Irreparable entry rows and invalid question rows are omitted, keeping
other valid rows available. A targeted read may return null for a dropped row;
this is a sanitized view, not deletion or proof that corrupt data never existed.
No alternative historical enum spellings were found in tracked code, so unknown
question enums are dropped rather than guessed. Read labels retain the 4,096
character bound. Corrupt settings fields fall back to null timestamps and a true
migration flag to prevent an automatic legacy import from repeating.

Every normalization/drop emits `console.warn` with table, bounded date/key,
field name and action only; no labels, answer values or account IDs are logged.
`MomentumData.getReadDiagnostics()` returns cumulative `normalizedFields`,
`droppedFields`, and `droppedRows` counts for the current account since adapter
initialization; changing accounts resets counts. Counts track read events, not
unique records, and are available for future UI use. No repaired values are
persisted. Ownership/auth/account-change failures and backend/protocol errors
still throw; only row corruption is tolerated.

Writes and mutation responses stay strict: numeric answers only, valid enums,
80-character labels/options, valid dates/IDs and complete batch results. All
batch inputs are checked before requesting a mutation. No schema changes or
scoring/golden-rule changes are made.
Production data inventory is still recommended once Supabase access exists.
Dashboard route loads now surface failures with a visible status and Retry button
instead of silently swallowing errors or rendering an empty history. Boot failures
use the same recovery action. Late route results are guarded by request/context.

`storage.js` is now only a generated repository bundle plus a classic adapter.
The custom browser global is `window.MomentumData`, preserving the old method
names and adding `loadEntry(date)` for the editor. The browser's native
`window.Storage` interface is never replaced. `app.js` routes every data call
through the adapter; it no longer queries Supabase directly. `auth.js` keeps its
existing auth client/session behavior for WP1.4. Existing entry/demo UI hooks are
unchanged; future module consumers can call the typed factory directly.

Regenerate and verify the data bridge with:

```sh
node src/data/build-legacy.mjs
node src/data/build-legacy.mjs --check
node src/domain/build-legacy.mjs --check
npm test
npm run typecheck
npm run lint
npm run build
```

The data bridge uses the same pinned compiler and generated-marker approach as
the domain bridge. No runtime dependency/import, script tag, package or Vite
config changes are needed. Its freshness test fails if the checked-in classic
bundle differs from `repositories.ts`. Repository tests inject a local client
that records every filter/payload and returns adversarial results; they do not
certify live Supabase permissions or perform any production call.


### Session boundaries (WP1.4)

`src/state/session.ts` is an injectable controller with no browser, database or
clock access. `auth.js` embeds its deterministic classic bundle. `Auth.init()` is
idempotent: one subscription is installed before the initial session snapshot.
Auth notifications synchronously publish credentials and invalidate the prior
generation; boot runs in a scheduled task after the callback returns. Duplicate
initial/sign-in events and token refresh for the current owner update credentials
without re-booting or clearing state. A newer notification wins over a late initial
snapshot. `Auth.init()` now resolves when session discovery finishes, rather than
waiting for database boot; boot has its own error status and Retry action.

The generation counter and app demo revision guard asynchronous read/write
continuations (including errors). Boot, migration, question loading, dashboard,
habits, exports, database status, editor/save and question mutations cannot
populate a later account's caches or DOM. In-flight boot is deduped for its owner,
generation and demo revision. A write already sent cannot be cancelled; its stale
result cannot change the current UI or trigger a follow-up write.

`updateSessionAccount()` owns transition cleanup: prior-owner durable drafts,
entry/question/history caches, diagnostics, forms, generated DOM fragments,
charts, summary values and overlays are cleared together. Static editor controls
remain intact. `MomentumData.resetReadDiagnostics()` is an additive, local-only
reset hook, callable during logout. The existing MomentumDemo, MomentumEntry and
MomentumData methods and events retain their contracts. Token refresh does not
invalidate the editor or its draft. The session controller supports disposal for
an embedding host; the page's singleton keeps its subscription for page lifetime.

Regenerate with `node src/state/build-legacy.mjs`; verify with `--check`, alongside
the domain/data gates. `npm run format` must precede final handoff and
`npm run format:check` is a required gate. Session tests use injected auth clients,
schedulers and deferred responses; no live authentication/database/browser run
is claimed by these tests.


### Engine B core (WP2.1–2.4)

The domain bundle now derives version `b-1` results. `isValidAnswer` is shared
by draft validation and scoring: only numeric integers 1–3 are answers.
`assessEligibility` counts currently-due question keys, separates unanswered,
invalid and explicitly excused items, ignores orphans, and requires all due
items resolved with at least one answered action. Pure inputs accept `dueKeys`,
`excusedKeys` and `finalized`; existing stored rows default to all current
questions due and finalized until WP3 supplies persisted revision/finalization
metadata. No schema or repository writes were changed in this ticket.

Unresolved/draft/no-action results expose `eligible=false` and a status; velocity
and multiplier streaks carry unchanged and shadow/change are zero. Valid partial
answers can retain candidate thrust/drag/items for preview, but those totals are
not a published action score. UI consumers must check eligibility/status (WP2.6).
Eligible results expose `rawDv`, `mult`, `rawChange`, `shadow`, `intendedChange`,
`actualChange`, and `engineVersion`. Existing `finalDv` aliases `actualChange`
so zero-floor losses cannot be displayed as larger than the velocity lost.

`roundHalfAwayFromZero` is shared for multiplier/raw change/shadow. History looks
up eligible drag at calendar t−1/t−2, using timezone-independent key arithmetic.
The trajectory floor appears once, in `applyVelocityChange`; history passes its
calendar shadow into the daily engine instead of flooring a second time.
Streaks are derived once from actualChange; zero actual change resets both.

Founder selected Variant1 carry-over on 2026-10-02. `applyConservativeCarryOver`
keeps velocity unchanged and resets multiplier streaks for closed gaps or closed
rows without an eligible action score. No decay, grace, fabricated drag or
synthetic rows are applied. `recomputeAll` accepts an explicit `todayKey`; the
classic adapter supplies device-local today so unfinished today cannot reset
continuity early. Pure historical batches without todayKey treat their rows as
closed. Month-gap positive streak is now1 and calendar shadow0.
WP2.5 adds immutable entry revisions below; the legacy cutover manifest remains pending. This
core implementation does not authorize production cutover or historical data
migration.

Worked fixtures are `tests/fixtures/engine-b-1.json` (E1–E4, supplied E7 trajectory
arithmetic and a negative half-tie). `tests/engine-b.test.mjs` also checks calendar
shadow, floor/streak behavior, due/excused/draft eligibility, shadow sign reversal
and deterministic E5 suffix replay. E6 immutable definitions are covered by WP2.5 revision tests. E7 follows Oscar's corrected contract (d30afcc): raw −10 with mult1.15
rounds to rawChange−12; the fixture tests both daily scoring and trajectory math.


### Immutable entry revisions (WP2.5)

Migration `0002_entry_question_revisions.sql` adds nullable `question_set_revision`
(JSON array of key/text/polarity/tier definitions) and `engine_version` to entries.
The embedded array is the complete immutable revision, rather than a pointer to
mutable user_questions. No new table, anonymous grant or RLS exception is added.
The trigger uses invoker privileges and keeps the existing owner-only policies.
Apply through Michael to staging before deploying the extended read projections;
Michael runs `npm run test:integration` afterward. No production cutover is authorized.

New inserts capture a revision and `b-1`; old clients omit metadata and the trigger
captures current owner questions at receipt. Classic `MomentumData.saveEntry(date,
answers, questions?)` and typed `entries.save` accept optional scoring definitions;
the classic app passes its loaded question set, so edits during a network delay
cannot alter which definitions were submitted. Re-saving/upserting an existing
stamped entry preserves its original definitions/version in the database even if
the client submits new ones. Import accepts validated paired metadata and follows
the same database immutability rule. Strict writes reject invalid/unsupported
supplied revisions. Read normalization preserves valid revisions; corrupt stamps
retain answers plus `revision_invalid: true`, causing history replay to fail closed.

History uses each row's definitions for eligibility, scores and shadow inputs.
Results expose `revisionStatus: stored | legacy-unversioned`. Only b-1 is supported;
a new engine version needs an explicit dispatcher, never implicit b-1 replay.
Unversioned NULL/NULL rows keep the legacy current-definition fallback, labelled
as unknown provenance. No backfill invents original definitions. Their historical
scores are NOT guaranteed immutable until an approved evidence-based cutover.
Editing a legacy row establishes its first baseline at that edit; it does not
recover the definitions used originally. Revisions do not freeze trajectory
velocity: answer correction/backfill intentionally replays the suffix under each
row's original definitions. Checkpoints, mutation queues, due/excuse persistence
and WP3 interfaces remain outside this ticket.
