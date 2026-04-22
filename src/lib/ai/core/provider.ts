import { getAIProvider } from '@/lib/ai/provider';

export type AIModelType = 'chat' | 'toolCalling' | 'pro' | 'json';

export const aiProvider = getAIProvider();
