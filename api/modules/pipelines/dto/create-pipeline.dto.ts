import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreatePipelineDto {
  @ApiProperty({ example: 'My CI/CD Pipeline', description: 'Pipeline name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    example: 'A comprehensive CI/CD pipeline for automated deployment', 
    description: 'Pipeline description',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ 
    example: 'clxxx123456789', 
    description: 'Project ID this pipeline belongs to'
  })
  @IsString()
  @IsUUID()
  projectId: string;
}