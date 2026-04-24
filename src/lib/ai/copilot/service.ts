import { nanoid } from 'nanoid';
import { z } from 'zod';
import { type CopilotScopeKind, getCopilotDefinition } from '@/lib/ai/copilot/registry';
import type { CopilotSessionMetadata } from '@/lib/ai/copilot/types';
import { generateChatText, generateChatTextStream } from '@/lib/ai/core/generate-chat-text';
import type { AIModelPolicy } from '@/lib/ai/core/model-policy';
import { getPromptDefinition } from '@/lib/ai/prompts/registry';
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
  const conversationId = nanoid();
  const generatedAt = new Date().toISOString();
  const latestQuestion = input.messages
    .filter((message) => message.role === 'user')
    .at(-1)?.content;

  const traced = await withAIToolTrace(async () => {
    const prompt =
      input.kind === 'environment'
        ? buildEnvironmentCopilotPrompt({
            ...(await buildEnvironmentCopilotEvidence({
              teamId: input.teamId,
              projectId: input.projectId,
              environmentId: input.environmentId ?? '',
              actorUserId: input.actorUserId,
            })),
            messages: input.messages,
          })
        : buildReleaseCopilotPrompt({
            ...(await buildReleaseCopilotEvidence({
              teamId: input.teamId,
              projectId: input.projectId,
              releaseId: input.releaseId ?? '',
              actorUserId: input.actorUserId,
            })),
            messages: input.messages,
          });

    return generateChatText({
      policy: input.policy,
      system: appendSystemPrompt(promptDefinition.system, input.systemAppendix),
      prompt,
    });
  });
  const result = traced.result;

  return {
    conversationId,
    message: cleanAssistantText(result.text),
    suggestions: definition.getSuggestions(latestQuestion),
    provider: result.provider,
    model: result.model,
    generatedAt,
    skillId: definition.skillId,
    promptKey: promptDefinition.key,
    promptVersion: promptDefinition.version,
    toolCalls: traced.calls,
    usage: result.usage,
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
  const conversationId = nanoid();
  const generatedAt = new Date().toISOString();
  const latestQuestion = input.messages
    .filter((message) => message.role === 'user')
    .at(-1)?.content;

  const traced = await withAIToolTrace(async () => {
    const prompt =
      input.kind === 'environment'
        ? buildEnvironmentCopilotPrompt({
            ...(await buildEnvironmentCopilotEvidence({
              teamId: input.teamId,
              projectId: input.projectId,
              environmentId: input.environmentId ?? '',
              actorUserId: input.actorUserId,
            })),
            messages: input.messages,
          })
        : buildReleaseCopilotPrompt({
            ...(await buildReleaseCopilotEvidence({
              teamId: input.teamId,
              projectId: input.projectId,
              releaseId: input.releaseId ?? '',
              actorUserId: input.actorUserId,
            })),
            messages: input.messages,
          });

    return generateChatTextStream({
      policy: input.policy,
      system: appendSystemPrompt(promptDefinition.system, input.systemAppendix),
      prompt,
    });
  });
  const result = traced.result;

  return {
    conversationId,
    generatedAt,
    ...result,
    suggestions: definition.getSuggestions(latestQuestion),
    skillId: definition.skillId,
    promptKey: promptDefinition.key,
    promptVersion: promptDefinition.version,
    toolCalls: traced.calls,
    usage: null,
  };
}

export async function generateEnvironmentCopilotReply(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotReply> {
  return generateCopilotReply({
    kind: 'environment',
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  });
}

export async function generateReleaseCopilotReply(input: {
  teamId: string;
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotReply> {
  return generateCopilotReply({
    kind: 'release',
    teamId: input.teamId,
    projectId: input.projectId,
    releaseId: input.releaseId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  });
}

export async function generateEnvironmentCopilotStream(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotStreamReply> {
  return generateCopilotStream({
    kind: 'environment',
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  });
}

export async function generateReleaseCopilotStream(input: {
  teamId: string;
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotStreamReply> {
  return generateCopilotStream({
    kind: 'release',
    teamId: input.teamId,
    projectId: input.projectId,
    releaseId: input.releaseId,
    actorUserId: input.actorUserId,
    messages: input.messages,
    policy: input.policy,
    systemAppendix: input.systemAppendix,
  });
}
