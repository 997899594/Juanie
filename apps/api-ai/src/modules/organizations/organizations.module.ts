import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsService } from './organizations.service';
import { TeamsService } from './teams.service';
import { TeamMembersService } from './team-members.service';
import { OrganizationsController } from './organizations.controller';
import { TeamsController } from './teams.controller';
import { TeamMembersController } from './team-members.controller';
import { OrganizationsRouter } from './organizations.router';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationsService, TeamsService, TeamMembersService, TrpcService, OrganizationsRouter],
  controllers: [
    OrganizationsController,
    TeamsController,
    TeamMembersController],
  exports: [
    OrganizationsService,
    TeamsService,
    TeamMembersService,
    OrganizationsRouter],
})
export class OrganizationsModule {}