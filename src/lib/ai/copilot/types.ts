import type { AIRunMetadata, AIUsageSummary } from '@/lib/ai/run-metadata';

export interface CopilotSessionMetadata
  extends Required<
    Pick<
      AIRunMetadata,
      'provider' | 'model' | 'skillId' | 'promptKey' | 'promptVersion' | 'toolCalls'
    >
  > {
  conversationId: string;
  generatedAt: string;
  suggestions: string[];
  usage: AIUsageSummary | null;
}

export interface CopilotReplayMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotContextCard {
  scopeLabel: string;
  title: string;
  summary: string;
  risk: string | null;
  nextStep: string | null;
  highlights: string[];
}

export interface CopilotReplayPayload {
  messages?: CopilotReplayMessageInput[];
  metadata?: CopilotSessionMetadata | null;
  contextCard?: CopilotContextCard | null;
}
