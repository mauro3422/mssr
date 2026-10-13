import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchMssrLibrarianEvidence } from "../../../../../dist/librarian-retrieval.js";

const scriptPath = fileURLToPath(import.meta.url);
const runDir = path.resolve(path.dirname(scriptPath), "..");
const repoRoot = path.resolve(path.dirname(scriptPath), "../../../../..");
const runPlan = JSON.parse(await readFile(path.join(runDir, "RUN-PLAN.json"), "utf8"));
const sourceRunDir = path.resolve(runDir, "..", runPlan.sourceRunId);
const sourceRoot = path.join(sourceRunDir, "inputs", "sources");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

const queryPacketBytes = await readFile(path.join(sourceRunDir, "inputs", "QUERIES.json"));
if (sha256(queryPacketBytes) !== runPlan.source.queryPacketSha256) {
  throw new Error("Frozen source query-packet hash mismatch");
}
const queryPacket = JSON.parse(queryPacketBytes.toString("utf8"));

const documents = [];
for (const sourceRef of runPlan.source.sourceRefs) {
  const markdown = await readFile(path.join(sourceRoot, ...sourceRef.split("/")), "utf8");
  if (sha256(markdown) !== runPlan.source.sourceHashes[sourceRef]) {
    throw new Error(`Frozen source hash mismatch: ${sourceRef}`);
  }
  documents.push({ owner: "MyceliumFront", sourceRef, markdown, privacyClass: "project-metadata" });
}

function observe(results, anchors) {
  const matching = [];
  for (const anchor of anchors) {
    results.forEach((result, index) => {
      const handle = result.handle;
      if (handle.sourceRef === anchor.sourceRef && handle.startLine <= anchor.endLine && handle.endLine >= anchor.startLine) {
        matching.push({
          rank: index + 1,
          exact: handle.startLine === anchor.startLine && handle.endLine === anchor.endLine,
          contains: handle.startLine <= anchor.startLine && handle.endLine >= anchor.endLine,
          sourceRef: handle.sourceRef,
          startLine: handle.startLine,
          endLine: handle.endLine,
          queryMatches: result.queryMatches,
          scoreQueryIndex: result.scoreQueryIndex,
          rankingQueryIndex: result.rankingQueryIndex,
        });
      }
    });
  }
  matching.sort((a, b) => a.rank - b.rank || Number(b.exact) - Number(a.exact));
  return {
    anyOverlap: matching.length > 0,
    fullAnchorContained: matching.some((item) => item.contains),
    exactAnchor: matching.some((item) => item.exact),
    firstOverlapRank: matching[0]?.rank ?? null,
    firstOverlap: matching[0] ?? null,
  };
}

const observations = [];
for (const testCase of queryPacket.queries) {
  if (!runPlan.cohort.focusCaseIds.includes(testCase.caseId)) continue;
  for (const arm of testCase.arms) {
    const otherArm = testCase.arms.find((candidate) => candidate.language !== arm.language);
    const primaryOnly = searchMssrLibrarianEvidence({
      documents,
      query: { query: arm.query, maxResults: 16, maxSnippetChars: 160 },
    });
    const primaryFirst = searchMssrLibrarianEvidence({
      documents,
      query: { query: arm.query, queryVariants: [otherArm.query], queryVariantRanking: "primary-first", maxResults: 16, maxSnippetChars: 160 },
    });
    const roundRobin = searchMssrLibrarianEvidence({
      documents,
      query: { query: arm.query, queryVariants: [otherArm.query], queryVariantRanking: "round-robin", maxResults: 16, maxSnippetChars: 160 },
    });
    for (const maxResults of runPlan.caps) {
      const baseline = observe(primaryOnly.results.slice(0, maxResults), testCase.anchors);
      const baselineTruncated = primaryOnly.truncated || primaryOnly.results.length > maxResults;
      for (const [policy, result] of [["primary-only", primaryOnly], ["primary-first", primaryFirst], ["round-robin", roundRobin]]) {
        const returnedResults = result.results.slice(0, maxResults);
        const returnedOutcome = observe(returnedResults, testCase.anchors);
        observations.push({
          caseId: testCase.caseId,
          primaryLanguage: arm.language,
          variantLanguage: otherArm.language,
          maxResults,
          policy,
          returned: returnedResults.length,
          truncated: result.truncated || result.results.length > maxResults,
          baselineAnchorOverlap: baseline.anyOverlap,
          ...returnedOutcome,
          rescuedByVariant: policy !== "primary-only" && !baseline.anyOverlap && returnedOutcome.anyOverlap,
          lostPrimaryAnchor: policy !== "primary-only" && baseline.anyOverlap && !returnedOutcome.anyOverlap,
          primarySearchTruncated: baselineTruncated,
        });
      }
    }
  }
}

