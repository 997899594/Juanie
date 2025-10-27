import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RoleAssignmentsService } from './role-assignments.service';

@Module({
    providers: [RoleAssignmentsService, TrpcService],
  exports: [RoleAssignmentsService]})
export class RoleAssignmentsModule {}