import * as core from "@actions/core";
import * as github from "@actions/github";
import { readConfig } from "@allurereport/core";
import fg from "fast-glob";
import * as fs from "node:fs";
import * as path from "node:path";

const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return "0ms";

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msLeft = ms % 1000;
  const parts: string[] = [];

  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  if (msLeft || parts.length === 0) parts.push(`${msLeft}ms`);

  return parts.join(" ");
};

export const generateSummaryMarkdownTable = (
  summaries: Array<{
    name: string;
    stats: { [key: string]: number };
    duration: number;
    remoteHref?: string;
  }>,
): string => {
  const header = `|  | Name | Duration | Report |`;
  const delimiter = `|-|-|-|-|`;
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: summary.stats.unknown ?? 0,
      passed: summary.stats.passed ?? 0,
      failed: summary.stats.failed ?? 0,
      broken: summary.stats.broken ?? 0,
      skipped: summary.stats.skipped ?? 0,
      ...summary.stats,
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary.name;
    const duration = formatDuration(summary.duration);
    const report = summary.remoteHref ? `[View](${summary.remoteHref})` : "N/A";

    return `| ${img} | ${name} | ${duration} | ${report} |`;
  });

  return [header, delimiter, ...rows].join("\n");
};

const run = async (): Promise<void> => {
  const workingDirectory = core.getInput("working-directory") || process.cwd();
  const config = await readConfig(workingDirectory);
  const reportDir = config.output ?? path.join(workingDirectory, "allure-report");
  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.promises.readFile(file, "utf-8");

      return JSON.parse(content);
    }),
  );

  if (summaryFilesContent.length === 0) {
    core.info("No published reports found");
    return;
  }

  const markdown = generateSummaryMarkdownTable(summaryFilesContent);

  core.setOutput("markdown", markdown);

  const token = core.getInput("github-token", { required: false });

  if (token && github.context.eventName === "pull_request" && github.context.payload.pull_request) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const issue_number = github.context.payload.pull_request.number;

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: markdown,
    });
  }
};

if (require.main === module) {
  run();
}

export { run };
