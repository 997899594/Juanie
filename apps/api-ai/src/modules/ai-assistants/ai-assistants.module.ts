import { Module } from '@nestjs/common';
import { AiAssistantsService } from './ai-assistants.service';
import { AiAssistantsRouter } from './ai-assistants.router';

@Module({
  providers: [AiAssistantsService, AiAssistantsRouter],
  exports: [AiAssistantsService],
})
export class AiAssistantsModule {}