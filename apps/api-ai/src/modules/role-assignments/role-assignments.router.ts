import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RoleAssignmentsService } from './role-assignments.service';
import { z } from 'zod';

@Injectable()
export class RoleAssignmentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly roleAssignmentsService: RoleAssignmentsService,
  ) {}

  public get roleAssignmentsRouter() {
    return this.trpc.router({
      // TODO: Implement actual role assignment management procedures here
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.roleAssignmentsService.hello();
        }),
    });
  }
}