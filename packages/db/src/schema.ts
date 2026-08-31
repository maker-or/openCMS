import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type Environment = "development" | "production";
export type DocumentStatus = "draft" | "published";

export type JsonObject = Record<string, unknown>;

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("projects_owner_slug_idx").on(table.ownerId, table.slug)],
);

export const contentSchemas = pgTable(
  "content_schemas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    version: integer("version").notNull().default(1),
    schema: jsonb("schema").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("content_schemas_project_idx").on(table.projectId)],
);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  environment: text("environment")
    .$type<Environment>()
    .notNull()
    .default("development"),
  contentType: text("content_type").notNull().default("page"),
  status: text("status")
    .$type<DocumentStatus>()
    .notNull()
    .default("draft"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: jsonb("content")
    .$type<JsonObject>()
    .notNull()
    .default({ version: 1, blocks: [] }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("documents_project_environment_slug_idx").on(
    table.projectId,
    table.environment,
    table.slug,
  ),
]);

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  sourceEnvironment: text("source_environment")
    .$type<Environment>()
    .notNull(),
  targetEnvironment: text("target_environment")
    .$type<Environment>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ContentSchema = typeof contentSchemas.$inferSelect;
export type NewContentSchema = typeof contentSchemas.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
