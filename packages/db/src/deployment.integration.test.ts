import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";

import { deployProject } from "./deployment";
import { createDb } from "./index";
import { contentSchemas, deployments, documents, projects } from "./schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL
  ?? (process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? process.env.DATABASE_URL : undefined);
const databaseTest = testDatabaseUrl ? test : test.skip;
const createdProjectIds: string[] = [];

afterAll(async () => {
  if (!testDatabaseUrl || !createdProjectIds.length) return;
  const db = createDb(testDatabaseUrl);
  await db.delete(projects).where(eq(projects.id, createdProjectIds[0]));
});

describe("deployProject with Neon", () => {
  databaseTest("atomically replaces production with the published development snapshot", async () => {
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for this integration test.");
    const db = createDb(testDatabaseUrl);
    const projectId = randomUUID();
    const ownerId = `integration-test-${randomUUID()}`;
    createdProjectIds.push(projectId);

    await db.batch([
      db.insert(projects).values({ id: projectId, name: "Deployment integration test", ownerId, slug: projectId }),
      db.insert(contentSchemas).values({
        projectId,
        ownerId,
        environment: "development",
        schema: {
          version: 1,
          blocks: { promoted: { label: "Promoted", fields: {} } },
          contentTypes: { page: { label: "Page", fields: {}, blocks: ["promoted"] } },
        },
      }),
      db.insert(documents).values([
        {
          projectId,
          ownerId,
          environment: "development",
          status: "published",
          title: "New home",
          slug: "home",
          content: { version: 1, blocks: [] },
        },
        {
          projectId,
          ownerId,
          environment: "development",
          status: "draft",
          title: "Private draft",
          slug: "private-draft",
          content: { version: 1, blocks: [] },
        },
        {
          projectId,
          ownerId,
          environment: "production",
          status: "published",
          title: "Old home",
          slug: "home",
          content: { version: 1, blocks: [] },
        },
        {
          projectId,
          ownerId,
          environment: "production",
          status: "published",
          title: "Stale page",
          slug: "stale-page",
          content: { version: 1, blocks: [] },
        },
      ]),
    ]);

    const deployment = await deployProject(db, projectId, ownerId);
    const [productionPages, productionSchemas, storedDeployments] = await Promise.all([
      db
        .select({ slug: documents.slug, status: documents.status, title: documents.title })
        .from(documents)
        .where(and(eq(documents.projectId, projectId), eq(documents.environment, "production"))),
      db
        .select({ schema: contentSchemas.schema })
        .from(contentSchemas)
        .where(and(
          eq(contentSchemas.projectId, projectId),
          eq(contentSchemas.environment, "production"),
        )),
      db
        .select({ id: deployments.id })
        .from(deployments)
        .where(eq(deployments.projectId, projectId)),
    ]);

    expect({
      deployment: {
        sourceEnvironment: deployment.sourceEnvironment,
        targetEnvironment: deployment.targetEnvironment,
      },
      productionPages,
      productionSchemas,
      storedDeploymentCount: storedDeployments.length,
    }).toEqual({
      deployment: {
        sourceEnvironment: "development",
        targetEnvironment: "production",
      },
      productionPages: [{ slug: "home", status: "published", title: "New home" }],
      productionSchemas: [{
        schema: {
          version: 1,
          blocks: { promoted: { label: "Promoted", fields: {} } },
          contentTypes: { page: { label: "Page", fields: {}, blocks: ["promoted"] } },
        },
      }],
      storedDeploymentCount: 1,
    });
  });
});
