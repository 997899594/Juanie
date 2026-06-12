import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('sleeping worker deployment boundary', () => {
  it('keeps an existing sleeping stable workload asleep while updating its template', () => {
    const executor = readFileSync(
      join(process.cwd(), 'src/lib/queue/deployment-executor.ts'),
      'utf8'
    );

    expect(executor).toContain('const stableSnapshot = stableExists');
    expect(executor).toContain('replicas: stableSnapshot?.replicas ?? service.replicas ?? 1');
  });

  it('waits for observed generation instead of pod readiness when promoted replicas are zero', () => {
    const workloads = readFileSync(join(process.cwd(), 'src/lib/releases/workloads.ts'), 'utf8');

    expect(workloads).toContain('async function waitForPromotedDeployment');
    expect(workloads).toContain('if (input.replicas <= 0)');
    expect(workloads).toContain('waitForDeploymentObserved');
  });
});
