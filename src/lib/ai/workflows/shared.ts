import type { infer as Infer, ZodTypeAny } from 'zod';
import { createDegradationState } from '@/lib/ai/core/degradation';
import { generateStructuredObject } from '@/lib/ai/core/generate-structured';
import { getPromptDefinition } from '@/lib/ai/prompts/registry';
import { buildAIRunMetadata } from '@/lib/ai/run-metadata';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import type { StructuredWorkflowDefinition } from '@/lib/ai/workflows/catalog';

export interface StructuredWorkflowGeneratorResult<TSchema extends ZodTypeAny> {
  object: Infer<TSchema>;
  provider: string;
  model: string;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
}

export interface StructuredWorkflowRuntime {
  generateObject<TSchema extends ZodTypeAny>(input: {
    schema: TSchema;
    schemaName: string;
    description: string;
    system: string;
    prompt: string;
  }): Promise<StructuredWorkflowGeneratorResult<TSchema>>;
}

const defaultStructuredWorkflowRuntime: StructuredWorkflowRuntime = {
  async generateObject(input) {
    const result = await generateStructuredObject(input);

    return {
      object: result.object,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    };
  },
};

export async function runStructuredWorkflow<TEvidence, TSchema extends ZodTypeAny>(input: {
  workflow: StructuredWorkflowDefinition<TSchema>;
  evidence: TEvidence;
  buildPrompt(evidence: TEvidence): string;
  runtime?: StructuredWorkflowRuntime;
}): Promise<AIPluginRunEnvelope<Infer<TSchema>>> {
  const promptDefinition = getPromptDefinition(input.workflow.promptKey);
  const runtime = input.runtime ?? defaultStructuredWorkflowRuntime;
  const result = await runtime.generateObject({
    schema: input.workflow.schema,
    schemaName: input.workflow.schemaName,
    description: input.workflow.description,
    system: promptDefinition.system,
    prompt: input.buildPrompt(input.evidence),
  });

  return {
    output: result.object,
    degradation: createDegradationState(null),
    ...buildAIRunMetadata({
      provider: result.provider,
      model: result.model,
      skillId: input.workflow.skillId,
      promptKey: promptDefinition.key,
      promptVersion: promptDefinition.version,
      usage: result.usage,
    }),
    outputSchema: input.workflow.schemaName,
  };
}
