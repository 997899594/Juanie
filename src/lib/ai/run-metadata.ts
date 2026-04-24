import type { AIToolTraceEntry } from '@/lib/ai/runtime/tool-trace';

export interface AIUsageSummary {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AIRunMetadata {
  provider: string | null;
  model: string | null;
  skillId?: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  toolCalls?: AIToolTraceEntry[];
  usage?: AIUsageSummary | null;
}

export function buildAIRunMetadata(input: AIRunMetadata): AIRunMetadata {
  return {
    provider: input.provider,
    model: input.model,
    skillId: input.skillId ?? null,
    promptKey: input.promptKey ?? null,
    promptVersion: input.promptVersion ?? null,
    toolCalls: input.toolCalls ?? [],
    usage: input.usage ?? null,
  };
}

export function buildRequiredAIRunMetadata(
  input: Required<
    Pick<
      AIRunMetadata,
      'provider' | 'model' | 'skillId' | 'promptKey' | 'promptVersion' | 'toolCalls'
    >
  > & {
    usage?: AIUsageSummary | null;
  }
): Required<
  Pick<
    AIRunMetadata,
    'provider' | 'model' | 'skillId' | 'promptKey' | 'promptVersion' | 'toolCalls'
  >
> & {
  usage: AIUsageSummary | null;
} {
  return {
    provider: input.provider,
    model: input.model,
    skillId: input.skillId,
    promptKey: input.promptKey,
    promptVersion: input.promptVersion,
    toolCalls: input.toolCalls,
    usage: input.usage ?? null,
  };
}
