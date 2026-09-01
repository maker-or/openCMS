"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Show, useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, Code2, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { Elevated } from "@/lib/elevated";
import { useShape } from "@/lib/shape-context";
import {
  createSdk,
  defaultSchema,
  type ContentBlock,
  type Document,
  type Environment,
  type OpenCmsSchema,
} from "@opencms/sdk";
import {
  BlockEditor,
  EnvironmentTabs,
  ProjectFrame,
  SignInRequired,
  validateBlocks,
} from "../../project-client";

type SaveState = "clean" | "dirty" | "saving" | "saved";

export default function PageEditorClient({
  projectId,
  documentId,
}: {
  projectId: string;
  documentId: string;
}) {
  const { getToken, isLoaded } = useAuth();
  const shape = useShape();
  const [environment, setEnvironment] = useState<Environment>("development");
  const [schema, setSchema] = useState<OpenCmsSchema>(defaultSchema);
  const [page, setPage] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [isLoading, setIsLoading] = useState(true);
  const logicalSlug = useRef<string | null>(null);
  const api = useMemo(
    () => createSdk({ projectId, environment, getToken }),
    [projectId, environment, getToken],
  );
  const isReadOnly = environment === "production";

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextSchema, pages] = await Promise.all([
        api.schema.get(),
        api.pages.list(),
      ]);
      const nextPage = pages.find((candidate) => candidate.id === documentId)
        ?? pages.find((candidate) => candidate.slug === logicalSlug.current)
        ?? null;
      setSchema(nextSchema);
      setPage(nextPage);
      setTitle(nextPage?.title ?? "");
      setSlug(nextPage?.slug ?? logicalSlug.current ?? "");
      setBlocks(nextPage?.content?.blocks ?? []);
      if (nextPage) logicalSlug.current = nextPage.slug;
      setErrors({});
      setError(null);
      setSaveState("clean");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load page");
    } finally {
      setIsLoading(false);
    }
  }, [api, documentId]);

  useEffect(() => {
    if (isLoaded) queueMicrotask(() => void loadPage());
  }, [isLoaded, loadPage]);

  function updateBlocks(nextBlocks: ContentBlock[]) {
    setBlocks(nextBlocks);
    setErrors({});
    setSaveState("dirty");
  }

  async function savePage(nextStatus: Document["status"] = page?.status ?? "draft") {
    if (!page) return;
    const nextErrors = validateBlocks(blocks, schema, page.contentType);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSaveState("dirty");
      return;
    }

    setSaveState("saving");
    try {
      const updated = await api.pages.update(page.id, {
        title: title.trim(),
        slug: slug.trim(),
        content: { version: 1, blocks },
        status: nextStatus,
      });
      setPage(updated);
      setTitle(updated.title);
      setSlug(updated.slug);
      setErrors({});
      setError(null);
      setSaveState("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save page");
      setSaveState("dirty");
    }
  }

  function changeEnvironment(nextEnvironment: Environment) {
    if (saveState === "dirty" || saveState === "saving") {
      setError("Save your changes before switching environments.");
      return;
    }
    setError(null);
    setEnvironment(nextEnvironment);
  }

  return (
    <>
      <Show when="signed-out"><SignInRequired /></Show>
      <Show when="signed-in">
        <ProjectFrame>
          <div className="flex flex-col gap-10">
            <header className="flex flex-col gap-8 border-b border-border pb-8">
              <div className="flex items-center justify-between gap-4">
                <Button variant="ghost" size="compact" asChild>
                  <Link href={`/dashboard/${projectId}`}>
                    <ArrowLeft />
                    <span>All pages</span>
                  </Link>
                </Button>
                <EnvironmentTabs environment={environment} onChange={changeEnvironment} />
              </div>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-[-0.06em] text-foreground">
                      {title || "Untitled page"}
                    </h1>

                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">/{slug || "page-slug"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground" role="status">
                    {saveState === "dirty" && "Unsaved changes"}
                    {saveState === "saving" && "Saving…"}
                    {saveState === "saved" && <span className="inline-flex items-center gap-1"><Check size={14} />Saved</span>}
                  </span>
                  {page && !isReadOnly && (
                    <Button
                      variant={page.status === "published" ? "tertiary" : "primary"}
                      leadingIcon={page.status === "published" ? Check : Send}
                      loading={saveState === "saving"}
                      disabled={isLoading || !title.trim() || !slug.trim() || saveState === "saving"}
                      onClick={() => void savePage(page.status === "published" ? "draft" : "published")}
                    >
                      {page.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                  )}
                  {!isReadOnly ? <Button
                    leadingIcon={Save}
                    loading={saveState === "saving"}
                    disabled={isLoading || !title.trim() || !slug.trim() || saveState === "clean"}
                    onClick={() => void savePage()}
                  >
                    Save changes
                  </Button> : (
                    <span className="text-xs text-muted-foreground">Production is read-only</span>
                  )}
                </div>
              </div>
            </header>

            {error && <div className="border border-destructive/20 bg-destructive-light/60 px-4 py-3 text-sm text-destructive">{error}</div>}

            {isLoading ? (
              <Elevated offset={1} className={`min-h-64 border border-border/60 p-6 ${shape.container}`}>
                <Card>
                  <CardHeader>
                    <CardTitle className="animate-pulse text-lg text-muted-foreground">Loading page…</CardTitle>
                  </CardHeader>
                </Card>
              </Elevated>
            ) : !page ? (
              <Elevated offset={1} className={`border border-border/60 p-6 ${shape.container}`}>
                <Card>
                  <CardHeader>
                    <CardTitle>Page unavailable</CardTitle>
                    <CardDescription>This page does not exist in the selected environment.</CardDescription>
                  </CardHeader>
                </Card>
              </Elevated>
            ) : (
              <div className="flex min-w-0 flex-col gap-8">
                  <Elevated offset={1} className={`overflow-hidden border border-border/60 ${shape.container}`}>
                    <Card>
                      <CardHeader className="border-b border-border px-6 pb-5 pt-6">
                        <CardTitle className="text-xl">Page settings</CardTitle>
                        <CardDescription>Identify this page in the {environment} environment.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        <InputGroup className="w-full sm:flex-row">
                          <InputField
                            index={0}
                            label="Title"
                            disabled={isReadOnly}
                            value={title}
                            onChange={(value) => { setTitle(value); setSaveState("dirty"); }}
                          />
                          <InputField
                            index={1}
                            label="Slug"
                            disabled={isReadOnly}
                            value={slug}
                            onChange={(value) => { setSlug(value); setSaveState("dirty"); }}
                          />
                        </InputGroup>
                      </CardContent>
                    </Card>
                  </Elevated>

                  <Elevated offset={1} className={`overflow-hidden border border-border/60 ${shape.container}`}>
                    <Card>
                      <CardHeader className="border-b border-border px-6 pb-5 pt-6">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Structured content</p>
                            <CardTitle className="mt-1 text-xl">Content blocks</CardTitle>
                          </div>
                          <p className="text-xs text-muted-foreground">{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</p>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <BlockEditor blocks={blocks} schema={schema} contentType={page.contentType} errors={errors} readOnly={isReadOnly} onChange={updateBlocks} />
                      </CardContent>
                    </Card>
                  </Elevated>

                  <Elevated offset={1} className={`overflow-hidden border border-border/60 ${shape.container}`}>
                    <details className="p-6">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                        <Code2 size={16} />
                        View JSON
                      </summary>
                      <pre className="mt-5 max-h-80 overflow-auto border border-border bg-transparent p-4 font-mono text-xs leading-6 text-muted-foreground">
                        {JSON.stringify({ title, slug, contentType: page.contentType, status: page.status, content: { version: 1, blocks } }, null, 2)}
                      </pre>
                    </details>
                  </Elevated>
              </div>
            )}
          </div>
        </ProjectFrame>
      </Show>
    </>
  );
}
