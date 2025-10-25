import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsService } from './organizations.service';
import { TeamsService } from './teams.service';
import { TeamMembersService } from './team-members.service';
import { OrganizationsController } from './organizations.controller';
import { TeamsController } from './teams.controller';
import { TeamMembersController } from './team-members.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    OrganizationsService,
    TeamsService,
    TeamMembersService,
  ],
  controllers: [
    OrganizationsController,
    TeamsController,
    TeamMembersController,
  ],
  exports: [
    OrganizationsService,
    TeamsService,
    TeamMembersService,
  ],
})
export class OrganizationsModule {}