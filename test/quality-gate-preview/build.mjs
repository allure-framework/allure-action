import fg from "fast-glob";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const reportOutput = "./out/allure-report";
const qualityGateOutput = join(reportOutput, "quality-gate.json");
const testResultRegistryOutput = join(reportOutput, "test-results.json");
const previewResolutions = [
  { issues: 2, muted: 1, accepted: 1 },
  { issues: 1, muted: 2, accepted: 1 },
];

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

const addPreviewResolutions = async () => {
  const summaryFiles = await fg([join(reportOutput, "**", "summary.json")], { onlyFiles: true });

  await Promise.all(
    summaryFiles.toSorted().map(async (file, index) => {
      const summary = JSON.parse(await readFile(file, "utf-8"));

      summary.stats ??= {};
      summary.stats.resolutions = previewResolutions[index % previewResolutions.length];
      await writeFile(file, `${JSON.stringify(summary)}\n`);
    }),
  );
};

const byDurationDesc = (left, right) => {
  return right.duration - left.duration || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
};

const groupTestsByEnvironment = (tests) => {
  return tests.reduce((groups, test) => {
    if (typeof test.environment !== "string" || test.environment.length === 0) {
      return groups;
    }

    const environmentTests = groups.get(test.environment) ?? [];

    environmentTests.push(test);
    groups.set(test.environment, environmentTests);

    return groups;
  }, new Map());
};

const createQualityGatePreview = (tests) => {
  const testsByEnvironment = groupTestsByEnvironment(tests);
  const [environmentTests = []] = [...testsByEnvironment.values()].toSorted(
    (left, right) => right.length - left.length,
  );
  const relatedTests = (environmentTests.length ? environmentTests : tests).toSorted(byDurationDesc).slice(0, 3);
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
const tests = Object.values(existingRegistry.byId);

await writeFile(qualityGateOutput, `${JSON.stringify(createQualityGatePreview(tests))}\n`);
await addPreviewResolutions();
