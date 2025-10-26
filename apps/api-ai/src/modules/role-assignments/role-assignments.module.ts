import { Module } from '@nestjs/common';
import { RoleAssignmentsService } from './role-assignments.service';
import { TrpcModule } from '../../trpc/trpc.module';

@Module({
  imports: [TrpcModule],
  providers: [RoleAssignmentsService],
  exports: [RoleAssignmentsService],
})
export class RoleAssignmentsModule {}