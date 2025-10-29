import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    username: text('username').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),

    // 用户偏好（JSONB）
    preferences: jsonb('preferences').$type<{
        language: 'en' | 'zh';
        theme: 'light' | 'dark' | 'system';
        notifications: {
            email: boolean;
            inApp: boolean;
        };
    }>().default({
        language: 'en',
        theme: 'system',
        notifications: { email: true, inApp: true },
    }),

    lastLoginAt: timestamp('last_login_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('users_email_idx').on(table.email),
    index('users_deleted_idx').on(table.deletedAt),
]);

// Zod schemas
export const insertUserSchema = z.object({
    email: z.string().email(),
    username: z.string().optional(),
    displayName: z.string().optional(),
    avatarUrl: z.string().url().optional(),
});

export const selectUserSchema = z.object({
    id: z.uuid(),
    email: z.string().email(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    preferences: z.object({
        language: z.enum(['en', 'zh']),
        theme: z.enum(['light', 'dark', 'system']),
        notifications: z.object({
            email: z.boolean(),
            inApp: z.boolean(),
        }),
    }),
    lastLoginAt: z.date().nullable(),
    deletedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
