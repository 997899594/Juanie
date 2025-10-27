import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
  id: uuid("id").defaultRandom().primaryKey(),
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
  // 简化notification_preferences JSONB字段
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(false),
  marketingEmails: boolean("marketing_emails").default(false),
  
  // 简化ai_assistant_config JSONB字段
  aiModelPreference: text("ai_model_preference").default("gpt-4"),
  aiTonePreference: text("ai_tone_preference").default("balanced"), // 'formal', 'casual', 'balanced'
  aiAutoComplete: boolean("ai_auto_complete").default(true),
  
  // 简化coding_style_preferences JSONB字段
  preferredIndentation: text("preferred_indentation").default("spaces"), // 'tabs', 'spaces'
  indentSize: integer("indent_size").default(2),
  preferSemicolons: boolean("prefer_semicolons").default(true),
  
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  
  // 简化security_keys JSONB字段
  backupCodesCount: integer("backup_codes_count").default(0),
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
export const insertUserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  username: z.string().min(1).max(50).optional(),
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  website: z.string().url().optional(),
  preferredLanguage: PreferredLanguageEnum.optional(),
  timezone: z.string().optional(),
  themePreference: ThemePreferenceEnum.optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  aiModelPreference: z.string().optional(),
  aiTonePreference: z.enum(["formal", "casual", "balanced"]).optional(),
  aiAutoComplete: z.boolean().optional(),
  preferredIndentation: z.enum(["tabs", "spaces"]).optional(),
  indentSize: z.number().int().min(1).max(8).optional(),
  preferSemicolons: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  backupCodesCount: z.number().int().min(0).optional(),
  lastSecurityAudit: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastLoginAt: z.date().optional(),
  loginCount: z.number().int().min(0).optional(),
});

export const selectUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  company: z.string().nullable(),
  website: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  timezone: z.string().nullable(),
  themePreference: z.string().nullable(),
  emailNotifications: z.boolean().nullable(),
  pushNotifications: z.boolean().nullable(),
  marketingEmails: z.boolean().nullable(),
  aiModelPreference: z.string().nullable(),
  aiTonePreference: z.string().nullable(),
  aiAutoComplete: z.boolean().nullable(),
  preferredIndentation: z.string().nullable(),
  indentSize: z.number().int().nullable(),
  preferSemicolons: z.boolean().nullable(),
  twoFactorEnabled: z.boolean().nullable(),
  backupCodesCount: z.number().int().nullable(),
  lastSecurityAudit: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
  loginCount: z.number().int().nullable(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1).max(50).optional(),
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  website: z.string().url().optional(),
  preferredLanguage: PreferredLanguageEnum.optional(),
  timezone: z.string().optional(),
  themePreference: ThemePreferenceEnum.optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  aiModelPreference: z.string().optional(),
  aiTonePreference: z.enum(["formal", "casual", "balanced"]).optional(),
  aiAutoComplete: z.boolean().optional(),
  preferredIndentation: z.enum(["tabs", "spaces"]).optional(),
  indentSize: z.number().int().min(1).max(8).optional(),
  preferSemicolons: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  preferredLanguage: z.string().optional(),
  timezone: z.string().nullable().optional(),
  themePreference: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  aiModelPreference: z.string().optional(),
  aiTonePreference: z.string().optional(),
  aiAutoComplete: z.boolean().optional(),
  preferredIndentation: z.string().optional(),
  indentSize: z.number().int().optional(),
  preferSemicolons: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  backupCodesCount: z.number().int().optional(),
  lastSecurityAudit: z.date().nullable().optional(),
  lastLoginAt: z.date().nullable().optional(),
  loginCount: z.number().int().optional(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ThemePreference = z.infer<typeof ThemePreferenceEnum>;
export type PreferredLanguage = z.infer<typeof PreferredLanguageEnum>;
