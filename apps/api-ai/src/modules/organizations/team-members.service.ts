import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and, or, desc } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { 
  teamMembers, 
  TeamMember, 
  NewTeamMember, 
  UpdateTeamMember,
  TeamMembershipRole,
  TeamMembershipStatus,
  insertTeamMemberSchema,
  updateTeamMemberSchema 
} from '../../database/schemas/team-members.schema';

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 添加团队成员
   */
  async addTeamMember(memberData: NewTeamMember): Promise<TeamMember> {
    try {
      // 验证输入数据
      insertTeamMemberSchema.parse(memberData);
      
      // 检查用户是否已经是团队成员
      const existingMember = await this.findByTeamAndUser(
        memberData.teamId, 
        memberData.userId
      );
      if (existingMember) {
        throw new ConflictException('User is already a member of this team');
      }

      const [newMember] = await this.db
        .insert(teamMembers)
        .values(memberData)
        .returning();

      this.logger.log(`Team member added: ${newMember.userId} to team ${newMember.teamId}`);
      return newMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add team member: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID查找团队成员
   */
  async findById(id: string): Promise<TeamMember | null> {
    try {
      const [member] = await this.db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, id))
        .limit(1);

      return member || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find team member by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据团队ID和用户ID查找成员
   */
  async findByTeamAndUser(teamId: string, userId: string): Promise<TeamMember | null> {
    try {
      const [member] = await this.db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ))
        .limit(1);

      return member || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find team member by team ${teamId} and user ${userId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队的所有成员
   */
  async getTeamMembers(
    teamId: string, 
    status?: TeamMembershipStatus,
    limit = 50, 
    offset = 0
  ): Promise<TeamMember[]> {
    try {
      const conditions = [eq(teamMembers.teamId, teamId)];
      
      if (status) {
        conditions.push(eq(teamMembers.status, status));
      }

      return await this.db
        .select()
        .from(teamMembers)
        .where(and(...conditions))
        .orderBy(desc(teamMembers.joinedAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team members for team ${teamId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取用户参与的所有团队
   */
  async getUserTeams(
    userId: string, 
    status?: TeamMembershipStatus,
    limit = 50, 
    offset = 0
  ): Promise<TeamMember[]> {
    try {
      const conditions = [eq(teamMembers.userId, userId)];
      
      if (status) {
        conditions.push(eq(teamMembers.status, status));
      }

      return await this.db
        .select()
        .from(teamMembers)
        .where(and(...conditions))
        .orderBy(desc(teamMembers.joinedAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user teams for user ${userId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新团队成员信息
   */
  async updateTeamMember(id: string, updateData: UpdateTeamMember): Promise<TeamMember> {
    try {
      // 验证输入数据
      updateTeamMemberSchema.parse(updateData);

      // 检查成员是否存在
      const existingMember = await this.findById(id);
      if (!existingMember) {
        throw new NotFoundException('Team member not found');
      }

      const updateObject = {
        ...updateData,
        updatedAt: new Date(),
      };

      const [updatedMember] = await this.db
        .update(teamMembers)
        .set(updateObject)
        .where(eq(teamMembers.id, id))
        .returning();

      this.logger.log(`Team member updated: ${id}`);
      return updatedMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update team member ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(id: string, role: TeamMembershipRole): Promise<TeamMember> {
    try {
      const existingMember = await this.findById(id);
      if (!existingMember) {
        throw new NotFoundException('Team member not found');
      }

      const [updatedMember] = await this.db
        .update(teamMembers)
        .set({ 
          role,
          updatedAt: new Date()
        })
        .where(eq(teamMembers.id, id))
        .returning();

      this.logger.log(`Team member role updated: ${id} to ${role}`);
      return updatedMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update team member role ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新成员状态
   */
  async updateMemberStatus(id: string, status: TeamMembershipStatus): Promise<TeamMember> {
    try {
      const existingMember = await this.findById(id);
      if (!existingMember) {
        throw new NotFoundException('Team member not found');
      }

      const [updatedMember] = await this.db
        .update(teamMembers)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(teamMembers.id, id))
        .returning();

      this.logger.log(`Team member status updated: ${id} to ${status}`);
      return updatedMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update team member status ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 移除团队成员
   */
  async removeTeamMember(id: string): Promise<void> {
    try {
      const existingMember = await this.findById(id);
      if (!existingMember) {
        throw new NotFoundException('Team member not found');
      }

      await this.db
        .delete(teamMembers)
        .where(eq(teamMembers.id, id));

      this.logger.log(`Team member removed: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove team member ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据团队和用户移除成员
   */
  async removeTeamMemberByTeamAndUser(teamId: string, userId: string): Promise<void> {
    try {
      const existingMember = await this.findByTeamAndUser(teamId, userId);
      if (!existingMember) {
        throw new NotFoundException('Team member not found');
      }

      await this.db
        .delete(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        ));

      this.logger.log(`Team member removed: user ${userId} from team ${teamId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove team member by team and user: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队成员数量统计
   */
  async getTeamMemberCount(teamId: string, status?: TeamMembershipStatus): Promise<number> {
    try {
      const conditions = [eq(teamMembers.teamId, teamId)];
      
      if (status) {
        conditions.push(eq(teamMembers.status, status));
      }

      const result = await this.db
        .select({ count: teamMembers.id })
        .from(teamMembers)
        .where(and(...conditions));

      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team member count for team ${teamId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队的所有者
   */
  async getTeamOwners(teamId: string): Promise<TeamMember[]> {
    try {
      return await this.db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.role, 'owner'),
          eq(teamMembers.status, 'active')
        ))
        .orderBy(desc(teamMembers.joinedAt));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team owners for team ${teamId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查用户是否为团队成员
   */
  async isTeamMember(teamId: string, userId: string, status: TeamMembershipStatus = 'active'): Promise<boolean> {
    try {
      const member = await this.db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, status)
        ))
        .limit(1);

      return member.length > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check team membership: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查用户是否为团队管理员（maintainer或owner）
   */
  async isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
    try {
      const member = await this.db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active')
        ))
        .limit(1);

      if (member.length === 0) return false;
      
      return ['maintainer', 'owner'].includes(member[0].role);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check team admin status: ${errorMessage}`);
      throw error;
    }
  }
}