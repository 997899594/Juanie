import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useAiChat } from './useAiChat'

// Mock fetch
global.fetch = vi.fn()

describe('useAiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default environment variable
    import.meta.env.VITE_AI_PLATFORM_URL = 'http://localhost:3003'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始化', () => {
    it('应该使用默认值初始化', () => {
      const { messages, input, isLoading, error, tenantId } = useAiChat()

      expect(messages.value).toEqual([])
      expect(input.value).toBe('')
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(tenantId.value).toBe('default')
    })

    it('应该使用提供的初始消息', () => {
      const initialMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: new Date(),
        },
      ]

      const { messages } = useAiChat({ initialMessages })

      expect(messages.value).toEqual(initialMessages)
    })

    it('应该使用提供的租户 ID', () => {
      const { tenantId } = useAiChat({ tenantId: 'test-tenant' })

      expect(tenantId.value).toBe('test-tenant')
    })
  })

  describe('sendMessage', () => {
    it('应该成功发送消息并接收流式响应', async () => {
      // Mock successful fetch response with text stream
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Hello') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(' World') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { messages, sendMessage, isLoading } = useAiChat()

      await sendMessage('Test message')
      await nextTick()

      // Should have user message and assistant message
      expect(messages.value).toHaveLength(2)
      expect(messages.value[0]?.role).toBe('user')
      expect(messages.value[0]?.content).toBe('Test message')
      expect(messages.value[1]?.role).toBe('assistant')
      expect(messages.value[1]?.content).toBe('Hello World')
      expect(isLoading.value).toBe(false)
    })

    it('应该在空消息时显示警告', async () => {
      const { sendMessage } = useAiChat()

      await sendMessage('')
      await sendMessage('   ')

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('应该处理 HTTP 错误', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const onError = vi.fn()
      const { sendMessage, error } = useAiChat({ onError })

      await sendMessage('Test message')
      await nextTick()

      expect(error.value).not.toBeNull()
      expect(error.value?.message).toContain('500')
      expect(onError).toHaveBeenCalled()
    })

    it('应该处理网络错误', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const onError = vi.fn()
      const { sendMessage, error } = useAiChat({ onError })

      await sendMessage('Test message')
      await nextTick()

      expect(error.value).not.toBeNull()
      expect(error.value?.message).toBe('Network error')
      expect(onError).toHaveBeenCalled()
    })

    it('应该在完成时调用回调', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Response') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const onFinish = vi.fn()
      const { sendMessage } = useAiChat({ onFinish })

      await sendMessage('Test')
      await nextTick()

      expect(onFinish).toHaveBeenCalled()
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'Response',
        }),
      )
    })

    it('应该发送正确的请求头', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Response') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { sendMessage } = useAiChat({ tenantId: 'test-tenant' })

      await sendMessage('Test')
      await nextTick()

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3003/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-tenant-id': 'test-tenant',
          }),
        }),
      )
    })

    it('应该支持 AbortController 取消请求', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      }
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { sendMessage, stopGeneration } = useAiChat()

      const promise = sendMessage('Test')
      stopGeneration()
      await promise
      await nextTick()

      // Should have called fetch with AbortController signal
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })
  })

  describe('clearMessages', () => {
    it('应该清空消息列表', () => {
      const initialMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: new Date(),
        },
      ]

      const { messages, clearMessages } = useAiChat({ initialMessages })

      expect(messages.value).toHaveLength(1)

      clearMessages()

      expect(messages.value).toHaveLength(0)
    })
  })

  describe('regenerate', () => {
    it('应该重新生成最后一条消息', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('First') })
          .mockResolvedValueOnce({ done: true, value: undefined })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Second') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { messages, sendMessage, regenerate } = useAiChat()

      // Send initial message
      await sendMessage('Test')
      await nextTick()

      expect(messages.value).toHaveLength(2)

      // Regenerate
      await regenerate()
      await nextTick()

      // Should still have 2 messages (user + new assistant)
      expect(messages.value).toHaveLength(2)
      expect(messages.value[1]?.content).toBe('Second')
    })

    it('应该在没有消息时显示警告', async () => {
      const { regenerate } = useAiChat()

      await regenerate()

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('setInput', () => {
    it('应该设置输入值', () => {
      const { input, setInput } = useAiChat()

      expect(input.value).toBe('')

      setInput('New input')

      expect(input.value).toBe('New input')
    })
  })

  describe('setMessages', () => {
    it('应该设置消息列表', () => {
      const { messages, setMessages } = useAiChat()

      expect(messages.value).toHaveLength(0)

      const newMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: new Date(),
        },
      ]

      setMessages(newMessages)

      expect(messages.value).toEqual(newMessages)
    })
  })

  describe('setSystemPrompt', () => {
    it('应该设置系统提示词并清空消息', () => {
      const initialMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: new Date(),
        },
      ]

      const { messages, setSystemPrompt } = useAiChat({ initialMessages })

      expect(messages.value).toHaveLength(1)

      setSystemPrompt('New system prompt')

      expect(messages.value).toHaveLength(0)
    })
  })
})
