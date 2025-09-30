import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ProjectStatus, TechStack } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'My DevOps Project', description: 'Project name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    example: 'A comprehensive DevOps platform for managing CI/CD pipelines', 
    description: 'Project description',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ 
    example: 'https://github.com/user/project', 
    description: 'Repository URL',
    required: false 
  })
  @IsOptional()
  @IsUrl()
  repositoryUrl?: string;

  @ApiProperty({ 
    example: ProjectStatus.ACTIVE, 
    description: 'Project status',
    enum: ProjectStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ 
    example: TechStack.NODEJS, 
    description: 'Technology stack',
    enum: TechStack,
    required: false 
  })
  @IsOptional()
  @IsEnum(TechStack)
  techStack?: TechStack;

  @ApiProperty({ 
    example: 'main', 
    description: 'Default branch',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultBranch?: string;

  @ApiProperty({ 
    example: 'production', 
    description: 'Environment',
    required: false 
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;
}