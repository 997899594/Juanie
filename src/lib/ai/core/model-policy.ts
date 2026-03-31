import { type AIModelType, aiProvider } from '@/lib/ai/core/provider';

export type AIModelPolicy = 'interactive-fast' | 'structured-high-quality' | 'tool-first';

const POLICY_TO_MODEL: Record<AIModelPolicy, AIModelType> = {
  'interactive-fast': 'chat',
  'structured-high-quality': 'pro',
  'tool-first': 'toolCalling',
};

export function getModelNameForPolicy(policy: AIModelPolicy): string {
  return aiProvider.getModelName(POLICY_TO_MODEL[policy]);
}

export function getProviderLabelForPolicy(): string {
  return aiProvider.getProviderLabel();
}

export function getReasoningModelForPolicy(policy: Exclude<AIModelPolicy, 'tool-first'>) {
  return aiProvider.getReasoningModel(POLICY_TO_MODEL[policy] as 'chat' | 'pro');
}

export function getToolCallingModelForPolicy() {
  return aiProvider.getToolCallingModel('toolCalling');
}

export function getJsonModelForPolicy(policy: Exclude<AIModelPolicy, 'tool-first'>) {
  return aiProvider.getJsonModel(POLICY_TO_MODEL[policy] as 'chat' | 'pro');
}
