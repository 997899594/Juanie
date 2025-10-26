import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { TeamMembersService } from './team-members.service';
import { z } from 'zod';

@Injectable()
export class TeamMembersRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly teamMembersService: TeamMembersService,
  ) {}

  public get teamMembersRouter() {
    return this.trpc.router({
      hello: this.trpc.publicProcedure.query(async () => {
        return this.teamMembersService.hello();
      }),
    });
  }
}