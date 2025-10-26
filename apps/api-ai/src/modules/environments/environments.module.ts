import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsRouter } from './environments.router';

@Module({
  imports: [TrpcModule],
  providers: [EnvironmentsService, EnvironmentsRouter],
  exports: [EnvironmentsService, EnvironmentsRouter],
})
export class EnvironmentsModule {}