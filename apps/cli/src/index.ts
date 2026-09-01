#!/usr/bin/env node

import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import process from "node:process";

import {
  createSdk,
  defaultSchema,
  OpenCmsApiError,
  type OpenCmsSchema,
  type Project,
} from "../../../packages/sdk/src/index";

const hostedUrl = "https://web-eta-ten-16.vercel.app";
const dashboardUrl = process.env.OPENCMS_DASHBOARD_URL ?? hostedUrl;
const apiUrl = process.env.OPENCMS_API_URL ?? hostedUrl;
const configRoot = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const configPath = join(configRoot, "opencms", "config.json");

interface CliConfig {
  token?: string;
  apiUrl?: string;
  projectId?: string;
}

async function readConfig(): Promise<CliConfig> {
  if (!(await fileExists(configPath))) return {};
  try {
    return JSON.parse(await readFile(configPath, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: CliConfig) {
  await mkdir(join(configRoot, "opencms"), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function tokenFor(config: CliConfig) {
  return process.env.OPENCMS_CLERK_TOKEN ?? config.token ?? null;
}

function sdk(config: CliConfig, projectId?: string) {
  return createSdk({
    baseUrl: process.env.OPENCMS_API_URL ?? config.apiUrl ?? apiUrl,
    projectId,
    getToken: () => tokenFor(config),
  });
}

async function ask(question: string) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question(question)).trim();
  } finally {
    terminal.close();
  }
}

function fileExists(path: string) {
  return access(path, constants.F_OK).then(() => true, () => false);
}

function runCommand(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; inherit?: boolean } = {}) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.inherit ? "inherit" : "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function openBrowser(url: string) {
  const command = process.platform === "darwin"
    ? ["open", url]
    : process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : ["xdg-open", url];
  await runCommand(command[0], command.slice(1));
}

async function browserLogin() {
  let resolveToken: (token: string) => void = () => undefined;
  let rejectLogin: (error: Error) => void = () => undefined;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectLogin = reject;
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (url.pathname !== "/callback") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Waiting for opencms login.");
      return;
    }
    const token = url.searchParams.get("token");
    if (!token) {
      response.writeHead(400, { "Content-Type": "text/plain" });
      response.end("Missing login token.");
      return;
    }
    resolveToken(token);
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<h1>OpenCMS login complete</h1><p>You can close this window.</p>");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start the login callback server.");
  const callback = `http://127.0.0.1:${address.port}/callback`;
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function ensureToken(config: CliConfig) {
  const token = tokenFor(config);
  if (token) return token;
  const loggedInToken = await browserLogin();
  await writeConfig({ ...config, token: loggedInToken, apiUrl: config.apiUrl ?? apiUrl });
  return loggedInToken;
}

async function reauthenticate(config: CliConfig) {
  if (process.env.OPENCMS_CLERK_TOKEN) {
    throw new Error("OPENCMS_CLERK_TOKEN was rejected or expired. Provide a fresh token or unset the variable to use browser login.");
  }
  console.log("Your OpenCMS session has expired. Opening browser login…");
  const loggedInToken = await browserLogin();
  await writeConfig({ ...config, token: loggedInToken, apiUrl: config.apiUrl ?? apiUrl });
  return loggedInToken;
}

async function login() {
  const config = await readConfig();
  if (process.env.OPENCMS_CLERK_TOKEN) {
    await writeConfig({ ...config, token: process.env.OPENCMS_CLERK_TOKEN, apiUrl: config.apiUrl ?? apiUrl });
    console.log("Saved OPENCMS_CLERK_TOKEN for local CLI use.");
    return;
  }
  const loggedInToken = await browserLogin();
  await writeConfig({ ...config, token: loggedInToken, apiUrl: config.apiUrl ?? apiUrl });
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
  const existing = (await fileExists(envPath)) ? await readFile(envPath, "utf8") : "";
  const managedKeys = ["NEXT_PUBLIC_OPENCMS_PROJECT_ID", "OPENCMS_API_URL", "OPENCMS_ENVIRONMENT"];
  const kept = existing.split("\n").filter((line) => !managedKeys.some((key) => line.startsWith(`${key}=`))).join("\n").trim();
  const managed = [
    `NEXT_PUBLIC_OPENCMS_PROJECT_ID=${project.id}`,
    `OPENCMS_API_URL=${baseUrl}`,
    "OPENCMS_ENVIRONMENT=development",
  ].join("\n");
  await writeFile(envPath, `${kept ? `${kept}\n\n` : ""}${managed}\n`, "utf8");
}

async function ensureCmsDirectory(destination: string, project: Project, baseUrl: string) {
  const cmsDirectory = join(destination, "cms");
  await mkdir(cmsDirectory, { recursive: true });
  const configFile = join(cmsDirectory, "opencms.ts");
  if (!(await fileExists(configFile))) {
    await writeFile(configFile, `export const opencms = {\n  projectId: process.env.NEXT_PUBLIC_OPENCMS_PROJECT_ID ?? "${project.id}",\n  apiUrl: process.env.OPENCMS_API_URL ?? "${baseUrl}",\n  environment: process.env.OPENCMS_ENVIRONMENT ?? "development",\n} as const;\n`, "utf8");
  }
  const schemaFile = join(cmsDirectory, "schema.json");
  if (!(await fileExists(schemaFile))) {
    await writeFile(schemaFile, `${JSON.stringify(defaultSchema, null, 2)}\n`, "utf8");
  }
}

async function packageManager(destination: string) {
  const files = new Set(await readdir(destination));
  if (files.has("pnpm-lock.yaml")) return ["pnpm", "install"];
  if (files.has("yarn.lock")) return ["yarn", "install"];
  if (files.has("package-lock.json")) return ["npm", "install"];
  return ["bun", "install"];
}

