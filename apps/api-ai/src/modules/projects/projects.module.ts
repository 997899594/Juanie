import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { ProjectsService } from './projects.service';
import { ProjectsRouter } from './projects.router';

@Module({
  providers: [ProjectsService, ProjectsRouter, TrpcService],
  exports: [ProjectsService, ProjectsRouter],
})
export class ProjectsModule {}