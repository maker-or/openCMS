export function vercelDeploymentArgs({
  apiUrl,
  projectId,
  token,
}: {
  apiUrl: string;
  projectId: string;
  token: string;
}) {
  const connectionVariables = [
    `NEXT_PUBLIC_OPENCMS_PROJECT_ID=${projectId}`,
    `OPENCMS_API_URL=${apiUrl}`,
    "OPENCMS_ENVIRONMENT=production",
  ];

  return [
    "vercel",
    "--prod",
    "--yes",
    "--token",
    token,
    ...connectionVariables.flatMap((value) => ["--build-env", value, "--env", value]),
  ];
}
