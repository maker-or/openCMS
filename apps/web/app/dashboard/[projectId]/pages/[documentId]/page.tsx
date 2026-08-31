import PageEditorClient from "./page-editor-client";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">Configure Clerk to open the OpenCMS dashboard.</main>;
  }

  const { projectId, documentId } = await params;
  return <PageEditorClient projectId={projectId} documentId={documentId} />;
}
