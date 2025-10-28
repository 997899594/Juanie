import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RepositoriesService } from './repositories.service';
import { RepositoriesRouter } from './repositories.router';

@Module({
  providers: [RepositoriesService, RepositoriesRouter, TrpcService],
  exports: [RepositoriesService, RepositoriesRouter]
})
export class RepositoriesModule {}