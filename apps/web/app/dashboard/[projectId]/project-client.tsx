"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardGroup,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useShape } from "@/lib/shape-context";
import { SurfaceProvider } from "@/lib/surface-context";
import type { IconComponent, IconComponentProps } from "@/lib/icon-context";
import {
  createSdk,
  defaultSchema,
  type ContentBlock,
  type Document,
  type Environment,
  type OpenCmsSchema,
} from "@opencms/sdk";
import { ThemeToggle } from "../../theme-provider";

export function ProjectFrame({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen persist={false} shortcut={null} width="112px">
      <div className="dashboard-surface flex min-h-screen w-full bg-surface-1">
        <ProjectSidebar />
        <SidebarInset className="dashboard-surface min-h-screen bg-surface-2 shadow-surface-2">
          <SurfaceProvider value={2}>
            <div className="mx-auto w-full max-w-6xl px-6 py-6 sm:px-10 sm:py-8">
              <div className="mb-8 flex items-center justify-between">
                <SidebarTrigger className="md:hidden" />
                <div className="ml-auto"><ThemeToggle /></div>
              </div>
              {children}
            </div>
          </SurfaceProvider>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function ProjectSidebar() {
  const items: Array<{ label: string; icon: IconComponent }> = [
    { label: "Overview", icon: OverviewIcon },
    { label: "Pages", icon: PagesIcon },
    { label: "Content", icon: NewContentIcon },
    { label: "Deployments", icon: DeploymentsIcon },
    { label: "Settings", icon: SettingsIcon },
  ];
  const activeItem = "Content";

  return (
    <Sidebar variant="inset" bordered collapsible="offcanvas" rail={false} className="bg-surface-1">
      <SidebarHeader className="items-center gap-6 p-3">
        <Button variant="ghost" size="compact" asChild className="self-start">
          <Link href="/dashboard"><ArrowLeft /></Link>
        </Button>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup className="px-2 py-5">
          <SidebarGroupLabel className="sr-only">Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-8">
              {items.map(({ label, icon: Icon }) => {
                const isActive = label === activeItem;
                return (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      icon={Icon}
                      aria-label={label}
                      title={label}
                      isActive={isActive}
                      disabled={!isActive}
                      size="lg"
                      className={`justify-center pl-0 pr-0 [&>span:last-child]:hidden [&>svg]:size-11 ${isActive ? "[&>span:first-child]:text-[#3937E0] [&>svg]:text-[#3937E0]" : "[&>span:first-child]:text-muted-foreground/60 [&>svg]:text-muted-foreground/60"}`}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function SidebarAssetIcon({ src, size = 18, className }: IconComponentProps & { src: string }) {
  const iconSize = Math.max(size, 44);

  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 bg-current ${className ?? ""}`}
      style={{
        width: iconSize,
        height: iconSize,
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

function PagesIcon(props: IconComponentProps) {
  return <SidebarAssetIcon {...props} src="/sidebar-icons/pages.svg" />;
}

function OverviewIcon(props: IconComponentProps) {
  return <SidebarAssetIcon {...props} src="/sidebar-icons/content.svg" />;
}

function NewContentIcon(props: IconComponentProps) {
  return <SidebarAssetIcon {...props} src="/sidebar-icons/content-new.svg" />;
}

function DeploymentsIcon(props: IconComponentProps) {
  return <SidebarAssetIcon {...props} src="/sidebar-icons/deployments.svg" />;
}

function SettingsIcon(props: IconComponentProps) {
  return <SidebarAssetIcon {...props} src="/sidebar-icons/settings.svg" />;
}

export function SignInRequired() {
  return (
    <main className="dashboard-surface min-h-screen bg-surface-1 px-6">
      <div className="flex min-h-[calc(100vh-5.5rem)] items-center justify-center pb-16">
        <div className="w-full max-w-[450px] rounded-3xl border border-white/10 bg-surface-2 px-10 py-12 text-center shadow-[0_24px_60px_rgb(0_0_0/0.24)]">
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-foreground">Sign in to manage projects.</h1>
          <SignInButton mode="modal"><Button className="mt-9 rounded-full px-6">Sign in</Button></SignInButton>
        </div>
      </div>
    </main>
  );
}

export function EnvironmentTabs({
  environment,
  onChange,
}: {
  environment: Environment;
  onChange: (environment: Environment) => void;
}) {
  return (
    <Tabs value={environment} onValueChange={(value) => onChange(value as Environment)} size="default">
      <TabsList>
        <TabItem value="development" label="Development" className="px-4" />
        <TabItem value="production" label="Production" className="px-4" />
      </TabsList>
    </Tabs>
  );
}

function PageList({
  projectId,
  pages,
  environment,
  isLoading,
}: {
  projectId: string;
  pages: Document[];
  environment: Environment;
  isLoading: boolean;
}) {
  return (
    <section aria-labelledby="content-library-title" className="pt-2">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Content library</p>
          <h2 id="content-library-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {environment} pages
          </h2>
        </div>
        <DialogTrigger render={<Button leadingIcon={Plus}>Add page</Button>} />
      </div>

      {isLoading ? (
        <Card className="min-h-64 bg-surface-2 shadow-surface-2">
          <CardHeader>
            <CardTitle className="animate-pulse text-lg text-muted-foreground">Loading pages…</CardTitle>
          </CardHeader>
        </Card>
      ) : pages.length === 0 ? (
        <Card className="min-h-64 border border-dashed border-border bg-surface-2 shadow-surface-2">
          <CardHeader className="flex min-h-64 items-center justify-center text-center">
            <CardTitle className="text-lg">No pages yet</CardTitle>
            <CardDescription className="mt-2 max-w-sm">
              Add a page to start building this environment’s content.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <CardGroup border="outlined" className="overflow-hidden bg-surface-2 shadow-surface-2">
          {pages.map((page) => (
            <Card
              key={page.id}
              href={`/dashboard/${projectId}/pages/${page.id}`}
              label={`Edit ${page.title}`}
              className="bg-transparent"
            >
              <CardHeader>
                <CardTitle className="text-lg">{page.title}</CardTitle>
                <CardDescription className="mt-1 font-mono text-xs">
                  /{page.slug} · {page.status} · {page.content?.blocks?.length ?? 0} blocks
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </CardGroup>
      )}
    </section>
  );
}

export function createBlock(type: string, schema?: OpenCmsSchema): ContentBlock {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${type}-${Date.now()}`;
  const fields = schema?.blocks[type]?.fields ?? {};
  const data = Object.fromEntries(Object.entries(fields).map(([name, field]) => [
    name,
    field.type === "number" ? 0 : field.type === "boolean" ? false : "",
  ]));
  return { id, type, data };
}

export function validateBlocks(
  blocks: ContentBlock[],
  schema: OpenCmsSchema,
  contentType = "page",
) {
  const errors: Record<string, string> = {};
  const definition = schema.contentTypes[contentType];
  if (!definition) return { _page: `Unknown content type: ${contentType}.` };

  for (const block of blocks) {
    const blockDefinition = schema.blocks[block.type];
    if (!blockDefinition) {
      errors[block.id] = `Unknown block type: ${block.type}.`;
      continue;
    }
    if (definition.blocks && !definition.blocks.includes(block.type)) {
      errors[block.id] = `${blockDefinition.label} is not allowed in ${definition.label}.`;
      continue;
    }
    for (const [fieldName, field] of Object.entries(blockDefinition.fields)) {
      const value = block.data[fieldName];
      const key = `${block.id}.${fieldName}`;
      if (field.required && (value === undefined || value === "")) {
        errors[key] = `${field.label ?? fieldName} is required.`;
      } else if (
        value !== undefined && value !== null && value !== "" &&
        ((field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) ||
          (field.type === "boolean" && typeof value !== "boolean") ||
          ((field.type === "text" || field.type === "slug") && typeof value !== "string"))
      ) {
        errors[key] = `${field.label ?? fieldName} must be a ${field.type}.`;
      }
    }
  }
  return errors;
}

export function BlockEditor({
  blocks,
  schema,
  contentType = "page",
  errors = {},
  onChange,
}: {
  blocks: ContentBlock[];
  schema: OpenCmsSchema;
  contentType?: string;
  errors?: Record<string, string>;
  onChange: (blocks: ContentBlock[]) => void;
}) {
  const shape = useShape();
  const allowedBlocks = schema.contentTypes[contentType]?.blocks ?? Object.keys(schema.blocks);

  function updateBlock(blockId: string, field: string, value: unknown) {
    onChange(blocks.map((block) => block.id === blockId
      ? { ...block, data: { ...block.data, [field]: value } }
      : block));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Page body</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Compose the page from structured blocks.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {allowedBlocks.map((type) => (
            <Button
              key={type}
              type="button"
              size="compact"
              variant="tertiary"
              onClick={() => onChange([...blocks, createBlock(type, schema)])}
            >
              + {schema.blocks[type]?.label ?? type}
            </Button>
          ))}
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className={`flex min-h-24 items-center justify-center border border-dashed border-border px-4 text-center text-[13px] text-muted-foreground ${shape.container}`}>
          Add a block to start composing this page.
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, index) => {
            const definition = schema.blocks[block.type];
            if (!definition) return null;
            return (
              <div key={block.id} className={`space-y-3 border border-border bg-surface-2 p-3 ${shape.container}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-foreground">{definition.label}</p>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon-compact" variant="ghost" disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label="Move block up">↑</Button>
                    <Button type="button" size="icon-compact" variant="ghost" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label="Move block down">↓</Button>
                    <Button type="button" size="compact" variant="ghost" onClick={() => onChange([...blocks.slice(0, index + 1), { ...block, id: createBlock(block.type, schema).id, data: { ...block.data } }, ...blocks.slice(index + 1)])}>Duplicate</Button>
                    <Button type="button" size="compact" variant="ghost" onClick={() => onChange(blocks.filter((item) => item.id !== block.id))}>Remove</Button>
                  </div>
                </div>
                {errors[block.id] && <p className="text-[11px] text-destructive">{errors[block.id]}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(definition.fields).map(([fieldName, field]) => {
                    const value = block.data[fieldName];
                    const label = field.label ?? fieldName;
                    const error = errors[`${block.id}.${fieldName}`];
                    if (field.type === "number") {
                      return (
                        <label key={fieldName} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
                          {label}
                          <input
                            type="number"
                            value={typeof value === "number" ? value : ""}
                            onChange={(event) => updateBlock(block.id, fieldName, Number(event.target.value))}
                            aria-invalid={!!error}
                            className={`h-9 bg-transparent px-2.5 text-[13px] text-foreground outline-none ring-1 ${error ? "ring-destructive" : "ring-border"} focus:bg-card ${shape.input}`}
                          />
                          {error && <span className="text-[11px] text-destructive">{error}</span>}
                        </label>
                      );
                    }
                    if (field.type === "boolean") {
                      return (
                        <label key={fieldName} className="flex items-center gap-2 text-[12px] text-muted-foreground sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={value === true}
                            onChange={(event) => updateBlock(block.id, fieldName, event.target.checked)}
                            className="size-4 accent-foreground"
                          />
                          {label}
                          {error && <span className="text-[11px] text-destructive">{error}</span>}
                        </label>
                      );
                    }
                    return (
                      <label key={fieldName} className="flex flex-col gap-1 text-[12px] text-muted-foreground sm:col-span-2">
                        {label}
                        <textarea
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => updateBlock(block.id, fieldName, event.target.value)}
                          placeholder={label}
                          aria-invalid={!!error}
                          className={`min-h-16 resize-y bg-transparent px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ${error ? "ring-destructive" : "ring-border"} focus:bg-card ${shape.input}`}
                        />
                        {error && <span className="text-[11px] text-destructive">{error}</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PageFormDialog({
  title,
  slug,
  blocks,
  schema,
  errors,
  isCreating,
  onTitleChange,
  onSlugChange,
  onBlocksChange,
  onSubmit,
}: {
  title: string;
  slug: string;
  blocks: ContentBlock[];
  schema: OpenCmsSchema;
  errors: Record<string, string>;
  isCreating: boolean;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onBlocksChange: (blocks: ContentBlock[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogContent size="lg" className="dashboard-surface">
      <DialogHeader>
        <DialogTitle>Add a page</DialogTitle>
        <DialogDescription>Saved directly to the selected environment.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-5">
        <InputGroup className="w-full">
          <InputField index={0} label="Title" placeholder="About us" value={title} onChange={onTitleChange} autoFocus />
          <InputField index={1} label="Slug" placeholder="about-us" value={slug} onChange={onSlugChange} />
        </InputGroup>
        <BlockEditor blocks={blocks} schema={schema} errors={errors} onChange={onBlocksChange} />
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button type="submit" loading={isCreating} disabled={!title.trim() || !slug.trim()}>
            Save page
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default function ProjectClient({ projectId }: { projectId: string }) {
  const { getToken, isLoaded } = useAuth();
  const [environment, setEnvironment] = useState<Environment>("development");
  const [schema, setSchema] = useState<OpenCmsSchema>(defaultSchema);
  const [pages, setPages] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const api = useMemo(() => createSdk({ projectId, environment, getToken }), [projectId, environment, getToken]);

  const loadPages = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextSchema, nextPages] = await Promise.all([api.schema.get(), api.pages.list()]);
      setSchema(nextSchema);
      setPages(nextPages);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load pages");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isLoaded) queueMicrotask(() => void loadPages());
  }, [isLoaded, loadPages]);

  async function addPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    const nextErrors = validateBlocks(blocks, schema);
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }
    setIsCreating(true);
    try {
      await api.pages.create({
        title: title.trim(),
        slug: slug.trim(),
        content: { version: 1, blocks },
      });
      setTitle("");
      setSlug("");
      setBlocks([]);
      setFormErrors({});
      setShowPageDialog(false);
      setMessage(`Page saved to ${environment}.`);
      await loadPages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save page");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Show when="signed-out"><SignInRequired /></Show>
      <Show when="signed-in">
        <Dialog open={showPageDialog} onOpenChange={(open) => { setShowPageDialog(open); if (!open) setFormErrors({}); }}>
          <ProjectFrame>
            <div className="flex flex-col gap-10">
              <header className="flex flex-col border-b border-border pb-8">
                <div>
                  <h3 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-foreground">Content</h3>
                </div>
                <div className="mt-8 self-start">
                  <EnvironmentTabs environment={environment} onChange={setEnvironment} />
                </div>
              </header>

              {error && <div className="border border-destructive/20 bg-destructive-light/60 px-4 py-3 text-sm text-destructive">{error}</div>}
              {message && <div className="flex items-center gap-2 border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground"><Check size={16} />{message}</div>}

          <PageList projectId={projectId} pages={pages} environment={environment} isLoading={isLoading} />
            </div>
          </ProjectFrame>

          <PageFormDialog
            title={title}
            slug={slug}
            blocks={blocks}
            schema={schema}
            errors={formErrors}
            isCreating={isCreating}
            onTitleChange={setTitle}
            onSlugChange={setSlug}
            onBlocksChange={(nextBlocks) => { setBlocks(nextBlocks); setFormErrors({}); }}
            onSubmit={addPage}
          />
        </Dialog>
      </Show>
    </>
  );
}
