import { spawnSync } from "node:child_process";
import { styleText } from "node:util";

const color = (format, text) => styleText(format, text, { validateStream: false });

const quiet = spawnSync("git", ["diff", "--ignore-space-at-eol", "--text", "--quiet", "--", "dist/"], {
  stdio: "ignore",
});

if (quiet.status === 0) {
  console.log(color("green", "dist/ is up to date"));
  process.exit(0);
}

console.log("\n");
console.error(color("red", "Detected uncommitted changes after build. See status below:"));
spawnSync("git", ["diff", "--ignore-space-at-eol", "--text", "--stat", "--", "dist/"], {
  stdio: "inherit",
});
console.error(color("red", "dist/ is out of date. Run yarn package and commit dist/"));
process.exit(1);
