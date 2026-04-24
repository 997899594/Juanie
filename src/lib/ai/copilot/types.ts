import type { AIToolTraceEntry } from '@/lib/ai/runtime/tool-trace';

export interface CopilotUsageSummary {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface CopilotSessionMetadata {
  conversationId: string;
  generatedAt: string;
  provider: string;
  model: string;
  suggestions: string[];
  skillId: string;
  promptKey: string;
  promptVersion: string;
  toolCalls: AIToolTraceEntry[];
  usage: CopilotUsageSummary | null;
}

export interface CopilotReplayMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotReplayPayload {
  messages?: CopilotReplayMessageInput[];
  metadata?: CopilotSessionMetadata | null;
}
