import { Module } from '@nestjs/common'
import { AiAssistantsService } from './ai-assistants.service'

@Module({
  providers: [AiAssistantsService],
  exports: [AiAssistantsService],
})
export class AiAssistantsModule {}
