import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('schema inspection source contract', () => {
  it('writes schema states through the effective source instead of raw input', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/schema-management/inspect.ts'),
      'utf8'
    );

    expect(source).toContain('resolveEffectiveSchemaInspectionSource');
    expect(source).toContain('sourceRef: source.sourceRef');
    expect(source).toContain('sourceCommitSha: source.sourceCommitSha');
    expect(source).not.toContain('sourceRef: input.sourceRef ?? null');
    expect(source).not.toContain('sourceCommitSha: input.sourceCommitSha ?? null');
  });

  it('keeps release-admission schema refreshes out of environment current state', () => {
    const gate = readFileSync(join(process.cwd(), 'src/lib/releases/schema-gate.ts'), 'utf8');
    const runner = readFileSync(
      join(process.cwd(), 'src/lib/schema-management/schema-runner.ts'),
      'utf8'
    );

    expect(gate).toContain('updateCurrentState: false');
    expect(runner).toContain("process.env.SCHEMA_INSPECT_UPDATE_CURRENT_STATE !== 'false'");
  });
});
