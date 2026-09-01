import type {
  CreateProjectInput,
  CreateDocumentInput,
  Deployment,
  Document,
  DocumentStatus,
  Environment,
  HealthResponse,
  Project,
  UpdateDocumentInput,
} from "./types";
import { emptyPageContent } from "./schema";
import type { OpenCmsSchema } from "./schema";

export type {
  CreateDocumentInput,
  CreateProjectInput,
  Deployment,
  Document,
  DocumentStatus,
  Environment,
  HealthResponse,
  Page,
  Project,
  UpdateDocumentInput,
} from "./types";
export type {
  ContentBlock,
  OpenCmsSchema,
  PageContent,
  SchemaContentRecord,
  SchemaBlock,
  SchemaContentType,
  SchemaField,
  SchemaFieldType,
} from "./schema";
export {
  defaultSchema,
  emptyPageContent,
  validatePageContent,
  validateSchemaCompatibility,
} from "./schema";

export interface OpenCmsSdkOptions {
  baseUrl?: string;
  projectId?: string;
  environment?: Environment;
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
}

export class OpenCmsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OpenCmsApiError";
  }
}

export function createSdk(options: OpenCmsSdkOptions = {}) {
  const defaultBaseUrl = typeof window === "undefined" ? undefined : window.location.origin;
  const configuredBaseUrl = options.baseUrl ?? defaultBaseUrl;
  // Client components can be rendered on the server before their browser-only
  // effects run. Keep the SDK constructible in that phase and use a relative
  // URL once the request is made in the browser.
  const baseUrl = configuredBaseUrl?.replace(
    /\/$/,
    "",
  ) ?? "";
  const fetcher = options.fetch ?? globalThis.fetch;
  const projectId = options.projectId;
  const environment = options.environment ?? "development";

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    const token = await options.getToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (!baseUrl && typeof window === "undefined") {
      throw new Error("baseUrl is required when making OpenCMS SDK requests outside a browser.");
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = response.statusText || "OpenCMS API request failed";
      try {
        const body = (await response.json()) as { error?: string };
        message = body.error ?? message;
      } catch {
        // Keep the HTTP status text when the response is not JSON.
      }
      throw new OpenCmsApiError(message, response.status);
    }

    return (await response.json()) as T;
  }

  return {
    health: () => request<HealthResponse>("/api/health"),
    projects: {
      list: () => request<Project[]>("/api/projects"),
      create: (input: CreateProjectInput) =>
        request<Project>("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      delete: (targetProjectId: string) =>
        request<{ deleted: true }>(`/api/projects/${targetProjectId}`, {
          method: "DELETE",
        }),
    },
    schema: {
      get: () => {
        if (!projectId) throw new Error("projectId is required to get the schema");
        return request<OpenCmsSchema>(`/api/projects/${projectId}/schema?environment=${environment}`);
      },
      update: (schema: OpenCmsSchema) => {
        if (!projectId) throw new Error("projectId is required to update the schema");
        return request<OpenCmsSchema>(`/api/projects/${projectId}/schema?environment=${environment}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schema),
        });
      },
    },
    pages: {
      list: () => {
        if (!projectId) throw new Error("projectId is required to list pages");
        return request<Document[]>(
          `/api/projects/${projectId}/pages?environment=${environment}`,
        );
      },
      create: (input: CreateDocumentInput) => {
        if (!projectId) throw new Error("projectId is required to create pages");
        return request<Document>(`/api/projects/${projectId}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, environment, content: input.content ?? emptyPageContent }),
        });
      },
      get: (documentId: string) => {
        if (!projectId) throw new Error("projectId is required to get pages");
        return request<Document>(`/api/projects/${projectId}/pages/${documentId}?environment=${environment}`);
      },
      update: (documentId: string, input: UpdateDocumentInput) => {
        if (!projectId) throw new Error("projectId is required to update pages");
        return request<Document>(`/api/projects/${projectId}/pages/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, environment }),
        });
      },
      delete: (documentId: string) => {
        if (!projectId) throw new Error("projectId is required to delete pages");
        return request<{ deleted: true }>(`/api/projects/${projectId}/pages/${documentId}?environment=${environment}`, {
          method: "DELETE",
        });
      },
    },
    deploy: (targetProjectId = projectId) => {
      if (!targetProjectId) throw new Error("projectId is required to deploy");
      return request<Deployment>(`/api/projects/${targetProjectId}/deploy`, {
        method: "POST",
      });
    },
    documents: {
      list: () => {
        if (!projectId) throw new Error("projectId is required to list documents");
        return request<Document[]>(
          `/api/projects/${projectId}/pages?environment=${environment}`,
        );
      },
      create: (input: CreateDocumentInput) => {
        if (!projectId) throw new Error("projectId is required to create documents");
        return request<Document>(`/api/projects/${projectId}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, environment, content: input.content ?? emptyPageContent }),
        });
      },
      get: (documentId: string) => {
        if (!projectId) throw new Error("projectId is required to get documents");
        return request<Document>(`/api/projects/${projectId}/pages/${documentId}?environment=${environment}`);
      },
      update: (documentId: string, input: UpdateDocumentInput) => {
        if (!projectId) throw new Error("projectId is required to update documents");
        return request<Document>(`/api/projects/${projectId}/pages/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, environment }),
        });
      },
      delete: (documentId: string) => {
        if (!projectId) throw new Error("projectId is required to delete documents");
        return request<{ deleted: true }>(`/api/projects/${projectId}/pages/${documentId}?environment=${environment}`, {
          method: "DELETE",
        });
      },
    },
  };
}

export type OpenCmsSdk = ReturnType<typeof createSdk>;
