import { Module } from '@nestjs/common'
import { ProjectsRouter } from './projects.router'
import { ProjectsService } from './projects.service'

@Module({
  providers: [ProjectsService, ProjectsRouter],
  exports: [ProjectsService, ProjectsRouter],
})
export class ProjectsModule {}
