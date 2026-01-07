import { Module } from '@nestjs/common'
import { ValidatorService } from './services/validator.service'

@Module({
  providers: [ValidatorService],
  exports: [ValidatorService],
})
export class KubernetesModule {}
