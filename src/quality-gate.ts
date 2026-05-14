import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import type { QualityGateResultsContent } from "./model.js";

export const stripAnsiCodes = (str: string, replacement?: string): string => {
  return str.replace(/\u001b\[\d+m/g, replacement ?? "");
};

export const isQualityGateFailed = (qualityGateResultsContent?: QualityGateResultsContent): boolean => {
  if (!qualityGateResultsContent) {
    return false;
  }

  if (Array.isArray(qualityGateResultsContent)) {
    return qualityGateResultsContent.length > 0;
  }

  return Object.values(qualityGateResultsContent).flat().length > 0;
};

export const formatQualityGareResultsList = (qualityGateResults: QualityGateValidationResult[]): string => {
  const commentLines: string[] = [];

  qualityGateResults.forEach((result) => {
    commentLines.push(`**${result.rule}** has failed:`);
    commentLines.push("```shell");
    commentLines.push(stripAnsiCodes(result.message));
    commentLines.push("```");
    commentLines.push("");
  });

  return commentLines.join("\n");
};

export const formatQualityGateResults = (qualityGateResultsContent: QualityGateResultsContent): string => {
  if (Array.isArray(qualityGateResultsContent)) {
    return formatQualityGareResultsList(qualityGateResultsContent);
  }

  const comments: string[] = [];

  Object.entries(qualityGateResultsContent).forEach(([env, results]) => {
    comments.push([`**Environment**: "${env}"`, formatQualityGareResultsList(results)].join("\n"));
  });

  return comments.join("\n\n---\n\n");
};
