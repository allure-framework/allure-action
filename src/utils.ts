export const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return "0ms";

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msLeft = ms % 1000;
  const parts: string[] = [];

  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  if (msLeft || parts.length === 0) parts.push(`${msLeft}ms`);

  return parts.join(" ");
};

export const generateSummaryMarkdownTable = (
  summaries: Array<{
    name: string;
    stats: { [key: string]: number };
    duration: number;
    remoteHref?: string;
  }>,
): string => {
  const header = `|  | Name | Duration | Stats | Report |`;
  const delimiter = `|-|-|-|-|-|`;
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: summary.stats.unknown ?? 0,
      passed: summary.stats.passed ?? 0,
      failed: summary.stats.failed ?? 0,
      broken: summary.stats.broken ?? 0,
      skipped: summary.stats.skipped ?? 0,
      ...summary.stats,
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary.remoteHref ? `[${summary.name}](${summary.remoteHref})` : summary.name;
    const duration = formatDuration(summary.duration);
    const statsLabels = [
      `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
    ].join("&nbsp;&nbsp;&nbsp;");

    return `| ${img} | ${name} | ${duration} | ${statsLabels} |`;
  });

  return ["# Allure Report Summary", header, delimiter, ...rows].join("\n");
};
