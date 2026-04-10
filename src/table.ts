import { formatDuration } from "@allurereport/core-api";
import type { PluginSummary } from "@allurereport/plugin-api";
import type { RemoteSummaryTestResult } from "./model.js";

export const formatSummaryTest = (test: RemoteSummaryTestResult): string => {
  const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
  const statusText = `${statusIcon} ${test.status}`;
  const testName = test.remoteHref ? `[${test.name}](${test.remoteHref})` : test.name;
  const duration = formatDuration(test.duration);

  return `- ${statusText} ${testName} (${duration})`;
};

export const formatSummaryTests = (tests: RemoteSummaryTestResult[]): string => {
  return tests.map((test) => formatSummaryTest(test)).join("\n");
};

/**
 * Generates a markdown table based on information from all available Allure Reports
 * Doesn't include certain information about every test to keep the table compact
 */
export const generateSummaryMarkdownTable = (
  summaries: PluginSummary[],
  options: { remoteHref?: string } = {},
): string => {
  const { remoteHref: inputRemoteHref } = options;
  const header = `|  | Name | Duration | Stats | New | Flaky | Retry | Report |`;
  const delimiter = `|-|-|-|-|-|-|-|-|`;
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: summary?.stats?.unknown ?? 0,
      passed: summary?.stats?.passed ?? 0,
      failed: summary?.stats?.failed ?? 0,
      broken: summary?.stats?.broken ?? 0,
      skipped: summary?.stats?.skipped ?? 0,
      ...summary.stats,
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary?.name ?? "Allure Report";
    const duration = formatDuration(summary?.duration ?? 0);
    const statsLabels: string[] = [];

    if (stats.passed > 0) {
      statsLabels.push(
        `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      );
    }

    if (stats.failed > 0) {
      statsLabels.push(
        `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      );
    }

    if (stats.broken > 0) {
      statsLabels.push(
        `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      );
    }

    if (stats.skipped > 0) {
      statsLabels.push(
        `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      );
    }

    if (stats.unknown > 0) {
      statsLabels.push(
        `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
      );
    }

    const effectiveRemoteHref = inputRemoteHref ?? summary.remoteHref;
    const newCount = summary?.newTests?.length ?? 0;
    const flakyCount = summary?.flakyTests?.length ?? 0;
    const retryCount = summary?.retryTests?.length ?? 0;
    const cells: string[] = [img, name, duration, statsLabels.join("&nbsp;&nbsp;&nbsp;")];

    if (!effectiveRemoteHref) {
      cells.push(newCount.toString());
      cells.push(flakyCount.toString());
      cells.push(retryCount.toString());
      cells.push("");
    } else {
      cells.push(
        newCount > 0
          ? `<a href="${effectiveRemoteHref}?filter=new" target="_blank">${newCount}</a>`
          : newCount.toString(),
      );
      cells.push(
        flakyCount > 0
          ? `<a href="${effectiveRemoteHref}?filter=flaky" target="_blank">${flakyCount}</a>`
          : flakyCount.toString(),
      );
      cells.push(
        retryCount > 0
          ? `<a href="${effectiveRemoteHref}?filter=retry" target="_blank">${retryCount}</a>`
          : retryCount.toString(),
      );
      cells.push(`<a href="${effectiveRemoteHref}" target="_blank">View</a>`);
    }

    return `| ${cells.join(" | ")} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];

  return lines.join("\n");
};
