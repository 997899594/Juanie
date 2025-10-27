import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, or, desc, asc, count, sql, ilike, inArray, gte, lte, isNull, gt } from 'drizzle-orm';
import * as schema from '../../database/schemas';
import { 
  teamMembers, 
  TeamMembershipRoleEnum,
  TeamMembershipStatusEnum,
  insertTeamMemberSchema,
  updateTeamMemberSchema 
} from '../../database/schemas/team-members.schema';

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * Hello method for testing
   */
  async hello(): Promise<string> {
    this.logger.log('Hello from TeamMembersService');
    return 'Hello from TeamMembersService';
  }

  /**
   * 获取团队成员列表
   */
  async getTeamMembers(teamId: string, limit = 20, offset = 0) {
    try {
      const members = await this.db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          role: teamMembers.role,
          status: teamMembers.status,
          invitedBy: teamMembers.invitedBy,
          joinedAt: teamMembers.joinedAt,
          createdAt: teamMembers.createdAt,
          updatedAt: teamMembers.updatedAt,
          user: {
            id: schema.users.id,
            email: schema.users.email,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
          },
          inviter: {
            id: schema.users.id,
            email: schema.users.email,
            username: schema.users.username,
            displayName: schema.users.displayName,
          }
        })
        .from(teamMembers)
        .leftJoin(schema.users, eq(teamMembers.userId, schema.users.id))
        .leftJoin(
          schema.users, 
          eq(teamMembers.invitedBy, schema.users.id)
        )
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(desc(teamMembers.joinedAt))
        .limit(limit)
        .offset(offset);

      return members;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team members: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 添加团队成员
   */
  async addTeamMember(memberData: {
    teamId: string;
    userId: string;
    role?: 'member' | 'maintainer' | 'owner';
    invitedBy?: string;
  }) {
    try {
      // 检查用户是否已经是团队成员
      const existingMember = await this.db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, memberData.teamId),
            eq(teamMembers.userId, memberData.userId),
            eq(teamMembers.status, 'active')
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new ConflictException('User is already a member of this team');
      }

      // 添加团队成员
      const [newMember] = await this.db
        .insert(teamMembers)
        .values({
          teamId: memberData.teamId,
          userId: memberData.userId,
          role: memberData.role || 'member',
          status: 'active',
          invitedBy: memberData.invitedBy,
          joinedAt: new Date(),
        })
        .returning();

      this.logger.log(`Team member added: ${newMember.id}`);
      return newMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add team member: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 移除团队成员
   */
  async removeTeamMember(teamId: string, userId: string) {
    try {
      const deletedMember = await this.db
        .update(teamMembers)
        .set({
          status: 'removed',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            eq(teamMembers.status, 'active')
          )
        )
        .returning();

      if (deletedMember.length === 0) {
        throw new NotFoundException('User is not an active member of this team');
      }

      this.logger.log(`Team member removed: ${deletedMember[0].id}`);
      return deletedMember[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove team member: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新团队成员角色
   */
  async updateMemberRole(teamId: string, userId: string, role: 'member' | 'maintainer' | 'owner') {
    try {
      const updatedMember = await this.db
        .update(teamMembers)
        .set({
          role,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            eq(teamMembers.status, 'active')
          )
        )
        .returning();

      if (updatedMember.length === 0) {
        throw new NotFoundException('User is not an active member of this team');
      }

      this.logger.log(`Team member role updated: ${updatedMember[0].id}`);
      return updatedMember[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update member role: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取用户在团队中的角色
   */
  async getUserTeamRole(teamId: string, userId: string) {
    try {
      const [member] = await this.db
        .select({
          id: teamMembers.id,
          role: teamMembers.role,
          status: teamMembers.status,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            eq(teamMembers.status, 'active')
          )
        )
        .limit(1);

      return member || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user team role: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取用户所属的团队列表
   */
  async getUserTeams(userId: string, limit = 20, offset = 0) {
    try {
      const userTeams = await this.db
        .select({
          id: teamMembers.id,
          role: teamMembers.role,
          status: teamMembers.status,
          joinedAt: teamMembers.joinedAt,
          team: {
            id: schema.teams.id,
            name: schema.teams.name,
            slug: schema.teams.slug,
            description: schema.teams.description,
            organizationId: schema.teams.organizationId,
          }
        })
        .from(teamMembers)
        .leftJoin(schema.teams, eq(teamMembers.teamId, schema.teams.id))
        .where(
          and(
            eq(teamMembers.userId, userId),
            eq(teamMembers.status, 'active')
          )
        )
        .orderBy(desc(teamMembers.joinedAt))
        .limit(limit)
        .offset(offset);

      return userTeams;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user teams: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查用户是否为团队成员
   */
  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    try {
      const [member] = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            eq(teamMembers.status, 'active')
          )
        )
        .limit(1);

      return !!member;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check team membership: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队成员统计
   */
  async getTeamMemberStats(teamId: string) {
    try {
      const stats = await this.db
        .select({
          total: count(),
          role: teamMembers.role,
        })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.status, 'active')
          )
        )
        .groupBy(teamMembers.role);

      const totalMembers = stats.reduce((sum, stat) => sum + stat.total, 0);
      const roleBreakdown = stats.reduce((acc, stat) => {
        acc[stat.role] = stat.total;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalMembers,
        roleBreakdown,
        stats,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team member stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量添加团队成员
   */
  async addMultipleTeamMembers(teamId: string, members: Array<{
    userId: string;
    role?: 'member' | 'maintainer' | 'owner';
  }>, invitedBy?: string) {
    try {
      const memberData = members.map(member => ({
        teamId,
        userId: member.userId,
        role: member.role || 'member',
        status: 'active' as const,
        invitedBy,
        joinedAt: new Date(),
      }));

      const newMembers = await this.db
        .insert(teamMembers)
        .values(memberData)
        .returning();

      this.logger.log(`Added ${newMembers.length} team members to team ${teamId}`);
      return newMembers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add multiple team members: ${errorMessage}`);
      throw error;
    }
  }
}