import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AiAssistantsService } from './ai-assistants.service';
import { AiAssistantsRouter } from './ai-assistants.router';

@Module({
  providers: [AiAssistantsService, AiAssistantsRouter, TrpcService],
  exports: [AiAssistantsService, AiAssistantsRouter],
})
export class AiAssistantsModule {}