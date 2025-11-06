import * as core from "@actions/core";
import * as github from "@actions/github";
import { PluginSummary, SummaryTestResult } from "@allurereport/plugin-api";

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

export const formatSummaryTests = (params: {
  title: string;
  tests: SummaryTestResult[];
  remoteHref?: string;
}): string => {
  const { title, tests, remoteHref } = params;
  const lines: string[] = [
    `### ${title}`,
    `| Status | Test Name | Duration |`,
    `|--------|-----------|----------|`
  ];

  tests.forEach((test) => {
    const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
    const statusText = `${statusIcon} ${test.status}`;
    const testName = remoteHref
      ? `[${test.name}](${remoteHref}#${test.id})`
      : test.name;
    const duration = formatDuration(test.duration);

    lines.push(`| ${statusText} | ${testName} | ${duration} |`);
  });

  return lines.join("\n");
};

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
    const report = summary.remoteHref ? `<a href="${summary.remoteHref}" target="_blank">📊 View Report</a>` : '';

    return `| ${img} | ${name} | ${duration} | ${statsLabels} | ${newCount} | ${flakyCount} | ${retryCount} | ${report} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];

  summaries.forEach((summary, i) => {
    const { newTests, flakyTests, retryTests } = summary;
    const hasTestsToDisplay = [newTests, flakyTests, retryTests].some((tests) => tests?.length);

    if (!hasTestsToDisplay) {
      return;
    }

    lines.push(`## ${summary.name}\n`)

    if (summary.newTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>New tests (${summary.newTests.length})</b></summary>\n`);
      lines.push(
        formatSummaryTests({
          title: "New tests",
          tests: summary.newTests,
          remoteHref: summary.remoteHref,
        }),
      );
      lines.push(`\n</details>\n`);
    }

    if (summary.flakyTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>Flaky tests (${summary.flakyTests.length})</b></summary>\n`);
      lines.push(
        formatSummaryTests({
          title: "Flaky tests",
          tests: summary.flakyTests,
          remoteHref: summary.remoteHref,
        }),
      );
      lines.push(`\n</details>\n`);
    }

    if (summary.retryTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>Retry tests (${summary.retryTests.length})</b></summary>\n`);
      lines.push(
        formatSummaryTests({
          title: "Retry tests",
          tests: summary.retryTests,
          remoteHref: summary.remoteHref,
        }),
      );
      lines.push(`\n</details>\n`);
    }

    if (i < summaries.length - 1) {
      lines.push("\n---\n");
    }
  });

  return lines.join("\n");
};
