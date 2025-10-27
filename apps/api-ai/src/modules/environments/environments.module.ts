import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsRouter } from './environments.router';

@Module({
    providers: [EnvironmentsService, EnvironmentsRouter, TrpcService],
  exports: [EnvironmentsService, EnvironmentsRouter]})
export class EnvironmentsModule {}