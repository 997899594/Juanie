import { and, asc, count, desc, eq, like } from "drizzle-orm";
import type { Database } from "../../db";
import { posts, users } from "../../db/schema";
import type {
  InsertPostSchema,
  PostListQuerySchema,
  UpdatePostSchema,
} from "../../db/valibot";

export class PostService {
  constructor(private db: Database) {}

  async list(query: PostListQuerySchema) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      authorId,
    } = query;

    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [];
    if (search) {
      conditions.push(
        like(posts.title, `%${search}%`),
        like(posts.content, `%${search}%`)
      );
    }
    if (authorId) {
      conditions.push(eq(posts.authorId, authorId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 构建排序
    const orderBy =
      sortOrder === "asc" ? asc(posts[sortBy]) : desc(posts[sortBy]);

    // 获取总数和数据
    const [totalResult, data] = await Promise.all([
      this.db.select({ count: count() }).from(posts).where(whereClause),
      this.db
        .select({
          id: posts.id,
          title: posts.title,
          content: posts.content,
          published: posts.published,
          authorId: posts.authorId,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async getById(id: string) {
    const [post] = await this.db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        published: posts.published,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, id))
      .limit(1);

    return post || null;
  }

  async create(data: InsertPostSchema) {
    const [newPost] = await this.db.insert(posts).values(data).returning();

    return newPost;
  }

  async update(id: string, data: UpdatePostSchema) {
    const [updatedPost] = await this.db
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();

    return updatedPost;
  }

  async delete(id: string) {
    await this.db.delete(posts).where(eq(posts.id, id));
  }
}
