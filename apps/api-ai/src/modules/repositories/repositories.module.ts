import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [TrpcModule],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}