-- Preserve fields whose operational mapping will be completed in later module migrations.
ALTER TABLE "MigrationImport" ADD COLUMN "sourceSnapshot" JSONB;
