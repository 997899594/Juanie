import { Global, Module } from '@nestjs/common'
import { K3sService } from './k3s.service'

@Global()
@Module({
  providers: [K3sService],
  exports: [K3sService],
})
export class K3sModule {}
