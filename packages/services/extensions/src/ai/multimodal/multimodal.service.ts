import type { AIClientConfig, AIProvider } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { generateText } from 'ai'
import { AIClientFactory } from '../ai/ai-client-factory'

/**
 * 图片输入类型
 */
export interface ImageInput {
  /** 图片 URL 或 base64 编码 */
  url?: string
  /** base64 编码的图片数据 */
  base64?: string
  /** 图片 MIME 类型 */
  mimeType?: string
  /** 图片描述（可选） */
  description?: string
}

/**
 * 多模态输入
 */
export interface MultimodalInput {
  /** 文本内容 */
  text: string
  /** 图片列表 */
  images?: ImageInput[]
  /** 系统提示（可选） */
  systemPrompt?: string
}

/**
 * 多模态响应
 */
export interface MultimodalResponse {
  /** 生成的文本 */
  content: string
  /** 使用的模型 */
  model: string
  /** Token 使用情况 */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * 支持的多模态模型
 *
 * 推荐模型（2025年最新）:
 * - glm-4.6: 智谱最新多模态，中文优化，支持深度思考
 * - gpt-4o: OpenAI最新多模态，性能卓越
 * - claude-3-5-sonnet-20241022: Anthropic最强多模态
 * - gemini-2.0-flash-exp: Google免费实验版
 */
export const MULTIMODAL_MODELS = {
  // 智谱 GLM-4.6 系列（2025年最新，官方推荐）
  'glm-4.6': 'zhipu', // 最新旗舰多模态，支持深度思考，中文优化
  'glm-4v-plus': 'zhipu', // 增强版本，中文图片理解优秀
  'glm-4v-flash': 'zhipu', // 快速版本，性价比高

  // OpenAI GPT-4o 系列（2024年最新）
  'gpt-4o': 'openai', // 最新多模态，速度快，能力强
  'gpt-4o-mini': 'openai', // 性价比最高，推荐日常使用

  // Claude 3.5 系列（2024年10月）
  'claude-3-5-sonnet-20241022': 'anthropic', // 最强多模态，图片理解最佳
  'claude-3-5-haiku-20241022': 'anthropic', // 最快最便宜，性价比极高

  // Google Gemini 系列（2024年12月）
  'gemini-2.0-flash-exp': 'google', // 最新实验版本，免费使用
  'gemini-1.5-pro': 'google', // 稳定版本，长上下文
  'gemini-1.5-flash': 'google', // 快速版本，性价比高

  // 阿里 Qwen2-VL（2024年）
  'qwen2-vl-72b': 'qwen', // 最强版本，中文图片理解优秀
  'qwen2-vl-7b': 'qwen', // 性价比版本，适合大规模使用
} as const

/**
 * 多模态服务
 *
 * 提供图片分析和图文混合输入处理能力
 *
 * 功能:
 * - 图片上传和处理
 * - 图文混合输入
 * - 多模态模型集成
 * - 架构图分析
 * - UI 设计分析
 * - 错误截图分析
 *
 * 支持的模型:
 * - Claude 3 系列
 * - GPT-4 Vision
 * - GLM-4V
 * - QwenVL
 */
@Injectable()
export class MultimodalService {
  constructor(private readonly clientFactory: AIClientFactory) {}

  /**
   * 分析图片
   *
   * @param image - 图片输入
   * @param prompt - 分析提示词
   * @param model - 使用的模型（默认: glm-4.6）
   * @returns 分析结果
   */
  async analyzeImage(
    image: ImageInput,
    prompt: string,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    return this.processMultimodal(
      {
        text: prompt,
        images: [image],
      },
      model,
    )
  }

