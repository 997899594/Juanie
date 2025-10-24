import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// 枚举定义
export const ThemePreferenceEnum = z.enum(["light", "dark", "system"]);
export const PreferredLanguageEnum = z.enum([
  "en",
  "zh",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  company: text("company"),
  website: text("website"),
  preferredLanguage: text("preferred_language").default("en"), // 'en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'
  timezone: text("timezone"),
  themePreference: text("theme_preference").default("system"), // 'light', 'dark', 'system'
  notificationPreferences: jsonb("notification_preferences").default({}),
  aiAssistantConfig: jsonb("ai_assistant_config").default({}),
  codingStylePreferences: jsonb("coding_style_preferences").default({}),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  securityKeys: jsonb("security_keys").default([]),
  lastSecurityAudit: timestamp("last_security_audit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
});

// Indexes
export const usersEmailIdx = index("users_email_idx").on(users.email);
export const usersUsernameIdx = index("users_username_idx").on(users.username);

// Zod Schemas with detailed enums
export const insertUserSchema = createInsertSchema(users);

export const selectUserSchema = createSelectSchema(users);

export const updateUserSchema = selectUserSchema.pick({
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  location: true,
  company: true,
  website: true,
  preferredLanguage: true,
  timezone: true,
  themePreference: true,
  notificationPreferences: true,
  aiAssistantConfig: true,
  codingStylePreferences: true,
  twoFactorEnabled: true,
  securityKeys: true,
  lastSecurityAudit: true,
  lastLoginAt: true,
  loginCount: true,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ThemePreference = z.infer<typeof ThemePreferenceEnum>;
export type PreferredLanguage = z.infer<typeof PreferredLanguageEnum>;
