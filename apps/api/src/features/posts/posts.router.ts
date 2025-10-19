import { TRPCError } from "@trpc/server";
import {
  insertPostSchema,
  postIdSchema,
  postListQuerySchema,
  updatePostInputSchema,
} from "../../db/valibot";
import { publicProcedure, router } from "../../trpc/trpc";
import { PostService } from "./posts.service";

export const postsRouter = router({
  list: publicProcedure
    .input(postListQuerySchema)
    .query(async ({ input, ctx }) => {
      const postService = new PostService(ctx.db);
      return postService.list(input);
    }),

  byId: publicProcedure.input(postIdSchema).query(async ({ input, ctx }) => {
    const postService = new PostService(ctx.db);
    const post = await postService.getById(input.id);
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Post not found",
      });
    }
    return post;
  }),

  create: publicProcedure
    .input(insertPostSchema)
    .mutation(async ({ input, ctx }) => {
      const postService = new PostService(ctx.db);
      return postService.create(input);
    }),

  update: publicProcedure
    .input(updatePostInputSchema)
    .mutation(async ({ input, ctx }) => {
      const postService = new PostService(ctx.db);
      const { id, ...data } = input;
      const updatedPost = await postService.update(id, data);
      
      if (!updatedPost) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }
      
      return updatedPost;
    }),

  delete: publicProcedure
    .input(postIdSchema)
    .mutation(async ({ input, ctx }) => {
      const postService = new PostService(ctx.db);
      const post = await postService.getById(input.id);
      
      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }
      
      await postService.delete(input.id);
      return { success: true };
    }),
});
