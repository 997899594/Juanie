import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RepositoriesService } from './repositories.service';

@Module({
    providers: [RepositoriesService, TrpcService],
  exports: [RepositoriesService]})
export class RepositoriesModule {}