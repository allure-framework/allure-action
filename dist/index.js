var $8zHUo$actionscore = require("@actions/core");
var $8zHUo$allurereportcore = require("@allurereport/core");
var $8zHUo$fastglob = require("fast-glob");
var $8zHUo$nodefs = require("node:fs");
var $8zHUo$nodefspromises = require("node:fs/promises");
var $8zHUo$nodepath = require("node:path");
var $8zHUo$actionsgithub = require("@actions/github");


function $parcel$interopDefault(a) {
  return a && a.__esModule ? a.default : a;
}

function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

      var $parcel$global = globalThis;
    
var $parcel$modules = {};
var $parcel$inits = {};

var parcelRequire = $parcel$global["parcelRequire9ff1"];

if (parcelRequire == null) {
  parcelRequire = function(id) {
    if (id in $parcel$modules) {
      return $parcel$modules[id].exports;
    }
    if (id in $parcel$inits) {
      var init = $parcel$inits[id];
      delete $parcel$inits[id];
      var module = {id: id, exports: {}};
      $parcel$modules[id] = module;
      init.call(module.exports, module, module.exports);
      return module.exports;
    }
    var err = new Error("Cannot find module '" + id + "'");
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  };

  parcelRequire.register = function register(id, init) {
    $parcel$inits[id] = init;
  };

  $parcel$global["parcelRequire9ff1"] = parcelRequire;
}

