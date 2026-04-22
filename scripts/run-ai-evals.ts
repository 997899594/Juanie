import { runJuanieEvals } from '@/lib/ai/evals/runner';

const fixtureId = process.argv[2] ?? null;
const results = await runJuanieEvals({ fixtureId });
const failed = results.filter((result) => !result.ok);

for (const result of results) {
  // Keep output terse and scan-friendly for CI/local runs.
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.fixtureId}`);
  for (const check of result.checks) {
    console.log(`  ${check.ok ? 'OK' : 'NO'} ${check.label}: ${check.detail}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}
