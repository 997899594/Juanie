import { nanoid } from 'nanoid';
import { z } from 'zod';
import { type CopilotScopeKind, getCopilotDefinition } from '@/lib/ai/copilot/registry';
import type { CopilotSessionMetadata } from '@/lib/ai/copilot/types';
import { generateChatText, generateChatTextStream } from '@/lib/ai/core/generate-chat-text';
import type { AIModelPolicy } from '@/lib/ai/core/model-policy';
import { getPromptDefinition } from '@/lib/ai/prompts/registry';
import {
  type AIRunMetadata,
  type AIUsageSummary,
  buildRequiredAIRunMetadata,
} from '@/lib/ai/run-metadata';
import { withAIToolTrace } from '@/lib/ai/runtime/tool-trace';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';

const copilotMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export type CopilotMessage = z.infer<typeof copilotMessageSchema>;

export const copilotRequestSchema = z.object({
  messages: z.array(copilotMessageSchema).min(1).max(12),
});

export interface CopilotReply extends CopilotSessionMetadata {
  message: string;
}

export interface CopilotStreamReply extends CopilotSessionMetadata {
  stream: ReadableStream<string>;
}

interface BaseCopilotScopeInput {
  teamId: string;
  projectId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
}

interface EnvironmentCopilotScopeInput extends BaseCopilotScopeInput {
  environmentId: string;
}

interface ReleaseCopilotScopeInput extends BaseCopilotScopeInput {
  releaseId: string;
}

function formatConversation(messages: CopilotMessage[]): string {
  return messages
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n');
}

function cleanAssistantText(text: string): string {
  return text.trim().replace(/\n{3,}/g, '\n\n');
}

function appendSystemPrompt(baseSystem: string, systemAppendix?: string): string {
  if (!systemAppendix?.trim()) {
    return baseSystem;
  }

  return `${baseSystem}\n${systemAppendix.trim()}`;
}

async function buildEnvironmentCopilotEvidence(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
}) {
  const sharedContext = {
    actorUserId: input.actorUserId,
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
  };

  const [environment, migration, envvar] = await Promise.all([
    executeJuanieTool({
      toolId: 'read-environment-context',
      context: {
        ...sharedContext,
        reason: '读取环境总览、访问地址、最新版本和治理状态',
      },
    }),
    executeJuanieTool({
      toolId: 'read-environment-migrations',
      context: {
        ...sharedContext,
        reason: '读取迁移状态、审批阻塞和失败信号',
      },
    }),
    executeJuanieTool({
      toolId: 'read-environment-variables',
      context: {
        ...sharedContext,
        reason: '读取变量继承、缺失和风险摘要',
      },
    }),
  ]);

  return {
    environment,
    migration,
    envvar,
  };
}

async function buildReleaseCopilotEvidence(input: {
  teamId: string;
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
}) {
  const sharedContext = {
    actorUserId: input.actorUserId,
    teamId: input.teamId,
    projectId: input.projectId,
    releaseId: input.releaseId,
  };

  const [release, incident] = await Promise.all([
    executeJuanieTool({
      toolId: 'read-release-context',
      context: {
        ...sharedContext,
        reason: '读取发布版本、产物和当前交付状态',
      },
    }),
    executeJuanieTool({
      toolId: 'read-incident-context',
      context: {
        ...sharedContext,
        reason: '读取异常信号、失败上下文和风险线索',
      },
    }),
  ]);

  return {
    release,
    incident,
  };
}

type EnvironmentCopilotEvidence = Awaited<ReturnType<typeof buildEnvironmentCopilotEvidence>>;
type ReleaseCopilotEvidence = Awaited<ReturnType<typeof buildReleaseCopilotEvidence>>;

interface CopilotScopeDescriptor<
  TScopeInput extends BaseCopilotScopeInput,
  TEvidence,
  TIdentityKey extends 'environmentId' | 'releaseId',
> {
  identityKey: TIdentityKey;
  buildEvidence: (input: TScopeInput) => Promise<TEvidence>;
  buildPrompt: (input: TEvidence & { messages: CopilotMessage[] }) => string;
}

const copilotScopeDescriptors = {
  environment: {
    identityKey: 'environmentId',
    buildEvidence: buildEnvironmentCopilotEvidence,
    buildPrompt: buildEnvironmentCopilotPrompt,
  },
  release: {
    identityKey: 'releaseId',
    buildEvidence: buildReleaseCopilotEvidence,
    buildPrompt: buildReleaseCopilotPrompt,
  },
} satisfies {
  environment: CopilotScopeDescriptor<
    EnvironmentCopilotScopeInput,
    EnvironmentCopilotEvidence,
    'environmentId'
  >;
  release: CopilotScopeDescriptor<ReleaseCopilotScopeInput, ReleaseCopilotEvidence, 'releaseId'>;
};

