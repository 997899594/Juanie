import { environmentSummaryEvalFixture } from '@/lib/ai/evals/fixtures/environment-summary';
import { envvarRiskEvalFixture } from '@/lib/ai/evals/fixtures/envvar-risk';
import { incidentAnalysisEvalFixture } from '@/lib/ai/evals/fixtures/incident-analysis';
import { migrationReviewEvalFixture } from '@/lib/ai/evals/fixtures/migration-review';
import { releasePlanEvalFixture } from '@/lib/ai/evals/fixtures/release-plan';
import type { JuanieEvalFixture } from '@/lib/ai/evals/types';

const coreEvalFixtures = [
  environmentSummaryEvalFixture,
  envvarRiskEvalFixture,
  releasePlanEvalFixture,
  incidentAnalysisEvalFixture,
  migrationReviewEvalFixture,
] satisfies JuanieEvalFixture[];

export function listJuanieEvalFixtures(): JuanieEvalFixture[] {
  return [...coreEvalFixtures];
}

export function getJuanieEvalFixtureById(id: string): JuanieEvalFixture | null {
  return coreEvalFixtures.find((fixture) => fixture.id === id) ?? null;
}
