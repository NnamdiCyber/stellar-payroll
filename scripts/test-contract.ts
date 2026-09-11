import { spawnSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const CONTRACTS = ['payroll-manager', 'payment-stream'];

let failed = false;

for (const contract of CONTRACTS) {
  const dir = path.join(root, 'contracts', contract);
  console.log(`\n=== Testing ${contract} ===`);
  const result = spawnSync('cargo', ['test', '--features', 'testutils'], {
    cwd: dir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error('\nOne or more contract test suites failed.');
  process.exit(1);
}
console.log('\nAll contract test suites passed.');