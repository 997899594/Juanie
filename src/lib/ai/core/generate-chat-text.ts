import { generateText } from 'ai';
import { createDegradationState } from '@/lib/ai/core/degradation';
import {
  type AIModelPolicy,
  getModelNameForPolicy,
  getReasoningModelForPolicy,
} from '@/lib/ai/core/model-policy';
import { aiProvider } from '@/lib/ai/core/provider';

export async function generateChatText(input: {
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  system: string;
  prompt: string;
}): Promise<{
  text: string;
  provider: string;
  model: string;
  degraded: ReturnType<typeof createDegradationState>;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
}> {
  if (!aiProvider.isEnabled()) {
    throw new Error('AI provider is not enabled or configured');
  }

  const policy = input.policy ?? 'interactive-fast';
  const result = await generateText({
    model: getReasoningModelForPolicy(policy),
    system: input.system,
    prompt: input.prompt,
  });

  return {
    text: result.text,
    provider: aiProvider.getProviderLabel(),
    model: getModelNameForPolicy(policy),
    degraded: createDegradationState(null),
    usage: {
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      totalTokens: result.usage?.totalTokens ?? null,
    },
  };
}
