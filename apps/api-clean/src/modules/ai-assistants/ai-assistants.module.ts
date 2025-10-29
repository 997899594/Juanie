import { Module } from '@nestjs/common'
import { AiAssistantsRouter } from './ai-assistants.router'
import { AiAssistantsService } from './ai-assistants.service'

@Module({
  providers: [AiAssistantsService, AiAssistantsRouter],
  exports: [AiAssistantsService],
})
export class AiAssistantsModule {}
