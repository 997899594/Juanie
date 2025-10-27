import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { ProjectMembershipsService } from './project-memberships.service';
import { DatabaseModule } from '../../database/database.module';
import { ProjectMembershipsRouter } from './project-memberships.router';

@Module({
  imports: [DatabaseModule],
  providers: [ProjectMembershipsService, ProjectMembershipsRouter, TrpcService],
  exports: [ProjectMembershipsService, ProjectMembershipsRouter]})
export class ProjectMembershipsModule {}