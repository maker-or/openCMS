import type {
  CreateProjectInput,
  CreateDocumentInput,
  Deployment,
  Document,
  Environment,
  HealthResponse,
  Project,
} from "./types";

export type {
  CreateDocumentInput,
  CreateProjectInput,
  Deployment,
  Document,
  Environment,
  HealthResponse,
  Page,
  Project,
} from "./types";

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
  const baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
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
          body: JSON.stringify({ ...input, environment }),
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
      create: (input: CreateDocumentInput) =>
        request<Document>(`/api/projects/${projectId ?? ""}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, environment }),
        }),
    },
  };
}

export type OpenCmsSdk = ReturnType<typeof createSdk>;
