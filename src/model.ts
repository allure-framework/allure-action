import type { QualityGateValidationResult, SummaryTestResult } from "@allurereport/plugin-api";
import type { PluginSummary } from "@allurereport/plugin-api";

export type RemoteSummaryTestResult = SummaryTestResult & {
  remoteHref?: string;
};

export type QualityGateResultsContent = QualityGateValidationResult[] | Record<string, QualityGateValidationResult[]>;

export const SUMMARY_SECTIONS = ["new", "flaky", "retry"] as const;

export type SummarySection = (typeof SUMMARY_SECTIONS)[number];

export type ActionSummary = PluginSummary & {
  summaryId: string;
};
