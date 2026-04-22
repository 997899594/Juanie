import { AsyncLocalStorage } from 'node:async_hooks';
import type { AIPluginPermissionLevel, AIPluginScope } from '@/lib/ai/runtime/types';

export interface AIToolTraceEntry {
  toolId: string;
  scope: Exclude<AIPluginScope, 'global'>;
  riskLevel: AIPluginPermissionLevel;
  reason: string | null;
}

interface AIToolTraceState {
  calls: AIToolTraceEntry[];
}

const toolTraceStorage = new AsyncLocalStorage<AIToolTraceState>();

export async function withAIToolTrace<T>(
  fn: () => Promise<T>
): Promise<{ result: T; calls: AIToolTraceEntry[] }> {
  const state: AIToolTraceState = {
    calls: [],
  };
  const result = await toolTraceStorage.run(state, fn);

  return {
    result,
    calls: [...state.calls],
  };
}

export function recordAIToolTrace(entry: AIToolTraceEntry): void {
  const state = toolTraceStorage.getStore();
  if (!state) {
    return;
  }

  state.calls.push(entry);
}
