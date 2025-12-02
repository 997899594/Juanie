import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { z } from 'zod'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    username: text('username').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),

    // 用户偏好（JSONB）
    preferences: jsonb('preferences')
      .$type<{
        language: 'en' | 'zh'
        themeMode: 'light' | 'dark' | 'system'
        themeId: 'default' | 'github' | 'bilibili' | string
        notifications: {
          email: boolean
          inApp: boolean
        }
        ui?: {
          radius?: number
          compactMode?: boolean
          animationsEnabled?: boolean
        }
      }>()
      .default({
        language: 'en',
        themeMode: 'system',
        themeId: 'default',
        notifications: { email: true, inApp: true },
      }),

    lastLoginAt: timestamp('last_login_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_deleted_idx').on(table.deletedAt),
  ],
)

// Zod schemas
export const insertUserSchema = z.object({
  email: z.string().email(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
})

export const selectUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  preferences: z.object({
    language: z.enum(['en', 'zh']),
    themeMode: z.enum(['light', 'dark', 'system']),
    themeId: z.enum(['default', 'github', 'bilibili']),
    notifications: z.object({
      email: z.boolean(),
      inApp: z.boolean(),
    }),
    ui: z
      .object({
        radius: z.number().optional(),
        compactMode: z.boolean().optional(),
        animationsEnabled: z.boolean().optional(),
      })
      .optional(),
  }),
  lastLoginAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// Relations
import { relations } from 'drizzle-orm'
import { userGitAccounts } from './user-git-accounts.schema'

export const usersRelations = relations(users, ({ many }) => ({
  gitAccounts: many(userGitAccounts),
}))
