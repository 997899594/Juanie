import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { WorkflowsService } from './workflows.service';
import { WorkflowsRouter } from './workflows.router';

@Module({
  providers: [WorkflowsService, WorkflowsRouter, TrpcService],
  exports: [WorkflowsService, WorkflowsRouter],
})
export class WorkflowsModule {}