async function buildCopilotPrompt(input: {
  kind: CopilotScopeKind;
  teamId: string;
  projectId: string;
  environmentId?: string;
  releaseId?: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
}): Promise<string> {
  if (input.kind === 'environment') {
    const scopeInput: EnvironmentCopilotScopeInput = {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId ?? '',
      actorUserId: input.actorUserId,
      messages: input.messages,
    };
    const descriptor = copilotScopeDescriptors.environment;
    const evidence = await descriptor.buildEvidence(scopeInput);

    return descriptor.buildPrompt({
      ...evidence,
      messages: scopeInput.messages,
    });
  }

  const scopeInput: ReleaseCopilotScopeInput = {
    teamId: input.teamId,
    projectId: input.projectId,
    releaseId: input.releaseId ?? '',
    actorUserId: input.actorUserId,
    messages: input.messages,
  };
  const descriptor = copilotScopeDescriptors.release;
  const evidence = await descriptor.buildEvidence(scopeInput);

  return descriptor.buildPrompt({
    ...evidence,
    messages: scopeInput.messages,
  });
}

function buildEnvironmentCopilotPrompt(input: {
  environment: Awaited<ReturnType<typeof buildEnvironmentCopilotEvidence>>['environment'];
  migration: Awaited<ReturnType<typeof buildEnvironmentCopilotEvidence>>['migration'];
  envvar: Awaited<ReturnType<typeof buildEnvironmentCopilotEvidence>>['envvar'];
  messages: CopilotMessage[];
}): string {
  return [
    'Current surface: environment detail copilot panel',
    'Rules:',
    '- Project is the entry, environment is the operational center.',
    '- Do not create new product entry points.',
    '- Prefer: current state, risks, next step.',
    '',
    'Environment context:',
    JSON.stringify(input.environment),
    '',
    'Migration context:',
    JSON.stringify(input.migration),
    '',
    'Env var context:',
    JSON.stringify(input.envvar),
    '',
    'Conversation:',
    formatConversation(input.messages),
  ].join('\n');
}

function getLatestQuestion(messages: CopilotMessage[]): string | undefined {
  return messages.filter((message) => message.role === 'user').at(-1)?.content;
}

function buildCopilotSessionMetadata(input: {
  conversationId: string;
  generatedAt: string;
  suggestions: string[];
  provider: AIRunMetadata['provider'];
  model: AIRunMetadata['model'];
  skillId: string;
  promptKey: string;
  promptVersion: string;
  toolCalls: NonNullable<AIRunMetadata['toolCalls']>;
  usage?: AIUsageSummary | null;
}): CopilotSessionMetadata {
  return {
    conversationId: input.conversationId,
    generatedAt: input.generatedAt,
    suggestions: input.suggestions,
    ...buildRequiredAIRunMetadata({
      provider: input.provider,
      model: input.model,
      skillId: input.skillId,
      promptKey: input.promptKey,
      promptVersion: input.promptVersion,
      toolCalls: input.toolCalls,
      usage: input.usage,
    }),
  };
}

function buildCopilotSessionBase(input: {
  definition: ReturnType<typeof getCopilotDefinition>;
  promptDefinition: ReturnType<typeof getPromptDefinition>;
  messages: CopilotMessage[];
  provider: AIRunMetadata['provider'];
  model: AIRunMetadata['model'];
  toolCalls: NonNullable<AIRunMetadata['toolCalls']>;
  usage?: AIUsageSummary | null;
}): CopilotSessionMetadata {
  return buildCopilotSessionMetadata({
    conversationId: nanoid(),
    generatedAt: new Date().toISOString(),
    suggestions: input.definition.getSuggestions(getLatestQuestion(input.messages)),
    provider: input.provider,
    model: input.model,
    skillId: input.definition.skillId,
    promptKey: input.promptDefinition.key,
    promptVersion: input.promptDefinition.version,
    toolCalls: input.toolCalls,
    usage: input.usage,
  });
}

