import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { TeamMembersService } from './team-members.service';
import { TeamMembersRouter } from './team-members.router';

@Module({
  imports: [DatabaseModule],
  providers: [TeamMembersService, TeamMembersRouter, TrpcService],
  exports: [TeamMembersService, TeamMembersRouter],
})
export class TeamMembersModule {}