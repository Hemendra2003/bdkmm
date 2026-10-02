import { spawn, spawnSync } from 'node:child_process';

// Build actual modules with deterministic public config, never a developer's
// .env values. Nested output directories share one preview origin.
const configs = [
  { outDir: 'dist', url: '', key: '' },
  { outDir: 'dist/e2e-malformed', url: 'not-a-valid-url', key: 'public-test-key' },
  { outDir: 'dist/e2e-valid', url: 'https://supabase.invalid', key: 'public-test-key' },
];
for (const { outDir, url, key } of configs) {
  const result = spawnSync('npm', ['run', 'build', '--', '--mode', 'e2e', '--outDir', outDir], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const server = spawn('npm', ['run', 'preview'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
