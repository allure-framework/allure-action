import { spawnSync } from "node:child_process";
import { styleText } from "node:util";

const color = (format, text) => styleText(format, text, { validateStream: false });

const runGit = (args, options = {}) =>
  spawnSync("git", args, {
    encoding: "utf8",
    ...options,
  });

// Porcelain status covers tracked edits/deletes and untracked files.
// --untracked-files=normal respects .gitignore (e.g. dist/**/*.d.ts).
const status = runGit(["status", "--porcelain=v1", "--untracked-files=normal", "--", "dist/"], {
  stdio: ["ignore", "pipe", "inherit"],
});

if (status.status !== 0) {
  console.error(color("red", "Failed to inspect dist/ git status"));
  process.exit(status.status ?? 1);
}

if (!status.stdout.trim()) {
  console.log(color("green", "dist/ is up to date"));
  process.exit(0);
}

console.error(color("red", "Detected uncommitted changes after build. See status below:"));
runGit(["status", "--short", "--untracked-files=normal", "--", "dist/"], { stdio: "inherit" });
runGit(["diff", "--ignore-space-at-eol", "--text", "--stat", "--", "dist/"], { stdio: "inherit" });
console.error(color("red", "dist/ is out of date. Run yarn package and commit dist/"));
process.exit(1);
