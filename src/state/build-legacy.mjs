// Embed the typed session module into the existing classic auth.js asset.
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export function buildSessionBundle() {
  const source = readFileSync(new URL('./session.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  return (
    '// BEGIN GENERATED SESSION BUNDLE — node src/state/build-legacy.mjs\n' +
    'const MomentumSession=(()=>{const exports={};\n' +
    outputText +
    '\nreturn exports;})();\n' +
    '// END GENERATED SESSION BUNDLE\n'
  );
}
export function bundledAuth(source) {
  const pattern =
    /\/\/ BEGIN GENERATED SESSION BUNDLE[^\n]*\n[\s\S]*?\/\/ END GENERATED SESSION BUNDLE\n/;
  if (!pattern.test(source)) throw new Error('Session bundle markers missing in auth.js');
  return source.replace(pattern, () => buildSessionBundle());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = new URL('../../auth.js', import.meta.url),
    source = readFileSync(url, 'utf8');
  const generated = bundledAuth(source);
  if (process.argv.includes('--check')) {
    if (source !== generated)
      throw new Error('Session bundle stale; run node src/state/build-legacy.mjs');
  } else {
    writeFileSync(url, generated);
  }
}
