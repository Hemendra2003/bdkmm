// Secret-scanning guard for TRACKED files. Zero dependencies.
//
// PURPOSE: fail CI (and a pre-commit run) if any file git is tracking contains
// something that looks like a live credential, so a secret can never be
// committed the way .claude/settings.local.json was (see docs/SECURITY.md).
//
// SCOPE: only files reported by `git ls-files` are scanned — untracked and
// git-ignored files are intentionally skipped, because ignoring them is how we
// keep local secrets out of the repo in the first place.
//
// SAFETY: this test NEVER prints a secret value. On a hit it reports only
// "<file>:<line>  <rule>" so the output itself is safe to paste anywhere.
//
// RUN: node --test tests/no-secrets.test.mjs
//      (a bare directory arg — `node --test tests/` — fails on Node 24; use the glob)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

// Rules are built with RegExp(...) from fragments so this scanner's OWN source
// never contains a full credential-shaped literal that would match itself.
const RULES = [
  { name: 'anthropic-api-key', re: new RegExp('sk-ant-' + '[A-Za-z0-9_\\-]{20,}') },
  { name: 'openai-api-key', re: new RegExp('sk-' + '(proj-)?[A-Za-z0-9]{20,}') },
  {
    name: 'auth-token-assignment',
    re: new RegExp('AUTH_TOKEN["\']?\\s*[:=]\\s*["\']?[A-Za-z0-9_.\\-]{20,}', 'i'),
  },
  {
    name: 'generic-api-key-assignment',
    re: new RegExp(
      '(api[_-]?key|secret[_-]?key|access[_-]?token)["\']?\\s*[:=]\\s*["\']?[A-Za-z0-9_.\\-]{24,}',
      'i',
    ),
  },
  // Supabase service_role / secret keys. JWT = three base64url segments.
  { name: 'supabase-secret-key', re: new RegExp('sb_secret_' + '[A-Za-z0-9_\\-]{10,}') },
  {
    name: 'jwt-token',
    re: new RegExp('eyJ' + '[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}'),
  },
  { name: 'private-key-block', re: new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----') },
];

// Explicit allowlist. The Supabase PUBLISHABLE key is designed to ship in the
// frontend and is safe by Supabase's own documentation (protection is RLS, not
// secrecy). Any line containing one of these substrings is exempt.
const ALLOWLIST_SUBSTRINGS = [
  'sb_publishable_', // frontend publishable Supabase key (auth.js)
];

// Files we never scan as text (binary / this test's own fragments are fine to scan,
// but binaries produce noise). Extensions treated as binary:
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.pdf',
  '.zip',
  '.woff',
  '.woff2',
  '.ttf',
  '.DS_Store',
]);

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function looksBinary(buf) {
  // NUL byte within the first 8KB -> treat as binary.
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function scan() {
  const findings = [];
  for (const rel of trackedFiles()) {
    const ext = path.extname(rel);
    if (BINARY_EXT.has(ext) || rel.endsWith('.DS_Store')) continue;
    const abs = path.join(REPO_ROOT, rel);
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue;
    }
    if (looksBinary(buf)) continue;
    const lines = buf.toString('utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (ALLOWLIST_SUBSTRINGS.some((s) => line.includes(s))) return;
      for (const rule of RULES) {
        if (rule.re.test(line)) findings.push(`${rel}:${i + 1}  ${rule.name}`);
      }
    });
  }
  return findings;
}

test('no tracked file contains a likely secret', () => {
  const findings = scan();
  assert.equal(
    findings.length,
    0,
    `Possible secret(s) in tracked files (values withheld; rotate + remove from git):\n  ${findings.join('\n  ')}`,
  );
});

test('scanner actually detects a planted secret-shaped string (self-check)', () => {
  // Proves the rules fire. These are fake, non-functional samples built at runtime,
  // never committed as literals.
  const samples = [
    'sk-ant-' + 'A'.repeat(40),
    'ANTHROPIC_AUTH_TOKEN=' + 'B'.repeat(40),
    'eyJ' + 'a'.repeat(20) + '.' + 'b'.repeat(20) + '.' + 'c'.repeat(20),
    '-----BEGIN ' + 'RSA PRIVATE KEY' + '-----', // split so this source line is not itself a match
    'sb_secret_' + 'z'.repeat(30),
  ];
  for (const s of samples) {
    assert.ok(
      RULES.some((r) => r.re.test(s)),
      `rules failed to flag a planted sample`,
    );
  }
});

test('publishable Supabase key is allowlisted, not flagged', () => {
  const line = "const SB_KEY='sb_publishable_" + 'x'.repeat(30) + "';";
  const exempt = ALLOWLIST_SUBSTRINGS.some((sub) => line.includes(sub));
  assert.ok(exempt, 'publishable key line should be allowlisted');
});
