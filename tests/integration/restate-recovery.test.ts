import { describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';

const enabled =
  process.env.INTEGRATION_TESTS === 'true' && process.env.RESTATE_INTEGRATION_TESTS === 'true';
const integrationTest = enabled ? it : it.skip;
const adminUrl = process.env.RESTATE_ADMIN_URL ?? 'http://127.0.0.1:9070';
const ingressUrl = process.env.RESTATE_INGRESS_URL ?? 'http://127.0.0.1:8080';
const fixturePort = 9081;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000,
  intervalMs = 100
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}

async function markerLines(path: string): Promise<string[]> {
  return readFile(path, 'utf8')
    .then((content) => content.trim().split('\n').filter(Boolean))
    .catch(() => []);
}

function startFixture(markerPath: string): ChildProcess {
  return spawn('bun', ['tests/integration/fixtures/restate-crash-workflow.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RESTATE_CRASH_MARKER_PATH: markerPath,
      RESTATE_SERVICE_PORT: String(fixturePort),
    },
    stdio: 'ignore',
  });
}

async function stopFixture(process: ChildProcess | null): Promise<void> {
  if (!process || process.exitCode !== null) return;
  process.kill('SIGKILL');
  await new Promise<void>((resolve) => process.once('exit', () => resolve()));
}

async function registerFixture(): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(`${adminUrl}/deployments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uri: `http://127.0.0.1:${fixturePort}` }),
    }).catch(() => null);
    return response?.ok === true || response?.status === 409;
  });
}

describe('Restate service crash recovery', () => {
  integrationTest(
    'resumes after the service endpoint restarts without replaying a checkpoint',
    async () => {
      const markerPath = `/tmp/juanie-restate-recovery-${randomUUID()}.log`;
      const workflowKey = randomUUID();
      const abortController = new AbortController();
      const abortTimeout = setTimeout(() => abortController.abort(), 25_000);
      let fixture: ChildProcess | null = null;
      let invocation: Promise<Response> | null = null;

      try {
        fixture = startFixture(markerPath);
        await registerFixture();
        invocation = fetch(
          `${ingressUrl}/CrashRecoveryWorkflow/${encodeURIComponent(workflowKey)}/run`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
            signal: abortController.signal,
          }
        );

        await waitFor(async () => (await markerLines(markerPath)).includes('checkpoint'));
        await stopFixture(fixture);
        fixture = startFixture(markerPath);

        const response = await invocation;
        expect(response.ok).toBe(true);
        expect(await markerLines(markerPath)).toEqual(['checkpoint', 'effect']);
      } finally {
        clearTimeout(abortTimeout);
        abortController.abort();
        await invocation?.catch(() => undefined);
        await stopFixture(fixture);
        await rm(markerPath, { force: true });
      }
    },
    30_000
  );
});
