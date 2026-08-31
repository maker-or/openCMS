"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Show, useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, Code2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputField, InputGroup } from "@/components/ui/input-group";
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
  const api = useMemo(
    () => createSdk({ projectId, environment, getToken }),
    [projectId, environment, getToken],
  );

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextSchema, nextPage] = await Promise.all([
        api.schema.get(),
        api.pages.get(documentId),
      ]);
      setSchema(nextSchema);
      setPage(nextPage);
      setTitle(nextPage.title);
      setSlug(nextPage.slug);
      setBlocks(nextPage.content?.blocks ?? []);
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

  async function savePage() {
    if (!page) return;
    const nextErrors = validateBlocks(blocks, schema, page.contentType);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSaveState("dirty");
      return;
    }

    setSaveState("saving");
    try {
      const updated = await api.pages.update(documentId, {
        title: title.trim(),
        slug: slug.trim(),
        content: { version: 1, blocks },
        status: page.status,
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

  return (
    <>
      <Show when="signed-out"><SignInRequired /></Show>
      <Show when="signed-in">
        <ProjectFrame>
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-6 border-b border-border pb-7">
              <div className="flex items-center justify-between gap-4">
                <Button variant="ghost" size="compact" asChild>
                  <Link href={`/dashboard/${projectId}`}>
                    <ArrowLeft />
                    <span>All pages</span>
                  </Link>
                </Button>
                <EnvironmentTabs environment={environment} onChange={setEnvironment} />
              </div>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Page editor</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                    {title || "Untitled page"}
                  </h1>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">/{slug || "page-slug"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground" role="status">
                    {saveState === "dirty" && "Unsaved changes"}
                    {saveState === "saving" && "Saving…"}
                    {saveState === "saved" && <span className="inline-flex items-center gap-1"><Check size={14} />Saved</span>}
                  </span>
                  <Button
                    leadingIcon={Save}
                    loading={saveState === "saving"}
                    disabled={isLoading || !title.trim() || !slug.trim() || saveState === "clean"}
                    onClick={() => void savePage()}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </header>

            {error && <div className="border border-destructive/20 bg-destructive-light/60 px-4 py-3 text-sm text-destructive">{error}</div>}

            {isLoading ? (
              <Card className={`min-h-64 ${shape.container}`}>
                <CardHeader>
                  <CardTitle className="animate-pulse text-lg text-muted-foreground">Loading page…</CardTitle>
                </CardHeader>
              </Card>
            ) : !page ? (
              <Card className={shape.container}>
                <CardHeader>
                  <CardTitle>Page unavailable</CardTitle>
                  <CardDescription>This page does not exist in the selected environment.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="flex flex-col gap-8">
                <section className="space-y-5">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Page settings</p>
                    <p className="mt-1 text-sm text-muted-foreground">These fields identify the page in the {environment} environment.</p>
                  </div>
                  <InputGroup className="w-full sm:flex-row">
                    <InputField
                      index={0}
                      label="Title"
                      value={title}
                      onChange={(value) => { setTitle(value); setSaveState("dirty"); }}
                    />
                    <InputField
                      index={1}
                      label="Slug"
                      value={slug}
                      onChange={(value) => { setSlug(value); setSaveState("dirty"); }}
                    />
                  </InputGroup>
                </section>

                <section className="space-y-5 border-t border-border pt-8">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Structured content</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-foreground">Content blocks</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">{blocks.length} {blocks.length === 1 ? "block" : "blocks"}</p>
                  </div>
                  <BlockEditor blocks={blocks} schema={schema} contentType={page.contentType} errors={errors} onChange={updateBlocks} />
                </section>

                <details className={`border-t border-border pt-5 ${shape.container}`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <Code2 size={16} />
                    View JSON
                  </summary>
                  <pre className="mt-4 max-h-80 overflow-auto border border-border bg-surface-2 p-4 font-mono text-xs leading-6 text-muted-foreground">
                    {JSON.stringify({ title, slug, contentType: page.contentType, content: { version: 1, blocks } }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </ProjectFrame>
      </Show>
    </>
  );
}
