import { Module } from '@nestjs/common'
import { OllamaModule } from '../ollama/ollama.module'
import { AiAssistantsService } from './ai-assistants.service'

@Module({
  imports: [OllamaModule],
  providers: [AiAssistantsService],
  exports: [AiAssistantsService],
})
export class AiAssistantsModule {}