function buildReleaseCopilotPrompt(input: {
  release: Awaited<ReturnType<typeof buildReleaseCopilotEvidence>>['release'];
  incident: Awaited<ReturnType<typeof buildReleaseCopilotEvidence>>['incident'];
  messages: CopilotMessage[];
}): string {
  return [
    'Current surface: release detail copilot panel',
    'Rules:',
    '- Project is the entry, environment is the operational center, release belongs to environment.',
    '- Do not create duplicate CTA or extra product lanes.',
    '- Prefer: current state, risk, blocker, next step.',
    '',
    'Release context:',
    JSON.stringify(input.release),
    '',
    'Incident context:',
    JSON.stringify(input.incident),
    '',
    'Conversation:',
    formatConversation(input.messages),
  ].join('\n');
}

async function generateCopilotReply(input: {
  kind: CopilotScopeKind;
  teamId: string;
  projectId: string;
  environmentId?: string;
  releaseId?: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotReply> {
  const definition = getCopilotDefinition(input.kind);
  const promptDefinition = getPromptDefinition(definition.promptKey);

  const traced = await withAIToolTrace(async () => {
    const prompt = await buildCopilotPrompt({
      kind: input.kind,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      releaseId: input.releaseId,
      actorUserId: input.actorUserId,
      messages: input.messages,
    });

    return generateChatText({
      policy: input.policy,
      system: appendSystemPrompt(promptDefinition.system, input.systemAppendix),
      prompt,
    });
  });
  const result = traced.result;
  const session = buildCopilotSessionBase({
    definition,
    promptDefinition,
    messages: input.messages,
    provider: result.provider,
    model: result.model,
    toolCalls: traced.calls,
    usage: result.usage,
  });

  return {
    ...session,
    message: cleanAssistantText(result.text),
  };
}

async function generateCopilotStream(input: {
  kind: CopilotScopeKind;
  teamId: string;
  projectId: string;
  environmentId?: string;
  releaseId?: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotStreamReply> {
  const definition = getCopilotDefinition(input.kind);
  const promptDefinition = getPromptDefinition(definition.promptKey);

  const traced = await withAIToolTrace(async () => {
    const prompt = await buildCopilotPrompt({
      kind: input.kind,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      releaseId: input.releaseId,
      actorUserId: input.actorUserId,
      messages: input.messages,
    });

    return generateChatTextStream({
      policy: input.policy,
      system: appendSystemPrompt(promptDefinition.system, input.systemAppendix),
      prompt,
    });
  });
  const result = traced.result;
  const session = buildCopilotSessionBase({
    definition,
    promptDefinition,
    messages: input.messages,
    provider: result.provider,
    model: result.model,
    toolCalls: traced.calls,
  });

  return {
    ...session,
    ...result,
  };
}

function toEnvironmentCopilotGenerationInput(
  input: EnvironmentCopilotScopeInput & {
    policy?: Exclude<AIModelPolicy, 'tool-first'>;
    systemAppendix?: string;
  }
): {
  kind: 'environment';
  teamId: string;
  projectId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  environmentId?: string;
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
} {
  return {
    kind: 'environment',
    teamId: input.teamId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    environmentId: input.environmentId,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  };
}

function toReleaseCopilotGenerationInput(
  input: ReleaseCopilotScopeInput & {
    policy?: Exclude<AIModelPolicy, 'tool-first'>;
    systemAppendix?: string;
  }
): {
  kind: 'release';
  teamId: string;
  projectId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  releaseId?: string;
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
} {
  return {
    kind: 'release',
    teamId: input.teamId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    releaseId: input.releaseId,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  };
}

type EnvironmentCopilotGenerateInput = {
  teamId: string;
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
};

type ReleaseCopilotGenerateInput = {
  teamId: string;
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
};

export async function generateEnvironmentCopilotReply(
  input: EnvironmentCopilotGenerateInput
): Promise<CopilotReply> {
  return generateCopilotReply(toEnvironmentCopilotGenerationInput(input));
}

export async function generateReleaseCopilotReply(
  input: ReleaseCopilotGenerateInput
): Promise<CopilotReply> {
  return generateCopilotReply(toReleaseCopilotGenerationInput(input));
}

export async function generateEnvironmentCopilotStream(
  input: EnvironmentCopilotGenerateInput
): Promise<CopilotStreamReply> {
  return generateCopilotStream(toEnvironmentCopilotGenerationInput(input));
}

export async function generateReleaseCopilotStream(
  input: ReleaseCopilotGenerateInput
): Promise<CopilotStreamReply> {
  return generateCopilotStream(toReleaseCopilotGenerationInput(input));
}