  /**
   * 处理图文混合输入
   *
   * @param input - 多模态输入
   * @param model - 使用的模型（默认: glm-4.6）
   * @returns 处理结果
   */
  async processMultimodal(
    input: MultimodalInput,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    // 验证模型支持
    if (!MULTIMODAL_MODELS[model]) {
      throw ErrorFactory.ai.inferenceFailed(`Model ${model} does not support multimodal input`)
    }

    const provider = MULTIMODAL_MODELS[model] as AIProvider

    // 创建客户端配置
    const config: AIClientConfig = {
      provider,
      model: model as any, // 类型断言，因为 MULTIMODAL_MODELS 的键是 AIModel 的子集
    }

    // 获取适配器
    const client = this.clientFactory.createClient(config)

    // 构建消息内容
    const content = await this.buildMultimodalContent(input)

    try {
      // 使用 Vercel AI SDK 的 generateText
      // 注意: 这里直接使用底层 SDK，因为我们需要支持图片
      const messages: any[] = []

      if (input.systemPrompt) {
        messages.push({ role: 'system', content: input.systemPrompt })
      }

      messages.push({
        role: 'user',
        content,
      })

      const result = await generateText({
        model: (client as any).model || (client as any).getModel(),
        messages,
      })

      return {
        content: result.text,
        model,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Multimodal processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 分析架构图
   *
   * @param image - 架构图图片
   * @param model - 使用的模型
   * @returns 架构分析结果
   */
  async analyzeArchitectureDiagram(
    image: ImageInput,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    const prompt = `请分析这个架构图，并提供以下信息：

1. 系统组件和服务
2. 组件之间的关系和数据流
3. 使用的技术栈
4. 潜在的架构问题或改进建议
5. 如果可能，生成对应的代码或配置

请用清晰的结构化格式输出。`

    return this.analyzeImage(image, prompt, model)
  }

  /**
   * 分析 UI 设计
   *
   * @param image - UI 设计图片
   * @param model - 使用的模型
   * @returns UI 分析结果
   */
  async analyzeUIDesign(
    image: ImageInput,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    const prompt = `请分析这个 UI 设计，并提供以下信息：

1. UI 组件和布局结构
2. 颜色方案和设计风格
3. 交互元素和用户流程
4. 可访问性考虑
5. 生成对应的前端代码（HTML/CSS/Vue/React）

请用清晰的结构化格式输出。`

    return this.analyzeImage(image, prompt, model)
  }

  /**
   * 分析错误截图
   *
   * @param image - 错误截图
   * @param additionalContext - 额外上下文信息
   * @param model - 使用的模型
   * @returns 错误分析结果
   */
  async analyzeErrorScreenshot(
    image: ImageInput,
    additionalContext?: string,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    let prompt = `请分析这个错误截图，并提供以下信息：

1. 错误类型和严重程度
2. 可能的根本原因
3. 详细的修复步骤
4. 预防措施
5. 相关的代码示例或配置修改

请用清晰的结构化格式输出。`

    if (additionalContext) {
      prompt += `\n\n额外上下文信息：\n${additionalContext}`
    }

    return this.analyzeImage(image, prompt, model)
  }

  /**
   * 从图片生成代码
   *
   * @param image - 设计图或架构图
   * @param codeType - 代码类型（component/config/architecture）
   * @param framework - 目标框架（可选）
   * @param model - 使用的模型
   * @returns 生成的代码
   */
  async generateCodeFromImage(
    image: ImageInput,
    codeType: 'component' | 'config' | 'architecture',
    framework?: string,
    model: keyof typeof MULTIMODAL_MODELS = 'glm-4.6',
  ): Promise<MultimodalResponse> {
    let prompt = ''

    switch (codeType) {
      case 'component':
        prompt = `请根据这个设计图生成对应的前端组件代码。`
        if (framework) {
          prompt += `\n使用 ${framework} 框架。`
        }
        prompt += `\n\n要求：
1. 完整的组件代码
2. 样式代码（CSS/Tailwind）
3. 必要的类型定义
4. 响应式设计
5. 可访问性支持`
        break

      case 'config':
        prompt = `请根据这个配置图生成对应的配置文件。

要求：
1. 完整的配置代码
2. 必要的注释说明
3. 最佳实践
4. 安全考虑`
        break

      case 'architecture':
        prompt = `请根据这个架构图生成对应的代码结构和配置。

要求：
1. 项目结构
2. 核心代码文件
3. 配置文件
4. 部署配置
5. 文档说明`
        break
    }

    return this.analyzeImage(image, prompt, model)
  }

  /**
   * 构建多模态内容
   *
   * @param input - 多模态输入
   * @returns Vercel AI SDK 兼容的内容格式
   */
  private async buildMultimodalContent(
    input: MultimodalInput,
  ): Promise<Array<{ type: string; text?: string; image?: string }>> {
    const content: Array<{ type: string; text?: string; image?: string }> = []

    // 添加文本
    if (input.text) {
      content.push({
        type: 'text',
        text: input.text,
      })
    }

    // 添加图片
    if (input.images && input.images.length > 0) {
      for (const image of input.images) {
        const imageUrl = await this.processImage(image)
        content.push({
          type: 'image',
          image: imageUrl,
        })
      }
    }

    return content
  }

  /**
   * 处理图片输入
   *
   * @param image - 图片输入
   * @returns 处理后的图片 URL 或 base64
   */
  private async processImage(image: ImageInput): Promise<string> {
    // 如果已经是 URL，直接返回
    if (image.url) {
      return image.url
    }

    // 如果是 base64，格式化为 data URL
    if (image.base64) {
      const mimeType = image.mimeType || 'image/png'
      return `data:${mimeType};base64,${image.base64}`
    }

    throw ErrorFactory.ai.inferenceFailed('Image must have either url or base64 data')
  }

  /**
   * 验证图片格式
   *
   * @param image - 图片输入
   * @returns 是否有效
   */
  validateImage(image: ImageInput): boolean {
    // 必须有 URL 或 base64
    if (!image.url && !image.base64) {
      return false
    }

    // 如果有 base64，验证格式
    if (image.base64) {
      // 简单验证 base64 格式
      const base64Regex = /^[A-Za-z0-9+/]+=*$/
      if (!base64Regex.test(image.base64)) {
        return false
      }
    }

    // 如果有 URL，验证格式
    if (image.url) {
      try {
        new URL(image.url)
      } catch {
        return false
      }
    }

    return true
  }

  /**
   * 获取支持的模型列表
   *
   * @returns 支持的多模态模型列表
   */
  getSupportedModels(): Array<{
    model: string
    provider: string
    description: string
    pricing?: string
    recommended?: boolean
  }> {
    return [
      // 智谱 GLM-4.6 系列（2025年最新，强烈推荐）
      {
        model: 'glm-4.6',
        provider: 'zhipu',
        description: 'GLM-4.6 - 智谱最新旗舰多模态，支持深度思考，中文优化，官方推荐',
        pricing: '¥0.05/千tokens',
        recommended: true,
      },
      {
        model: 'glm-4v-plus',
        provider: 'zhipu',
        description: 'GLM-4V Plus - 增强版本，中文图片理解优秀',
        pricing: '¥0.05/千tokens',
        recommended: true,
      },
      {
        model: 'glm-4v-flash',
        provider: 'zhipu',
        description: 'GLM-4V Flash - 快速版本，性价比高',
        pricing: '¥0.01/千tokens',
        recommended: true,
      },

      // OpenAI GPT-4o 系列（推荐）
      {
        model: 'gpt-4o',
        provider: 'openai',
        description: 'GPT-4o - 最新多模态，速度快，能力强',
        pricing: '$2.50/$10 per 1M tokens',
        recommended: true,
      },
      {
        model: 'gpt-4o-mini',
        provider: 'openai',
        description: 'GPT-4o Mini - 性价比最高，日常使用推荐',
        pricing: '$0.15/$0.60 per 1M tokens',
        recommended: true,
      },

      // Claude 3.5 系列（推荐）
      {
        model: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        description: 'Claude 3.5 Sonnet - 最强多模态能力，图片理解最佳',
        pricing: '$3/$15 per 1M tokens',
        recommended: true,
      },
      {
        model: 'claude-3-5-haiku-20241022',
        provider: 'anthropic',
        description: 'Claude 3.5 Haiku - 最快最便宜，性价比极高',
        pricing: '$0.80/$4 per 1M tokens',
        recommended: true,
      },

      // Google Gemini 系列（推荐免费）
      {
        model: 'gemini-2.0-flash-exp',
        provider: 'google',
        description: 'Gemini 2.0 Flash - 最新实验版本，免费使用',
        pricing: 'Free (实验版)',
        recommended: true,
      },
      {
        model: 'gemini-1.5-pro',
        provider: 'google',
        description: 'Gemini 1.5 Pro - 稳定版本，长上下文',
        pricing: '$1.25/$5 per 1M tokens',
      },
      {
        model: 'gemini-1.5-flash',
        provider: 'google',
        description: 'Gemini 1.5 Flash - 快速版本，性价比高',
        pricing: '$0.075/$0.30 per 1M tokens',
        recommended: true,
      },

      // 阿里 Qwen2-VL（中文优化）
      {
        model: 'qwen2-vl-72b',
        provider: 'qwen',
        description: 'Qwen2-VL 72B - 最强版本，中文图片理解优秀',
        pricing: '¥0.04/千tokens',
      },
      {
        model: 'qwen2-vl-7b',
        provider: 'qwen',
        description: 'Qwen2-VL 7B - 性价比版本，适合大规模使用',
        pricing: '¥0.008/千tokens',
        recommended: true,
      },
    ]
  }
}
