import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { extractJsonMiddleware, extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import { aiConfig, isAIConfigured, isAIEnabled } from '@/lib/ai/config';
import type {
  JuanieAIModelType,
  JuanieAIProviderAdapter,
  JuanieAIProviderStatus,
} from '@/lib/ai/provider/adapter';

type LanguageModelType = Exclude<JuanieAIModelType, 'json'>;

export class Provider302Adapter implements JuanieAIProviderAdapter {
  private readonly client = createOpenAI({
    baseURL: aiConfig.provider.baseUrl,
    apiKey: aiConfig.provider.apiKey ?? undefined,
  });

  isConfigured(): boolean {
    return isAIConfigured(aiConfig);
  }

  isEnabled(): boolean {
    return isAIEnabled(aiConfig);
  }

  getStatus(): JuanieAIProviderStatus {
    return {
      provider: aiConfig.provider.label,
      configured: this.isConfigured(),
      enabled: this.isEnabled(),
      models: {
        chat: this.getModelName('chat'),
        toolCalling: this.getModelName('toolCalling'),
        pro: this.getModelName('pro'),
        json: this.getModelName('json'),
      },
    };
  }

  private getPlainModel(modelType: LanguageModelType = 'chat'): LanguageModelV3 {
    return this.client.chat(this.getModelName(modelType));
  }

  getReasoningModel(modelType: LanguageModelType = 'chat'): LanguageModelV3 {
    return wrapLanguageModel({
      model: this.getPlainModel(modelType),
      middleware: [
        extractReasoningMiddleware({
          tagName: 'thinking',
          separator: '\n\n---\n\n',
        }),
      ],
    });
  }

  getToolCallingModel(modelType: LanguageModelType = 'chat'): LanguageModelV3 {
    const targetType = modelType === 'chat' ? 'toolCalling' : modelType;
    return this.getPlainModel(targetType);
  }

  getJsonModel(modelType: LanguageModelType = 'chat'): LanguageModelV3 {
    const targetType = modelType === 'chat' ? 'json' : modelType;

    return wrapLanguageModel({
      model: this.client.chat(this.getModelName(targetType)),
      middleware: [extractJsonMiddleware()],
    });
  }

  getModelName(modelType: JuanieAIModelType = 'chat'): string {
    return aiConfig.models[modelType];
  }

  getProviderLabel(): string {
    return aiConfig.provider.label;
  }
}
