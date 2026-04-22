import { dynamicPluginPrompt } from '@/lib/ai/prompts/resources/dynamic-plugin';
import { environmentSummaryPrompt } from '@/lib/ai/prompts/resources/environment-summary';
import { envvarRiskPrompt } from '@/lib/ai/prompts/resources/envvar-risk';
import { incidentAnalysisPrompt } from '@/lib/ai/prompts/resources/incident-analysis';
import { migrationReviewPrompt } from '@/lib/ai/prompts/resources/migration-review';
import { releasePlanPrompt } from '@/lib/ai/prompts/resources/release-plan';

const promptRegistry = {
  [dynamicPluginPrompt.key]: dynamicPluginPrompt,
  [envvarRiskPrompt.key]: envvarRiskPrompt,
  [environmentSummaryPrompt.key]: environmentSummaryPrompt,
  [migrationReviewPrompt.key]: migrationReviewPrompt,
  [releasePlanPrompt.key]: releasePlanPrompt,
  [incidentAnalysisPrompt.key]: incidentAnalysisPrompt,
} as const;

export type JuaniePromptKey = keyof typeof promptRegistry;

export function getPromptDefinition(key: JuaniePromptKey) {
  return promptRegistry[key];
}

export function getPromptVersionedKey(key: JuaniePromptKey): string {
  const prompt = getPromptDefinition(key);
  return `${prompt.key}@${prompt.version}`;
}
