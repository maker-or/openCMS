import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";

import { createSdk, type Project } from "@opencms/sdk";

const dashboardUrl = Bun.env.OPENCMS_DASHBOARD_URL ?? "http://localhost:3000";
const apiUrl = Bun.env.OPENCMS_API_URL ?? "http://localhost:3000";
const configRoot = Bun.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const configPath = join(configRoot, "opencms", "config.json");

interface CliConfig {
  token?: string;
  apiUrl?: string;
  projectId?: string;
}

async function readConfig(): Promise<CliConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) return {};
  try {
    return (await file.json()) as CliConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: CliConfig) {
  await mkdir(join(configRoot, "opencms"), { recursive: true });
  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function tokenFor(config: CliConfig) {
  return Bun.env.OPENCMS_CLERK_TOKEN ?? config.token ?? null;
}

function sdk(config: CliConfig, projectId?: string) {
  return createSdk({
    baseUrl: Bun.env.OPENCMS_API_URL ?? config.apiUrl ?? apiUrl,
    projectId,
    getToken: () => tokenFor(config),
  });
}

async function openBrowser(url: string) {
  const command = process.platform === "darwin"
    ? ["open", url]
    : process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : ["xdg-open", url];
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  await child.exited;
}

async function browserLogin() {
  let resolveToken: (token: string) => void = () => undefined;
  let rejectLogin: (error: Error) => void = () => undefined;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectLogin = reject;
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== "/callback") return new Response("Waiting for opencms login.");
      const token = url.searchParams.get("token");
      if (!token) return new Response("Missing login token.", { status: 400 });
      resolveToken(token);
      return new Response("<h1>OpenCMS login complete</h1><p>You can close this window.</p>", { headers: { "Content-Type": "text/html" } });
    },
  });

  const callback = `http://127.0.0.1:${server.port}/callback`;
  const loginUrl = `${dashboardUrl.replace(/\/$/, "")}/cli/login?redirect_uri=${encodeURIComponent(callback)}`;
  console.log(`Opening ${loginUrl}`);
  try {
    await openBrowser(loginUrl);
  } catch {
    console.log("Open the URL above in a browser to continue.");
  }

  const timeout = setTimeout(() => rejectLogin(new Error("Login timed out.")), 5 * 60 * 1000);
  try {
    return await tokenPromise;
  } finally {
    clearTimeout(timeout);
    server.stop();
  }
}

async function ensureToken(config: CliConfig) {
  const token = tokenFor(config);
  if (token) return token;
  const loggedInToken = await browserLogin();
  await writeConfig({ ...config, token: loggedInToken, apiUrl: config.apiUrl ?? apiUrl });
  return loggedInToken;
}

async function login() {
  const config = await readConfig();
  if (Bun.env.OPENCMS_CLERK_TOKEN) {
    await writeConfig({ ...config, token: Bun.env.OPENCMS_CLERK_TOKEN, apiUrl: config.apiUrl ?? apiUrl });
    console.log("Saved OPENCMS_CLERK_TOKEN for local CLI use.");
    return;
  }
  await ensureToken(config);
  console.log("Logged in to OpenCMS.");
}

