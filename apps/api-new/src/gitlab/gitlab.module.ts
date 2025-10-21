import { Module } from '@nestjs/common';
import { GitLabController } from './gitlab.controller';
import { GitLabService } from './gitlab.service';

@Module({
  controllers: [GitLabController],
  providers: [GitLabService],
  exports: [GitLabService],
})
export class GitLabModule {}