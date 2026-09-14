import { formatDuration } from "@allurereport/core-api";
import type { CompatiblePluginSummary, RemoteSummaryTestResult, ReportArtifact, SummarySection } from "../../model.js";

const MAX_SUMMARY_COMMENT_BODY_LENGTH = 60_000;

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const escapeMarkdownTableCell = (value: string): string => {
  return value.split("|").join("\\|");
};

const escapeTextTableCell = (value: string): string => {
  return escapeMarkdownTableCell(escapeHtml(value));
};

export const createExternalLink = (href: string, label: string): string => {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
};

const REPORT_FILTERS: Record<SummarySection, string> = {
  new: "transition=new",
  flaky: "flaky=true",
  retry: "retry=true",
};

const STATUS_KEYS = ["passed", "failed", "broken", "skipped", "unknown"] as const;

const getSummaryStats = (summary: CompatiblePluginSummary) => ({
  unknown: summary?.stats?.unknown ?? 0,
  passed: summary?.stats?.passed ?? 0,
  failed: summary?.stats?.failed ?? 0,
  broken: summary?.stats?.broken ?? 0,
  skipped: summary?.stats?.skipped ?? 0,
  ...summary.stats,
});

const getStatsHeader = (summaries: CompatiblePluginSummary[]): string => {
  const maxDigits = summaries.reduce((max, summary) => {
    const stats = getSummaryStats(summary);
    const summaryMaxDigits = Math.max(
      ...STATUS_KEYS.map((status) => (stats[status] > 0 ? stats[status].toString().length : 0)),
    );

    return Math.max(max, summaryMaxDigits);
  }, 0);
  const spacer = "&nbsp;".repeat(Math.max(0, maxDigits + 2));

  return `Stats${spacer}`;
};

export const createReportFilterHref = (href: string, section: SummarySection): string => {
  const hashIndex = href.indexOf("#");
  const baseHref = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const separator = baseHref.includes("?") ? "&" : "?";

  return `${baseHref}${separator}${REPORT_FILTERS[section]}${hash}`;
};

export const formatSummaryTest = (test: RemoteSummaryTestResult): string => {
  const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
  const statusText = `${statusIcon} ${test.status}`;
  const testName = test.remoteHref ? createExternalLink(test.remoteHref, test.name) : test.name;
  const duration = formatDuration(test.duration);

  return `- ${statusText} ${testName} (${duration})`;
};

export const formatSummaryTests = (tests: RemoteSummaryTestResult[]): string => {
  return tests.map((test) => formatSummaryTest(test)).join("\n");
};

const getSummaryResolutions = (summary: CompatiblePluginSummary): Record<string, number> | undefined => {
  const resolutions = summary.stats?.resolutions;

  return resolutions && typeof resolutions === "object" && !Array.isArray(resolutions)
    ? (resolutions as Record<string, number>)
    : undefined;
};

const formatSummaryResolutions = (summary: CompatiblePluginSummary): string => {
  const resolutions = getSummaryResolutions(summary);

  if (!resolutions) {
    return "";
  }

  return [
    ["Issues", resolutions.issues],
    ["Muted", resolutions.muted],
    ["Accepted", resolutions.accepted],
  ]
    .flatMap(([label, count]) => (typeof count === "number" && count > 0 ? [`${label}: ${count}`] : []))
    .join("<br/>");
};

const formatStatsLabel = (
  status: "passed" | "failed" | "broken" | "skipped" | "unknown",
  label: string,
  count: number,
): string =>
  `<img alt="${label}" src="https://allurecharts.qameta.workers.dev/dot?type=${status}&size=8" width="8" height="8" />&#8288;&nbsp;${count}`;

const renderArtifactsDetails = (artifacts: ReportArtifact[], omittedCount = 0): string => {
  const lines = [
    "",
    "<details>",
    `<summary>Artifacts used (${artifacts.length + omittedCount})</summary>`,
    "",
    "| Name | Path |",
    "|-|-|",
    ...artifacts.map((artifact) => `| ${escapeTextTableCell(artifact.name)} | ${escapeTextTableCell(artifact.path)} |`),
  ];

  if (omittedCount > 0) {
    lines.push("", `_${omittedCount} artifacts omitted due to comment size limit._`);
  }

  lines.push("</details>");

  return lines.join("\n");
};

