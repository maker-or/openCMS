import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export { cliTokens, contentSchemas, deployments, documents, projects } from "./schema";
export { createCliToken, hashCliToken } from "./cli-token";
export { createDeploymentPlan, deployProject } from "./deployment";
export type { DeploymentPlan, ProductionDocumentWrite } from "./deployment";
export type {
  CliToken,
  ContentSchema,
  Deployment,
  Document,
  DocumentStatus,
  Environment,
  JsonObject,
  NewContentSchema,
  NewDocument,
  NewProject,
  Project,
} from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to Neon");
  }

  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export type Database = ReturnType<typeof createDb>;
