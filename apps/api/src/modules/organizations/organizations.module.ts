import { Module } from '@nestjs/common'
import { OrganizationsRouter } from './organizations.router'
import { OrganizationsService } from './organizations.service'

@Module({
  providers: [OrganizationsService, OrganizationsRouter],
  exports: [OrganizationsService, OrganizationsRouter],
})
export class OrganizationsModule {}