const appendArtifactsDetails = (
  summaryMarkdown: string,
  artifacts: ReportArtifact[],
  maxCommentBodyLength: number,
): string => {
  if (!artifacts.length) {
    return summaryMarkdown;
  }

  const fullMarkdown = `${summaryMarkdown}\n${renderArtifactsDetails(artifacts)}`;

  if (fullMarkdown.length <= maxCommentBodyLength) {
    return fullMarkdown;
  }

  const keptArtifacts: ReportArtifact[] = [];

  artifacts.forEach((artifact, index) => {
    const candidateArtifacts = [...keptArtifacts, artifact];
    const candidate = `${summaryMarkdown}\n${renderArtifactsDetails(candidateArtifacts, artifacts.length - index - 1)}`;

    if (candidate.length <= maxCommentBodyLength) {
      keptArtifacts.push(artifact);
    }
  });

  const truncated = `${summaryMarkdown}\n${renderArtifactsDetails(keptArtifacts, artifacts.length - keptArtifacts.length)}`;

  return truncated.length <= maxCommentBodyLength
    ? truncated
    : summaryMarkdown.slice(0, Math.max(maxCommentBodyLength - 1, 0));
};

/**
 * Generates a markdown table based on information from all available Allure Reports
 * Doesn't include certain information about every test to keep the table compact
 */
export const generateSummaryMarkdownTable = (
  summaries: CompatiblePluginSummary[],
  options: {
    artifacts?: ReportArtifact[];
    environments?: string[];
    maxCommentBodyLength?: number;
    remoteHref?: string;
  } = {},
): string => {
  const {
    artifacts = [],
    environments = [],
    maxCommentBodyLength = MAX_SUMMARY_COMMENT_BODY_LENGTH,
    remoteHref: inputRemoteHref,
  } = options;
  const hasEnvironments = environments.length > 0;
  const hasResolutions = summaries.some((summary) => getSummaryResolutions(summary));
  const headerCells = [
    "&nbsp;&nbsp;&nbsp;&nbsp;",
    "Name",
    "Duration",
    getStatsHeader(summaries),
    ...(hasResolutions ? ["Resolutions"] : []),
    "New",
    "Flaky",
    "Retry",
    "Report",
  ];
  const header = `| ${headerCells.join(" | ")} |`;
  const delimiter = `|${headerCells.map(() => "-").join("|")}|`;
  const rows = summaries.map((summary) => {
    const stats = getSummaryStats(summary);
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp;`;
    const name = escapeTextTableCell(summary?.name ?? "Allure Report");
    const duration = formatDuration(summary?.duration ?? 0);
    const statsLabels: string[] = [];

    if (stats.passed > 0) {
      statsLabels.push(formatStatsLabel("passed", "Passed tests", stats.passed));
    }

    if (stats.failed > 0) {
      statsLabels.push(formatStatsLabel("failed", "Failed tests", stats.failed));
    }

    if (stats.broken > 0) {
      statsLabels.push(formatStatsLabel("broken", "Broken tests", stats.broken));
    }

    if (stats.skipped > 0) {
      statsLabels.push(formatStatsLabel("skipped", "Skipped tests", stats.skipped));
    }

    if (stats.unknown > 0) {
      statsLabels.push(formatStatsLabel("unknown", "Unknown tests", stats.unknown));
    }

    const effectiveRemoteHref = inputRemoteHref ?? summary.remoteHref;
    const newCount = summary?.newTests?.length ?? 0;
    const flakyCount = summary?.flakyTests?.length ?? 0;
    const retryCount = summary?.retryTests?.length ?? 0;
    const cells: string[] = [img, name];

    cells.push(duration, statsLabels.join("<br/>"));

    if (hasResolutions) {
      cells.push(formatSummaryResolutions(summary));
    }

    if (!effectiveRemoteHref) {
      cells.push(newCount.toString());
      cells.push(flakyCount.toString());
      cells.push(retryCount.toString());
      cells.push("");
    } else {
      cells.push(
        newCount > 0
          ? createExternalLink(createReportFilterHref(effectiveRemoteHref, "new"), newCount.toString())
          : newCount.toString(),
      );
      cells.push(
        flakyCount > 0
          ? createExternalLink(createReportFilterHref(effectiveRemoteHref, "flaky"), flakyCount.toString())
          : flakyCount.toString(),
      );
      cells.push(
        retryCount > 0
          ? createExternalLink(createReportFilterHref(effectiveRemoteHref, "retry"), retryCount.toString())
          : retryCount.toString(),
      );
      cells.push(createExternalLink(effectiveRemoteHref, "View"));
    }

    return `| ${cells.join(" | ")} |`;
  });
  const environmentLine = hasEnvironments
    ? [
        `**Environments:** ${environments.map((environment) => `<code>${escapeHtml(environment)}</code>`).join(", ")}`,
        "",
      ]
    : [];
  const lines = ["# Allure Report Summary", ...environmentLine, header, delimiter, ...rows];

  return appendArtifactsDetails(lines.join("\n"), artifacts, maxCommentBodyLength);
};
