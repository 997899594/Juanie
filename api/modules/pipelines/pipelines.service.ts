import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { Pipeline, Role } from '@prisma/client';

@Injectable()
export class PipelinesService {
  constructor(private prisma: PrismaService) {}

  async create(createPipelineDto: CreatePipelineDto, userId: string): Promise<Pipeline> {
    return this.prisma.pipeline.create({
      data: {
        ...createPipelineDto,
        projectId: createPipelineDto.projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, userRole: Role): Promise<Pipeline[]> {
    // Admin can see all pipelines, others can only see pipelines from their projects
    const whereClause = userRole === Role.ADMIN 
      ? {} 
      : {
          project: {
            createdBy: userId,
          },
        };

    return this.prisma.pipeline.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string, userRole: Role): Promise<Pipeline> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            createdBy: true,
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    // Check if user has access to this pipeline
    const hasAccess =
      userRole === Role.ADMIN ||
      pipeline.project.createdBy === userId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this pipeline');
    }

    return pipeline;
  }

  async update(id: string, updatePipelineDto: UpdatePipelineDto, userId: string, userRole: Role): Promise<Pipeline> {
    const pipeline = await this.findOne(id, userId, userRole);

    return this.prisma.pipeline.update({
      where: { id },
      data: updatePipelineDto,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string, userRole: Role): Promise<void> {
    const pipeline = await this.findOne(id, userId, userRole);

    await this.prisma.pipeline.delete({
      where: { id },
    });
  }

  async run(id: string, userId: string, userRole: Role): Promise<Pipeline> {
    const pipeline = await this.findOne(id, userId, userRole);

    // Update pipeline status to running
    return this.prisma.pipeline.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}