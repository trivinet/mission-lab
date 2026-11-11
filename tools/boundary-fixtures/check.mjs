// Proves the architecture boundary rules work: every fixture under tools/boundary-fixtures/ is a
// deliberately illegal file whose first line is `// expect: <ruleId>`. This script exits 0 only if
// ESLint reports that rule for every fixture (and there is at least one fixture).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');

/** @param {string} dir @returns {string[]} */
function listFixtures(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFixtures(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const fixtures = listFixtures(here);
if (fixtures.length === 0) {
  console.error('check:boundaries: no fixtures found');
  process.exit(1);
}

// ignore:false lets us lint files that the normal configuration ignores.
const eslint = new ESLint({ cwd: root, ignore: false });
const results = await eslint.lintFiles(fixtures);
const byPath = new Map(results.map((result) => [result.filePath, result]));

let failures = 0;
for (const fixture of fixtures) {
  const rel = relative(root, fixture).replaceAll(String.fromCharCode(92), '/');
  const match = /^\/\/ expect: (\S+)/.exec(readFileSync(fixture, 'utf8'));
  if (match === null || match[1] === undefined) {
    console.error(`FAIL ${rel}: missing "// expect: <ruleId>" header`);
    failures += 1;
    continue;
  }
  const expected = match[1];
  const result = byPath.get(fixture);
  const messages = result?.messages ?? [];
  const parseError = messages.find((message) => message.fatal === true);
  if (parseError !== undefined) {
    console.error(`FAIL ${rel}: parse error: ${parseError.message}`);
    failures += 1;
    continue;
  }
  const hit = messages.some((message) => message.ruleId?.startsWith(expected) ?? false);
  if (hit) {
    console.log(`ok   ${rel} -> ${expected}`);
  } else {
    const seen = messages.map((message) => message.ruleId ?? 'none').join(', ') || 'nothing';
    console.error(`FAIL ${rel}: expected ${expected} to be reported, got: ${seen}`);
    failures += 1;
  }
}

console.log(`${String(fixtures.length - failures)}/${String(fixtures.length)} fixtures reported`);
process.exit(failures === 0 ? 0 : 1);
