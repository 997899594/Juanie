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
export const insertUserSchema = createInsertSchema(users);

export const selectUserSchema = createSelectSchema(users);

export const createUserSchema = insertUserSchema.pick({
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
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: true,
  aiModelPreference: true,
  aiTonePreference: true,
  aiAutoComplete: true,
  preferredIndentation: true,
  indentSize: true,
  preferSemicolons: true,
});

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
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: true,
  aiModelPreference: true,
  aiTonePreference: true,
  aiAutoComplete: true,
  preferredIndentation: true,
  indentSize: true,
  preferSemicolons: true,
  twoFactorEnabled: true,
  backupCodesCount: true,
  lastSecurityAudit: true,
  lastLoginAt: true,
  loginCount: true,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ThemePreference = z.infer<typeof ThemePreferenceEnum>;
export type PreferredLanguage = z.infer<typeof PreferredLanguageEnum>;
