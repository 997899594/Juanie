import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

export interface AIAssistant {
  id: string
  organizationId: string | null
  name: string
  type: string
  modelConfig: {
    provider: string
    model: string
    temperature?: number
    maxTokens?: number
  } | null
  systemPrompt: string
  isActive: boolean
  averageRating: number | null
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
}

export interface ChatResponse {
  message: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface OllamaModel {
  name: string
  size: number
  modified: string
}

export interface OllamaStatus {
  available: boolean
  version?: string
  models?: OllamaModel[]
}

export function useAIAssistants() {
  const toast = useToast()

  const assistants = ref<AIAssistant[]>([])
  const currentAssistant = ref<AIAssistant | null>(null)
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const chatting = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasAssistants = computed(() => assistants.value.length > 0)
  const hasMessages = computed(() => messages.value.length > 0)

  /**
   * 获取 AI 助手列表
   */
  const fetchAssistants = async (filters?: { organizationId?: string; type?: string }) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.aiAssistants.list.query(filters || {})
      assistants.value = result as AIAssistant[]
    } catch (err: any) {
      const errorMessage = err.message || '获取 AI 助手列表失败'
      error.value = errorMessage
      toast.error('获取失败', errorMessage)
      console.error('获取 AI 助手列表失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取单个 AI 助手
   */
  const fetchAssistant = async (id: string) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.aiAssistants.get.query({ id })
      currentAssistant.value = result as AIAssistant
      return result as AIAssistant
    } catch (err: any) {
      const errorMessage = err.message || '获取 AI 助手失败'
      error.value = errorMessage
      toast.error('获取失败', errorMessage)
      console.error('获取 AI 助手失败:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 与 AI 助手对话
   */
  const chat = async (
    assistantId: string,
    message: string,
    context?: Record<string, any>,
  ): Promise<string | null> => {
    try {
      chatting.value = true
      error.value = null

      // 添加用户消息到历史
      messages.value.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      })

      const result = await trpc.aiAssistants.chat.mutate({
        assistantId,
        message,
        context,
      })

      const response = result as ChatResponse

      // 添加助手响应到历史
      messages.value.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      })

      return response.message
    } catch (err: any) {
      const errorMessage = err.message || '对话失败'
      error.value = errorMessage
      toast.error('对话失败', errorMessage)
      console.error('AI 助手对话失败:', err)
      return null
    } finally {
      chatting.value = false
    }
  }

  /**
   * 评分 AI 助手响应
   */
  const rate = async (assistantId: string, rating: number) => {
    try {
      await trpc.aiAssistants.rate.mutate({
        assistantId,
        rating,
      })

      toast.success('评分成功', '感谢您的反馈')

      // 更新助手评分
      const assistant = assistants.value.find((a) => a.id === assistantId)
      if (assistant) {
        await fetchAssistant(assistantId)
      }
    } catch (err: any) {
      const errorMessage = err.message || '评分失败'
      toast.error('评分失败', errorMessage)
      console.error('评分失败:', err)
    }
  }

  /**
   * 创建 AI 助手
   */
  const create = async (data: {
    organizationId?: string
    name: string
    type: 'code_review' | 'devops_engineer' | 'cost_optimizer' | 'security_analyst'
    modelConfig: {
      provider: 'openai' | 'anthropic' | 'google' | 'ollama'
      model: string
      temperature?: number
      maxTokens?: number
    }
    systemPrompt?: string
    isActive?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.aiAssistants.create.mutate(data)
      toast.success('创建成功', 'AI 助手已创建')

      if (data.organizationId) {
        await fetchAssistants({ organizationId: data.organizationId })
      }
      return result as AIAssistant
    } catch (err: any) {
      const errorMessage = err.message || '创建失败'
      error.value = errorMessage
      toast.error('创建失败', errorMessage)
      console.error('创建 AI 助手失败:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新 AI 助手
   */
  const update = async (
    assistantId: string,
    data: {
      name?: string
      systemPrompt?: string
      temperature?: number
      maxTokens?: number
      isActive?: boolean
    },
  ) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.aiAssistants.update.mutate({
        assistantId,
        ...data,
      })

      toast.success('更新成功', 'AI 助手已更新')

      // 更新本地数据
      const index = assistants.value.findIndex((a) => a.id === assistantId)
      if (index !== -1) {
        assistants.value[index] = result as AIAssistant
      }

      if (currentAssistant.value?.id === assistantId) {
        currentAssistant.value = result as AIAssistant
      }

      return result as AIAssistant
    } catch (err: any) {
      const errorMessage = err.message || '更新失败'
      error.value = errorMessage
      toast.error('更新失败', errorMessage)
      console.error('更新 AI 助手失败:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除 AI 助手
   */
  const deleteAssistant = async (id: string) => {
    try {
      loading.value = true
      error.value = null

      await trpc.aiAssistants.delete.mutate({ id })
      toast.success('删除成功', 'AI 助手已删除')

      // 从列表中移除
      assistants.value = assistants.value.filter((a) => a.id !== id)

      if (currentAssistant.value?.id === id) {
        currentAssistant.value = null
      }
    } catch (err: any) {
      const errorMessage = err.message || '删除失败'
      error.value = errorMessage
      toast.error('删除失败', errorMessage)
      console.error('删除 AI 助手失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 列出可用的 Ollama 模型
   */
  const listOllamaModels = async (): Promise<OllamaModel[]> => {
    try {
      const result = await trpc.aiAssistants.listOllamaModels.query()
      return result as OllamaModel[]
    } catch (err: any) {
      console.error('获取 Ollama 模型列表失败:', err)
      return []
    }
  }

  /**
   * 检查 Ollama 服务状态
   */
  const checkOllamaStatus = async (): Promise<OllamaStatus> => {
    try {
      const result = await trpc.aiAssistants.checkOllamaStatus.query()
      return result as OllamaStatus
    } catch (err: any) {
      console.error('检查 Ollama 状态失败:', err)
      return { available: false }
    }
  }

  /**
   * 清空对话历史
   */
  const clearMessages = () => {
    messages.value = []
  }

  /**
   * 设置当前助手
   */
  const setCurrentAssistant = (assistant: AIAssistant | null) => {
    currentAssistant.value = assistant
    clearMessages()
  }

  return {
    // 状态
    assistants,
    currentAssistant,
    messages,
    loading,
    chatting,
    error,

    // 计算属性
    hasAssistants,
    hasMessages,

    // 方法
    fetchAssistants,
    fetchAssistant,
    chat,
    rate,
    create,
    update,
    deleteAssistant,
    listOllamaModels,
    checkOllamaStatus,
    clearMessages,
    setCurrentAssistant,
  }
}
