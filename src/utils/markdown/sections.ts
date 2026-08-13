import {
  type ActionSummary,
  type CompatiblePluginSummary,
  SUMMARY_SECTIONS,
  type RemoteSummaryTestResult,
  type SummarySection,
  type TestResultRegistry,
} from "../../model.js";
import { resolveSummaryTests } from "../testResults.js";
import { createExternalLink, formatSummaryTest } from "./table.js";

const SUMMARY_SECTION_DEFINITIONS: Record<
  SummarySection,
  {
    filter: SummarySection;
    title: string;
    testsKey: "newTests" | "flakyTests" | "retryTests";
  }
> = {
  new: {
    filter: "new",
    title: "New Tests",
    testsKey: "newTests",
  },
  flaky: {
    filter: "flaky",
    title: "Flaky Tests",
    testsKey: "flakyTests",
  },
  retry: {
    filter: "retry",
    title: "Retry Tests",
    testsKey: "retryTests",
  },
};

const SUMMARY_SECTION_ALIASES: Record<string, SummarySection> = {
  "new": "new",
  "new-tests": "new",
  "flaky": "flaky",
  "flaky-tests": "flaky",
  "retry": "retry",
  "retry-tests": "retry",
};

export const SUMMARY_SECTION_MARKER_PREFIX = "<!-- allure-report-section:";

const MAX_SECTION_COMMENT_BODY_LENGTH = 60_000;

const normalizeSummarySection = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[\s[\]"']+|[\s\]"']+$/g, "");
};

const getSummaryDisplayName = (summary: CompatiblePluginSummary): string => {
  return summary?.name ?? "Allure Report";
};

const getSummaryTestResultsLinksFlag = (summary: CompatiblePluginSummary): boolean => {
  const { meta } = summary as CompatiblePluginSummary & {
    meta?: {
      withTestResultsLinks?: boolean;
    };
  };

  return Boolean(meta?.withTestResultsLinks);
};

const createSummaryTestRemoteHref = (summary: CompatiblePluginSummary, testId: string): string | undefined => {
  if (!summary.remoteHref || !getSummaryTestResultsLinksFlag(summary)) {
    return undefined;
  }

  return `${summary.remoteHref}#${testId}`;
};

const getSummarySectionTests = (
  summary: CompatiblePluginSummary,
  section: SummarySection,
  registry?: TestResultRegistry,
): RemoteSummaryTestResult[] => {
  const definition = SUMMARY_SECTION_DEFINITIONS[section];
  const tests = resolveSummaryTests(summary[definition.testsKey], registry);

  return tests.map((test) => ({
    ...test,
    remoteHref: createSummaryTestRemoteHref(summary, test.id),
  }));
};

export const parseSummarySections = (value: string): SummarySection[] => {
  const normalizedRequestedSections = value.split(/[\n,]/).map(normalizeSummarySection).filter(Boolean);

  if (normalizedRequestedSections.includes("all")) {
    return [...SUMMARY_SECTIONS];
  }

  const requestedSections = new Set(
    normalizedRequestedSections
      .map((section) => SUMMARY_SECTION_ALIASES[section])
      .filter((section): section is SummarySection => Boolean(section)),
  );

  return SUMMARY_SECTIONS.filter((section) => requestedSections.has(section));
};

export const getSummarySectionMarker = (summaryId: string, section: SummarySection): string => {
  return `${SUMMARY_SECTION_MARKER_PREFIX}${section}:${summaryId} -->`;
};

const getSummarySectionFilterHref = (summary: CompatiblePluginSummary, section: SummarySection): string | undefined => {
  if (!summary.remoteHref) {
    return undefined;
  }

  return `${summary.remoteHref}?filter=${SUMMARY_SECTION_DEFINITIONS[section].filter}`;
};

const formatSummarySectionToggleLabel = (section: SummarySection, testsCount: number): string => {
  const testLabel = testsCount === 1 ? "test" : "tests";

  return `Show ${testsCount} ${section} ${testLabel}`;
};

const renderSummarySectionCommentBody = (titleLine: string, summaryLine: string, contentLines: string[]): string => {
  return [titleLine, "", "<details>", `<summary>${summaryLine}</summary>`, "", ...contentLines, "</details>"].join(
    "\n",
  );
};

const getTruncatedSummarySectionLines = (summary: CompatiblePluginSummary, section: SummarySection): string[] => {
  const moreHref = getSummarySectionFilterHref(summary, section);

  if (!moreHref) {
    return ["", "_List truncated due to comment size limit._", ""];
  }

  return ["", createExternalLink(moreHref, "More"), ""];
};

const generateSummarySectionCommentBody = (
  summary: CompatiblePluginSummary,
  section: SummarySection,
  options: { maxCommentBodyLength?: number; testResultRegistry?: TestResultRegistry } = {},
): string | undefined => {
  const { maxCommentBodyLength = MAX_SECTION_COMMENT_BODY_LENGTH, testResultRegistry } = options;
  const tests = getSummarySectionTests(summary, section, testResultRegistry);

  if (!tests.length) {
    return undefined;
  }

  const definition = SUMMARY_SECTION_DEFINITIONS[section];
  const titleLine = `### ${definition.title} in ${getSummaryDisplayName(summary)}`;
  const summaryLine = formatSummarySectionToggleLabel(section, tests.length);
  const formattedTestLines = tests.map((test) => formatSummaryTest(test));
  const fullBody = renderSummarySectionCommentBody(titleLine, summaryLine, [...formattedTestLines, ""]);

  if (fullBody.length <= maxCommentBodyLength) {
    return fullBody;
  }

  const truncatedTailLines = getTruncatedSummarySectionLines(summary, section);
  const keptTestLines: string[] = [];

  formattedTestLines.forEach((line) => {
    const candidate = renderSummarySectionCommentBody(titleLine, summaryLine, [
      ...keptTestLines,
      line,
      ...truncatedTailLines,
    ]);

    if (candidate.length <= maxCommentBodyLength) {
      keptTestLines.push(line);
    }
  });

  return renderSummarySectionCommentBody(titleLine, summaryLine, [...keptTestLines, ...truncatedTailLines]);
};

export const generateSummarySectionComments = (
  summaries: ActionSummary[],
  sections: SummarySection[],
  options: { maxCommentBodyLength?: number; testResultRegistry?: TestResultRegistry } = {},
): { body: string; marker: string }[] => {
  const comments: { body: string; marker: string }[] = [];

  sections.forEach((section) => {
    summaries.forEach((summary) => {
      const body = generateSummarySectionCommentBody(summary, section, options);

      if (!body) {
        return;
      }

      comments.push({
        marker: getSummarySectionMarker(summary.summaryId, section),
        body,
      });
    });
  });

  return comments;
};
