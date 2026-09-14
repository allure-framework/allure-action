import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ReportArtifact, TestResultRegistry } from "./model.js";

type ReadReportArtifactsOptions = {
  onError?: (message: string) => void;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const artifactSort = (left: ReportArtifact, right: ReportArtifact): number => {
  return left.path.localeCompare(right.path) || left.name.localeCompare(right.name);
};

export const readReportArtifacts = async (
  artifactsFile: string,
  options: ReadReportArtifactsOptions = {},
): Promise<ReportArtifact[]> => {
  if (!existsSync(artifactsFile)) {
    return [];
  }

  try {
    const content = await readFile(artifactsFile, "utf-8");
    const artifacts = JSON.parse(content) as unknown;

    if (!Array.isArray(artifacts)) {
      options.onError?.(`Artifacts manifest has unsupported shape: ${artifactsFile}`);
      return [];
    }

    const byPath = new Map<string, ReportArtifact>();

    artifacts.forEach((artifact) => {
      if (!isRecord(artifact) || typeof artifact.name !== "string" || typeof artifact.path !== "string") {
        return;
      }

      if (!byPath.has(artifact.path)) {
        byPath.set(artifact.path, {
          name: artifact.name,
          path: artifact.path,
        });
      }
    });

    return [...byPath.values()].toSorted(artifactSort);
  } catch (error) {
    options.onError?.(`Artifacts manifest parse error: ${String(error)}`);
    return [];
  }
};

export const getTestResultEnvironments = (registry?: TestResultRegistry): string[] => {
  if (!registry) {
    return [];
  }

  const environments = Object.values(registry.byId).flatMap((testResult) => {
    if (!isRecord(testResult)) {
      return [];
    }

    if (typeof testResult.environment !== "string") {
      return [];
    }

    const environment = testResult.environment.trim();

    return environment && environment !== "default" ? [environment] : [];
  });

  return [...new Set(environments)].toSorted((left, right) => left.localeCompare(right));
};
