import { z } from 'zod';
import { generateChatText } from '@/lib/ai/core/generate-chat-text';
import type { AIModelPolicy } from '@/lib/ai/core/model-policy';
import {
  buildEnvironmentEnvvarRiskEvidence,
  type EnvironmentEnvvarRiskEvidence,
} from '@/lib/ai/evidence/environment-envvar-risk';
import {
  buildEnvironmentEvidencePack,
  type EnvironmentEvidencePack,
} from '@/lib/ai/evidence/environment-evidence';
import {
  buildEnvironmentMigrationReviewEvidence,
  type EnvironmentMigrationReviewEvidence,
} from '@/lib/ai/evidence/environment-migration-review';
import {
  buildIncidentEvidencePack,
  type IncidentEvidencePack,
} from '@/lib/ai/evidence/incident-evidence';
import {
  buildReleaseEvidencePack,
  type ReleaseEvidencePack,
} from '@/lib/ai/evidence/release-evidence';

const copilotMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export type CopilotMessage = z.infer<typeof copilotMessageSchema>;

export const copilotRequestSchema = z.object({
  messages: z.array(copilotMessageSchema).min(1).max(12),
});

export interface CopilotReply {
  message: string;
  suggestions: string[];
  provider: string | null;
  model: string | null;
  generatedAt: string;
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

function buildEnvironmentSuggestions(question?: string): string[] {
  const normalized = question?.toLowerCase() ?? '';

  if (normalized.includes('变量') || normalized.includes('env')) {
    return ['哪些变量最值得先检查？', '继承链里哪里最容易出错？', '现在改变量会影响什么？'];
  }

  if (normalized.includes('数据库') || normalized.includes('迁移')) {
    return ['哪个数据库最需要先处理？', '现在适合继续迁移吗？', '先看风险还是先看下一步？'];
  }

  return [
    '当前环境最该先看什么？',
    '这个环境为什么是现在这个状态？',
    '我下一步最合理的动作是什么？',
  ];
}

function buildReleaseSuggestions(question?: string): string[] {
  const normalized = question?.toLowerCase() ?? '';

  if (normalized.includes('失败') || normalized.includes('故障')) {
    return ['最像根因的信号是什么？', '先处理迁移还是先处理部署？', '有没有可以立刻执行的动作？'];
  }

  if (normalized.includes('回滚') || normalized.includes('发布')) {
    return ['现在适合继续推进吗？', '回滚触发条件是什么？', '我应该先确认哪几个检查项？'];
  }

  return ['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该做什么？'];
}

function buildEnvironmentPrompt(input: {
  environment: EnvironmentEvidencePack;
  migration: EnvironmentMigrationReviewEvidence;
  envvar: EnvironmentEnvvarRiskEvidence;
  messages: CopilotMessage[];
}): string {
  return [
    'Current surface: environment detail copilot panel',
    'Rules:',
    '- Project is the entry, environment is the operational center.',
    '- Do not create new product entry points.',
    '- Answer only from provided context.',
    '- Keep the answer clear, concise, and operational.',
    '- Prefer: current state, risks, next step.',
    '- If the user asks outside this environment scope, say so directly.',
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

function buildReleasePrompt(input: {
  release: ReleaseEvidencePack;
  incident: IncidentEvidencePack;
  messages: CopilotMessage[];
}): string {
  return [
    'Current surface: release detail copilot panel',
    'Rules:',
    '- Project is the entry, environment is the operational center, release belongs to environment.',
    '- Do not create duplicate CTA or extra product lanes.',
    '- Answer only from provided context.',
    '- Keep the answer clear, concise, and operational.',
    '- Prefer: current state, risk, blocker, next step.',
    '- If the user asks outside this release scope, say so directly.',
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

export async function generateEnvironmentCopilotReply(input: {
  projectId: string;
  environmentId: string;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotReply> {
  const [environment, migration, envvar] = await Promise.all([
    buildEnvironmentEvidencePack({
      projectId: input.projectId,
      environmentId: input.environmentId,
    }),
    buildEnvironmentMigrationReviewEvidence({
      projectId: input.projectId,
      environmentId: input.environmentId,
    }),
    buildEnvironmentEnvvarRiskEvidence({
      projectId: input.projectId,
      environmentId: input.environmentId,
    }),
  ]);

  const result = await generateChatText({
    policy: input.policy,
    system: [
      '你是 Juanie 的环境 Copilot。',
      '你的任务是解释当前环境，而不是做泛化聊天。',
      '只基于给定上下文作答，不得编造。',
      '回答要少即是多，链路清楚，避免废话。',
      '优先回答当前状态、风险、阻塞、下一步。',
      input.systemAppendix ?? null,
    ].join('\n'),
    prompt: buildEnvironmentPrompt({
      environment,
      migration,
      envvar,
      messages: input.messages,
    }),
  });

  const latestQuestion = input.messages
    .filter((message) => message.role === 'user')
    .at(-1)?.content;

  return {
    message: cleanAssistantText(result.text),
    suggestions: buildEnvironmentSuggestions(latestQuestion),
    provider: result.provider,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateReleaseCopilotReply(input: {
  projectId: string;
  releaseId: string;
  messages: CopilotMessage[];
  policy?: Exclude<AIModelPolicy, 'tool-first'>;
  systemAppendix?: string;
}): Promise<CopilotReply> {
  const [release, incident] = await Promise.all([
    buildReleaseEvidencePack({
      projectId: input.projectId,
      releaseId: input.releaseId,
    }),
    buildIncidentEvidencePack({
      projectId: input.projectId,
      releaseId: input.releaseId,
    }),
  ]);

  const result = await generateChatText({
    policy: input.policy,
    system: [
      '你是 Juanie 的发布 Copilot。',
      '你的任务是解释当前发布、风险、阻塞和下一步。',
      '只基于给定上下文作答，不得编造。',
      '回答要少即是多，结论前置，不要重复页面废话。',
      '优先指出当前是否安全、卡在哪、先做什么。',
      input.systemAppendix ?? null,
    ].join('\n'),
    prompt: buildReleasePrompt({
      release,
      incident,
      messages: input.messages,
    }),
  });

  const latestQuestion = input.messages
    .filter((message) => message.role === 'user')
    .at(-1)?.content;

  return {
    message: cleanAssistantText(result.text),
    suggestions: buildReleaseSuggestions(latestQuestion),
    provider: result.provider,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}
