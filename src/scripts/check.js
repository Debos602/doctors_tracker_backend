/**
 * `npm run build` — the API is plain JavaScript and runs as-is, so there is
 * nothing to compile. This checks every source file for syntax errors, so a
 * broken file fails here instead of at deploy time.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)); // src/

function listJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listJs(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

const files = listJs(root);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed++;
    console.error(`✗ ${relative(root, file)}\n${error.stderr?.toString().trim()}\n`);
  }
}

if (failed) {
  console.error(`Build failed: ${failed} of ${files.length} files have syntax errors.`);
  process.exit(1);
}

console.log(`✓ ${files.length} files passed the syntax check.`);
console.log('No compile step needed — start the API with `npm start`.');
