import { describe, expect, test } from "bun:test";

import { createSdk, OpenCmsApiError } from "./index";

describe("OpenCMS SDK", () => {
  test("sends authenticated page mutations to the configured project and environment", async () => {
    let receivedRequest: Request | undefined;
    const sdk = createSdk({
      baseUrl: "https://cms.example.test/",
      environment: "production",
      getToken: () => "session-token",
      projectId: "project-1",
      fetch: (async (input, init) => {
        receivedRequest = new Request(input, init);
        return Response.json({
          content: { blocks: [], version: 1 },
          contentType: "page",
          createdAt: "2026-09-01T00:00:00.000Z",
          environment: "production",
          id: "page-1",
          ownerId: "user-1",
          projectId: "project-1",
          publishedAt: null,
          slug: "home",
          status: "draft",
          title: "Home",
          updatedAt: "2026-09-01T00:00:00.000Z",
        });
      }) as typeof globalThis.fetch,
    });

    await sdk.pages.create({ slug: "home", title: "Home" });

    expect({
      authorization: receivedRequest?.headers.get("Authorization"),
      body: await receivedRequest?.json(),
      method: receivedRequest?.method,
      url: receivedRequest?.url,
    }).toEqual({
      authorization: "Bearer session-token",
      body: {
        content: { blocks: [], version: 1 },
        environment: "production",
        slug: "home",
        title: "Home",
      },
      method: "POST",
      url: "https://cms.example.test/api/projects/project-1/pages",
    });
  });

  test("surfaces API error messages and status codes", async () => {
    const sdk = createSdk({
      baseUrl: "https://cms.example.test",
      fetch: (async () => Response.json({ error: "Unauthorized" }, { status: 401 })) as unknown as typeof globalThis.fetch,
    });

    const error = await sdk.projects.list().catch((caught: unknown) => caught);

    expect(error).toEqual(new OpenCmsApiError("Unauthorized", 401));
  });

  test("deletes a project through the management API", async () => {
    let receivedRequest: Request | undefined;
    const sdk = createSdk({
      baseUrl: "https://cms.example.test",
      fetch: (async (input, init) => {
        receivedRequest = new Request(input, init);
        return Response.json({ deleted: true });
      }) as typeof globalThis.fetch,
    });

    await sdk.projects.delete("project-1");

    expect({ method: receivedRequest?.method, url: receivedRequest?.url }).toEqual({
      method: "DELETE",
      url: "https://cms.example.test/api/projects/project-1",
    });
  });

  test("reads and updates the schema in the selected environment", async () => {
    const requests: Request[] = [];
    const sdk = createSdk({
      baseUrl: "https://cms.example.test",
      environment: "production",
      projectId: "project-1",
      fetch: (async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ blocks: {}, contentTypes: {}, version: 1 });
      }) as typeof globalThis.fetch,
    });

    const schema = { blocks: {}, contentTypes: {}, version: 1 } as const;
    await sdk.schema.get();
    await sdk.schema.update(schema);

    expect(requests.map((request) => ({ method: request.method, url: request.url }))).toEqual([
      {
        method: "GET",
        url: "https://cms.example.test/api/projects/project-1/schema?environment=production",
      },
      {
        method: "PUT",
        url: "https://cms.example.test/api/projects/project-1/schema?environment=production",
      },
    ]);
  });
});
