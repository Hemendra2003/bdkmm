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
`npm run format:check`, scoped to src/ and tests/. Existing files have not been
reformatted; format:check may report existing formatting and is not a gate yet.
The test runner remains `node --test`.

## Continuous integration and the main branch gate

`.github/workflows/ci.yml` runs on pull requests and pushes to main. Its
`Quality checks` job uses Node.js 22 LTS, caches npm downloads by package-lock.json,
and runs these commands in order:

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` includes `tests/no-secrets.test.mjs`, which scans tracked source files
without printing credential values. This is a current-tree guard, not a history
scan. No Supabase credentials or other repository secrets are required for these
checks. Actions are pinned to full commit hashes, with version comments; the
workflow token has only contents:read and checkout does not persist it.

The separate `Browser smoke (WP1.5b pending)` job is intentionally skipped.
WP1.5b must add pinned Playwright, browser installation and a real smoke test
against the built preview before enabling it. Until then CI does not verify
rendered UI, authentication or integration behavior. Do not mark the skipped job
as required or report it as passing. Local dev/preview serving checks also remain
pending; WP1.1 build validation did not start those servers.

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
merge. When WP1.5b is enabled and has run, add its actual browser check to the
required checks too. The workflow file alone does not enforce merge protection;
that repository setting and an observed remote run are still required. Michael
owns remote pushes and integration; no push or settings change is authorized by
adding this file. See GitHub's
[branch protection instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

For local command validation use Node.js 22.12 or newer and run the five commands
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