async function installDependencies(destination: string) {
  if (process.env.OPENCMS_SKIP_INSTALL === "1") return;
  const manager = await packageManager(destination);
  console.log(`Installing dependencies with ${manager[0]}…`);
  if (await runCommand(manager[0], manager.slice(1), { cwd: destination, inherit: true }) !== 0) {
    throw new Error("Dependency installation failed.");
  }
}

async function pullTemplate(destination: string) {
  const repository = process.env.OPENCMS_TEMPLATE_REPO ?? "https://github.com/maker-or/nextjs-template.git";
  if (await fileExists(destination)) throw new Error(`Destination already exists: ${destination}`);
  console.log("Pulling the OpenCMS Next.js template…");
  if (await runCommand("git", ["clone", "--depth", "1", repository, destination], { inherit: true }) !== 0) {
    throw new Error("Unable to pull the Next.js template.");
  }
  await rm(join(destination, ".git"), { recursive: true, force: true });
}

async function createProject() {
  const config = await readConfig();
  await ensureToken(config);
  const name = await ask("Project name: ");
  if (!name) throw new Error("A project name is required.");
  let currentConfig = await readConfig();
  let client = sdk(currentConfig);
  let project: Project;
  try {
    project = await client.projects.create({ name });
  } catch (error) {
    if (!(error instanceof OpenCmsApiError) || error.status !== 401) throw error;
    await reauthenticate(currentConfig);
    currentConfig = await readConfig();
    client = sdk(currentConfig);
    project = await client.projects.create({ name });
  }
  const destination = resolve(process.cwd(), slugify(project.name));
  await pullTemplate(destination);
  const baseUrl = process.env.OPENCMS_API_URL ?? config.apiUrl ?? apiUrl;
  await writeProjectEnv(destination, project, baseUrl);
  await ensureCmsDirectory(destination, project, baseUrl);
  await installDependencies(destination);
  await writeConfig({ ...(await readConfig()), projectId: project.id, apiUrl: baseUrl });
  console.log(`\nCreated ${project.name}.`);
  console.log(`Project ID: ${project.id}`);
  console.log(`Dashboard: ${dashboardUrl.replace(/\/$/, "")}/dashboard/${project.id}`);
  console.log(`\nNext steps:\n  cd ${slugify(project.name)}\n  npx @maker-or/opencms dev\n  npx @maker-or/opencms deploy`);
}

async function runDev() {
  const config = await readConfig();
  await ensureToken(config);
  try {
    await syncLocalSchema(await projectIdFromEnv(), await readConfig());
  } catch (error) {
    if (!(error instanceof OpenCmsApiError) || error.status !== 401) throw error;
    await reauthenticate(await readConfig());
    await syncLocalSchema(await projectIdFromEnv(), await readConfig());
  }
  const manager = await packageManager(process.cwd());
  const command = manager[0] === "npm" ? ["npm", "run", "dev"] : manager[0] === "pnpm" ? ["pnpm", "dev"] : manager[0] === "yarn" ? ["yarn", "dev"] : ["bun", "run", "dev"];
  process.exit(await runCommand(command[0], command.slice(1), { cwd: process.cwd(), env: { ...process.env, OPENCMS_ENVIRONMENT: "development" }, inherit: true }));
}

async function syncLocalSchema(projectId: string | undefined, config: CliConfig) {
  if (!projectId) return;
  const schemaPath = join(process.cwd(), "cms", "schema.json");
  if (!(await fileExists(schemaPath))) return;

  let schema: OpenCmsSchema;
  try {
    schema = JSON.parse(await readFile(schemaPath, "utf8")) as OpenCmsSchema;
  } catch {
    throw new Error("cms/schema.json is not valid JSON.");
  }

  console.log("Syncing the OpenCMS schema to development…");
  await sdk(config, projectId).schema.update(schema);
}

function projectIdFromEnv() {
  const envPath = join(process.cwd(), ".env.local");
  return fileExists(envPath).then(async (exists) => {
    if (!exists) return undefined;
    const match = (await readFile(envPath, "utf8")).match(/^NEXT_PUBLIC_OPENCMS_PROJECT_ID=(.+)$/m);
    return match?.[1]?.trim();
  });
}

async function deploy() {
  const config = await readConfig();
  await ensureToken(config);
  const projectId = (await projectIdFromEnv()) ?? config.projectId;
  if (!projectId) throw new Error("No OpenCMS project is configured in this directory.");
  let deployment;
  try {
    await syncLocalSchema(projectId, await readConfig());
    deployment = await sdk(await readConfig()).deploy(projectId);
  } catch (error) {
    if (!(error instanceof OpenCmsApiError) || error.status !== 401) throw error;
    await reauthenticate(await readConfig());
    await syncLocalSchema(projectId, await readConfig());
    deployment = await sdk(await readConfig()).deploy(projectId);
  }
  console.log(`Deployed ${deployment.sourceEnvironment} content to ${deployment.targetEnvironment}.`);
  if (process.env.VERCEL_TOKEN) {
    console.log("Deploying the application to Vercel…");
    if (await runCommand("npx", ["vercel", "--prod", "--yes", "--token", process.env.VERCEL_TOKEN], { cwd: process.cwd(), inherit: true }) !== 0) {
      throw new Error("Vercel deployment failed.");
    }
  }
}

function printHelp() {
  console.log("OpenCMS CLI\n\nUsage: npx @maker-or/opencms <command>\n\nCommands:\n  create   Create a project and connected Next.js app\n  login    Authenticate this machine\n  logout   Remove local credentials\n  dev      Run the local Next.js app against development\n  deploy   Promote development content to production");
}

const command = process.argv[2];
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
