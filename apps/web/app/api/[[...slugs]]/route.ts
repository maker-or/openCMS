import { randomUUID } from "node:crypto";

import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  contentSchemas,
  createDb,
  deployments,
  documents,
  projects,
  type Environment,
  type JsonObject,
} from "@opencms/db";
import {
  defaultSchema,
  emptyPageContent,
  type DocumentStatus,
  type SchemaField,
  type OpenCmsSchema,
  type PageContent,
} from "@opencms/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const environments = ["development", "production"] as const;
const fieldTypes = ["text", "slug", "number", "boolean"] as const;

async function getUserId(request: Request) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  try {
    const client = await clerkClient();
    const state = await client.authenticateRequest(request, {
      authorizedParties: process.env.NEXT_PUBLIC_APP_URL
        ? [process.env.NEXT_PUBLIC_APP_URL]
        : undefined,
      jwtKey: process.env.CLERK_JWT_KEY,
    });

    if (!state.isAuthenticated) return null;
    return state.toAuth().userId ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueViolation(error: unknown) {
  return isRecord(error) && error.code === "23505";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "project";
}

function getEnvironment(request: Request): Environment {
  const requested = new URL(request.url).searchParams.get("environment");
  return environments.includes(requested as (typeof environments)[number])
    ? (requested as Environment)
    : "development";
}

async function ownedProject(projectId: string, userId: string) {
  const db = createDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return { db, project };
}

async function projectSchema(
  db: ReturnType<typeof createDb>,
  projectId: string,
  ownerId: string,
): Promise<OpenCmsSchema> {
  const [stored] = await db
    .select()
    .from(contentSchemas)
    .where(and(eq(contentSchemas.projectId, projectId), eq(contentSchemas.ownerId, ownerId)))
    .limit(1);

  if (stored) return stored.schema as unknown as OpenCmsSchema;

  await db
    .insert(contentSchemas)
    .values({
      projectId,
      ownerId,
      version: defaultSchema.version,
      schema: defaultSchema as unknown as JsonObject,
    })
    .onConflictDoNothing({ target: contentSchemas.projectId });

  const [created] = await db
    .select()
    .from(contentSchemas)
    .where(eq(contentSchemas.projectId, projectId))
    .limit(1);

  return (created?.schema ?? defaultSchema) as unknown as OpenCmsSchema;
}

function fieldsError(fields: Record<string, unknown>, owner: string): string | null {
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!isRecord(field) || !fieldTypes.includes(field.type as (typeof fieldTypes)[number])) {
      return `${owner} field ${fieldName} has an invalid type.`;
    }
  }
  return null;
}

function schemaError(schema: unknown): string | null {
  if (!isRecord(schema) || schema.version !== 1) return "Schema version must be 1.";
  if (!isRecord(schema.blocks) || !isRecord(schema.contentTypes)) {
    return "Schema must define blocks and contentTypes.";
  }

  for (const [blockName, block] of Object.entries(schema.blocks)) {
    if (!isRecord(block) || typeof block.label !== "string" || !isRecord(block.fields)) {
      return `Block ${blockName} must define a label and fields.`;
    }
    const error = fieldsError(block.fields, `Block ${blockName}`);
    if (error) return error;
  }

  for (const [typeName, contentType] of Object.entries(schema.contentTypes)) {
    if (!isRecord(contentType) || typeof contentType.label !== "string" || !isRecord(contentType.fields)) {
      return `Content type ${typeName} must define a label and fields.`;
    }
    const error = fieldsError(contentType.fields, `Content type ${typeName}`);
    if (error) return error;
    if (contentType.blocks !== undefined && (!Array.isArray(contentType.blocks) || contentType.blocks.some((name) => typeof name !== "string"))) {
      return `Content type ${typeName} has an invalid blocks list.`;
    }
    for (const blockName of contentType.blocks ?? []) {
      if (!isRecord(schema.blocks[blockName])) return `Content type ${typeName} references unknown block ${blockName}.`;
    }
  }

  return null;
}

