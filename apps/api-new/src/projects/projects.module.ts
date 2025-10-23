import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}