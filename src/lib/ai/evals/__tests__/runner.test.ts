import { describe, expect, it } from 'bun:test';
import { getJuanieEvalFixtureById } from '@/lib/ai/evals/registry';
import { evaluateJuanieFixture, runJuanieEvals } from '@/lib/ai/evals/runner';
import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';

describe('ai eval runner', () => {
  it('evaluates registered fixtures successfully', async () => {
    const results = await runJuanieEvals();

    expect(results.length >= 5).toBe(true);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('supports running a single fixture by id', async () => {
    const results = await runJuanieEvals({
      fixtureId: 'release-plan-production-gated-migration',
    });

    expect(results.length).toBe(1);
    expect(results[0]?.fixtureId).toBe('release-plan-production-gated-migration');
    expect(results[0]?.ok).toBe(true);
  });

  it('fails when fixture output no longer matches schema', async () => {
    const fixture = getJuanieEvalFixtureById(
      'release-plan-production-gated-migration'
    ) as JuanieEvalFixture<unknown, ReleasePlan> | null;

    expect(fixture === null).toBe(false);

    const result = await evaluateJuanieFixture({
      ...fixture!,
      output: {
        ...fixture!.output,
        recommendation: {
          ...fixture!.output.recommendation,
          strategy: 'invalid',
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.label === 'output schema valid' && !check.ok)).toBe(
      true
    );
  });
});
