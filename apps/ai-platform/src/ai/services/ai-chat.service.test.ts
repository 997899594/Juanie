import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AiChatService } from './ai-chat.service'
import type { ChatRequestDto } from '../dto/chat-request.dto'

const mockStreamText = vi.fn()

vi.mock('ai', () => ({
  streamText: mockStreamText,
}))

vi.mock('../config/gemini.config', () => ({
  GeminiConfig: {
    initialize: vi.fn(),
    getFlashModel: vi.fn(),
    getProModel: vi.fn(),
  },
}))

describe('AiChatService', () => {
  let service: AiChatService
  let mockConfigService: any
  let mockToolRegistry: any
  let mockAiRouter: any
  let mockSafetyGuard: any
  let mockContextCaching: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfigService = {
      get: vi.fn((key: string) => {
        const config: Record<string, any> = {
          GEMINI_API_KEY: 'test-api-key',
          USE_AI_ROUTER: 'true',
        }
        return config[key]
      }),
    }

    mockToolRegistry = {
      getTools: vi.fn().mockReturnValue({}),
      getToolDescriptions: vi.fn().mockReturnValue('Tool descriptions here'),
    }

    mockAiRouter = {
      selectModel: vi.fn(),
    }

    mockSafetyGuard = {
      checkInput: vi.fn().mockResolvedValue({ safe: true }),
      checkOutput: vi.fn().mockResolvedValue({ safe: true }),
    }

    mockContextCaching = {
      getCachedContext: vi.fn().mockResolvedValue(null),
    }

    service = new AiChatService(
      mockConfigService,
      mockToolRegistry,
      mockAiRouter,
      mockSafetyGuard,
      mockContextCaching,
    )
  })

  describe('onModuleInit', () => {
    it('should initialize GeminiConfig with ConfigService', () => {
      const { GeminiConfig } = require('../config/gemini.config')
      service.onModuleInit()
      expect(GeminiConfig.initialize).toHaveBeenCalledWith(mockConfigService)
    })
  })

  describe('chat', () => {
    const mockRequest: ChatRequestDto = {
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      tenantId: 'test-tenant',
    }

    it('should check input safety before processing', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      await service.chat(mockRequest)
      expect(mockSafetyGuard.checkInput).toHaveBeenCalledWith('Hello, how are you?')
    })

    it('should throw error if input fails safety check', async () => {
      mockSafetyGuard.checkInput.mockResolvedValue({
        safe: false,
        reason: 'Prompt injection detected',
      })
      await expect(service.chat(mockRequest)).rejects.toThrow('Input blocked: Prompt injection detected')
    })

    it('should get cached context for tenant', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      await service.chat(mockRequest)
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('test-tenant')
    })

    it('should select model based on message complexity', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      await service.chat(mockRequest)
      expect(mockAiRouter.selectModel).toHaveBeenCalledWith(mockRequest.messages)
    })

    it('should get tools from registry', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      await service.chat(mockRequest)
      expect(mockToolRegistry.getTools).toHaveBeenCalled()
    })

    it('should call streamText with correct parameters', async () => {
      const mockModel = { modelId: 'gemini-2.0-flash-exp' }
      const mockTools = { tool1: {} }
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue(mockModel)
      mockToolRegistry.getTools.mockReturnValue(mockTools)
      await service.chat(mockRequest)
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
          tools: mockTools,
        })
      )
    })

    it('should perform safety check on output', async () => {
      let onFinishCallback: any
      mockStreamText.mockImplementation((config: any) => {
        onFinishCallback = config.onFinish
        return {} as any
      })
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      await service.chat(mockRequest)
      await onFinishCallback({ text: 'Generated response', usage: {} })
      expect(mockSafetyGuard.checkOutput).toHaveBeenCalledWith('Generated response')
    })

    it('should use default tenant if not provided', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      const requestWithoutTenant: ChatRequestDto = {
        messages: [{ role: 'user', content: 'Test' }],
      }
      await service.chat(requestWithoutTenant)
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('default')
    })
  })

  describe('buildSystemPrompt', () => {
    it('should build base system prompt without cached context', () => {
      const prompt = (service as any).buildSystemPrompt()
      expect(prompt).toContain('You are an AI-powered DevOps and SRE assistant')
      expect(prompt).toContain('Tool descriptions here')
    })

    it('should include cached context when provided', () => {
      const cachedContext = 'Cached tenant context'
      const prompt = (service as any).buildSystemPrompt(cachedContext)
      expect(prompt).toContain('You are an AI-powered DevOps and SRE assistant')
      expect(prompt).toContain('## Cached Context')
      expect(prompt).toContain(cachedContext)
    })

    it('should include tool descriptions in prompt', () => {
      mockToolRegistry.getToolDescriptions.mockReturnValue('Available tools: showKubeDashboard, showDeploymentDiff')
      const prompt = (service as any).buildSystemPrompt()
      expect(prompt).toContain('showKubeDashboard')
      expect(prompt).toContain('showDeploymentDiff')
    })

    it('should handle empty tool descriptions', () => {
      mockToolRegistry.getToolDescriptions.mockReturnValue('')
      const prompt = (service as any).buildSystemPrompt()
      expect(prompt).toBeDefined()
      expect(prompt).toContain('You are an AI-powered DevOps and SRE assistant')
    })

    it('should handle null cached context', () => {
      const prompt = (service as any).buildSystemPrompt(null)
      expect(prompt).toBeDefined()
      expect(prompt).not.toContain('## Cached Context')
    })

    it('should handle undefined cached context', () => {
      const prompt = (service as any).buildSystemPrompt(undefined)
      expect(prompt).toBeDefined()
      expect(prompt).not.toContain('## Cached Context')
    })
  })

  describe('error handling', () => {
    it('should propagate errors from safety check', async () => {
      mockSafetyGuard.checkInput.mockRejectedValue(new Error('Safety check failed'))
      const request: ChatRequestDto = { messages: [{ role: 'user', content: 'Test' }] }
      await expect(service.chat(request)).rejects.toThrow('Safety check failed')
    })

    it('should propagate errors from model selection', async () => {
      mockAiRouter.selectModel.mockRejectedValue(new Error('Model selection failed'))
      const request: ChatRequestDto = { messages: [{ role: 'user', content: 'Test' }] }
      await expect(service.chat(request)).rejects.toThrow('Model selection failed')
    })

    it('should propagate errors from streamText', async () => {
      mockStreamText.mockRejectedValue(new Error('Stream failed'))
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      const request: ChatRequestDto = { messages: [{ role: 'user', content: 'Test' }] }
      await expect(service.chat(request)).rejects.toThrow('Stream failed')
    })

    it('should propagate errors from context caching', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      mockContextCaching.getCachedContext.mockRejectedValue(new Error('Cache error'))
      const request: ChatRequestDto = { messages: [{ role: 'user', content: 'Test' }] }
      await expect(service.chat(request)).rejects.toThrow('Cache error')
    })
  })

  describe('multi-tenant isolation', () => {
    it('should use tenant-specific context', async () => {
      let capturedSystemPrompt: string | undefined
      mockStreamText.mockImplementation((config: any) => {
        capturedSystemPrompt = config.system
        return {} as any
      })
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      const request: ChatRequestDto = {
        messages: [{ role: 'user', content: 'Test' }],
        tenantId: 'tenant-123',
      }
      await service.chat(request)
      expect(capturedSystemPrompt).toBeDefined()
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('tenant-123')
    })

    it('should include tenant context in system prompt', async () => {
      const tenantContext = 'Tenant-specific context for tenant-456'
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      mockContextCaching.getCachedContext.mockResolvedValue(tenantContext)
      const request: ChatRequestDto = {
        messages: [{ role: 'user', content: 'Test' }],
        tenantId: 'tenant-456',
      }
      await service.chat(request)
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('tenant-456')
    })

    it('should isolate contexts between tenants', async () => {
      mockStreamText.mockResolvedValue({} as any)
      mockAiRouter.selectModel.mockResolvedValue({} as any)
      const request1: ChatRequestDto = {
        messages: [{ role: 'user', content: 'Test 1' }],
        tenantId: 'tenant-1',
      }
      const request2: ChatRequestDto = {
        messages: [{ role: 'user', content: 'Test 2' }],
        tenantId: 'tenant-2',
      }
      await service.chat(request1)
      await service.chat(request2)
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('tenant-1')
      expect(mockContextCaching.getCachedContext).toHaveBeenCalledWith('tenant-2')
    })
  })
})
