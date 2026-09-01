-- Upgrade databases created before the content schema model was introduced.
-- This migration is intentionally idempotent because those databases do not
-- have a Drizzle migrations table yet.

CREATE TABLE IF NOT EXISTS "content_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"schema" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'content_schemas_project_id_projects_id_fk'
	) THEN
		ALTER TABLE "content_schemas"
			ADD CONSTRAINT "content_schemas_project_id_projects_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "content_schemas_project_idx"
	ON "content_schemas" USING btree ("project_id");

INSERT INTO "content_schemas" ("project_id", "owner_id", "version", "schema")
SELECT
	"projects"."id",
	"projects"."owner_id",
	1,
	'{
	  "version": 1,
	  "blocks": {
	    "heading": {
	      "label": "Heading",
	      "fields": {
	        "text": { "type": "text", "label": "Text", "required": true },
	        "level": { "type": "number", "label": "Level", "required": true }
	      }
	    },
	    "text": {
	      "label": "Text",
	      "fields": {
	        "text": { "type": "text", "label": "Text", "required": true }
	      }
	    },
	    "quote": {
	      "label": "Quote",
	      "fields": {
	        "text": { "type": "text", "label": "Quote", "required": true },
	        "author": { "type": "text", "label": "Author" }
	      }
	    },
	    "feature-list": {
	      "label": "Feature list",
	      "fields": {
	        "title": { "type": "text", "label": "Title", "required": true },
	        "items": { "type": "text", "label": "Items", "required": true }
	      }
	    }
	  },
	  "contentTypes": {
	    "page": {
	      "label": "Page",
	      "fields": {
	        "title": { "type": "text", "label": "Title", "required": true },
	        "slug": { "type": "slug", "label": "Slug", "required": true, "unique": true }
	      },
	      "blocks": ["heading", "text", "quote", "feature-list"]
	    }
	  }
}'::jsonb
FROM "projects"
ON CONFLICT ("project_id") DO NOTHING;

ALTER TABLE "documents"
	ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT 'page' NOT NULL;

ALTER TABLE "documents"
	ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;

ALTER TABLE "documents"
	ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

CREATE OR REPLACE FUNCTION opencms_legacy_content_to_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
	IF value IS NULL OR btrim(value) = '' THEN
		RETURN '{"version":1,"blocks":[]}'::jsonb;
	END IF;

	BEGIN
		RETURN value::jsonb;
	EXCEPTION WHEN invalid_text_representation THEN
		RETURN jsonb_build_object(
			'version', 1,
			'blocks', jsonb_build_array(jsonb_build_object(
				'id', gen_random_uuid()::text,
				'type', 'text',
				'data', jsonb_build_object('text', value)
			))
		);
	END;
END $$;

ALTER TABLE "documents"
	ALTER COLUMN "content" DROP DEFAULT;

DO $$
DECLARE
	content_data_type text;
BEGIN
	SELECT data_type
	INTO content_data_type
	FROM information_schema.columns
	WHERE table_schema = 'public'
	  AND table_name = 'documents'
	  AND column_name = 'content';

	IF content_data_type = 'text' THEN
		ALTER TABLE "documents"
			ALTER COLUMN "content" TYPE jsonb
			USING opencms_legacy_content_to_jsonb(content);
	END IF;
END $$;

DROP FUNCTION opencms_legacy_content_to_jsonb(text);

ALTER TABLE "documents"
	ALTER COLUMN "content" SET DEFAULT '{"version":1,"blocks":[]}'::jsonb;

ALTER TABLE "documents"
	ALTER COLUMN "content" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "documents_project_environment_slug_idx"
	ON "documents" USING btree ("project_id", "environment", "slug");