const summaries = [];
for (const primaryLanguage of ["es", "en"]) {
  for (const maxResults of runPlan.caps) {
    for (const policy of ["primary-only", "primary-first", "round-robin"]) {
      const rows = observations.filter((item) => item.primaryLanguage === primaryLanguage && item.maxResults === maxResults && item.policy === policy);
      const ranks = rows.map((item) => item.firstOverlapRank).filter(Number.isInteger);
      summaries.push({
        primaryLanguage,
        variantLanguage: primaryLanguage === "es" ? "en" : "es",
        maxResults,
        policy,
        cases: rows.length,
        nonempty: rows.filter((item) => item.returned > 0).length,
        anyAnchorOverlap: rows.filter((item) => item.anyOverlap).length,
        fullAnchorContained: rows.filter((item) => item.fullAnchorContained).length,
        exactAnchorRange: rows.filter((item) => item.exactAnchor).length,
        rescuedByVariant: rows.filter((item) => item.rescuedByVariant).length,
        lostPrimaryAnchor: rows.filter((item) => item.lostPrimaryAnchor).length,
        truncated: rows.filter((item) => item.truncated).length,
        meanFirstOverlapRank: ranks.length ? Number((ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length).toFixed(3)) : null,
      });
    }
  }
}

const sourceHashes = Object.fromEntries(documents.map((document) => [document.sourceRef, sha256(document.markdown)]));
const findSummary = (primaryLanguage, maxResults, policy) => summaries.find((item) => item.primaryLanguage === primaryLanguage && item.maxResults === maxResults && item.policy === policy);
const findCase = (caseId, primaryLanguage, maxResults, policy) => observations.find((item) => item.caseId === caseId && item.primaryLanguage === primaryLanguage && item.maxResults === maxResults && item.policy === policy);
const findings = {
  englishPrimaryTop8: {
    primaryOnlyOverlap: findSummary("en", 8, "primary-only").anyAnchorOverlap,
    primaryFirstOverlap: findSummary("en", 8, "primary-first").anyAnchorOverlap,
    roundRobinOverlap: findSummary("en", 8, "round-robin").anyAnchorOverlap,
    primaryFirstExactRanges: findSummary("en", 8, "primary-first").exactAnchorRange,
    roundRobinExactRanges: findSummary("en", 8, "round-robin").exactAnchorRange,
    d10PrimaryFirstTop16Rank: findCase("D10", "en", 16, "primary-first").firstOverlapRank,
    d10RoundRobinTop16Rank: findCase("D10", "en", 16, "round-robin").firstOverlapRank,
  },
  spanishPrimaryTop8: {
    primaryFirstOverlap: findSummary("es", 8, "primary-first").anyAnchorOverlap,
    roundRobinOverlap: findSummary("es", 8, "round-robin").anyAnchorOverlap,
    primaryFirstExactRanges: findSummary("es", 8, "primary-first").exactAnchorRange,
    roundRobinExactRanges: findSummary("es", 8, "round-robin").exactAnchorRange,
    primaryFirstLostAnchors: findSummary("es", 8, "primary-first").lostPrimaryAnchor,
    roundRobinLostAnchors: findSummary("es", 8, "round-robin").lostPrimaryAnchor,
  },
};
const result = {
  schemaVersion: "mssr-librarian-query-ranking-replay-v1",
  runId: runPlan.runId,
  sourceRunId: runPlan.sourceRunId,
  implementationVersion: runPlan.implementationVersion,
  implementationBuildReceipt: JSON.parse(await readFile(path.join(repoRoot, "dist", ".build-receipt.json"), "utf8")),
  sourceRevision: runPlan.source.projectRevision,
  verifiedQueryPacketSha256: runPlan.source.queryPacketSha256,
  verifiedSourceHashes: sourceHashes,
  cohort: { cases: runPlan.cohort.focusCaseIds.length, queryArms: runPlan.cohort.queryArms, projectClusters: 1, ownerAdjudication: "pending", anchors: "provisional", priorSearchExposure: true },
  method: "Deterministic replay of nine previously exposed English top-8 misses in both primary-language directions, using primary-only, primary-first, and implemented round-robin. Each query returns top 16 once; top-8 metrics are derived by slicing the same ranked list. No Jev/provider calls.",
  summaries,
  findings,
  caseObservations: observations,
};

