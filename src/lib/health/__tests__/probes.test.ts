import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('health probe runtime boundary', () => {
  it('keeps startup and liveness probes free of dependency checks', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/health/probes.ts'), 'utf8');

    expect(source).not.toContain('@/lib/db');
    expect(source).not.toContain('@/lib/k8s');
    expect(source).not.toContain('@/lib/redis');
    expect(source).not.toContain('dependency-checks');
  });
});