var parcelRegister = parcelRequire.register;
parcelRegister("lINVd", function(module, exports) {

$parcel$export(module.exports, "run", () => run);







var $lCxOT = parcelRequire("lCxOT");
const stripAnsiCodes = (str, replacement)=>str.replace(/\u001b\[\d+m/g, replacement ?? "");
const run = async ()=>{
    const token = (0, $lCxOT.getGithubInput)("github-token");
    const { eventName, repo, payload } = (0, $lCxOT.getGithubContext)();
    if (!token) return;
    if (eventName !== "pull_request" || !payload.pull_request) return;
    const workingDirectory = (0, $lCxOT.getGithubInput)("working-directory") || process.cwd();
    const config = await (0, $8zHUo$allurereportcore.readConfig)(workingDirectory);
    const reportDir = config.output ?? $8zHUo$nodepath.join(workingDirectory, "allure-report");
    const qualityGateFile = $8zHUo$nodepath.join(reportDir, "quality-gate.json");
    const summaryFiles = await (0, ($parcel$interopDefault($8zHUo$fastglob)))([
        $8zHUo$nodepath.join(reportDir, "**", "summary.json")
    ], {
        onlyFiles: true
    });
    let qualityGateResults;
    const summaryFilesContent = await Promise.all(summaryFiles.map(async (file)=>{
        const content = await $8zHUo$nodefspromises.readFile(file, "utf-8");
        return JSON.parse(content);
    }));
    if ((0, $8zHUo$nodefs.existsSync)(qualityGateFile)) {
        const qualityGateContentRaw = await $8zHUo$nodefspromises.readFile(qualityGateFile, "utf-8");
        try {
            qualityGateResults = JSON.parse(qualityGateContentRaw);
        } catch (ignored) {}
    }
    if (qualityGateResults) {
        const octokit = (0, $lCxOT.getOctokit)(token);
        const summaryLines = [];
        const qualityGateFailed = qualityGateResults.length > 0;
        qualityGateResults.forEach((result)=>{
            summaryLines.push(`**${result.rule}** has failed:`);
            summaryLines.push("```shell");
            summaryLines.push(stripAnsiCodes(result.message));
            summaryLines.push("```");
            summaryLines.push("");
        });
        octokit.rest.checks.create({
            owner: repo.owner,
            repo: repo.repo,
            name: "Allure Quality Gate",
            head_sha: payload.pull_request.head.sha,
            status: "completed",
            conclusion: !qualityGateFailed ? "success" : "failure",
            output: !qualityGateFailed ? undefined : {
                title: "Quality Gate",
                summary: summaryLines.join("\n")
            }
        });
    }
    if (summaryFilesContent.length === 0) {
        $8zHUo$actionscore.info("No published reports found");
        return;
    }
    const markdown = (0, $lCxOT.generateSummaryMarkdownTable)(summaryFilesContent);
    const issue_number = payload.pull_request.number;
    const octokit = (0, $lCxOT.getOctokit)(token);
    await octokit.rest.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: issue_number,
        body: markdown
    });
};
if (undefined === module) run();

});
parcelRegister("lCxOT", function(module, exports) {

$parcel$export(module.exports, "getGithubInput", () => $9ba0f9a5c47c04f2$export$c4e6bbc67f187ceb);
$parcel$export(module.exports, "getGithubContext", () => $9ba0f9a5c47c04f2$export$8fcb840ab2357e0f);
$parcel$export(module.exports, "getOctokit", () => $9ba0f9a5c47c04f2$export$314f6a0fd9b37fe2);
$parcel$export(module.exports, "generateSummaryMarkdownTable", () => $9ba0f9a5c47c04f2$export$b062b6a6ad8cd21c);


const $9ba0f9a5c47c04f2$export$c4e6bbc67f187ceb = (name)=>$8zHUo$actionscore.getInput(name, {
        required: false
    });
const $9ba0f9a5c47c04f2$export$8fcb840ab2357e0f = ()=>$8zHUo$actionsgithub.context;
const $9ba0f9a5c47c04f2$export$314f6a0fd9b37fe2 = (token)=>$8zHUo$actionsgithub.getOctokit(token);
const $9ba0f9a5c47c04f2$export$bc733b0c5cbb3e8a = (ms)=>{
    if (!ms || ms < 0) return "0ms";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms % 3600000 / 60000);
    const s = Math.floor(ms % 60000 / 1000);
    const msLeft = ms % 1000;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s) parts.push(`${s}s`);
    // include ms when present
    if (msLeft) parts.push(`${msLeft}ms`);
    return parts.join(" ");
};
const $9ba0f9a5c47c04f2$export$f215903e261f2b5 = (params)=>{
    const { title: title, tests: tests, remoteHref: remoteHref } = params;
    const lines = [
        `### ${title}`,
        `| Status | Test Name | Duration |`,
        `|--------|-----------|----------|`
    ];
    tests.forEach((test)=>{
        const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
        const statusText = `${statusIcon} ${test.status}`;
        const testName = remoteHref ? `[${test.name}](${remoteHref}#${test.id})` : test.name;
        const duration = $9ba0f9a5c47c04f2$export$bc733b0c5cbb3e8a(test.duration);
        lines.push(`| ${statusText} | ${testName} | ${duration} |`);
    });
    return lines.join("\n");
};
const $9ba0f9a5c47c04f2$export$b062b6a6ad8cd21c = (summaries)=>{
    const header = `|  | Name | Duration | Stats | New | Flaky | Retry | Report |`;
    const delimiter = `|-|-|-|-|-|-|-|-|`;
    const rows = summaries.map((summary)=>{
        const stats = {
            unknown: summary.stats.unknown ?? 0,
            passed: summary.stats.passed ?? 0,
            failed: summary.stats.failed ?? 0,
            broken: summary.stats.broken ?? 0,
            skipped: summary.stats.skipped ?? 0,
            ...summary.stats
        };
        const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
        const name = summary.name;
        const duration = $9ba0f9a5c47c04f2$export$bc733b0c5cbb3e8a(summary.duration);
        const statsLabels = [
            `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
            `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
            `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
            `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
            `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`
        ].join("&nbsp;&nbsp;&nbsp;");
        const newCount = summary.newTests?.length ?? 0;
        const flakyCount = summary.flakyTests?.length ?? 0;
        const retryCount = summary.retryTests?.length ?? 0;
        const report = summary.remoteHref ? `<a href="${summary.remoteHref}" target="_blank">View</a>` : '';
        return `| ${img} | ${name} | ${duration} | ${statsLabels} | ${newCount} | ${flakyCount} | ${retryCount} | ${report} |`;
    });
    const lines = [
        "# Allure Report Summary",
        header,
        delimiter,
        ...rows
    ];
    summaries.forEach((summary, i)=>{
        const { newTests: newTests, flakyTests: flakyTests, retryTests: retryTests } = summary;
        const hasTestsToDisplay = [
            newTests,
            flakyTests,
            retryTests
        ].some((tests)=>tests?.length);
        if (!hasTestsToDisplay) return;
        lines.push(`## ${summary.name}\n`);
        if (summary.newTests?.length) {
            lines.push(`<details>`);
            lines.push(`<summary><b>New tests (${summary.newTests.length})</b></summary>\n`);
            lines.push($9ba0f9a5c47c04f2$export$f215903e261f2b5({
                title: "New tests",
                tests: summary.newTests,
                remoteHref: summary.remoteHref
            }));
            lines.push(`\n</details>\n`);
        }
        if (summary.flakyTests?.length) {
            lines.push(`<details>`);
            lines.push(`<summary><b>Flaky tests (${summary.flakyTests.length})</b></summary>\n`);
            lines.push($9ba0f9a5c47c04f2$export$f215903e261f2b5({
                title: "Flaky tests",
                tests: summary.flakyTests,
                remoteHref: summary.remoteHref
            }));
            lines.push(`\n</details>\n`);
        }
        if (summary.retryTests?.length) {
            lines.push(`<details>`);
            lines.push(`<summary><b>Retry tests (${summary.retryTests.length})</b></summary>\n`);
            lines.push($9ba0f9a5c47c04f2$export$f215903e261f2b5({
                title: "Retry tests",
                tests: summary.retryTests,
                remoteHref: summary.remoteHref
            }));
            lines.push(`\n</details>\n`);
        }
        if (i < summaries.length - 1) lines.push("\n---\n");
    });
    return lines.join("\n");
};

});



parcelRequire("lINVd");

//# sourceMappingURL=index.js.map
