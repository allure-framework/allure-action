import * as core from "@actions/core";
import { readConfig } from "@allurereport/core";
import fg from "fast-glob";
import * as fs from "node:fs";
import * as path from "node:path";

const run = async (): Promise<void> => {
  const workingDirectory = core.getInput("working-directory") || process.cwd();

  console.log({ workingDirectory, cwd: process.cwd() });

  const config = await readConfig(workingDirectory);

  console.log({ config });

  const reportDir = config.output ?? path.join(workingDirectory, "allure-report");

  console.log({ reportDir });

  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });

  console.log({ summaryFiles });

  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.promises.readFile(file, "utf-8");

      return JSON.parse(content);
    }),
  );

  console.log({ summaryFilesContent });

  const reportsHrefs = summaryFilesContent.map(({ remoteHref }) => remoteHref).filter(Boolean);

  if (reportsHrefs.length === 0) {
    core.info("No published reports found");
    return;
  }

  core.info(`Found ${reportsHrefs.length} published reports`);

  reportsHrefs.forEach((href) => {
    core.info(`- ${href}`);
  });
};

if (require.main === module) {
  run();
}

export { run };
