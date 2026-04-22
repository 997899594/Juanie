import { describe, expect, it } from 'bun:test';
import { getJuanieEvalFixtureById, listJuanieEvalFixtures } from '@/lib/ai/evals/registry';
import { getPromptVersionedKey } from '@/lib/ai/prompts/registry';

describe('ai eval registry', () => {
  it('registers fixtures for all first-party core workflows', () => {
    const fixtureIds = listJuanieEvalFixtures().map((fixture) => fixture.id);

    expect(fixtureIds).toContain('environment-summary-production-attention');
    expect(fixtureIds).toContain('envvar-risk-inherited-overrides');
    expect(fixtureIds).toContain('release-plan-production-gated-migration');
    expect(fixtureIds).toContain('incident-analysis-migration-blocked');
    expect(fixtureIds).toContain('migration-review-awaiting-approval');
  });

  it('keeps fixture prompt metadata aligned with prompt registry', () => {
    const releaseFixture = getJuanieEvalFixtureById('release-plan-production-gated-migration');
    const incidentFixture = getJuanieEvalFixtureById('incident-analysis-migration-blocked');
    const environmentFixture = getJuanieEvalFixtureById('environment-summary-production-attention');

    expect(releaseFixture === null).toBe(false);
    expect(incidentFixture === null).toBe(false);
    expect(environmentFixture === null).toBe(false);
    expect(`${releaseFixture?.promptKey}@${releaseFixture?.promptVersion}`).toBe(
      getPromptVersionedKey('release-plan')
    );
    expect(`${incidentFixture?.promptKey}@${incidentFixture?.promptVersion}`).toBe(
      getPromptVersionedKey('incident-analysis')
    );
    expect(`${environmentFixture?.promptKey}@${environmentFixture?.promptVersion}`).toBe(
      getPromptVersionedKey('environment-summary')
    );
  });
});
