import type { infer as Infer, ZodTypeAny } from 'zod';
import { createDegradationState } from '@/lib/ai/core/degradation';
import { generateStructuredObject } from '@/lib/ai/core/generate-structured';
import { getPromptDefinition, type JuaniePromptKey } from '@/lib/ai/prompts/registry';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';

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
  promptKey: JuaniePromptKey;
  skillId: string | null;
  schema: TSchema;
  schemaName: string;
  description: string;
  evidence: TEvidence;
  buildPrompt(evidence: TEvidence): string;
  runtime?: StructuredWorkflowRuntime;
}): Promise<AIPluginRunEnvelope<Infer<TSchema>>> {
  const promptDefinition = getPromptDefinition(input.promptKey);
  const runtime = input.runtime ?? defaultStructuredWorkflowRuntime;
  const result = await runtime.generateObject({
    schema: input.schema,
    schemaName: input.schemaName,
    description: input.description,
    system: promptDefinition.system,
    prompt: input.buildPrompt(input.evidence),
  });

  return {
    output: result.object,
    provider: result.provider,
    model: result.model,
    degradation: createDegradationState(null),
    skillId: input.skillId,
    promptKey: promptDefinition.key,
    promptVersion: promptDefinition.version,
    outputSchema: input.schemaName,
    usage: result.usage,
  };
}
