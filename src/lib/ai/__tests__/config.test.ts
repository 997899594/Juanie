import { describe, expect, it } from 'bun:test';
import { createAIConfig, isAIConfigured, isAIEnabled } from '@/lib/ai/config';

describe('ai config', () => {
  it('builds a typed config with stable defaults', () => {
    const config = createAIConfig({
      AI_302_API_KEY: 'secret',
    });

    expect(config.provider.label).toBe('302.ai');
    expect(config.provider.baseUrl).toBe('https://api.302.ai/v1');
    expect(config.models.chat).toBe('gemini-2.5-flash');
    expect(config.models.pro).toBe('gemini-2.5-pro');
    expect(config.defaultPlan).toBe('free');
    expect(isAIConfigured(config)).toBe(true);
    expect(isAIEnabled(config)).toBe(true);
  });

  it('keeps enabled false when override disables ai even if provider is configured', () => {
    const config = createAIConfig({
      AI_ENABLED: 'false',
      AI_302_API_KEY: 'secret',
    });

    expect(isAIConfigured(config)).toBe(true);
    expect(isAIEnabled(config)).toBe(false);
  });

  it('uses model-specific overrides without leaking vendor details into callers', () => {
    const config = createAIConfig({
      AI_302_API_KEY: 'secret',
      AI_MODEL: 'gemini-2.5-flash-preview',
      AI_MODEL_PRO: 'gemini-2.5-pro-preview',
      AI_MODEL_TOOL: 'gpt-4.1-mini',
    });

    expect(config.models.chat).toBe('gemini-2.5-flash-preview');
    expect(config.models.json).toBe('gemini-2.5-flash-preview');
    expect(config.models.pro).toBe('gemini-2.5-pro-preview');
    expect(config.models.toolCalling).toBe('gpt-4.1-mini');
  });
});
