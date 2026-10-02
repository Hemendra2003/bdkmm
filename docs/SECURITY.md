# Security

## Secret scanning

A zero-dependency guard checks every **tracked** file for likely credentials
(Anthropic/OpenAI key prefixes, `AUTH_TOKEN=`-style assignments, Supabase
`service_role`/secret keys and JWTs, PEM private-key blocks).

Run it:

```sh
node --test tests/no-secrets.test.mjs
```

(Use the file path, not `node --test tests/` — a bare directory argument fails on
Node 24.) Wire the same command into CI and, ideally, a pre-commit hook.

Notes:

- It scans only files from `git ls-files`. Untracked and git-ignored files are
  skipped on purpose — keeping local secrets out of the repo is what
  `.gitignore` is for (`.env*`, `.claude/settings.local.json`, etc.).
- The frontend Supabase **publishable** key in `auth.js` is allowlisted. It is
  designed to ship in the browser; its protection is Row Level Security, not
  secrecy.
- The scanner reports `file:line` only and never prints a secret value.

## History still holds old tokens — rotate them

> **Action required by the repository owner.** Removing a file or adding an
> ignore rule does **not** revoke a credential, and it does **not** erase it
> from git history.

Earlier commits tracked `.claude/settings.local.json`, which contained live
LLM-gateway tokens. Those commits still exist in this repository's history and in
any clone, fork, or host-side cache. Until the tokens are **rotated/revoked in
their provider consoles**, treat them as compromised regardless of this cleanup.

Do this, in order:

1. **Rotate/revoke** every affected token in its provider console (the
   LLM-gateway account and, if a real Anthropic key was used, the Anthropic
   Console). Review usage/billing for unexpected activity.
2. Confirm no Supabase **service_role** (admin) key was ever committed. If in
   doubt, rotate it in Supabase → Project Settings → API. (None is present in
   the current tree.)
3. Decide on history cleanup **separately** (e.g. BFG / `git filter-repo`),
   coordinating collaborators, forks, backups, and protected branches. This is
   not an automatic force-push.

This scanner prevents the **next** leak; it cannot undo a past one.
