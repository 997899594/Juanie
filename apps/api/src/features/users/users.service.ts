import { and, asc, count, desc, eq, like } from "drizzle-orm";
import type { Database } from "../../db";
import { users } from "../../db/schema";
import type {
  InsertUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
} from "../../db/valibot";

export class UserService {
  constructor(private db: Database) {}

  async list(query: UserListQuerySchema) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [];
    if (search) {
      conditions.push(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 构建排序
    const orderBy =
      sortOrder === "asc" ? asc(users[sortBy]) : desc(users[sortBy]);

    // 获取总数和数据
    const [totalResult, data] = await Promise.all([
      this.db.select({ count: count() }).from(users).where(whereClause),
      this.db
        .select()
        .from(users)
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
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async create(data: InsertUserSchema) {
    const [newUser] = await this.db.insert(users).values(data).returning();

    return newUser;
  }

  async update(id: string, data: UpdateUserSchema) {
    const [updatedUser] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return updatedUser;
  }

  async delete(id: string) {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
