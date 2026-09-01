import { and, eq, inArray, sql } from "drizzle-orm";

import type { createDb } from "./index";
import { contentSchemas, deployments, documents } from "./schema";
import type { Document, JsonObject } from "./schema";

export interface ProductionDocumentWrite {
  projectId: string;
  ownerId: string;
  environment: "production";
  contentType: string;
  status: "published";
  title: string;
  slug: string;
  content: JsonObject;
  publishedAt: Date;
  updatedAt: Date;
}

export interface DeploymentPlan {
  deleteIds: string[];
  upserts: ProductionDocumentWrite[];
}

export function createDeploymentPlan({
  deployedAt,
  developmentPages,
  productionPages,
}: {
  deployedAt: Date;
  developmentPages: Document[];
  productionPages: Document[];
}): DeploymentPlan {
  const publishedPages = developmentPages.filter((page) => page.status === "published");
  const publishedSlugs = new Set(publishedPages.map((page) => page.slug));

  return {
    deleteIds: productionPages
      .filter((page) => !publishedSlugs.has(page.slug))
      .map((page) => page.id),
    upserts: publishedPages.map((page) => ({
      projectId: page.projectId,
      ownerId: page.ownerId,
      environment: "production",
      contentType: page.contentType,
      status: "published",
      title: page.title,
      slug: page.slug,
      content: page.content,
      publishedAt: deployedAt,
      updatedAt: deployedAt,
    })),
  };
}

export async function deployProject(
  db: ReturnType<typeof createDb>,
  projectId: string,
  ownerId: string,
) {
  const [developmentPages, productionPages, developmentSchemas] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, projectId), eq(documents.environment, "development"))),
    db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, projectId), eq(documents.environment, "production"))),
    db
      .select()
      .from(contentSchemas)
      .where(and(
        eq(contentSchemas.projectId, projectId),
        eq(contentSchemas.environment, "development"),
      ))
      .limit(1),
  ]);
  const [developmentSchema] = developmentSchemas;
  if (!developmentSchema) throw new Error("Development schema not found.");
  const plan = createDeploymentPlan({
    deployedAt: new Date(),
    developmentPages,
    productionPages,
  });

  const deleteStalePages = plan.deleteIds.length
    ? db.delete(documents).where(inArray(documents.id, plan.deleteIds))
    : db.delete(documents).where(sql`false`);
  const createDeployment = db
    .insert(deployments)
    .values({
      projectId,
      ownerId,
      sourceEnvironment: "development",
      targetEnvironment: "production",
    })
    .returning();
  const promoteSchema = db
    .insert(contentSchemas)
    .values({
      projectId,
      ownerId,
      environment: "production",
      version: developmentSchema.version,
      schema: developmentSchema.schema,
    })
    .onConflictDoUpdate({
      target: [contentSchemas.projectId, contentSchemas.environment],
      set: {
        ownerId,
        version: developmentSchema.version,
        schema: developmentSchema.schema,
        updatedAt: new Date(),
      },
    });

  if (!plan.upserts.length) {
    const results = await db.batch([deleteStalePages, promoteSchema, createDeployment]);
    const [deployment] = results[2];
    if (!deployment) throw new Error("Deployment did not return a deployment record.");
    return deployment;
  }

  const upsertPages = db
    .insert(documents)
    .values(plan.upserts)
    .onConflictDoUpdate({
      target: [documents.projectId, documents.environment, documents.slug],
      set: {
        ownerId: sql`excluded.owner_id`,
        contentType: sql`excluded.content_type`,
        status: "published",
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        publishedAt: sql`excluded.published_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
  const results = await db.batch([deleteStalePages, upsertPages, promoteSchema, createDeployment]);
  const [deployment] = results[3];
  if (!deployment) throw new Error("Deployment did not return a deployment record.");
  return deployment;
}
