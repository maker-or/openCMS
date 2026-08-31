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
  SidebarFooter,
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
import { createSdk, type Document, type Environment } from "@opencms/sdk";
import { ThemeToggle } from "../../theme-provider";

function ProjectFrame({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen persist={false} shortcut={null} width="220px">
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
  const items = ["Overview", "Pages", "Content", "Deployments", "Settings"];

  return (
    <Sidebar variant="inset" bordered collapsible="offcanvas" rail={false} className="bg-surface-1">
      <SidebarHeader className="gap-6 p-5">
        <Button variant="ghost" size="compact" asChild className="self-start">
          <Link href="/dashboard"><ArrowLeft /></Link>
        </Button>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup className="px-3 py-5">
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu size="compact">
              {items.map((item) => (
                <SidebarMenuItem key={item}>
                  <SidebarMenuButton isActive={item === "Content"} disabled={item !== "Content"}>
                    {item}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="font-mono text-[10px] text-muted-foreground/70">OpenCMS</p>
      </SidebarFooter>
    </Sidebar>
  );
}

function SignInRequired() {
  return (
    <main className="dashboard-surface min-h-screen bg-surface-1 px-6">
      <div className="flex justify-end py-6"><ThemeToggle /></div>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Private workspace</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Sign in to manage this project.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Your projects and content are scoped to your Clerk account.</p>
          <SignInButton mode="modal"><Button className="mt-7">Sign in</Button></SignInButton>
        </div>
      </div>
    </main>
  );
}

function EnvironmentTabs({
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
  pages,
  environment,
  isLoading,
}: {
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
            <Card key={page.id} className="bg-transparent">
              <CardHeader>
                <CardTitle className="text-lg">{page.title}</CardTitle>
                <CardDescription className="mt-1 font-mono text-xs">/{page.slug}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </CardGroup>
      )}
    </section>
  );
}

function PageFormDialog({
  title,
  slug,
  content,
  isCreating,
  onTitleChange,
  onSlugChange,
  onContentChange,
  onSubmit,
}: {
  title: string;
  slug: string;
  content: string;
  isCreating: boolean;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const shape = useShape();

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
        <label className="flex flex-col gap-2 text-[13px] text-muted-foreground" htmlFor="page-content">
          Content
          <textarea
            id="page-content"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder="Write the page content"
            className={`min-h-36 w-full resize-y bg-transparent px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground ring-1 ring-border transition-all focus:bg-card ${shape.input}`}
          />
        </label>
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
  const [pages, setPages] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const api = useMemo(() => createSdk({ projectId, environment, getToken }), [projectId, environment, getToken]);

  const loadPages = useCallback(async () => {
    setIsLoading(true);
    try {
      setPages(await api.pages.list());
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
    setIsCreating(true);
    try {
      await api.pages.create({ title: title.trim(), slug: slug.trim(), content });
      setTitle("");
      setSlug("");
      setContent("");
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
        <Dialog open={showPageDialog} onOpenChange={setShowPageDialog}>
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

              <PageList pages={pages} environment={environment} isLoading={isLoading} />
            </div>
          </ProjectFrame>

          <PageFormDialog
            title={title}
            slug={slug}
            content={content}
            isCreating={isCreating}
            onTitleChange={setTitle}
            onSlugChange={setSlug}
            onContentChange={setContent}
            onSubmit={addPage}
          />
        </Dialog>
      </Show>
    </>
  );
}
