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
  // hide ms when duration includes minutes
  if (m < 0 && msLeft) parts.push(`${msLeft}ms`);

  return parts.join(" ");
};

export const formatSummaryTests = (params: {
  title: string;
  tests: SummaryTestResult[];
  remoteHref?: string;
}): string => {
  const { title, tests, remoteHref } = params;
  const lines: string[] = [`### ${title}`];

  tests.forEach((test) => {
    const parts = [`<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`];

    if (remoteHref) {
      parts.push(`<a href="${remoteHref}/#${test.id}" target="_blank">${test.name}</a>`);
    } else {
      parts.push(`<span>${test.name}</span>`);
    }

    parts.push(`<span>${formatDuration(test.duration)}</span>`);

    lines.push(parts.join("&nbsp;"));
  });

  return lines.join("\n");
};

export const generateSummaryMarkdownTable = (summaries: PluginSummary[]): string => {
  const header = `|  | Name | Duration | Stats |`;
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
    const name = summary.remoteHref ? `[${summary.name}](${summary.remoteHref})` : summary.name;
    const duration = formatDuration(summary.duration);
    const statsLabels = [
      `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
    ].join("&nbsp;&nbsp;&nbsp;");

    return `| ${img} | ${name} | ${duration} | ${statsLabels} |`;
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
      lines.push(
        formatSummaryTests({
          title: "New tests",
          tests: summary.newTests,
          remoteHref: summary.remoteHref,
        }),
      );
    }

    if (summary.flakyTests?.length) {
      lines.push(
        formatSummaryTests({
          title: "Flaky tests",
          tests: summary.flakyTests,
          remoteHref: summary.remoteHref,
        }),
      );
    }

    if (summary.retryTests?.length) {
      lines.push(
        formatSummaryTests({
          title: "Retry tests",
          tests: summary.retryTests,
          remoteHref: summary.remoteHref,
        }),
      );
    }

    if (i < summaries.length - 1) {
      lines.push("\n---\n");
    }
  });

  return lines.join("\n");
};
