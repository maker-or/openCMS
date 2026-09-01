"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddCircleIcon } from "@hugeicons/core-free-icons";
import type { IconComponentProps } from "@/lib/icon-context";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardDescription,
  CardFooter,
  CardGroup,
  CardHeader,
  CardMedia,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "../theme-provider";

import { createSdk, type Project } from "@opencms/sdk";

function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="dashboard-surface min-h-screen bg-surface-1">
      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10">
        <div className="mb-8 flex justify-end"><ThemeToggle /></div>
        {children}
      </section>
    </main>
  );
}

function SignInRequired() {
  return (
    <DashboardFrame>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Private workspace</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Sign in to manage projects.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Your projects and content are scoped to your Clerk account.</p>
          <SignInButton mode="modal"><Button className="mt-7">Sign in</Button></SignInButton>
        </div>
      </div>
    </DashboardFrame>
  );
}

function CreateProjectIcon({ size, strokeWidth, className }: IconComponentProps) {
  return (
    <HugeiconsIcon
      icon={AddCircleIcon}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
      className={className}
    />
  );
}

function EmptyWorkspace() {
  return (
    <main className="dashboard-surface relative flex min-h-screen items-center justify-center bg-surface-1 px-6">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <div>
        <section className="flex items-center justify-center">
          <div className="flex -translate-y-2 flex-col items-center text-center">
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <DialogTrigger
                render={
                  <Button
                    size="lg"
                    variant="primary"
                    className="text-[21px] font-medium tracking-[-0.04em]"
                  >
                    Create
                  </Button>
                }
              />
              <span className="text-[21px] font-medium tracking-[-0.04em] text-muted-foreground">
                your first Project
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardLoading() {
  return (
    <main className="dashboard-surface relative flex min-h-screen items-center justify-center bg-surface-1 px-6">

      <div>
        <p className="animate-pulse text-sm font-medium text-muted-foreground">Loading your workspace…</p>
      </div>
    </main>
  );
}

function CreateProjectDialog({
  name,
  isCreating,
  onNameChange,
  onSubmit,
}: {
  name: string;
  isCreating: boolean;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogContent size="sm" className="dashboard-surface">
      <DialogHeader>
        <DialogTitle>Create your first project</DialogTitle>

      </DialogHeader>
      <form onSubmit={onSubmit}>
        <InputGroup className="w-full">
          <InputField
            index={0}
            label="Project name"

            value={name}
            onChange={onNameChange}
            autoFocus
          />
        </InputGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button type="submit" loading={isCreating} disabled={!name.trim()}>
            Create project
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default function DashboardClient() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const api = useMemo(() => createSdk({ getToken }), [getToken]);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      setProjects(await api.projects.list());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isLoaded) queueMicrotask(() => void loadProjects());
  }, [isLoaded, loadProjects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const project = await api.projects.create({ name });
      router.push(`/dashboard/${project.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create project");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Show when="signed-out"><SignInRequired /></Show>
      <Show when="signed-in">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          {isLoading ? (
            <DashboardLoading />
          ) : projects.length === 0 ? (
            <EmptyWorkspace />
          ) : (
            <DashboardFrame>
              <div className="flex flex-col gap-10">
                <header className="flex flex-col justify-between gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-end">
                  <div>

                    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground">Your projects</h1>

                  </div>
                  <DialogTrigger render={<Button trailingIcon={CreateProjectIcon}>New project</Button>} />
                </header>

                {error && <div className="border border-destructive/20 bg-destructive-light/60 px-4 py-3 text-sm text-destructive">{error}</div>}
                <CardGroup orientation="inline" border="outlined" className="mx-auto w-full max-w-2xl bg-surface-2 p-4 shadow-surface-2">
                  {projects.map((project) => (
                    <Card key={project.id} href={`/dashboard/${project.id}`} label={`Open ${project.name}`}>
                      <CardMedia label={project.name} />
                      <CardHeader>
                        <CardTitle className="text-xl">{project.name}</CardTitle>
                        <CardDescription className="mt-1 font-mono text-xs">id: {project.id}</CardDescription>
                      </CardHeader>

                    </Card>
                  ))}
                </CardGroup>
              </div>
            </DashboardFrame>
          )}
          <CreateProjectDialog
            name={name}
            isCreating={isCreating}
            onNameChange={setName}
            onSubmit={createProject}
          />
        </Dialog>
      </Show>
    </>
  );
}
