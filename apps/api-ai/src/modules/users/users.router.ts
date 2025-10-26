import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { UsersService } from './users.service';
import { 
  createUserSchema, 
  updateUserSchema, 
  selectUserSchema 
} from '../../database/schemas/users.schema';

@Injectable()
export class UsersRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly usersService: UsersService,
  ) {}

  public get usersRouter() {
    return this.trpc.router({
      // Hello endpoint for testing
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return {
            greeting: `Hello ${input.name ?? 'Users'}!`,
          };
        }),

      // 创建用户
      create: this.trpc.protectedProcedure
        .input(createUserSchema)
        .output(selectUserSchema)
        .mutation(async ({ input }) => {
          return await this.usersService.createUser(input);
        }),

      // 获取用户列表
      list: this.trpc.protectedProcedure
        .input(
          z.object({
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
            search: z.string().optional(),
          })
        )
        .output(z.array(selectUserSchema))
        .query(async ({ input }) => {
          const { limit, offset, search } = input;
          
          if (search) {
            return await this.usersService.searchUsers(search, limit, offset);
          }
          
          return await this.usersService.getUsers(limit, offset);
        }),

      // 根据ID获取用户
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectUserSchema.nullable())
        .query(async ({ input }) => {
          return await this.usersService.findById(input.id);
        }),

      // 根据邮箱获取用户
      getByEmail: this.trpc.protectedProcedure
        .input(z.object({ email: z.string().email() }))
        .output(selectUserSchema.nullable())
        .query(async ({ input }) => {
          return await this.usersService.findByEmail(input.email);
        }),

      // 根据用户名获取用户
      getByUsername: this.trpc.protectedProcedure
        .input(z.object({ username: z.string() }))
        .output(selectUserSchema.nullable())
        .query(async ({ input }) => {
          return await this.usersService.findByUsername(input.username);
        }),

      // 更新用户
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            data: updateUserSchema.partial(),
          })
        )
        .output(selectUserSchema)
        .mutation(async ({ input }) => {
          return await this.usersService.updateUser(input.id, input.data);
        }),

      // 删除用户
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.void())
        .mutation(async ({ input }) => {
          await this.usersService.deleteUser(input.id);
        }),

      // 搜索用户
      search: this.trpc.protectedProcedure
        .input(
          z.object({
            query: z.string().min(1),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
        )
        .output(z.array(selectUserSchema))
        .query(async ({ input }) => {
          return await this.usersService.searchUsers(input.query, input.limit, input.offset);
        }),

      // 更新最后登录时间
      updateLastLogin: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.void())
        .mutation(async ({ input }) => {
          await this.usersService.updateLastLogin(input.id);
        }),

      // 获取当前用户信息
      me: this.trpc.protectedProcedure
        .output(selectUserSchema.nullable())
        .query(async ({ ctx }) => {
          // TODO: 从上下文获取当前用户ID
          return null;
        }),
    });
  }
}