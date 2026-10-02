// Regenerate the classic app's embedded domain bundle, with no runtime loader
// or external dependency. Run: node src/domain/build-legacy.mjs
// Check reproducibility without mutation: node src/domain/build-legacy.mjs --check
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
const names = ['dates', 'rounding', 'validation', 'scoring', 'history', 'explain'];
export function buildLegacyBundle() {
  const factories = names.map((name) => {
    const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    return `${JSON.stringify('./' + name)}:function(exports,require){\n${outputText}\n}`;
  });
  return (
    `// BEGIN GENERATED DOMAIN BUNDLE — node src/domain/build-legacy.mjs\n` +
    `const MomentumDomain=(()=>{\nconst modules={${factories.join(',\n')}};\n` +
    `const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;modules[name](exports,load);return exports;}\n` +
    `return Object.assign({},${names.map((name) => `load('./${name}')`).join(',')});\n})();\n` +
    `// END GENERATED DOMAIN BUNDLE\n`
  );
}
const appURL = new URL('../../app.js', import.meta.url);
// The script itself is under src/domain, so the repository root is ../.. .
export function bundledApp(source) {
  const pattern =
    /\/\/ BEGIN GENERATED DOMAIN BUNDLE[^\n]*\n[\s\S]*?\/\/ END GENERATED DOMAIN BUNDLE\n/;
  if (!pattern.test(source)) throw new Error('Generated domain bundle markers missing in app.js');
  return source.replace(pattern, () => buildLegacyBundle());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = readFileSync(appURL, 'utf8');
  const generated = bundledApp(source);
  if (process.argv.includes('--check')) {
    if (source !== generated)
      throw new Error('Domain bundle is stale; run node src/domain/build-legacy.mjs');
  } else {
    writeFileSync(appURL, generated);
  }
}
