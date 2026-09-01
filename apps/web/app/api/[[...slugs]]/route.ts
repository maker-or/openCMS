import { randomUUID } from "node:crypto";

import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  cliTokens,
  contentSchemas,
  createCliToken,
  createDb,
  deployProject,
  documents,
  projects,
  hashCliToken,
  type Environment,
  type JsonObject,
} from "@opencms/db";
import {
  defaultSchema,
  emptyPageContent,
  type DocumentStatus,
  type OpenCmsSchema,
  type PageContent,
  validatePageContent,
  validateSchemaCompatibility,
} from "@opencms/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const environments = ["development", "production"] as const;
const fieldTypes = ["text", "slug", "number", "boolean"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearerToken(request: Request) {
  const authorization = request.headers.get("Authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

async function getClerkUserId(request: Request) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  try {
    const client = await clerkClient();
    const requestOrigin = new URL(request.url).origin;
    const authorizedParties = Array.from(new Set([
      requestOrigin,
      ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ]));
    const state = await client.authenticateRequest(request, {
      authorizedParties,
      jwtKey: process.env.CLERK_JWT_KEY,
    });

    if (!state.isAuthenticated) return null;
    return state.toAuth().userId ?? null;
  } catch {
    return null;
  }
}

async function getUserId(request: Request) {
  const token = bearerToken(request);
  if (token?.startsWith("ocms_")) {
    const [stored] = await createDb()
      .select({ ownerId: cliTokens.ownerId })
      .from(cliTokens)
      .where(and(
        eq(cliTokens.tokenHash, hashCliToken(token)),
        gt(cliTokens.expiresAt, new Date()),
      ))
      .limit(1);
    return stored?.ownerId ?? null;
  }
  return getClerkUserId(request);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function isUniqueViolation(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === "23505") return true;
  return [error.cause, error.sourceError, error.originalError].some((nested) => (
    nested !== error && isUniqueViolation(nested)
  ));
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
  if (!isUuid(projectId)) return { db, project: undefined };
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
  environment: Environment,
): Promise<OpenCmsSchema> {
  const [stored] = await db
    .select()
    .from(contentSchemas)
    .where(and(
      eq(contentSchemas.projectId, projectId),
      eq(contentSchemas.ownerId, ownerId),
      eq(contentSchemas.environment, environment),
    ))
    .limit(1);

  if (stored) return stored.schema as unknown as OpenCmsSchema;

  await db
    .insert(contentSchemas)
    .values({
      projectId,
      ownerId,
      environment,
      version: defaultSchema.version,
      schema: defaultSchema as unknown as JsonObject,
    })
    .onConflictDoNothing({ target: [contentSchemas.projectId, contentSchemas.environment] });

  const [created] = await db
    .select()
    .from(contentSchemas)
    .where(and(
      eq(contentSchemas.projectId, projectId),
      eq(contentSchemas.environment, environment),
    ))
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
  .onError(({ code, error, set }) => {
    if (code === "PARSE" || code === "VALIDATION") {
      set.status = 400;
      return { error: "Invalid request" };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }

    console.error("OpenCMS API request failed", { code, error });
    set.status = 500;
    return { error: "Internal Server Error" };
  })
  .get("/health", () => ({ status: "ok" as const, service: "opencms-api" }))
  .post("/cli/tokens", async ({ request, set }) => {
    const userId = await getClerkUserId(request);
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const token = createCliToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const db = createDb();
    await db.batch([
      db.delete(cliTokens).where(and(
        eq(cliTokens.ownerId, userId),
        lt(cliTokens.expiresAt, new Date()),
      )),
      db.insert(cliTokens).values({
        ownerId: userId,
        tokenHash: hashCliToken(token),
        expiresAt,
      }),
    ]);

    set.status = 201;
    return { token, expiresAt: expiresAt.toISOString() };
  })
  .delete("/cli/tokens/current", async ({ request, set }) => {
    const token = bearerToken(request);
    if (!token?.startsWith("ocms_")) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    await createDb()
      .delete(cliTokens)
      .where(eq(cliTokens.tokenHash, hashCliToken(token)));
    return { revoked: true as const };
  })
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

      const name = body.name.trim();
      if (!name) {
        set.status = 400;
        return { error: "Project name is required." };
      }

      const db = createDb();
      const projectId = randomUUID();
      let project;
      try {
        const [createdProjects] = await db.batch([
          db
            .insert(projects)
            .values({ id: projectId, ownerId: userId, name, slug: slugify(name) })
            .returning(),
          db.insert(contentSchemas).values(environments.map((environment) => ({
            projectId,
            ownerId: userId,
            environment,
            version: defaultSchema.version,
            schema: defaultSchema as unknown as JsonObject,
          }))),
        ]);
        [project] = createdProjects;
      } catch (error) {
        if (isUniqueViolation(error)) {
          set.status = 409;
          return { error: "A project with that name already exists." };
        }
        throw error;
      }

      if (!project) throw new Error("Project creation did not return a project.");

      set.status = 201;
      return project;
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 80 }) }) },
  )
  .delete("/projects/:projectId", async ({ request, params, set }) => {
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
    await db.delete(projects).where(eq(projects.id, project.id));
    return { deleted: true as const };
  })
  .get("/delivery/projects/:projectId/pages", async ({ request, params, set }) => {
    if (!isUuid(params.projectId)) {
      set.status = 404;
      return { error: "Project not found" };
    }
    const db = createDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, params.projectId))
      .limit(1);

    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }

    const environment = getEnvironment(request);
    set.headers["Cache-Control"] = environment === "production"
      ? "public, s-maxage=30, stale-while-revalidate=300"
      : "no-store";

    return db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        environment: documents.environment,
        contentType: documents.contentType,
        status: documents.status,
        title: documents.title,
        slug: documents.slug,
        content: documents.content,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        publishedAt: documents.publishedAt,
      })
      .from(documents)
      .where(and(
        eq(documents.projectId, project.id),
        eq(documents.environment, environment),
        eq(documents.status, "published"),
      ))
      .orderBy(desc(documents.updatedAt));
  })
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
    return projectSchema(db, project.id, userId, getEnvironment(request));
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
      const environment = getEnvironment(request);
      if (environment !== "development") {
        set.status = 403;
        return { error: "Production schema is read-only. Deploy the development schema instead." };
      }
      const error = schemaError(body);
      if (error) {
        set.status = 400;
        return { error };
      }
      const existingPages = await db
        .select({
          slug: documents.slug,
          contentType: documents.contentType,
          content: documents.content,
        })
        .from(documents)
        .where(and(
          eq(documents.projectId, project.id),
          eq(documents.environment, "development"),
        ));
      const compatibilityError = validateSchemaCompatibility(
        body as OpenCmsSchema,
        existingPages.map((page) => ({
          ...page,
          content: page.content as unknown as PageContent,
        })),
      );
      if (compatibilityError) {
        set.status = 409;
        return { error: `Schema is incompatible with existing content. ${compatibilityError}` };
      }
      const [updated] = await db
        .insert(contentSchemas)
        .values({
          projectId: project.id,
          ownerId: userId,
          environment,
          version: 1,
          schema: body as JsonObject,
        })
        .onConflictDoUpdate({
          target: [contentSchemas.projectId, contentSchemas.environment],
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
    if (!isUuid(params.documentId)) {
      set.status = 404;
      return { error: "Page not found" };
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
      if ((body.environment ?? "development") !== "development") {
        set.status = 403;
        return { error: "Production content is read-only. Deploy development content instead." };
      }

      const title = body.title.trim();
      const requestedSlug = body.slug.trim();
      if (!title || !requestedSlug) {
        set.status = 400;
        return { error: "Page title and slug are required." };
      }

      const contentType = body.contentType ?? "page";
      let content: PageContent;
      try {
        content = normalizeContent(body.content);
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : "Invalid content" };
      }
      const error = validatePageContent(
        content,
        await projectSchema(db, project.id, userId, "development"),
        contentType,
      );
      if (error) {
        set.status = 400;
        return { error };
      }

      let page;
      try {
        [page] = await db
          .insert(documents)
          .values({
            projectId: project.id,
            ownerId: userId,
            environment: body.environment ?? "development",
            contentType,
            status: body.status ?? "draft",
            title,
            slug: slugify(requestedSlug),
            content: content as unknown as JsonObject,
            publishedAt: body.status === "published" ? new Date() : null,
          })
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) {
          set.status = 409;
          return { error: "A page with that slug already exists in this environment." };
        }
        throw error;
      }

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
      if (!isUuid(params.documentId)) {
        set.status = 404;
        return { error: "Page not found" };
      }
      const environment = body.environment ?? getEnvironment(request);
      if (environment !== "development") {
        set.status = 403;
        return { error: "Production content is read-only. Deploy development content instead." };
      }
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
      if (body.title !== undefined && !body.title.trim()) {
        set.status = 400;
        return { error: "Page title cannot be empty." };
      }
      if (body.slug !== undefined && !body.slug.trim()) {
        set.status = 400;
        return { error: "Page slug cannot be empty." };
      }

      const contentType = body.contentType ?? existing.contentType;
      let content = existing.content as unknown as PageContent;
      try {
        if (body.content !== undefined) content = normalizeContent(body.content);
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : "Invalid content" };
      }
      const error = validatePageContent(
        content,
        await projectSchema(db, project.id, userId, environment),
        contentType,
      );
      if (error) {
        set.status = 400;
        return { error };
      }

      let updated;
      try {
        [updated] = await db
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
      } catch (error) {
        if (isUniqueViolation(error)) {
          set.status = 409;
          return { error: "A page with that slug already exists in this environment." };
        }
        throw error;
      }
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
    if (!isUuid(params.documentId)) {
      set.status = 404;
      return { error: "Page not found" };
    }
    const environment = getEnvironment(request);
    if (environment !== "development") {
      set.status = 403;
      return { error: "Production content is read-only. Deploy development content instead." };
    }
    const result = await db
      .delete(documents)
      .where(and(
        eq(documents.id, params.documentId),
        eq(documents.projectId, project.id),
        eq(documents.environment, environment),
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

    return deployProject(db, project.id, userId);
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;
