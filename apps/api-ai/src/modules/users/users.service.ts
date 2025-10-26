import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schemas';
import { 
  users, 
  User, 
  NewUser, 
  UpdateUser,
  insertUserSchema,
  updateUserSchema,
  createUserSchema 
} from '../../database/schemas/users.schema';
import { z } from 'zod';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  /**
   * 创建新用户
   */
  async createUser(userData: z.infer<typeof createUserSchema>): Promise<User> {
    try {
      // 验证输入数据
      const validatedData = createUserSchema.parse(userData);
      
      // 检查邮箱是否已存在
      if (validatedData.email) {
        const existingUser = await this.findByEmail(validatedData.email);
        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
      }

      // 检查用户名是否已存在
      if (validatedData.username) {
        const existingUser = await this.findByUsername(validatedData.username);
        if (existingUser) {
          throw new ConflictException('Username already exists');
        }
      }

      const [newUser] = await this.db
        .insert(users)
        .values(validatedData as any)
        .returning();

      this.logger.log(`User created: ${newUser.id}`);
      return newUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error}`);
      throw error;
    }
  }

  /**
   * 根据ID查找用户
   */
  async findById(id: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user || null;
    } catch (error) {
      this.logger.error(`Failed to find user by ID ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return user || null;
    } catch (error) {
      this.logger.error(`Failed to find user by email ${email}: ${error}`);
      throw error;
    }
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      return user || null;
    } catch (error) {
      this.logger.error(`Failed to find user by username ${username}: ${error}`);
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updateData: Partial<UpdateUser>): Promise<User> {
    try {
      // 验证输入数据
      const validatedData = updateUserSchema.partial().parse(updateData);

      // 检查用户是否存在
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // 检查邮箱冲突
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailUser = await this.findByEmail(validatedData.email);
        if (emailUser && emailUser.id !== id) {
          throw new ConflictException('Email already exists');
        }
      }

      // 检查用户名冲突
      if (validatedData.username && validatedData.username !== existingUser.username) {
        const usernameUser = await this.findByUsername(validatedData.username);
        if (usernameUser && usernameUser.id !== id) {
          throw new ConflictException('Username already exists');
        }
      }

      const [updatedUser] = await this.db
        .update(users)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      this.logger.log(`User updated: ${id}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      await this.db
        .delete(users)
        .where(eq(users.id, id));

      this.logger.log(`User deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 搜索用户
   */
  async searchUsers(query: string, limit = 20, offset = 0): Promise<User[]> {
    try {
      const searchPattern = `%${query}%`;
      
      return await this.db
        .select()
        .from(users)
        .where(
          or(
            ilike(users.email, searchPattern),
            ilike(users.username, searchPattern),
            ilike(users.displayName, searchPattern)
          )
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.logger.error(`Failed to search users: ${error}`);
      throw error;
    }
  }

  /**
   * 获取用户列表
   */
  async getUsers(limit = 20, offset = 0): Promise<User[]> {
    try {
      return await this.db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.logger.error(`Failed to get users: ${error}`);
      throw error;
    }
  }

  /**
   * 更新用户最后登录时间
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({ 
          lastLoginAt: new Date(),
          loginCount: sql`${users.loginCount} + 1`
        })
        .where(eq(users.id, id));

      this.logger.log(`Updated last login for user: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to update last login for user ${id}: ${error}`);
      throw error;
    }
  }
}