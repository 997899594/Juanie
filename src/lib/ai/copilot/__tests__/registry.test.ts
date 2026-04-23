import { describe, expect, it } from 'bun:test';
import { getCopilotDefinition } from '@/lib/ai/copilot/registry';

describe('copilot registry', () => {
  it('registers environment copilot on top of the environment skill', () => {
    const definition = getCopilotDefinition('environment');

    expect(definition.skillId).toBe('environment-skill');
    expect(definition.promptKey).toBe('environment-copilot');
    expect(definition.getSuggestions()).toContain('当前环境最该先看什么？');
  });

  it('registers release copilot on top of the release skill', () => {
    const definition = getCopilotDefinition('release');

    expect(definition.skillId).toBe('release-skill');
    expect(definition.promptKey).toBe('release-copilot');
    expect(definition.getSuggestions('这次发布失败了')).toContain('最像根因的信号是什么？');
  });
});
