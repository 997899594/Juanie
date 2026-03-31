import { createOpenAI } from '@ai-sdk/openai';
import { extractJsonMiddleware, extractReasoningMiddleware, wrapLanguageModel } from 'ai';

export type AIModelType = 'chat' | 'toolCalling' | 'pro' | 'json';

type LanguageModelType = Exclude<AIModelType, 'json'>;

function getBaseUrl(): string {
  return process.env.AI_302_BASE_URL?.trim() || 'https://api.302.ai/v1';
}

function getModelId(modelType: AIModelType): string {
  if (modelType === 'pro') {
    return process.env.AI_MODEL_PRO?.trim() || process.env.AI_MODEL?.trim() || 'gemini-2.5-pro';
  }

  if (modelType === 'toolCalling') {
    return process.env.AI_MODEL_TOOL?.trim() || process.env.AI_MODEL?.trim() || 'gemini-2.5-flash';
  }

  return process.env.AI_MODEL?.trim() || 'gemini-2.5-flash';
}

class JuanieAIProvider {
  private static instance: JuanieAIProvider | null = null;
  private readonly label = '302.ai';
  private readonly client = createOpenAI({
    baseURL: getBaseUrl(),
    apiKey: process.env.AI_302_API_KEY,
  });

  static getInstance(): JuanieAIProvider {
    if (!JuanieAIProvider.instance) {
      JuanieAIProvider.instance = new JuanieAIProvider();
    }

    return JuanieAIProvider.instance;
  }

  isEnabled(): boolean {
    return process.env.AI_ENABLED === 'true' && this.isConfigured();
  }

  isConfigured(): boolean {
    return Boolean(process.env.AI_302_API_KEY?.trim());
  }

  getStatus() {
    return {
      provider: this.label,
      configured: this.isConfigured(),
      enabled: this.isEnabled(),
      models: {
        chat: getModelId('chat'),
        toolCalling: getModelId('toolCalling'),
        pro: getModelId('pro'),
        json: getModelId('json'),
      },
    };
  }

  private getPlainModel(modelType: LanguageModelType = 'chat') {
    return this.client.chat(getModelId(modelType));
  }

  getReasoningModel(modelType: LanguageModelType = 'chat') {
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

  getToolCallingModel(modelType: LanguageModelType = 'chat') {
    const targetType = modelType === 'chat' ? 'toolCalling' : modelType;
    return this.getPlainModel(targetType);
  }

  getJsonModel(modelType: LanguageModelType = 'chat') {
    const targetType = modelType === 'chat' ? 'json' : modelType;

    return wrapLanguageModel({
      model: this.client.chat(getModelId(targetType)),
      middleware: [extractJsonMiddleware()],
    });
  }

  getModelName(modelType: AIModelType = 'chat'): string {
    return getModelId(modelType);
  }

  getProviderLabel(): string {
    return this.label;
  }
}

export const aiProvider = JuanieAIProvider.getInstance();
