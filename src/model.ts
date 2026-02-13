import type { QualityGateValidationResult, SummaryTestResult } from "@allurereport/plugin-api";

export type RemoteSummaryTestResult = SummaryTestResult & {
  remoteHref?: string;
};

export type QualityGateResultsContent = QualityGateValidationResult[] | Record<string, QualityGateValidationResult[]>;
