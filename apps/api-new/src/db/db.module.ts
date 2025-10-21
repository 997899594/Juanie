import { Module } from '@nestjs/common';
import { drizzleProvider, PG_CONNECTION } from './drizzle.provider';

@Module({
  providers: [drizzleProvider],
  exports: [PG_CONNECTION],
})
export class DbModule {}