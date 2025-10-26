import { Module } from '@nestjs/common';
import { ProjectMembershipsService } from './project-memberships.service';
import { DatabaseModule } from '../../database/database.module';
import { ProjectMembershipsRouter } from './project-memberships.router';
import { TrpcModule } from '../../trpc/trpc.module';

@Module({
  imports: [TrpcModule, DatabaseModule],
  providers: [ProjectMembershipsService, ProjectMembershipsRouter],
  exports: [ProjectMembershipsService, ProjectMembershipsRouter],
})
export class ProjectMembershipsModule {}