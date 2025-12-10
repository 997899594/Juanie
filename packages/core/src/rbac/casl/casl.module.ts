import { Module } from '@nestjs/common'
import { CaslGuard } from './casl.guard'
import { CaslAbilityFactory } from './casl-ability.factory'

@Module({
  providers: [CaslAbilityFactory, CaslGuard],
  exports: [CaslAbilityFactory, CaslGuard],
})
export class CaslModule {}
