import * as core from "@actions/core";
import * as github from "@actions/github";
import type { PluginSummary } from "@allurereport/plugin-api";
import chunk from "lodash.chunk";
import type { RemoteSummaryTestResult, RemoteSummaryTestResultsMap } from "./model.js";

export const getGithubInput = (name: string) => core.getInput(name, { required: false });

export const getGithubContext = () => github.context;

export const getOctokit = (token: string) => github.getOctokit(token);

export const formatDuration = (ms?: number): string => {
  if (!ms || ms < 0) return "0ms";

  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const msLeft = ms % 1000;
  const parts: string[] = [];

  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  // include ms when present
  if (msLeft) parts.push(`${msLeft}ms`);

  return parts.join(" ");
};

export const formatSummaryTests = (tests: RemoteSummaryTestResult[]): string => {
  const lines: string[] = [];

  tests.forEach((test) => {
    const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
    const statusText = `${statusIcon} ${test.status}`;
    const testName = test.remoteHref ? `[${test.name}](${test.remoteHref})` : test.name;
    const duration = formatDuration(test.duration);

    lines.push(`- ${statusText} ${testName} (${duration})`);
  });

  return lines.join("\n");
};

/**
 * Generates a markdown table based on information from all available Allure Reports
 * Doesn't include certaion informatino about every test to keep the table compact
 */
export const generateSummaryMarkdownTable = (summaries: PluginSummary[]): string => {
  const header = `|  | Name | Duration | Stats | New | Flaky | Retry | Report |`;
  const delimiter = `|-|-|-|-|-|-|-|-|`;
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
    const statsLabels = [
      `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
    ].join("&nbsp;&nbsp;&nbsp;");
    const newCount = summary.newTests?.length ?? 0;
    const flakyCount = summary.flakyTests?.length ?? 0;
    const retryCount = summary.retryTests?.length ?? 0;
    const report = summary.remoteHref ? `<a href="${summary.remoteHref}" target="_blank">View</a>` : "";

    return `| ${img} | ${name} | ${duration} | ${statsLabels} | ${newCount} | ${flakyCount} | ${retryCount} | ${report} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];

  return lines.join("\n");
};

/**
 * Generates a collapsible markdown section with details about given tests with a given title
 * Keep in mind, that tests cound shouldn't be so big due to github comment body size limitations (>65k characters)
 * Default 200 tests limit is an approximation to avoid hitting the limit
 */
export const generateTestsSectionComment = (params: {
  title: string;
  mappedTests: RemoteSummaryTestResultsMap;
  sectionLimit?: number;
}) => {
  const { title, mappedTests, sectionLimit = 200 } = params;
  const comments: string[] = [];

  if (mappedTests.size === 0) {
    return [];
  }

  const testsList = Array.from(mappedTests.values()).flat();
  const testsChunks = chunk(testsList, sectionLimit);

  testsChunks.forEach((testsChunk, i) => {
    const sectionTitle = testsChunks.length > 1 ? `${title} (part ${i + 1})` : title;
    const lines: string[] = [];

    lines.push(`<details>`);
    lines.push(`<summary><b>${sectionTitle}</b></summary>\n`);
    lines.push(formatSummaryTests(testsChunk));
    lines.push(`\n</details>\n`);

    comments.push(lines.join("\n"));
  });

  return comments;
};

export const stripAnsiCodes = (str: string, replacement?: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[\d+m/g, replacement ?? "");
};
