import { Module } from '@nestjs/common'
import { OrganizationEventsService } from './organization-events.service'
import { OrganizationsService } from './organizations.service'

@Module({
  providers: [OrganizationsService, OrganizationEventsService],
  exports: [OrganizationsService, OrganizationEventsService],
})
export class OrganizationsModule {}
