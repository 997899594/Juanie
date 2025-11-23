# Ollama AI 集成深度教程

## 什么是 Ollama？

### 简介

**Ollama** 是一个开源的本地大语言模型运行平台，让你可以在自己的机器上运行 Llama 2、Mistral、CodeLlama 等开源模型。

**核心优势**：
- ✅ **完全本地运行** - 数据不离开你的服务器
- ✅ **隐私保护** - 不需要发送数据到第三方
- ✅ **成本控制** - 无 API 调用费用
- ✅ **自定义模型** - 可以微调和定制模型
- ✅ **简单易用** - 一行命令启动模型

### 与其他 AI 方案对比

| 方案 | 优势 | 劣势 | 成本 |
|------|------|------|------|
| **OpenAI API** | 模型强大，响应快 | 数据隐私，按量付费 | 高 |
| **Azure OpenAI** | 企业级，合规 | 配置复杂，成本高 | 高 |
| **Ollama** | 本地运行，隐私 | 需要 GPU，模型较弱 | 低 |
| **LM Studio** | 图形界面友好 | 功能有限 | 低 |

---

## 快速开始

### 1. 安装 Ollama

**macOS / Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**:
```powershell
# 下载安装器
# https://ollama.com/download/windows
```

**Docker**:
```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### 2. 下载模型

```bash
# 下载 Llama 2 (7B)
ollama pull llama2

# 下载 Mistral (7B)
ollama pull mistral

# 下载 CodeLlama (代码专用)
ollama pull codellama

# 下载 Qwen (中文优化)
ollama pull qwen:7b
```

### 3. 测试模型

```bash
# 交互式对话
ollama run llama2

# 单次查询
ollama run llama2 "解释什么是 Kubernetes"

# 查看已安装模型
ollama list
```

---

## 在项目中集成 Ollama

### 架构设计

```
┌─────────────────────────────────────────┐
│           Frontend (Vue 3)              │
│  ┌─────────────────────────────────┐    │
│  │  AI Chat Component              │    │
│  │  - 代码审查                      │    │
│  │  - DevOps 建议                   │    │
│  │  - 错误诊断                      │    │
│  └─────────────────────────────────┘    │
└──────────────┬──────────────────────────┘
               │ tRPC
┌──────────────▼──────────────────────────┐
│        API Gateway (NestJS)             │
│  ┌─────────────────────────────────┐    │
│  │  AI Router                      │    │
│  │  - chat                         │    │
│  │  - codeReview                   │    │
│  │  - suggest                      │    │
│  └─────────────────────────────────┘    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     AI Service (extensions)             │
│  ┌─────────────────────────────────┐    │
│  │  Ollama Service                 │    │
│  │  - 模型管理                      │    │
│  │  - 提示词工程                    │    │
│  │  - 上下文管理                    │    │
│  └─────────────────────────────────┘    │
└──────────────┬──────────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────────┐
│         Ollama Server                   │
│  ┌─────────────────────────────────┐    │
│  │  llama2, mistral, codellama     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```


### 1. 创建 Ollama Service

```typescript
// packages/services/extensions/src/ai/ollama/ollama.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaRequest {
  model: string
  messages: OllamaMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    max_tokens?: number
  }
}

interface OllamaResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name)
  private readonly baseUrl: string
  private readonly defaultModel: string

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    this.defaultModel = this.config.get('OLLAMA_DEFAULT_MODEL', 'llama2')
  }

  /**
   * 发送聊天请求
   */
  async chat(
    messages: OllamaMessage[],
    options?: {
      model?: string
      temperature?: number
      stream?: boolean
    }
  ): Promise<string> {
    const model = options?.model || this.defaultModel

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
          },
        } as OllamaRequest),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = (await response.json()) as OllamaResponse
      return data.message.content
    } catch (error) {
      this.logger.error('Failed to chat with Ollama', error)
      throw error
    }
  }

  /**
   * 流式响应
   */
  async *chatStream(
    messages: OllamaMessage[],
    options?: {
      model?: string
      temperature?: number
    }
  ): AsyncGenerator<string> {
    const model = options?.model || this.defaultModel

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options?.temperature || 0.7,
          },
        } as OllamaRequest),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            const data = JSON.parse(line) as OllamaResponse
            if (data.message?.content) {
              yield data.message.content
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to stream chat with Ollama', error)
      throw error
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      const data = await response.json()
      return data.models.map((m: any) => m.name)
    } catch (error) {
      this.logger.error('Failed to list models', error)
      return []
    }
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }
}
```

### 2. 创建 AI Assistant Service

```typescript
// packages/services/extensions/src/ai/assistants/ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { OllamaService } from '../ollama/ollama.service'

