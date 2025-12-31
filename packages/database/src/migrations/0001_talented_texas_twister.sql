CREATE TYPE "public"."gitops_resource_status" AS ENUM('pending', 'ready', 'reconciling', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gitops_resource_type" AS ENUM('kustomization', 'helm');--> statement-breakpoint
ALTER TABLE "deployments" ALTER COLUMN "commit_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gitops_resources" ALTER COLUMN "type" SET DATA TYPE "public"."gitops_resource_type" USING "type"::"public"."gitops_resource_type";--> statement-breakpoint
ALTER TABLE "gitops_resources" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."gitops_resource_status";--> statement-breakpoint
ALTER TABLE "gitops_resources" ALTER COLUMN "status" SET DATA TYPE "public"."gitops_resource_status" USING "status"::"public"."gitops_resource_status";