async function logout() {
  const config = await readConfig();
  const { token: _token, ...withoutToken } = config;
  await writeConfig(withoutToken);
  console.log("Logged out of OpenCMS.");
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

async function writeProjectEnv(destination: string, project: Project, baseUrl: string) {
  const envPath = join(destination, ".env.local");
  const existing = (await Bun.file(envPath).exists()) ? await Bun.file(envPath).text() : "";
  const managedKeys = ["NEXT_PUBLIC_OPENCMS_PROJECT_ID", "OPENCMS_API_URL", "OPENCMS_ENVIRONMENT"];
  const kept = existing.split("\n").filter((line) => !managedKeys.some((key) => line.startsWith(`${key}=`))).join("\n").trim();
  const managed = [
    `NEXT_PUBLIC_OPENCMS_PROJECT_ID=${project.id}`,
    `OPENCMS_API_URL=${baseUrl}`,
    "OPENCMS_ENVIRONMENT=development",
  ].join("\n");
  await Bun.write(envPath, `${kept ? `${kept}\n\n` : ""}${managed}\n`);
}

async function ensureCmsDirectory(destination: string, project: Project, baseUrl: string) {
  const cmsDirectory = join(destination, "cms");
  await mkdir(cmsDirectory, { recursive: true });
  const configFile = join(cmsDirectory, "opencms.ts");
  if (!(await Bun.file(configFile).exists())) {
    await Bun.write(configFile, `export const opencms = {\n  projectId: process.env.NEXT_PUBLIC_OPENCMS_PROJECT_ID ?? "${project.id}",\n  apiUrl: process.env.OPENCMS_API_URL ?? "${baseUrl}",\n  environment: process.env.OPENCMS_ENVIRONMENT ?? "development",\n} as const;\n`);
  }
}

async function installDependencies(destination: string) {
  if (Bun.env.OPENCMS_SKIP_INSTALL === "1") return;
  const files = await Array.fromAsync(new Bun.Glob("{bun.lock,bun.lockb,pnpm-lock.yaml,yarn.lock,package-lock.json}").scan({ cwd: destination }));
  const manager = files.some((file) => file.startsWith("pnpm")) ? ["pnpm", "install"]
    : files.some((file) => file.startsWith("yarn")) ? ["yarn", "install"]
      : files.some((file) => file.startsWith("package-lock")) ? ["npm", "install"]
        : ["bun", "install"];
  console.log(`Installing dependencies with ${manager[0]}…`);
  const child = Bun.spawn(manager, { cwd: destination, stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error("Dependency installation failed.");
}

async function pullTemplate(destination: string) {
  const repository = Bun.env.OPENCMS_TEMPLATE_REPO ?? "https://github.com/opencms/template-nextjs.git";
  if (existsSync(destination)) throw new Error(`Destination already exists: ${destination}`);
  console.log("Pulling the OpenCMS Next.js template…");
  const child = Bun.spawn(["git", "clone", "--depth", "1", repository, destination], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error("Unable to pull the Next.js template.");
  await rm(join(destination, ".git"), { recursive: true, force: true });
}

async function createProject() {
  const config = await readConfig();
  await ensureToken(config);
  const name = prompt("Project name:")?.trim();
  if (!name) throw new Error("A project name is required.");
  const client = sdk(await readConfig());
  const project = await client.projects.create({ name });
  const destination = resolve(process.cwd(), slugify(project.name));
  await pullTemplate(destination);
  const baseUrl = Bun.env.OPENCMS_API_URL ?? config.apiUrl ?? apiUrl;
  await writeProjectEnv(destination, project, baseUrl);
  await ensureCmsDirectory(destination, project, baseUrl);
  await installDependencies(destination);
  await writeConfig({ ...(await readConfig()), projectId: project.id, apiUrl: baseUrl });
  console.log(`\nCreated ${project.name}.`);
  console.log(`Project ID: ${project.id}`);
  console.log(`Dashboard: ${dashboardUrl.replace(/\/$/, "")}/dashboard/${project.id}`);
  console.log(`\nNext steps:\n  cd ${slugify(project.name)}\n  npx opencms dev\n  npx opencms deploy`);
}

async function runDev() {
  const config = await readConfig();
  await ensureToken(config);
  const child = Bun.spawn(["bun", "run", "dev"], { cwd: process.cwd(), env: { ...Bun.env, OPENCMS_ENVIRONMENT: "development" }, stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}

function projectIdFromEnv() {
  const envFile = Bun.file(join(process.cwd(), ".env.local"));
  return envFile.exists().then(async (exists) => {
    if (!exists) return undefined;
    const match = (await envFile.text()).match(/^NEXT_PUBLIC_OPENCMS_PROJECT_ID=(.+)$/m);
    return match?.[1]?.trim();
  });
}

async function deploy() {
  const config = await readConfig();
  await ensureToken(config);
  const projectId = (await projectIdFromEnv()) ?? config.projectId;
  if (!projectId) throw new Error("No OpenCMS project is configured in this directory.");
  const deployment = await sdk(await readConfig()).deploy(projectId);
  console.log(`Deployed ${deployment.sourceEnvironment} content to ${deployment.targetEnvironment}.`);
  if (Bun.env.VERCEL_TOKEN) {
    console.log("Deploying the application to Vercel…");
    const child = Bun.spawn(["npx", "vercel", "--prod", "--yes", "--token", Bun.env.VERCEL_TOKEN], { cwd: process.cwd(), stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error("Vercel deployment failed.");
  }
}

function printHelp() {
  console.log("OpenCMS CLI\n\nUsage: npx opencms <command>\n\nCommands:\n  create   Create a project and connected Next.js app\n  login    Authenticate this machine\n  logout   Remove local credentials\n  dev      Run the local Next.js app against development\n  deploy   Promote development content to production");
}

const command = Bun.argv[2];
try {
  if (command === "create") await createProject();
  else if (command === "login") await login();
  else if (command === "logout") await logout();
  else if (command === "dev") await runDev();
  else if (command === "deploy") await deploy();
  else printHelp();
} catch (error) {
  console.error(`\nOpenCMS: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
