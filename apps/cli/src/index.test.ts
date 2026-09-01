import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

describe("OpenCMS CLI binary", () => {
  test("prints the supported command surface", () => {
    const result = spawnSync("node", [resolve(import.meta.dir, "../dist/index.js"), "--help"], {
      encoding: "utf8",
    });

    expect({
      exitCode: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
    }).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "OpenCMS CLI\n\nUsage: npx @maker-or/opencms <command>\n\nCommands:\n  create   Create a project and connected Next.js app\n  login    Authenticate this machine\n  logout   Remove local credentials\n  dev      Run the local Next.js app against development\n  deploy   Promote development content to production\n",
    });
  });

  test("stores local credentials with owner-only permissions", async () => {
    const testConfigRoot = await mkdtemp(join(tmpdir(), "opencms-cli-test-"));
    const executable = resolve(import.meta.dir, "../dist/index.js");

    try {
      const result = spawnSync("node", [executable, "login"], {
        encoding: "utf8",
        env: {
          ...process.env,
          OPENCMS_CLERK_TOKEN: "test-session-token",
          OPENCMS_URL: "https://cms.example.test",
          XDG_CONFIG_HOME: testConfigRoot,
        },
      });
      const configPath = join(testConfigRoot, "opencms", "config.json");

      expect({
        config: JSON.parse(await readFile(configPath, "utf8")),
        exitCode: result.status,
        mode: (await stat(configPath)).mode & 0o777,
      }).toEqual({
        config: {
          apiUrl: "https://cms.example.test",
          token: "test-session-token",
        },
        exitCode: 0,
        mode: 0o600,
      });
    } finally {
      await rm(testConfigRoot, { force: true, recursive: true });
    }
  });
});
