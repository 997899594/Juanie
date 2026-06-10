ALTER TYPE "public"."releaseStatus" ADD VALUE IF NOT EXISTS 'admission_running' BEFORE 'queued';
ALTER TYPE "public"."releaseStatus" ADD VALUE IF NOT EXISTS 'admission_failed' AFTER 'admission_running';
