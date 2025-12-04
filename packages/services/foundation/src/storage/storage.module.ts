import { Global, Module } from '@nestjs/common'
// import { ConfigModule } from '@nestjs/config'
import { StorageService } from './storage.service'

@Global()
@Module({
  imports: [], // ConfigModule removed due to build issues
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
