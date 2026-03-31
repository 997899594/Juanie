import { generateText, Output } from 'ai';
import type { infer as Infer, ZodTypeAny } from 'zod';
import { createDegradationState } from '@/lib/ai/core/degradation';
import { getJsonModelForPolicy, getModelNameForPolicy } from '@/lib/ai/core/model-policy';
import { aiProvider } from '@/lib/ai/core/provider';

export async function generateStructuredObject<TSchema extends ZodTypeAny>(input: {
  policy?: 'interactive-fast' | 'structured-high-quality';
  schema: TSchema;
  schemaName: string;
  description: string;
  system: string;
  prompt: string;
}): Promise<{
  object: Infer<TSchema>;
  provider: string;
  model: string;
  degraded: ReturnType<typeof createDegradationState>;
}> {
  if (!aiProvider.isEnabled()) {
    throw new Error('AI provider is not enabled or configured');
  }

  const policy = input.policy ?? 'structured-high-quality';
  const result = await generateText({
    model: getJsonModelForPolicy(policy),
    system: input.system,
    prompt: input.prompt,
    output: Output.object({
      schema: input.schema,
      name: input.schemaName,
      description: input.description,
    }),
  });

  return {
    object: result.output as Infer<TSchema>,
    provider: aiProvider.getProviderLabel(),
    model: getModelNameForPolicy(policy),
    degraded: createDegradationState(null),
  };
}
