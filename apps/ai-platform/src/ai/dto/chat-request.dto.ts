import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'

export class ChatMessage {
  @IsString()
  role!: 'user' | 'assistant' | 'system'

  @IsString()
  content!: string
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages!: ChatMessage[]

  @IsOptional()
  @IsString()
  tenantId?: string

  @IsOptional()
  @IsString()
  userId?: string
}
