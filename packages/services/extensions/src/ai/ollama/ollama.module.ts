import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { OllamaService } from './ollama.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
