import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RoleAssignmentsService } from './role-assignments.service';
import { RoleAssignmentsRouter } from './role-assignments.router';

@Module({
  providers: [RoleAssignmentsService, RoleAssignmentsRouter, TrpcService],
  exports: [RoleAssignmentsService, RoleAssignmentsRouter],
})
export class RoleAssignmentsModule {}