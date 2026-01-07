import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { ConfigService } from '@nestjs/config'

export class GeminiConfig {
  private static configService: ConfigService

  static initialize(configService: ConfigService) {
    GeminiConfig.configService = configService
  }

  private static getProvider() {
    const apiKey = GeminiConfig.configService.get<string>('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    return createGoogleGenerativeAI({ apiKey })
  }

  static getFlashModel() {
    const google = GeminiConfig.getProvider()
    return google('gemini-2.0-flash-exp')
  }

  static getProModel() {
    const google = GeminiConfig.getProvider()
    return google('gemini-2.0-pro-exp')
  }
}
