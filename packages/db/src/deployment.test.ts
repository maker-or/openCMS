import { describe, expect, test } from "bun:test";

import { createDeploymentPlan } from "./deployment";

describe("createDeploymentPlan", () => {
  test("promotes only published development pages and removes stale production pages", () => {
    const deployedAt = new Date("2026-09-01T00:00:00.000Z");
    const plan = createDeploymentPlan({
      deployedAt,
      developmentPages: [
        {
          id: "development-home",
          projectId: "project-1",
          ownerId: "user-1",
          environment: "development",
          contentType: "page",
          status: "published",
          title: "Home",
          slug: "home",
          content: { version: 1, blocks: [] },
          publishedAt: deployedAt,
          createdAt: deployedAt,
          updatedAt: deployedAt,
        },
        {
          id: "development-draft",
          projectId: "project-1",
          ownerId: "user-1",
          environment: "development",
          contentType: "page",
          status: "draft",
          title: "Private draft",
          slug: "private-draft",
          content: { version: 1, blocks: [] },
          publishedAt: null,
          createdAt: deployedAt,
          updatedAt: deployedAt,
        },
      ],
      productionPages: [
        {
          id: "production-home",
          projectId: "project-1",
          ownerId: "user-1",
          environment: "production",
          contentType: "page",
          status: "published",
          title: "Old home",
          slug: "home",
          content: { version: 1, blocks: [] },
          publishedAt: deployedAt,
          createdAt: deployedAt,
          updatedAt: deployedAt,
        },
        {
          id: "production-stale",
          projectId: "project-1",
          ownerId: "user-1",
          environment: "production",
          contentType: "page",
          status: "published",
          title: "Removed page",
          slug: "removed-page",
          content: { version: 1, blocks: [] },
          publishedAt: deployedAt,
          createdAt: deployedAt,
          updatedAt: deployedAt,
        },
      ],
    });

    expect(plan).toEqual({
      deleteIds: ["production-stale"],
      upserts: [
        {
          projectId: "project-1",
          ownerId: "user-1",
          environment: "production",
          contentType: "page",
          status: "published",
          title: "Home",
          slug: "home",
          content: { version: 1, blocks: [] },
          publishedAt: deployedAt,
          updatedAt: deployedAt,
        },
      ],
    });
  });
});
