import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { DatabaseModule } from '../../database/database.module';
import { TeamMembersService } from './team-members.service';
import { TeamMembersRouter } from './team-members.router';

@Module({
  imports: [TrpcModule, DatabaseModule],
  providers: [TeamMembersService, TeamMembersRouter],
  exports: [TeamMembersService, TeamMembersRouter],
})
export class TeamMembersModule {}