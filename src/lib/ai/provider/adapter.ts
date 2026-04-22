import type { LanguageModelV3 } from '@ai-sdk/provider';

export type JuanieAIModelType = 'chat' | 'toolCalling' | 'pro' | 'json';

export interface JuanieAIProviderStatus {
  provider: string;
  configured: boolean;
  enabled: boolean;
  models: Record<JuanieAIModelType, string>;
}

export interface JuanieAIProviderAdapter {
  isConfigured(): boolean;
  isEnabled(): boolean;
  getStatus(): JuanieAIProviderStatus;
  getReasoningModel(modelType?: Exclude<JuanieAIModelType, 'json'>): LanguageModelV3;
  getToolCallingModel(modelType?: Exclude<JuanieAIModelType, 'json'>): LanguageModelV3;
  getJsonModel(modelType?: Exclude<JuanieAIModelType, 'json'>): LanguageModelV3;
  getModelName(modelType?: JuanieAIModelType): string;
  getProviderLabel(): string;
}
