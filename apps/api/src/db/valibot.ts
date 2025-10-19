import * as v from "valibot";
import { posts, users } from "./schema";
import { createInsertSchema, createSelectSchema } from "drizzle-valibot";

// Users schemas
export const insertUserSchema = createInsertSchema(users) satisfies v.GenericSchema;

export const selectUserSchema = createSelectSchema(users) satisfies v.GenericSchema;

export const updateUserSchema = v.object({
  name: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Name is required"),
      v.maxLength(100, "Name too long")
    )
  ),
  email: v.optional(v.pipe(v.string(), v.email("Invalid email format"))),
  image: v.optional(v.pipe(v.string(), v.url("Invalid image URL"))),
  isActive: v.optional(v.boolean()),
});

// 用于路由器输入的 schema，包含 id
export const updateUserInputSchema = v.object({
  id: v.pipe(v.string(), v.uuid("Invalid user ID")),
  name: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Name is required"),
      v.maxLength(100, "Name too long")
    )
  ),
  email: v.optional(v.pipe(v.string(), v.email("Invalid email format"))),
  image: v.optional(v.pipe(v.string(), v.url("Invalid image URL"))),
  isActive: v.optional(v.boolean()),
});

// Posts schemas
export const insertPostSchema = createInsertSchema(posts) satisfies v.GenericSchema;

export const selectPostSchema = createSelectSchema(posts) satisfies v.GenericSchema;

export const updatePostSchema = v.object({
  title: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Title is required"),
      v.maxLength(200, "Title too long")
    )
  ),
  content: v.optional(v.string()),
  slug: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Slug is required"),
      v.regex(/^[a-z0-9-]+$/, "Invalid slug format")
    )
  ),
  authorId: v.optional(v.pipe(v.string(), v.uuid("Invalid author ID"))),
  published: v.optional(v.boolean()),
});

// 用于路由器输入的 schema，包含 id
export const updatePostInputSchema = v.object({
  id: v.pipe(v.string(), v.uuid("Invalid post ID")),
  title: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Title is required"),
      v.maxLength(200, "Title too long")
    )
  ),
  content: v.optional(v.string()),
  slug: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1, "Slug is required"),
      v.regex(/^[a-z0-9-]+$/, "Invalid slug format")
    )
  ),
  authorId: v.optional(v.pipe(v.string(), v.uuid("Invalid author ID"))),
  published: v.optional(v.boolean()),
});

// 查询参数 schemas
export const userListQuerySchema = v.object({
  search: v.optional(v.string()),
  sortBy: v.optional(v.picklist(["name", "email", "createdAt"])),
  sortOrder: v.optional(v.picklist(["asc", "desc"])),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
  ),
});

export const userIdSchema = v.object({
  id: v.pipe(v.string(), v.uuid("Invalid user ID")),
});

export const postListQuerySchema = v.object({
  search: v.optional(v.string()),
  authorId: v.optional(v.pipe(v.string(), v.uuid())),
  published: v.optional(v.boolean()),
  sortBy: v.optional(v.picklist(["title", "createdAt", "updatedAt"])),
  sortOrder: v.optional(v.picklist(["asc", "desc"])),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  limit: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
  ),
});

export const postIdSchema = v.object({
  id: v.pipe(v.string(), v.uuid("Invalid post ID")),
});

// Type exports
export type InsertUserSchema = v.InferInput<typeof insertUserSchema>;
export type UpdateUserSchema = v.InferInput<typeof updateUserSchema>;
export type UpdateUserInputSchema = v.InferInput<typeof updateUserInputSchema>;
export type UserListQuerySchema = v.InferInput<typeof userListQuerySchema>;

export type InsertPostSchema = v.InferInput<typeof insertPostSchema>;
export type UpdatePostSchema = v.InferInput<typeof updatePostSchema>;
export type UpdatePostInputSchema = v.InferInput<typeof updatePostInputSchema>;
export type PostListQuerySchema = v.InferInput<typeof postListQuerySchema>;