function normalizeContent(value: unknown): PageContent {
  if (value === undefined || value === null) return emptyPageContent;
  if (typeof value === "string") {
    return value.trim()
      ? { version: 1, blocks: [{ id: randomUUID(), type: "text", data: { text: value } }] }
      : emptyPageContent;
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks)) {
    throw new Error("Content must have version 1 and a blocks array.");
  }
  return value as unknown as PageContent;
}

function fieldValueError(field: SchemaField, value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;

  const valid = field.type === "number"
    ? typeof value === "number" && Number.isFinite(value)
    : field.type === "boolean"
      ? typeof value === "boolean"
      : typeof value === "string";

  return valid ? null : `${label} must be a ${field.type}.`;
}

function contentError(content: PageContent, schema: OpenCmsSchema, contentType: string): string | null {
  const definition = schema.contentTypes[contentType];
  if (!definition) return `Unknown content type: ${contentType}.`;

  for (const [index, block] of content.blocks.entries()) {
    if (!isRecord(block) || typeof block.id !== "string" || typeof block.type !== "string" || !isRecord(block.data)) {
      return `Block ${index + 1} must define an id, type, and data object.`;
    }
    const blockDefinition = schema.blocks[block.type];
    if (!blockDefinition) return `Unknown block type: ${block.type}.`;
    if (definition.blocks && !definition.blocks.includes(block.type)) {
      return `Block ${block.type} is not allowed in ${contentType}.`;
    }
    for (const [fieldName, field] of Object.entries(blockDefinition.fields)) {
      const value = block.data[fieldName];
      if (field.required && (value === undefined || value === "")) {
        return `${blockDefinition.label} requires ${field.label ?? fieldName}.`;
      }
      const valueError = fieldValueError(field, value, field.label ?? fieldName);
      if (valueError) return valueError;
    }
  }
  return null;
}

function pageBody() {
  return t.Object({
    title: t.String({ minLength: 1, maxLength: 160 }),
    slug: t.String({ minLength: 1, maxLength: 160 }),
    content: t.Optional(t.Any()),
    contentType: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
    status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published")])),
    environment: t.Optional(t.Union([t.Literal("development"), t.Literal("production")])),
  });
}

