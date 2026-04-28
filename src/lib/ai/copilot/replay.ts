import { type CopilotScopeKind, getCopilotDefinition } from '@/lib/ai/copilot/registry';
import type {
  CopilotContextCard,
  CopilotReplayPayload,
  CopilotSessionMetadata,
} from '@/lib/ai/copilot/types';

export function buildCopilotContextMarkdown(card: CopilotContextCard): string {
  const sections = [
    `# ${card.scopeLabel} AI 汇总`,
    '',
    `**当前判断**`,
    card.title,
    '',
    card.summary,
  ];

  if (card.risk) {
    sections.push('', `**主要风险**`, card.risk);
  }

  if (card.nextStep) {
    sections.push('', `**下一步**`, card.nextStep);
  }

  if (card.highlights.length > 0) {
    sections.push(
      '',
      '**重点**',
      ...card.highlights.slice(0, 4).map((item, index) => `${index + 1}. ${item}`)
    );
  }

  sections.push('', '可以继续问我原因、风险来源、优先级，或者让我把它拆成具体动作。');

  return sections.join('\n');
}

export function buildCopilotReplayMetadata(input: {
  kind: CopilotScopeKind;
  provider?: string | null;
  model?: string | null;
  suggestions?: string[];
}): CopilotSessionMetadata {
  const definition = getCopilotDefinition(input.kind);

  return {
    conversationId: `replay-${input.kind}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    provider: input.provider ?? '302.ai',
    model: input.model ?? '',
    suggestions: input.suggestions ?? definition.getSuggestions(),
    skillId: definition.skillId,
    promptKey: definition.promptKey,
    promptVersion: 'replay-v1',
    toolCalls: [],
    usage: null,
  };
}

export function buildCopilotReplayPayload(input: {
  kind: CopilotScopeKind;
  contextCard: CopilotContextCard;
  provider?: string | null;
  model?: string | null;
  suggestions?: string[];
}): CopilotReplayPayload {
  return {
    contextCard: input.contextCard,
    messages: [
      {
        role: 'assistant',
        content: buildCopilotContextMarkdown(input.contextCard),
      },
    ],
    metadata: buildCopilotReplayMetadata({
      kind: input.kind,
      provider: input.provider,
      model: input.model,
      suggestions: input.suggestions,
    }),
  };
}