const resultPath = path.join(path.dirname(scriptPath), "IMPLEMENTATION-REPLAY.json");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const reportLines = [
  "# MyceliumFront query-variant ranking implementation replay",
  "",
  `Run: \`${runPlan.runId}\``,
  `Implementation: MSSR \`${runPlan.implementationVersion}\``,
  `Source run: \`${runPlan.sourceRunId}\` (four files, commit \`${runPlan.source.projectRevision}\`)`,
  `Query packet SHA-256: \`${runPlan.source.queryPacketSha256}\``,
  "",
  "## Scope and limits",
  "",
  "This is a deterministic implementation replay over the nine English top-8 misses from the previously exposed 35-case MyceliumFront packet, in both primary-language directions (18 query arms). The implementation returns top 16 once per policy and derives top-8 by slicing the same ranking. All anchors remain provisional and owner adjudication is pending. There was no Jev/provider call. These are correlated arms from one project, not independent reliability samples, owner gold, or a holdout.",
  "",
  "`primary-only` is the deterministic baseline. `primary-first` and `round-robin` use the same explicit paired query variant; round-robin keeps the per-query score streams separate and reports the ranking lane. Metrics measure overlap/containment/exactness against candidate anchors only.",
  "",
  "## Results",
  "",
  "| Primary | Cap | Policy | Anchor overlap | Full anchor contained | Exact range | Rescued vs primary-only | Lost primary anchor | Truncated |",
  "|---|---:|---|---:|---:|---:|---:|---:|---:|",
  ...summaries.map((item) => `| ${item.primaryLanguage} | ${item.maxResults} | ${item.policy} | ${item.anyAnchorOverlap}/${item.cases} | ${item.fullAnchorContained}/${item.cases} | ${item.exactAnchorRange}/${item.cases} | ${item.rescuedByVariant} | ${item.lostPrimaryAnchor} | ${item.truncated}/${item.cases} |`),
  "",
  `For English-primary queries, top-8 anchor overlap was ${findings.englishPrimaryTop8.primaryOnlyOverlap}/9 with no variant, ${findings.englishPrimaryTop8.primaryFirstOverlap}/9 with the default policy, and ${findings.englishPrimaryTop8.roundRobinOverlap}/9 with round-robin. Exact ranges stayed ${findings.englishPrimaryTop8.primaryFirstExactRanges}/9 versus ${findings.englishPrimaryTop8.roundRobinExactRanges}/9. D10's first anchor moved from rank ${findings.englishPrimaryTop8.d10PrimaryFirstTop16Rank} to ${findings.englishPrimaryTop8.d10RoundRobinTop16Rank}.`,
  `For Spanish-primary queries on the same nine cases, overlap stayed ${findings.spanishPrimaryTop8.primaryFirstOverlap}/9 and there were no fully lost anchors, but exact top-8 ranges changed from ${findings.spanishPrimaryTop8.primaryFirstExactRanges}/9 to ${findings.spanishPrimaryTop8.roundRobinExactRanges}/9. Top-16 exact counts were equal at 5/9. This is a measurable tradeoff, not a universal improvement.`,
  "",
  "## Interpretation",
  "",
  "The result supports or rejects only the retrieval-rank hypothesis for this frozen corpus. Higher provisional-anchor coverage does not establish that Jev will choose the right range, that the excerpt is sufficient, or that a composition is accurate. A production default change still requires owner-adjudicated, project-grouped evidence. `primary-first` remains the compatibility default.",
  "",
  "Reproduction: `node derived/replay-query-variant-ranking.mjs`. The script verifies every frozen source SHA-256 before querying and writes `derived/IMPLEMENTATION-REPLAY.json`.",
];
await writeFile(path.join(path.dirname(scriptPath), "IMPLEMENTATION-REPLAY.md"), `${reportLines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ runId: runPlan.runId, summaries, resultPath }, null, 2));
