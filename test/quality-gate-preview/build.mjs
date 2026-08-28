import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const reportOutput = "./out/allure-report";
const sourceReportDir = join(reportOutput, "awesome1");
const sourceTestResultsDir = join(sourceReportDir, "data", "test-results");
const qualityGateOutput = join(reportOutput, "quality-gate.json");
const testResultRegistryOutput = join(reportOutput, "test-results.json");

const toRegistryEntry = (test) => ({
  id: test.id,
  name: test.name,
  status: test.status,
  duration: typeof test.duration === "number" ? test.duration : Math.max((test.stop ?? 0) - (test.start ?? 0), 0),
  ...(test.environment ? { environment: test.environment } : {}),
});

const readExistingRegistry = async () => {
  if (!existsSync(testResultRegistryOutput)) {
    return { byId: {} };
  }

  try {
    const registry = JSON.parse(await readFile(testResultRegistryOutput, "utf-8"));

    return registry?.byId && typeof registry.byId === "object" ? registry : { byId: {} };
  } catch {
    return { byId: {} };
  }
};

const readReportTestResults = async () => {
  const byId = {};
  const files = await readdir(sourceTestResultsDir);

  await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const test = JSON.parse(await readFile(join(sourceTestResultsDir, file), "utf-8"));

        if (test.id && !test.isRetry) {
          byId[test.id] = toRegistryEntry(test);
        }
      }),
  );

  return { byId };
};

const byDurationDesc = (left, right) => {
  return right.duration - left.duration || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
};

const createQualityGatePreview = (tests) => {
  const relatedTests = tests.toSorted(byDurationDesc).slice(0, 3);
  const maxDuration = relatedTests[0]?.duration ?? 0;

  return [
    {
      success: false,
      expected: Math.max(maxDuration - 1, 0),
      actual: maxDuration,
      rule: "maxDuration",
      message: `The slowest test duration ${maxDuration}ms exceeds the allowed threshold value ${Math.max(maxDuration - 1, 0)}ms`,
      environment: relatedTests[0]?.environment,
      testResults: relatedTests.map((test) => test.id),
    },
    {
      success: false,
      expected: tests.length + 1,
      actual: tests.length,
      rule: "minTestsCount",
      message: "The total number of tests is below the expected threshold",
      testResults: [],
    },
  ];
};

const existingRegistry = await readExistingRegistry();
const reportRegistry = await readReportTestResults();
const registry = {
  byId: {
    ...existingRegistry.byId,
    ...reportRegistry.byId,
  },
};
const tests = Object.values(reportRegistry.byId);

await writeFile(testResultRegistryOutput, `${JSON.stringify(registry)}\n`);
await writeFile(qualityGateOutput, `${JSON.stringify(createQualityGatePreview(tests))}\n`);
