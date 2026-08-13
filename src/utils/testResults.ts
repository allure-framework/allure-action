import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { RemoteSummaryTestResult, SummaryTestReference, TestResultRegistry } from "../model.js";

export const readTestResultRegistry = async (registryFile: string): Promise<TestResultRegistry | undefined> => {
  if (!existsSync(registryFile)) {
    return undefined;
  }

  try {
    const content = await readFile(registryFile, "utf-8");
    const registry = JSON.parse(content) as Partial<TestResultRegistry>;

    if (!registry.byId || typeof registry.byId !== "object" || Array.isArray(registry.byId)) {
      return undefined;
    }

    return registry as TestResultRegistry;
  } catch {
    return undefined;
  }
};

export const resolveSummaryTests = (
  values: SummaryTestReference[] | undefined,
  registry?: TestResultRegistry,
): RemoteSummaryTestResult[] => {
  return (values ?? []).flatMap((value) => {
    if (typeof value === "object" && value !== null) {
      return [value];
    }

    const resolved = registry?.byId?.[value];

    return resolved ? [resolved] : [];
  });
};
