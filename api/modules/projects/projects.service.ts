import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { Project, Role } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createProjectDto: CreateProjectDto,
    userId: string
  ): Promise<Project> {
    return this.prisma.project.create({
      data: {
        ...createProjectDto,
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, userRole: Role): Promise<Project[]> {
    // Admin can see all projects, others can only see their own projects
    const whereClause = userRole === Role.ADMIN 
      ? {} 
      : {
          OR: [
            { createdBy: userId },
          ],
        };

    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: {
            deployments: true,
            pipelines: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async findOne(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        pipelines: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    // Check if user has access to this project
    const hasAccess =
      userRole === UserRole.ADMIN ||
      project.ownerId === userId ||
      project.members.some((member) => member.id === userId);

    if (!hasAccess) {
      throw new ForbiddenException("You do not have access to this project");
    }

    return project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
    userRole: UserRole
  ): Promise<Project> {
    const project = await this.findOne(id, userId, userRole);

    // Only owner or admin can update project
    if (project.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        "Only project owner or admin can update this project"
      );
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async remove(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<Project> {
    const project = await this.findOne(id, userId, userRole);

    // Only owner or admin can delete project
    if (project.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        "Only project owner or admin can delete this project"
      );
    }

    return this.prisma.project.delete({
      where: { id },
    });
  }

  async addMember(
    projectId: string,
    memberId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Project> {
    const project = await this.findOne(projectId, userId, userRole);

    // Only owner or admin can add members
    if (project.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        "Only project owner or admin can add members"
      );
    }

    // Check if user is already a member
    const existingMember = project.members.find(
      (member) => member.id === memberId
    );
    if (existingMember) {
      throw new ForbiddenException("User is already a member of this project");
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        members: {
          connect: { id: memberId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async removeMember(
    projectId: string,
    memberId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Project> {
    const project = await this.findOne(projectId, userId, userRole);

    // Only owner or admin can remove members
    if (project.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        "Only project owner or admin can remove members"
      );
    }

    // Cannot remove the owner
    if (memberId === project.ownerId) {
      throw new ForbiddenException("Cannot remove project owner");
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        members: {
          disconnect: { id: memberId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async getProjectStats(projectId: string, userId: string, userRole: UserRole) {
    const project = await this.findOne(projectId, userId, userRole);

    const stats = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        _count: {
          select: {
            deployments: true,
            pipelines: true,
            members: true,
          },
        },
        deployments: {
          select: {
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        pipelines: {
          select: {
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    return {
      totalDeployments: stats._count.deployments,
      totalPipelines: stats._count.pipelines,
      totalMembers: stats._count.members + 1, // +1 for owner
      recentDeployments: stats.deployments,
      recentPipelines: stats.pipelines,
    };
  }
}
