import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { eq } from "drizzle-orm";

import { cliTokens, createCliToken, createDb, hashCliToken, projects } from "@opencms/db";

import { GET, POST } from "./[[...slugs]]/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL
  ?? (process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? process.env.DATABASE_URL : undefined);
const databaseTest = testDatabaseUrl ? test : test.skip;
const createdProjectIds: string[] = [];

afterAll(async () => {
  if (!testDatabaseUrl) return;
  const db = createDb(testDatabaseUrl);
  await Promise.all(createdProjectIds.map((id) => db.delete(projects).where(eq(projects.id, id))));
});

describe("OpenCMS HTTP API", () => {
  test("reports service health", async () => {
    const response = await GET(new Request("http://opencms.test/api/health"));

    expect({
      body: await response.json(),
      status: response.status,
    }).toEqual({
      body: { service: "opencms-api", status: "ok" },
      status: 200,
    });
  });

  test("does not expose project mutations without authentication", async () => {
    const response = await POST(new Request("http://opencms.test/api/projects", {
      body: JSON.stringify({ name: "Unauthorized project" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }));

    expect({
      body: await response.json(),
      status: response.status,
    }).toEqual({
      body: { error: "Unauthorized" },
      status: 401,
    });
  });

  test("rejects invalid delivery project identifiers without touching the database", async () => {
    const response = await GET(new Request("http://opencms.test/api/delivery/projects/not-a-uuid/pages"));
    const body = await response.text();

    expect({
      body,
      status: response.status,
    }).toEqual({
      body: '{"error":"Project not found"}',
      status: 404,
    });
  });

  test("returns a stable JSON error for malformed requests", async () => {
    const response = await POST(new Request("http://opencms.test/api/projects", {
      body: "{not-json",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }));

    expect({ body: await response.text(), status: response.status }).toEqual({
      body: '{"error":"Invalid request"}',
      status: 400,
    });
  });

  test("does not expose unexpected server error details", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    delete process.env.DATABASE_URL;
    try {
      const response = await GET(new Request(
        "http://opencms.test/api/delivery/projects/00000000-0000-4000-8000-000000000000/pages",
      ));

      expect({ body: await response.text(), status: response.status }).toEqual({
        body: '{"error":"Internal Server Error"}',
        status: 500,
      });
    } finally {
      consoleError.mockRestore();
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  databaseTest("accepts a hashed CLI token without exposing it in storage", async () => {
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required.");
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDatabaseUrl;
    const db = createDb(testDatabaseUrl);
    const ownerId = `cli-token-test-${randomUUID()}`;
    const projectId = randomUUID();
    const token = createCliToken();
    createdProjectIds.push(projectId);

    try {
      await db.batch([
        db.insert(projects).values({ id: projectId, ownerId, name: "CLI auth test", slug: projectId }),
        db.insert(cliTokens).values({
          ownerId,
          tokenHash: hashCliToken(token),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ]);

      const response = await GET(new Request("http://opencms.test/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      }));
      const body = await response.json() as Array<{ id: string }>;

      expect({ ids: body.map((project) => project.id), status: response.status }).toEqual({
        ids: [projectId],
        status: 200,
      });
      const [stored] = await db
        .select({ tokenHash: cliTokens.tokenHash })
        .from(cliTokens)
        .where(eq(cliTokens.ownerId, ownerId));
      expect(stored?.tokenHash).toBe(hashCliToken(token));
      expect(stored?.tokenHash).not.toContain(token);
    } finally {
      await db.delete(cliTokens).where(eq(cliTokens.ownerId, ownerId));
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
