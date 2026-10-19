import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("starts the shipped action without node_modules", async () => {
  const directory = await mkdtemp(join(tmpdir(), "allure-action-bundle-"));

  try {
    const entrypoint = join(directory, "index.js");
    await copyFile(new URL("../../dist/index.js", import.meta.url), entrypoint);
    const result = spawnSync(process.execPath, [entrypoint], {
      cwd: directory,
      env: {
        ...process.env,
        "NODE_OPTIONS": "",
        "NODE_PATH": "",
        "GITHUB_REPOSITORY": "bundle-test/repository",
        "INPUT_GITHUB-TOKEN": "",
      },
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("No GitHub token provided");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
