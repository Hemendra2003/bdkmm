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
