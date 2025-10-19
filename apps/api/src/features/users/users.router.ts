import { TRPCError } from "@trpc/server";
import {
  insertUserSchema,
  updateUserInputSchema,
  userIdSchema,
  userListQuerySchema,
} from "../../db/valibot";
import { publicProcedure, router } from "../../trpc/trpc";
import { UserService } from "./users.service";

export const usersRouter = router({
  list: publicProcedure
    .input(userListQuerySchema)
    .query(async ({ input, ctx }) => {
      const userService = new UserService(ctx.db);
      return await userService.list(input);
    }),

  byId: publicProcedure.input(userIdSchema).query(async ({ input, ctx }) => {
    const userService = new UserService(ctx.db);
    const user = await userService.getById(input.id);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    return user;
  }),

  create: publicProcedure
    .input(insertUserSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService(ctx.db);
      return userService.create(input);
    }),

  update: publicProcedure
    .input(updateUserInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService(ctx.db);
      const { id, ...data } = input;
      const updatedUser = await userService.update(id, data);

      if (!updatedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updatedUser;
    }),

  delete: publicProcedure
    .input(userIdSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService(ctx.db);
      const user = await userService.getById(input.id);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      await userService.delete(input.id);
      return { success: true };
    }),
});
