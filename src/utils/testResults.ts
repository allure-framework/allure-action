import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { RemoteSummaryTestResult, SummaryTestReference, TestResultRegistry } from "../model.js";

type ReadTestResultRegistryOptions = {
  onError?: (message: string) => void;
};

export const readTestResultRegistry = async (
  registryFile: string,
  options: ReadTestResultRegistryOptions = {},
): Promise<TestResultRegistry | undefined> => {
  if (!existsSync(registryFile)) {
    return undefined;
  }

  try {
    const content = await readFile(registryFile, "utf-8");
    const registry = JSON.parse(content) as Partial<TestResultRegistry>;

    if (!registry.byId || typeof registry.byId !== "object" || Array.isArray(registry.byId)) {
      options.onError?.(`Test result registry has unsupported shape: ${registryFile}`);
      return undefined;
    }

    return registry as TestResultRegistry;
  } catch (error) {
    options.onError?.(`Test result registry parse error: ${String(error)}`);
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
