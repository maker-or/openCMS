export interface Document {
  id: string;
  projectId: string;
  ownerId: string;
  environment: Environment;
  title: string;
  slug: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type Page = Document;
export type Environment = "development" | "production";

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
  content?: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
}
