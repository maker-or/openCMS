DROP INDEX "content_schemas_project_idx";--> statement-breakpoint
ALTER TABLE "content_schemas" ADD COLUMN "environment" text DEFAULT 'development' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "content_schemas_project_environment_idx" ON "content_schemas" USING btree ("project_id","environment");--> statement-breakpoint
INSERT INTO "content_schemas" (
	"project_id",
	"owner_id",
	"environment",
	"version",
	"schema",
	"created_at",
	"updated_at"
)
SELECT
	"project_id",
	"owner_id",
	'production',
	"version",
	"schema",
	"created_at",
	"updated_at"
FROM "content_schemas"
WHERE "environment" = 'development'
ON CONFLICT ("project_id", "environment") DO NOTHING;
