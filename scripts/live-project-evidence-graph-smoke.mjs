import path from "node:path";
import { buildMssrProjectEvidenceGraph } from "../dist/index.js";

const roots = process.argv.slice(2).filter(Boolean);
if (roots.length === 0) {
  console.error("Usage: node scripts/live-project-evidence-graph-smoke.mjs <projectRoot> [projectRoot ...]");
  process.exit(2);
}

const reports = [];
for (const projectRootInput of roots) {
  const projectRoot = path.resolve(projectRootInput);
  const graph = await buildMssrProjectEvidenceGraph({
    projectRoot,
    maxSources: 64,
    maxBlocks: 384,
    maxPairs: 24,
    minScore: 0.24,
  });
  const nodes = new Map(graph.nodes.map((node) => [node.block.id, node]));
  reports.push({
    projectRoot,
    sources: graph.sources.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    sourceKinds: [...graph.sources.reduce((map, source) => map.set(source.kind, (map.get(source.kind) ?? 0) + 1), new Map())]
      .map(([kind, count]) => ({ kind, count })),
    candidateCount: graph.edges.length,
    candidates: graph.edges.slice(0, 12).map((edge) => {
      const left = nodes.get(edge.leftBlockId);
      const right = nodes.get(edge.rightBlockId);
      return {
        edgeId: edge.id,
        score: edge.retrieval.score,
        methods: edge.retrieval.methods,
        left: { sourceRef: edge.leftSourceRef, startLine: left?.block.startLine, endLine: left?.block.endLine, sha256: left?.block.sha256 },
        right: { sourceRef: edge.rightSourceRef, startLine: right?.block.startLine, endLine: right?.block.endLine, sha256: right?.block.sha256 },
        orderingHint: edge.orderingHint,
      };
    }),
    policy: graph.policy,
  });
}

console.log(JSON.stringify({ schemaVersion: 1, reports }, null, 2));
