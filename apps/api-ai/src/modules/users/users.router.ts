import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { UsersService } from './users.service';
import { 
  createUserSchema, 
  updateUserSchema, 
  selectUserSchema 
} from '../../database/schemas/users.schema';

export const createUsersRouter = (trpc: TrpcService, usersService: UsersService) => {
  return trpc.router({
    // 创建用户
    create: trpc.protectedProcedure
      .input(createUserSchema)
      .output(selectUserSchema)
      .mutation(async ({ input }) => {
        return usersService.createUser(input);
      }),

    // 获取用户列表
    list: trpc.protectedProcedure
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
          return usersService.searchUsers(search, limit, offset);
        }
        
        return usersService.getUsers(limit, offset);
      }),

    // 根据ID获取用户
    getById: trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .output(selectUserSchema.nullable())
      .query(async ({ input }) => {
        return usersService.findById(input.id);
      }),

    // 根据邮箱获取用户
    getByEmail: trpc.protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .output(selectUserSchema.nullable())
      .query(async ({ input }) => {
        return usersService.findByEmail(input.email);
      }),

    // 根据用户名获取用户
    getByUsername: trpc.protectedProcedure
      .input(z.object({ username: z.string() }))
      .output(selectUserSchema.nullable())
      .query(async ({ input }) => {
        return usersService.findByUsername(input.username);
      }),

    // 更新用户
    update: trpc.protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: updateUserSchema.partial(),
        })
      )
      .output(selectUserSchema)
      .mutation(async ({ input }) => {
        return usersService.updateUser(input.id, input.data);
      }),

    // 删除用户
    delete: trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .output(z.void())
      .mutation(async ({ input }) => {
        await usersService.deleteUser(input.id);
      }),

    // 搜索用户
    search: trpc.protectedProcedure
      .input(
        z.object({
          query: z.string().min(1),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
      )
      .output(z.array(selectUserSchema))
      .query(async ({ input }) => {
        return usersService.searchUsers(input.query, input.limit, input.offset);
      }),

    // 更新最后登录时间
    updateLastLogin: trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .output(z.void())
      .mutation(async ({ input }) => {
        await usersService.updateLastLogin(input.id);
      }),

    // 获取当前用户信息
    me: trpc.protectedProcedure
      .output(selectUserSchema.nullable())
      .query(async ({ ctx }) => {
        // TODO: 从上下文获取当前用户ID
        return null;
      }),
  });
};

@Injectable()
export class UsersRouter {
  public usersRouter: ReturnType<typeof createUsersRouter>;

  constructor(
    private readonly trpc: TrpcService,
    private readonly usersService: UsersService,
  ) {
    this.usersRouter = createUsersRouter(this.trpc, this.usersService);
  }
}