interface CodeReviewRequest {
  code: string
  language: string
  context?: string
}

interface DevOpsAdviceRequest {
  scenario: string
  currentSetup?: string
  goals?: string[]
}

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name)

  constructor(private readonly ollama: OllamaService) {}

  /**
   * 代码审查
   */
  async reviewCode(request: CodeReviewRequest): Promise<string> {
    const systemPrompt = `你是一个专业的代码审查助手。
请审查以下 ${request.language} 代码，关注：
1. 潜在的 bug 和错误
2. 性能问题
3. 安全漏洞
4. 代码风格和最佳实践
5. 可维护性建议

请用中文回复，格式清晰，重点突出。`

    const userPrompt = `${request.context ? `上下文：${request.context}\n\n` : ''}代码：\n\`\`\`${request.language}\n${request.code}\n\`\`\``

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  /**
   * DevOps 建议
   */
  async suggestDevOps(request: DevOpsAdviceRequest): Promise<string> {
    const systemPrompt = `你是一个 DevOps 专家，擅长 Kubernetes、CI/CD、GitOps 等技术。
请根据用户的场景提供专业的建议和最佳实践。`

    const userPrompt = `场景：${request.scenario}

${request.currentSetup ? `当前配置：\n${request.currentSetup}\n\n` : ''}${request.goals ? `目标：\n${request.goals.join('\n')}\n\n` : ''}请提供详细的建议和实施步骤。`

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  /**
   * 错误诊断
   */
  async diagnoseError(error: {
    message: string
    stack?: string
    context?: string
  }): Promise<string> {
    const systemPrompt = `你是一个错误诊断专家。
请分析错误信息，提供：
1. 错误原因分析
2. 可能的解决方案
3. 预防措施

用中文回复，简洁明了。`

    const userPrompt = `错误信息：${error.message}

${error.stack ? `堆栈跟踪：\n${error.stack}\n\n` : ''}${error.context ? `上下文：\n${error.context}` : ''}`

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  /**
   * 生成 Dockerfile
   */
  async generateDockerfile(request: {
    projectType: string
    dependencies?: string[]
    requirements?: string[]
  }): Promise<string> {
    const systemPrompt = `你是一个 Docker 专家。
请根据项目类型生成优化的 Dockerfile，包括：
1. 多阶段构建
2. 层缓存优化
3. 安全最佳实践
4. 最小镜像体积

只返回 Dockerfile 内容，不要额外解释。`

    const userPrompt = `项目类型：${request.projectType}
${request.dependencies ? `依赖：${request.dependencies.join(', ')}\n` : ''}${request.requirements ? `要求：${request.requirements.join(', ')}` : ''}`

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  /**
   * 生成 Kubernetes 配置
   */
  async generateK8sManifest(request: {
    appName: string
    image: string
    port: number
    replicas?: number
    resources?: {
      cpu: string
      memory: string
    }
  }): Promise<string> {
    const systemPrompt = `你是一个 Kubernetes 专家。
请生成生产级别的 Kubernetes 配置，包括：
1. Deployment
2. Service
3. HorizontalPodAutoscaler
4. ResourceQuota（如果需要）

只返回 YAML 配置，不要额外解释。`

    const userPrompt = `应用名称：${request.appName}
镜像：${request.image}
端口：${request.port}
副本数：${request.replicas || 3}
${request.resources ? `资源限制：CPU ${request.resources.cpu}, Memory ${request.resources.memory}` : ''}`

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  /**
   * 聊天（通用）
   */
  async chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string> {
    const systemPrompt = `你是一个 AI DevOps 助手，帮助用户解决开发和运维问题。
你擅长：
- Kubernetes 和容器化
- CI/CD 和 GitOps
- 代码审查和优化
- 错误诊断和调试
- 最佳实践建议

请用中文回复，专业且友好。`

    return await this.ollama.chat([
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ])
  }

  /**
   * 流式聊天
   */
  async *chatStream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): AsyncGenerator<string> {
    const systemPrompt = `你是一个 AI DevOps 助手。用中文回复。`

    yield* this.ollama.chatStream([
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ])
  }
}
```

### 3. 创建 tRPC Router

```typescript
// apps/api-gateway/src/routers/ai.router.ts
import { Injectable } from '@nestjs/common'
import { TrpcService } from '../trpc/trpc.service'
import { AIAssistantService } from '@juanie/service-extensions'
import { z } from 'zod'
import { observable } from '@trpc/server/observable'

@Injectable()
export class AIRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly aiAssistant: AIAssistantService
  ) {}

  router = this.trpc.router({
    // 代码审查
    reviewCode: this.trpc.protectedProcedure
      .input(
        z.object({
          code: z.string(),
          language: z.string(),
          context: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.reviewCode(input)
      }),

    // DevOps 建议
    suggestDevOps: this.trpc.protectedProcedure
      .input(
        z.object({
          scenario: z.string(),
          currentSetup: z.string().optional(),
          goals: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.suggestDevOps(input)
      }),

    // 错误诊断
    diagnoseError: this.trpc.protectedProcedure
      .input(
        z.object({
          message: z.string(),
          stack: z.string().optional(),
          context: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.diagnoseError(input)
      }),

    // 生成 Dockerfile
    generateDockerfile: this.trpc.protectedProcedure
      .input(
        z.object({
          projectType: z.string(),
          dependencies: z.array(z.string()).optional(),
          requirements: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.generateDockerfile(input)
      }),

    // 生成 K8s 配置
    generateK8sManifest: this.trpc.protectedProcedure
      .input(
        z.object({
          appName: z.string(),
          image: z.string(),
          port: z.number(),
          replicas: z.number().optional(),
          resources: z
            .object({
              cpu: z.string(),
              memory: z.string(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.generateK8sManifest(input)
      }),

    // 聊天
    chat: this.trpc.protectedProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return await this.aiAssistant.chat(input.messages)
      }),

    // 流式聊天
    chatStream: this.trpc.protectedProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })
          ),
        })
      )
      .subscription(({ input }) => {
        return observable<string>((emit) => {
          ;(async () => {
            try {
              for await (const chunk of this.aiAssistant.chatStream(input.messages)) {
                emit.next(chunk)
              }
              emit.complete()
            } catch (error) {
              emit.error(error)
            }
          })()
        })
      }),
  })
}
```

### 4. 前端集成

**创建 AI Composable**:
```typescript
// apps/web/src/composables/useAI.ts
import { ref } from 'vue'
import { trpc } from '@/lib/trpc'

export function useAI() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 代码审查
  const reviewCode = async (code: string, language: string, context?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await trpc.ai.reviewCode.mutate({
        code,
        language,
        context,
      })
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '代码审查失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // DevOps 建议
  const suggestDevOps = async (
    scenario: string,
    currentSetup?: string,
    goals?: string[]
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await trpc.ai.suggestDevOps.mutate({
        scenario,
        currentSetup,
        goals,
      })
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取建议失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 生成 Dockerfile
  const generateDockerfile = async (
    projectType: string,
    dependencies?: string[],
    requirements?: string[]
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await trpc.ai.generateDockerfile.mutate({
        projectType,
        dependencies,
        requirements,
      })
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '生成 Dockerfile 失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 聊天
  const chat = async (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await trpc.ai.chat.mutate({ messages })
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '聊天失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 流式聊天
  const chatStream = (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void
  ) => {
    isLoading.value = true
    error.value = null

    const subscription = trpc.ai.chatStream.subscribe(
      { messages },
      {
        onData: (chunk) => {
          onChunk(chunk)
        },
        onError: (err) => {
          error.value = err.message
          isLoading.value = false
        },
        onComplete: () => {
          isLoading.value = false
        },
      }
    )

    return () => {
      subscription.unsubscribe()
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    reviewCode,
    suggestDevOps,
    generateDockerfile,
    chat,
    chatStream,
  }
}
```

**AI 聊天组件**:
```vue
<!-- apps/web/src/components/AIChat.vue -->
<template>
  <div class="ai-chat">
    <div class="messages">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message', message.role]"
      >
        <div class="avatar">
          <UserIcon v-if="message.role === 'user'" />
          <SparklesIcon v-else />
        </div>
        <div class="content">
          <div v-html="renderMarkdown(message.content)" />
        </div>
      </div>

      <div v-if="isLoading" class="message assistant">
        <div class="avatar">
          <SparklesIcon class="animate-pulse" />
        </div>
        <div class="content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <form @submit.prevent="sendMessage" class="input-form">
      <textarea
        v-model="input"
        placeholder="问我任何关于 DevOps 的问题..."
        @keydown.enter.exact.prevent="sendMessage"
        rows="3"
      />
      <button type="submit" :disabled="!input.trim() || isLoading">
        <PaperAirplaneIcon />
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { marked } from 'marked'
import { UserIcon, SparklesIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline'
import { useAI } from '@/composables/useAI'

const { isLoading, chatStream } = useAI()

const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const input = ref('')

const renderMarkdown = (content: string) => {
  return marked(content)
}

const sendMessage = async () => {
  if (!input.value.trim() || isLoading.value) return

  const userMessage = input.value.trim()
  input.value = ''

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: userMessage,
  })

  // 创建助手消息占位
  const assistantMessageIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
  })

  // 流式接收响应
  const unsubscribe = chatStream(messages.value.slice(0, -1), (chunk) => {
    messages.value[assistantMessageIndex].content += chunk
  })

  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe()
  })
}
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  gap: 0.75rem;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
}

