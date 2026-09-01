import { describe, expect, test } from "bun:test";

import { vercelDeploymentArgs } from "./vercel";

describe("vercelDeploymentArgs", () => {
  test("connects the production build and runtime to the production CMS environment", () => {
    expect(vercelDeploymentArgs({
      apiUrl: "https://cms.example.test",
      projectId: "project-1",
      token: "vercel-token",
    })).toEqual([
      "vercel",
      "--prod",
      "--yes",
      "--token",
      "vercel-token",
      "--build-env",
      "NEXT_PUBLIC_OPENCMS_PROJECT_ID=project-1",
      "--env",
      "NEXT_PUBLIC_OPENCMS_PROJECT_ID=project-1",
      "--build-env",
      "OPENCMS_API_URL=https://cms.example.test",
      "--env",
      "OPENCMS_API_URL=https://cms.example.test",
      "--build-env",
      "OPENCMS_ENVIRONMENT=production",
      "--env",
      "OPENCMS_ENVIRONMENT=production",
    ]);
  });
});
