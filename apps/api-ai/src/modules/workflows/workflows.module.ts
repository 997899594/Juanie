import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsRouter } from './workflows.router';

@Module({
  providers: [WorkflowsService, WorkflowsRouter],
  exports: [WorkflowsService, WorkflowsRouter],
})
export class WorkflowsModule {}