import type { ContentBlock, OpenCmsSchema, PageContent } from "./schema";

export type { ContentBlock, OpenCmsSchema, PageContent } from "./schema";

export interface Document {
  id: string;
  projectId: string;
  ownerId: string;
  environment: Environment;
  contentType: string;
  status: DocumentStatus;
  title: string;
  slug: string;
  content: PageContent;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export type Page = Document;
export type Environment = "development" | "production";
export type DocumentStatus = "draft" | "published";

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  ownerId: string;
  sourceEnvironment: Environment;
  targetEnvironment: Environment;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
}

export interface CreateDocumentInput {
  title: string;
  slug: string;
  content?: PageContent;
  contentType?: string;
  status?: DocumentStatus;
}

export interface UpdateDocumentInput {
  title?: string;
  slug?: string;
  content?: PageContent;
  contentType?: string;
  status?: DocumentStatus;
}

export interface HealthResponse {
  status: "ok";
  service: string;
}
