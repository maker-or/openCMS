import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  createSdk,
  type OpenCmsSchema,
  type PageContent,
} from "../packages/sdk/src/index";

interface StoredConfig {
  token?: string;
}

const origin = process.env.OPENCMS_URL?.trim().replace(/\/$/, "");
if (!origin) throw new Error("OPENCMS_URL is required.");

async function storedToken() {
  if (process.env.OPENCMS_CLERK_TOKEN) return process.env.OPENCMS_CLERK_TOKEN;
  const configRoot = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  try {
    const config = JSON.parse(
      await readFile(join(configRoot, "opencms", "config.json"), "utf8"),
    ) as StoredConfig;
    return config.token;
  } catch {
    return undefined;
  }
}

const token = await storedToken();
if (!token) throw new Error("Run `npx @maker-or/opencms login` before the production smoke test.");

const management = createSdk({ baseUrl: origin, getToken: () => token });
const project = await management.projects.create({ name: `production-smoke-${Date.now()}` });

const schema: OpenCmsSchema = {
  version: 1,
  blocks: {
    smoke: {
      label: "Smoke test",
      fields: { text: { type: "text", label: "Text", required: true } },
    },
  },
  contentTypes: {
    page: {
      label: "Page",
      fields: {
        title: { type: "text", required: true },
        slug: { type: "slug", required: true, unique: true },
      },
      blocks: ["smoke"],
    },
  },
};
const content: PageContent = {
  version: 1,
  blocks: [{ id: "smoke-block", type: "smoke", data: { text: "production-ready" } }],
};

try {
  const development = createSdk({
    baseUrl: origin,
    environment: "development",
    getToken: () => token,
    projectId: project.id,
  });
  await development.schema.update(schema);
  await development.pages.create({
    title: "Production smoke test",
    slug: "production-smoke",
    status: "published",
    content,
  });
  await development.deploy();

  const production = createSdk({
    baseUrl: origin,
    environment: "production",
    getToken: () => token,
    projectId: project.id,
  });
  const [productionSchema, deliveryResponse] = await Promise.all([
    production.schema.get(),
    fetch(`${origin}/api/delivery/projects/${project.id}/pages?environment=production`),
  ]);
  if (!deliveryResponse.ok) {
    throw new Error(`Production delivery returned ${deliveryResponse.status}.`);
  }
  const pages = await deliveryResponse.json() as Array<{
    slug: string;
    content: PageContent;
  }>;
  if (!isDeepStrictEqual(productionSchema, schema)) {
    throw new Error("The production schema does not match development after deploy.");
  }
  if (pages.length !== 1 || pages[0]?.slug !== "production-smoke") {
    throw new Error("The published development page was not delivered in production.");
  }
  if (pages[0].content.blocks[0]?.data.text !== "production-ready") {
    throw new Error("Production delivery returned unexpected page content.");
  }

  console.log("OpenCMS production smoke test passed.");
} finally {
  await management.projects.delete(project.id);
}