.content {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: var(--color-bg-secondary);
}

.message.user .content {
  background: var(--color-primary);
  color: white;
}

.typing-indicator {
  display: flex;
  gap: 0.25rem;
}

.typing-indicator span {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-text-secondary);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-0.5rem);
  }
}

.input-form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}

textarea {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  resize: none;
  font-family: inherit;
}

button {
  padding: 0.75rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

**代码审查组件**:
```vue
<!-- apps/web/src/components/CodeReview.vue -->
<template>
  <div class="code-review">
    <div class="editor">
      <div class="header">
        <select v-model="language">
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
        </select>
        <button @click="review" :disabled="!code || isLoading">
          <SparklesIcon class="w-4 h-4" />
          {{ isLoading ? '审查中...' : 'AI 审查' }}
        </button>
      </div>

      <textarea
        v-model="code"
        placeholder="粘贴你的代码..."
        class="code-input"
      />
    </div>

    <div v-if="result" class="result">
      <h3>审查结果</h3>
      <div v-html="renderMarkdown(result)" />
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { marked } from 'marked'
import { SparklesIcon } from '@heroicons/vue/24/outline'
import { useAI } from '@/composables/useAI'

const { isLoading, error, reviewCode } = useAI()

const code = ref('')
const language = ref('typescript')
const result = ref('')

const renderMarkdown = (content: string) => {
  return marked(content)
}

const review = async () => {
  if (!code.value) return

  result.value = ''
  const response = await reviewCode(code.value, language.value)
  result.value = response
}
</script>

<style scoped>
.code-review {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  height: 100%;
}

.editor {
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.code-input {
  flex: 1;
  padding: 1rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  resize: none;
}

.result {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow-y: auto;
}

.error {
  grid-column: 1 / -1;
  padding: 1rem;
  background: var(--color-error-bg);
  color: var(--color-error);
  border-radius: 0.5rem;
}
</style>
```

---

## 高级功能

### 1. 自定义模型

**创建 Modelfile**:
```dockerfile
# Modelfile
FROM llama2

# 设置系统提示词
SYSTEM """
你是一个专业的 DevOps 工程师，专注于 Kubernetes、Docker、CI/CD 和 GitOps。
你的回答应该：
1. 专业且准确
2. 包含实际可执行的代码
3. 考虑生产环境的最佳实践
4. 用中文回复
"""

# 设置参数
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40

# 添加示例对话
MESSAGE user 如何优化 Dockerfile？
MESSAGE assistant 优化 Dockerfile 的关键策略：

1. 使用多阶段构建
2. 合并 RUN 命令减少层数
3. 利用构建缓存
4. 使用 .dockerignore
5. 选择合适的基础镜像

示例：
```dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# 运行阶段
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/main.js"]
```
```

**构建自定义模型**:
```bash
# 创建模型
ollama create devops-assistant -f Modelfile

# 测试模型
ollama run devops-assistant "如何设置 Kubernetes HPA？"

# 列出模型
ollama list
```

### 2. 模型微调

**准备训练数据**:
```json
// training-data.jsonl
{"prompt": "如何创建 Kubernetes Deployment？", "completion": "创建 Deployment 的步骤：\n1. 编写 YAML 配置\n2. 使用 kubectl apply\n3. 验证部署状态\n\n示例：\n```yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: my-app\n  template:\n    metadata:\n      labels:\n        app: my-app\n    spec:\n      containers:\n      - name: app\n        image: my-app:latest\n        ports:\n        - containerPort: 8080\n```"}
{"prompt": "什么是 GitOps？", "completion": "GitOps 是一种使用 Git 作为单一事实来源的运维实践：\n\n核心原则：\n1. 声明式配置\n2. Git 作为唯一真相源\n3. 自动化部署\n4. 持续同步\n\n常用工具：\n- Flux CD\n- ArgoCD\n- Jenkins X"}
```

**微调模型**:
```bash
# 使用 Ollama 微调（需要 GPU）
ollama create devops-tuned -f Modelfile --train training-data.jsonl
```

### 3. RAG（检索增强生成）

```typescript
// packages/services/extensions/src/ai/rag/rag.service.ts
import { Injectable } from '@nestjs/common'
import { OllamaService } from '../ollama/ollama.service'

interface Document {
  id: string
  content: string
  metadata: Record<string, any>
}

@Injectable()
export class RAGService {
  private documents: Document[] = []

  constructor(private readonly ollama: OllamaService) {}

  /**
   * 添加文档到知识库
   */
  async addDocument(doc: Document) {
    this.documents.push(doc)
  }

  /**
   * 简单的相似度搜索（实际应使用向量数据库）
   */
  private searchDocuments(query: string, limit = 3): Document[] {
    return this.documents
      .map((doc) => ({
        doc,
        score: this.calculateSimilarity(query, doc.content),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.doc)
  }

  /**
   * 简单的相似度计算（实际应使用嵌入向量）
   */
  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/)
    const contentWords = content.toLowerCase().split(/\s+/)
    const intersection = queryWords.filter((word) => contentWords.includes(word))
    return intersection.length / queryWords.length
  }

  /**
   * RAG 查询
   */
  async query(question: string): Promise<string> {
    // 1. 检索相关文档
    const relevantDocs = this.searchDocuments(question)

    // 2. 构建上下文
    const context = relevantDocs.map((doc) => doc.content).join('\n\n')

    // 3. 生成回答
    const prompt = `基于以下上下文回答问题：

上下文：
${context}

问题：${question}

请基于上下文回答，如果上下文中没有相关信息，请说明。`

    return await this.ollama.chat([{ role: 'user', content: prompt }])
  }
}
```

### 4. 函数调用（Function Calling）

```typescript
// packages/services/extensions/src/ai/functions/function-calling.service.ts
import { Injectable } from '@nestjs/common'
import { OllamaService } from '../ollama/ollama.service'

interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

@Injectable()
export class FunctionCallingService {
  private functions: Map<string, Function> = new Map()

  constructor(private readonly ollama: OllamaService) {
    this.registerDefaultFunctions()
  }

  /**
   * 注册函数
   */
  registerFunction(name: string, fn: Function, definition: FunctionDefinition) {
    this.functions.set(name, fn)
  }

  /**
   * 注册默认函数
   */
  private registerDefaultFunctions() {
    // 获取 Kubernetes Pod 状态
    this.registerFunction(
      'getK8sPods',
      async (namespace: string) => {
        // 实际实现
        return { pods: [] }
      },
      {
        name: 'getK8sPods',
        description: '获取 Kubernetes 命名空间中的 Pod 列表',
        parameters: {
          type: 'object',
          properties: {
            namespace: {
              type: 'string',
              description: 'Kubernetes 命名空间',
            },
          },
          required: ['namespace'],
        },
      }
    )

    // 部署应用
    this.registerFunction(
      'deployApp',
      async (appName: string, image: string) => {
        // 实际实现
        return { success: true }
      },
      {
        name: 'deployApp',
        description: '部署应用到 Kubernetes',
        parameters: {
          type: 'object',
          properties: {
            appName: { type: 'string', description: '应用名称' },
            image: { type: 'string', description: 'Docker 镜像' },
          },
          required: ['appName', 'image'],
        },
      }
    )
  }

  /**
   * 执行带函数调用的查询
   */
  async queryWithFunctions(userMessage: string): Promise<string> {
    // 1. 让 AI 决定是否需要调用函数
    const functionPrompt = `你有以下可用函数：
${Array.from(this.functions.keys()).join(', ')}

用户消息：${userMessage}

如果需要调用函数，请返回 JSON 格式：
{"function": "函数名", "arguments": {...}}

如果不需要，直接回答问题。`

    const response = await this.ollama.chat([{ role: 'user', content: functionPrompt }])

    // 2. 解析响应
    try {
      const functionCall = JSON.parse(response)
      if (functionCall.function && this.functions.has(functionCall.function)) {
        // 3. 执行函数
        const fn = this.functions.get(functionCall.function)!
        const result = await fn(...Object.values(functionCall.arguments))

        // 4. 将结果返回给 AI 生成最终回答
        const finalPrompt = `函数 ${functionCall.function} 返回结果：
${JSON.stringify(result, null, 2)}

请基于这个结果回答用户的问题：${userMessage}`

        return await this.ollama.chat([{ role: 'user', content: finalPrompt }])
      }
    } catch {
      // 不是函数调用，直接返回响应
      return response
    }

    return response
  }
}
```

---

## 生产环境部署

### 1. Docker Compose 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped

  api-gateway:
    build: ./apps/api-gateway
    depends_on:
      - ollama
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - OLLAMA_DEFAULT_MODEL=llama2
    ports:
      - "3000:3000"

volumes:
  ollama-data:
```

### 2. Kubernetes 部署

```yaml
# k8s/ollama-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: ai
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: 16Gi
          requests:
            nvidia.com/gpu: 1
            memory: 8Gi
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
      volumes:
      - name: ollama-data
        persistentVolumeClaim:
          claimName: ollama-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: ai
spec:
  selector:
    app: ollama
  ports:
  - port: 11434
    targetPort: 11434
  type: ClusterIP
```

### 3. 性能优化

**模型预加载**:
```bash
# 启动时预加载模型
docker exec ollama ollama pull llama2
docker exec ollama ollama pull mistral
docker exec ollama ollama pull codellama
```

**并发控制**:
```typescript
// 限制并发请求数
import PQueue from 'p-queue'

@Injectable()
export class OllamaService {
  private queue = new PQueue({ concurrency: 3 })

  async chat(messages: OllamaMessage[]): Promise<string> {
    return this.queue.add(() => this._chat(messages))
  }

  private async _chat(messages: OllamaMessage[]): Promise<string> {
    // 实际请求逻辑
  }
}
```

---

## 最佳实践

### 1. 提示词工程

**清晰的角色定义**:
```typescript
const systemPrompt = `你是一个专业的 DevOps 工程师。
你的专长：
- Kubernetes 和容器编排
- CI/CD 流水线设计
- 基础设施即代码（IaC）
- 监控和可观测性

回答要求：
- 提供可执行的代码示例
- 考虑生产环境最佳实践
- 解释技术决策的原因
- 用中文回复`
```

**Few-shot Learning**:
```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '如何创建 Kubernetes Service？' },
  {
    role: 'assistant',
    content: '创建 Service 的 YAML 配置：\n```yaml\napiVersion: v1\nkind: Service\n...\n```',
  },
  { role: 'user', content: userQuestion },
]
```

### 2. 错误处理

```typescript
async chat(messages: OllamaMessage[]): Promise<string> {
  const maxRetries = 3
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this._chat(messages)
    } catch (error) {
      lastError = error
      this.logger.warn(`Ollama request failed (attempt ${i + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }

  throw lastError!
}
```

### 3. 监控和日志

```typescript
async chat(messages: OllamaMessage[]): Promise<string> {
  const startTime = Date.now()

  try {
    const result = await this._chat(messages)
    const duration = Date.now() - startTime

    this.logger.log({
      event: 'ollama_chat_success',
      duration,
      messageCount: messages.length,
      responseLength: result.length,
    })

    return result
  } catch (error) {
    this.logger.error({
      event: 'ollama_chat_error',
      duration: Date.now() - startTime,
      error: error.message,
    })
    throw error
  }
}
```

---

## 总结

### Ollama 的价值

1. **隐私保护** - 数据完全本地化
2. **成本控制** - 无 API 调用费用
3. **自主可控** - 可以自定义和微调模型
4. **离线可用** - 不依赖外部服务
5. **快速迭代** - 本地测试和开发

### 适用场景

✅ **适合**：
- 注重数据隐私的企业
- 需要离线运行的场景
- 预算有限的项目
- 需要自定义模型的场景

❌ **不适合**：
- 需要最强模型能力
- 没有 GPU 资源
- 对响应速度要求极高

### 下一步

1. ✅ 安装 Ollama 并测试
2. ✅ 集成到项目中
3. ✅ 实现基础功能
4. ✅ 优化提示词
5. ✅ 添加 RAG 能力
6. ✅ 部署到生产环境

**Ollama 让 AI 能力触手可及！**
