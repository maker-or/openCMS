import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  createDb,
  deployments,
  documents,
  projects,
  type Environment,
} from "@opencms/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const environments = ["development", "production"] as const;

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
      const [project] = await db
        .insert(projects)
        .values({ ownerId: userId, name: body.name.trim(), slug: slugify(body.name) })
        .returning();

      set.status = 201;
      return project;
    },
    { body: t.Object({ name: t.String({ minLength: 1, maxLength: 80 }) }) },
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
      .where(
        and(
          eq(documents.projectId, project.id),
          eq(documents.environment, getEnvironment(request)),
        ),
      )
      .orderBy(desc(documents.updatedAt));
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

      const [page] = await db
        .insert(documents)
        .values({
          projectId: project.id,
          ownerId: userId,
          environment: body.environment ?? "development",
          title: body.title.trim(),
          slug: slugify(body.slug),
          content: body.content ?? "",
        })
        .returning();

      set.status = 201;
      return page;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 160 }),
        slug: t.String({ minLength: 1, maxLength: 160 }),
        content: t.Optional(t.String()),
        environment: t.Optional(t.Union([t.Literal("development"), t.Literal("production")])),
      }),
    },
  )
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
      .where(
        and(
          eq(documents.projectId, project.id),
          eq(documents.environment, "development"),
        ),
      );

    for (const page of developmentPages) {
      await db
        .insert(documents)
        .values({
          projectId: page.projectId,
          ownerId: page.ownerId,
          environment: "production",
          title: page.title,
          slug: page.slug,
          content: page.content,
        })
        .onConflictDoUpdate({
          target: [documents.projectId, documents.environment, documents.slug],
          set: {
            title: page.title,
            content: page.content,
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
