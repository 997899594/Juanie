import { describe, expect, it } from 'bun:test';
import { getPromptDefinition, getPromptVersionedKey } from '@/lib/ai/prompts/registry';

describe('ai prompt registry', () => {
  it('registers versioned prompts for every first-party workflow', () => {
    expect(getPromptVersionedKey('environment-copilot')).toBe('environment-copilot@v1');
    expect(getPromptVersionedKey('environment-summary')).toBe('environment-summary@v1');
    expect(getPromptVersionedKey('envvar-risk')).toBe('envvar-risk@v1');
    expect(getPromptVersionedKey('migration-review')).toBe('migration-review@v1');
    expect(getPromptVersionedKey('release-copilot')).toBe('release-copilot@v1');
    expect(getPromptVersionedKey('release-plan')).toBe('release-plan@v1');
    expect(getPromptVersionedKey('incident-analysis')).toBe('incident-analysis@v1');
    expect(getPromptVersionedKey('dynamic-plugin')).toBe('dynamic-plugin@v1');
  });

  it('exposes stable system prompts instead of inline plugin strings', () => {
    const prompt = getPromptDefinition('release-plan');

    expect(prompt.key).toBe('release-plan');
    expect(prompt.version).toBe('v1');
    expect(prompt.assetPath.endsWith('src/lib/ai/prompts/definitions/release-plan.md')).toBe(true);
    expect(prompt.system.includes('只能依据 evidence 作答')).toBe(true);
  });
});
