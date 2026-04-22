import { z } from 'zod';

const aiEnvSchema = z.object({
  AI_ENABLED: z.enum(['true', 'false']).optional(),
  AI_302_API_KEY: z.string().optional(),
  AI_302_BASE_URL: z.string().url().optional(),
  AI_DEFAULT_PLAN: z.enum(['free', 'pro', 'scale', 'enterprise']).optional(),
  AI_MODEL: z.string().optional(),
  AI_MODEL_PRO: z.string().optional(),
  AI_MODEL_TOOL: z.string().optional(),
});

export interface JuanieAIEnvInput {
  AI_ENABLED?: string | undefined;
  AI_302_API_KEY?: string | undefined;
  AI_302_BASE_URL?: string | undefined;
  AI_DEFAULT_PLAN?: string | undefined;
  AI_MODEL?: string | undefined;
  AI_MODEL_PRO?: string | undefined;
  AI_MODEL_TOOL?: string | undefined;
}

function cleanOptional(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createAIConfig(input: JuanieAIEnvInput): {
  enabledOverride: boolean | null;
  provider: {
    kind: '302';
    label: '302.ai';
    apiKey: string | null;
    baseUrl: string;
  };
  models: {
    chat: string;
    toolCalling: string;
    pro: string;
    json: string;
  };
  defaultPlan: 'free' | 'pro' | 'scale' | 'enterprise';
} {
  const parsedAIEnv = aiEnvSchema.parse(input);

  return {
    enabledOverride:
      parsedAIEnv.AI_ENABLED === undefined ? null : parsedAIEnv.AI_ENABLED === 'true',
    provider: {
      kind: '302',
      label: '302.ai',
      apiKey: cleanOptional(parsedAIEnv.AI_302_API_KEY),
      baseUrl: cleanOptional(parsedAIEnv.AI_302_BASE_URL) ?? 'https://api.302.ai/v1',
    },
    models: {
      chat: cleanOptional(parsedAIEnv.AI_MODEL) ?? 'gemini-2.5-flash',
      toolCalling:
        cleanOptional(parsedAIEnv.AI_MODEL_TOOL) ??
        cleanOptional(parsedAIEnv.AI_MODEL) ??
        'gemini-2.5-flash',
      pro:
        cleanOptional(parsedAIEnv.AI_MODEL_PRO) ??
        cleanOptional(parsedAIEnv.AI_MODEL) ??
        'gemini-2.5-pro',
      json: cleanOptional(parsedAIEnv.AI_MODEL) ?? 'gemini-2.5-flash',
    },
    defaultPlan: parsedAIEnv.AI_DEFAULT_PLAN ?? 'free',
  };
}

export const aiConfig = createAIConfig({
  AI_ENABLED: process.env.AI_ENABLED,
  AI_302_API_KEY: process.env.AI_302_API_KEY,
  AI_302_BASE_URL: process.env.AI_302_BASE_URL,
  AI_DEFAULT_PLAN: process.env.AI_DEFAULT_PLAN,
  AI_MODEL: process.env.AI_MODEL,
  AI_MODEL_PRO: process.env.AI_MODEL_PRO,
  AI_MODEL_TOOL: process.env.AI_MODEL_TOOL,
});

export type JuanieAIConfig = typeof aiConfig;

export function isAIConfigured(config: JuanieAIConfig = aiConfig): boolean {
  return Boolean(config.provider.apiKey);
}

export function isAIEnabled(config: JuanieAIConfig = aiConfig): boolean {
  if (config.enabledOverride === null) {
    return isAIConfigured(config);
  }

  return config.enabledOverride && isAIConfigured(config);
}
