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
The test runner remains `node --test`. No continuous integration is added here.

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

Read results and mutation responses are validated before being returned. Lists
must be arrays; only a `null` single-row result confirms absence. Entry dates must
be real `YYYY-MM-DD` dates; answer maps permit numeric `1`, `2`, `3`, or `null`
(with partial/orphan keys retained), and at most 1,000 safe keys. String answers,
invalid choices, invalid dates and malformed timestamps are rejected, not
silently repaired. Questions require valid identity, polarity/tier, three text
choices, boolean fixed status, library/custom source and nonnegative integer
order. Existing labels up to 4,096 characters can be read without truncation;
new question and option text still has the P0.4 80-character limit. Question IDs
permit nonempty strings or nonnegative safe integers because no tracked/live
schema establishes one ID type. Settings validate the boolean migration flag
and nullable timestamp. Errors identify fields without embedding private values.

Batches validate all members, duplicates and optional ownership before making
any request. Invalid batches cannot partially begin from this client. Returned
batches must contain all expected dates/keys without duplicates. Backend errors
propagate rather than becoming empty rows or success. These boundary contracts
may reject malformed legacy/imported data (including string-valued answers or
unknown source/tier values); inventory and a deliberate repair/migration are
required if such data exists. No legacy data was normalized in this task, and
the pure scoring engine/golden rules remain unchanged.

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
