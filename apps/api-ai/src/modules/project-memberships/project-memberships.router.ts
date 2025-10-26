import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { ProjectMembershipsService } from './project-memberships.service';
import { z } from 'zod';

@Injectable()
export class ProjectMembershipsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectMembershipsService: ProjectMembershipsService,
  ) {}

  public get projectMembershipsRouter() {
    return this.trpc.router({
      hello: this.trpc.publicProcedure.query(async () => {
        return this.projectMembershipsService.hello();
      }),
    });
  }
}