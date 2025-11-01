import { ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OllamaService } from '../src/ollama.service'

describe('OllamaService', () => {
  let service: OllamaService

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'OLLAMA_HOST') return 'http://localhost:11434'
        return undefined
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<OllamaService>(OllamaService)

    // Skip module initialization to avoid connection attempts
    vi.spyOn(service as any, 'checkConnection').mockResolvedValue(undefined)
    vi.spyOn(service as any, 'ensureModelsAvailable').mockResolvedValue(undefined)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return recommended models', () => {
    const models = service.getRecommendedModels()
    expect(models).toHaveLength(3)
    expect(models[0].name).toBe('llama3.2:3b')
  })

  it('should return connection status', () => {
    const isConnected = service.isOllamaConnected()
    expect(typeof isConnected).toBe('boolean')
  })
})
