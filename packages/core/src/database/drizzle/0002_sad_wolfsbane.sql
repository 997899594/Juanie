-- 先清空无效的 template_id 值
UPDATE "projects" SET "template_id" = NULL WHERE "template_id" IS NOT NULL AND "template_id" NOT IN (SELECT "id"::text FROM "project_templates");
--> statement-breakpoint
-- 修改列类型，使用 USING 子句进行类型转换
ALTER TABLE "projects" ALTER COLUMN "template_id" SET DATA TYPE uuid USING "template_id"::uuid;
--> statement-breakpoint
-- 添加外键约束
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_templates"("id") ON DELETE set null ON UPDATE no action;