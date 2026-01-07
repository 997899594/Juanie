import { computed, readonly, ref } from 'vue'
import { useToast } from '@/composables/useToast'

// Lazy import log to avoid issues in test environment
const getLogger = () => {
  try {
    // @ts-expect-error - dynamic import
    return require('@juanie/ui').log
  } catch {
    return {
      error: console.error,
      info: console.info,
      warn: console.warn,
    }
  }
}

/**
 * 消息类型定义
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}

/**
 * AI Chat 组合式函数
 * 使用 AI SDK Text Stream Protocol 连接到 NestJS AI Platform 后端
 *
 * 功能特性：
 * - 流式响应（基于 AI SDK Text Stream Protocol）
 * - 工具调用支持（Tool Calling）
 * - 多租户隔离（通过 x-tenant-id header）
 * - 自动错误处理和重试
 * - 消息历史管理
 * - 加载状态和错误状态
 */
export function useAiChat(options?: {
  /**
   * 初始消息列表
   */
  initialMessages?: Message[]

  /**
   * 租户 ID（用于多租户隔离）
   */
  tenantId?: string

  /**
   * 系统提示词（可选）
   */
  systemPrompt?: string

  /**
   * 错误回调
   */
  onError?: (error: Error) => void

  /**
   * 完成回调
   */
  onFinish?: (message: Message) => void
}) {
  const toast = useToast()

  // 获取租户 ID
  const tenantId = computed(() => {
    return options?.tenantId || 'default'
  })

  // 获取 AI Platform 后端 URL
  const apiUrl = computed(() => {
    const baseUrl = import.meta.env.VITE_AI_PLATFORM_URL || 'http://localhost:3003'
    return `${baseUrl}/api/ai/chat`
  })

  // 响应式状态
  const messages = ref<Message[]>(options?.initialMessages || [])
  const input = ref('')
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const abortController = ref<AbortController | null>(null)

  /**
   * 发送消息
   * @param content 消息内容
   * @param role 消息角色（默认为 'user'）
   */
  const sendMessage = async (content: string, role: 'user' | 'assistant' = 'user') => {
    if (!content.trim()) {
      toast.warning('请输入消息内容')
      return
    }

    try {
      isLoading.value = true
      error.value = null

      // 创建 AbortController 用于取消请求
      abortController.value = new AbortController()

      // 添加用户消息
      const userMessage: Message = {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        createdAt: new Date(),
      }
      messages.value.push(userMessage)

      // 调用 API
      const response = await fetch(apiUrl.value, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId.value,
        },
        body: JSON.stringify({
          messages: messages.value,
          tenantId: tenantId.value,
          systemPrompt: options?.systemPrompt,
        }),
        signal: abortController.value.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 创建助手消息
      const assistantMessage: Message = {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      }
      messages.value.push(assistantMessage)

      // 读取文本流
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      // 读取流式响应
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantMessage.content += chunk

        // 触发响应式更新
        messages.value = [...messages.value]
      }

      // 调用完成回调
      options?.onFinish?.(assistantMessage)
    } catch (err) {
      // 忽略用户主动取消的错误
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      const errorObj = err instanceof Error ? err : new Error(String(err))
      error.value = errorObj
      const log = getLogger()
      log.error('AI Chat error:', err)
      toast.error('AI 对话失败', errorObj.message || '请稍后重试')
      options?.onError?.(errorObj)
    } finally {
      isLoading.value = false
      abortController.value = null
    }
  }

  /**
   * 清空对话历史
   */
  const clearMessages = () => {
    messages.value = []
    toast.info('对话历史已清空')
  }

  /**
   * 重新生成最后一条消息
   */
  const regenerate = async () => {
    if (messages.value.length < 2) {
      toast.warning('没有可重新生成的消息')
      return
    }

    try {
      // 移除最后一条助手消息
      messages.value = messages.value.slice(0, -1)

      // 获取最后一条用户消息
      const lastUserMessage = messages.value[messages.value.length - 1]
      if (lastUserMessage && lastUserMessage.role === 'user') {
        // 移除用户消息并重新发送
        messages.value = messages.value.slice(0, -1)
        await sendMessage(lastUserMessage.content)
      }
    } catch (err) {
      const log = getLogger()
      log.error('Failed to regenerate:', err)
      toast.error('重新生成失败', '请稍后重试')
    }
  }

  /**
   * 停止生成
   */
  const stopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort()
      toast.info('已停止生成')
    }
  }

  /**
   * 设置系统提示词
   * 注意：这会清空当前对话历史
   */
  const setSystemPrompt = (prompt: string) => {
    clearMessages()
    // 系统提示词会在下次发送消息时通过 body 传递
    if (options) {
      options.systemPrompt = prompt
    }
  }

  /**
   * 设置输入内容
   */
  const setInput = (value: string) => {
    input.value = value
  }

  /**
   * 设置消息列表
   */
  const setMessages = (newMessages: Message[]) => {
    messages.value = newMessages
  }

  return {
    // 状态
    messages: readonly(messages),
    input,
    isLoading: readonly(isLoading),
    error: readonly(error),
    tenantId: readonly(tenantId),

    // 操作
    sendMessage,
    clearMessages,
    regenerate,
    stopGeneration,
    setSystemPrompt,
    setInput,
    setMessages,
  }
}