function pageUpdateBody() {
  return t.Object({
    title: t.Optional(t.String({ minLength: 1, maxLength: 160 })),
    slug: t.Optional(t.String({ minLength: 1, maxLength: 160 })),
    content: t.Optional(t.Any()),
    contentType: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
    status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published")])),
    environment: t.Optional(t.Union([t.Literal("development"), t.Literal("production")])),
  });
}

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" as const, service: "opencms-api" }))
  .get("/projects", async ({ request, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    return createDb()
      .select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt));
  })
  .post(
    "/projects",
    async ({ request, body, set }) => {
      const userId = await getUserId(request);
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const db = createDb();
      let project;
      try {
        [project] = await db
          .insert(projects)
          .values({ ownerId: userId, name: body.name.trim(), slug: slugify(body.name) })
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) {
          set.status = 409;
          return { error: "A project with that name already exists." };
        }
        throw error;
      }

      await db.insert(contentSchemas).values({
        projectId: project.id,
        ownerId: userId,
        version: defaultSchema.version,
        schema: defaultSchema as unknown as JsonObject,
      });

      set.status = 201;
      return project;
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 80 }) }) },
  )
  .get("/projects/:projectId/schema", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const { db, project } = await ownedProject(params.projectId, userId);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }
    return projectSchema(db, project.id, userId);
  })
  .put(
    "/projects/:projectId/schema",
    async ({ request, params, body, set }) => {
      const userId = await getUserId(request);
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const { db, project } = await ownedProject(params.projectId, userId);
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }
      const error = schemaError(body);
      if (error) {
        set.status = 400;
        return { error };
      }
      const [updated] = await db
        .insert(contentSchemas)
        .values({
          projectId: project.id,
          ownerId: userId,
          version: 1,
          schema: body as JsonObject,
        })
        .onConflictDoUpdate({
          target: contentSchemas.projectId,
          set: { schema: body as JsonObject, version: 1, updatedAt: new Date() },
        })
        .returning();
      return updated.schema as unknown as OpenCmsSchema;
    },
    { body: t.Any() },
  )
  .get("/projects/:projectId/pages", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { db, project } = await ownedProject(params.projectId, userId);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }

    return db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, project.id), eq(documents.environment, getEnvironment(request))))
      .orderBy(desc(documents.updatedAt));
  })
  .get("/projects/:projectId/pages/:documentId", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const { db, project } = await ownedProject(params.projectId, userId);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }
    const [page] = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.id, params.documentId),
        eq(documents.projectId, project.id),
        eq(documents.environment, getEnvironment(request)),
      ))
      .limit(1);
    if (!page) {
      set.status = 404;
      return { error: "Page not found" };
    }
    return page;
  })
  .post(
    "/projects/:projectId/pages",
    async ({ request, params, body, set }) => {
      const userId = await getUserId(request);
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { db, project } = await ownedProject(params.projectId, userId);
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }

      const contentType = body.contentType ?? "page";
      let content: PageContent;
      try {
        content = normalizeContent(body.content);
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : "Invalid content" };
      }
      const error = contentError(content, await projectSchema(db, project.id, userId), contentType);
      if (error) {
        set.status = 400;
        return { error };
      }

      const [page] = await db
        .insert(documents)
        .values({
          projectId: project.id,
          ownerId: userId,
          environment: body.environment ?? "development",
          contentType,
          status: body.status ?? "draft",
          title: body.title.trim(),
          slug: slugify(body.slug),
          content: content as unknown as JsonObject,
          publishedAt: body.status === "published" ? new Date() : null,
        })
        .returning();

      set.status = 201;
      return page;
    },
    { body: pageBody() },
  )
  .patch(
    "/projects/:projectId/pages/:documentId",
    async ({ request, params, body, set }) => {
      const userId = await getUserId(request);
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const { db, project } = await ownedProject(params.projectId, userId);
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }
      const environment = body.environment ?? getEnvironment(request);
      const [existing] = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, params.documentId),
          eq(documents.projectId, project.id),
          eq(documents.environment, environment),
        ))
        .limit(1);
      if (!existing) {
        set.status = 404;
        return { error: "Page not found" };
      }

      const contentType = body.contentType ?? existing.contentType;
      let content = existing.content as unknown as PageContent;
      try {
        if (body.content !== undefined) content = normalizeContent(body.content);
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : "Invalid content" };
      }
      const error = contentError(content, await projectSchema(db, project.id, userId), contentType);
      if (error) {
        set.status = 400;
        return { error };
      }

      const [updated] = await db
        .update(documents)
        .set({
          ...(body.title === undefined ? {} : { title: body.title.trim() }),
          ...(body.slug === undefined ? {} : { slug: slugify(body.slug) }),
          ...(body.content === undefined ? {} : { content: content as unknown as JsonObject }),
          ...(body.contentType === undefined ? {} : { contentType }),
          ...(body.status === undefined
            ? {}
            : {
                status: body.status as DocumentStatus,
                publishedAt: body.status === "published" ? new Date() : null,
              }),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, existing.id))
        .returning();
      return updated;
    },
    { body: pageUpdateBody() },
  )
  .delete("/projects/:projectId/pages/:documentId", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const { db, project } = await ownedProject(params.projectId, userId);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }
    const result = await db
      .delete(documents)
      .where(and(
        eq(documents.id, params.documentId),
        eq(documents.projectId, project.id),
        eq(documents.environment, getEnvironment(request)),
      ))
      .returning({ id: documents.id });
    if (!result.length) {
      set.status = 404;
      return { error: "Page not found" };
    }
    return { deleted: true as const };
  })
  .post("/projects/:projectId/deploy", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { db, project } = await ownedProject(params.projectId, userId);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }

    const developmentPages = await db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, project.id), eq(documents.environment, "development")));

    for (const page of developmentPages) {
      await db
        .insert(documents)
        .values({
          projectId: page.projectId,
          ownerId: page.ownerId,
          environment: "production",
          contentType: page.contentType,
          status: "published",
          title: page.title,
          slug: page.slug,
          content: page.content,
          publishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [documents.projectId, documents.environment, documents.slug],
          set: {
            contentType: page.contentType,
            status: "published",
            title: page.title,
            content: page.content,
            publishedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        ownerId: userId,
        sourceEnvironment: "development",
        targetEnvironment: "production",
      })
      .returning();

    return deployment;
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;
