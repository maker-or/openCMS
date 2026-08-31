import ProjectClient from "./project-client";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#0b0d10] px-6 text-center text-sm text-zinc-400">Configure Clerk to open the OpenCMS dashboard.</main>;
  }
  return <ProjectClient projectId={(await params).projectId} />;
}
