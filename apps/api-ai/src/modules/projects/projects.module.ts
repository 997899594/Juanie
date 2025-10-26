import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TrpcModule],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}