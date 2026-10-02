// Embed the typed repository module into the existing classic storage.js asset.
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export function buildDataBundle() {
  const source = readFileSync(new URL('./repositories.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  return (
    '// BEGIN GENERATED DATA BUNDLE — node src/data/build-legacy.mjs\n' +
    'const MomentumRepositories=(()=>{const exports={};\n' +
    outputText +
    '\nreturn exports;})();\n' +
    '// END GENERATED DATA BUNDLE\n'
  );
}
export function bundledStorage(source) {
  const pattern =
    /\/\/ BEGIN GENERATED DATA BUNDLE[^\n]*\n[\s\S]*?\/\/ END GENERATED DATA BUNDLE\n/;
  if (!pattern.test(source)) throw new Error('Repository bundle markers missing in storage.js');
  return source.replace(pattern, () => buildDataBundle());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = new URL('../../storage.js', import.meta.url),
    source = readFileSync(url, 'utf8');
  const generated = bundledStorage(source);
  if (process.argv.includes('--check')) {
    if (source !== generated)
      throw new Error('Repository bundle stale; run node src/data/build-legacy.mjs');
  } else {
    writeFileSync(url, generated);
  }
}
