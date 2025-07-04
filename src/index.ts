import * as core from "@actions/core";
import * as github from "@actions/github";
import { readConfig } from "@allurereport/core";
import * as d3 from "d3";
import fg from "fast-glob";
import * as fs from "node:fs";
import * as path from "node:path";

export const generatePieChartSVG = (
  stats: {
    unknown: number;
    passed: number;
    failed: number;
    broken: number;
    skipped: number;
    [key: string]: number;
  },
  size: number = 120,
): string => {
  const data = [
    { label: "passed", value: stats.passed || 0, color: "#22C55F" },
    { label: "failed", value: stats.failed || 0, color: "#E43334" },
    { label: "broken", value: stats.broken || 0, color: "#FBBF24" },
    { label: "skipped", value: stats.skipped || 0, color: "#8190A6" },
    { label: "unknown", value: stats.unknown || 0, color: "#8332D9" },
  ];
  const filtered = data.filter((d) => d.value > 0);
  const radius = size / 2;
  const pie = d3.pie<{ label: string; value: number; color: string }>().value((d) => d.value);
  const arc = d3
    .arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
    .outerRadius(radius - 2)
    .innerRadius(0);
  const arcs = pie(filtered);
  const paths = arcs
    .map((d, i) => {
      const color = d.data.color;
      const arcPath = arc(d);
      return arcPath ? `<path d="${arcPath}" fill="${color}" stroke="#fff" stroke-width="1" />` : "";
    })
    .join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${radius},${radius})">
      ${paths}
    </g>
  </svg>`;
};

export const svgToBase64Url = (svg: string): string => {
  const cleaned = svg.trim().replace(/\n/g, "");
  const base64 = Buffer.from(cleaned, "utf-8").toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

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
  const header = `|  | Name | Duration | Report |\n|-|-|-|-|`;
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
    const svg = generatePieChartSVG(stats, 32);
    const img = `<img src="data:image/svg+xml;base64,${svgToBase64Url(svg)}" width="16px" height="16px" />`;
    const name = summary.name;
    const duration = formatDuration(summary.duration);
    const report = summary.remoteHref ? `[link](${summary.remoteHref})` : "N/A";

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
