import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planMssrProjectContextReferenceSplit } from '../../dist/index.js';

const sourceProjectRoot = path.resolve('D:/Dev/mssr');
const sourceManifest = JSON.parse(await fs.readFile(path.join(sourceProjectRoot, '.mssr', 'project-context.json'), 'utf8'));
const expectations = {
  'mssr-architecture-impact-history': {
    '## Current cross-host coordinator (0.2.54)': 'keep',
    '## Coarse and structural refinement (0.2.33-0.2.39)': 'move',
    '## Derived invariants, context feedback, and reviewed-current receipts (0.2.41-0.2.43)': 'move',
  },
  'mssr-context-plane-history': {
    '## Current persistence review boundary (0.2.54)': 'keep',
    '## Context Messages foundation (v1, 0.2.10)': 'move',
    '## Host delivery and canonical project-context cutover (0.2.11, 0.2.18)': 'move',
    '## Inbox tombstone semantics (0.2.12)': 'move',
    '## Canonical-owner migration reconciliation (0.2.64)': 'move',
  },
};

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mssr-jev-real-production-smoke-'));
try {
  const selectedModules = [];
  for (const moduleId of Object.keys(expectations)) {
    const entry = sourceManifest.modules.find((item) => item.id === moduleId);
    assert(entry, `missing source manifest entry ${moduleId}`);
    selectedModules.push(entry);
    const sourcePath = path.join(sourceProjectRoot, entry.source.path);
    const targetPath = path.join(root, entry.source.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, await fs.readFile(sourcePath));
  }
  await fs.mkdir(path.join(root, '.mssr'), { recursive: true });
  await fs.writeFile(path.join(root, '.mssr', 'project-context.json'), `${JSON.stringify({ schemaVersion: 1, core: [], modules: selectedModules }, null, 2)}\n`, 'utf8');

  const reports = [];
  for (const [moduleId, expected] of Object.entries(expectations)) {
    const plan = await planMssrProjectContextReferenceSplit({ projectRoot: root, moduleId, persist: false });
    const actual = Object.fromEntries(plan.decisions.map((decision) => [decision.heading, decision.action]));
    const rows = Object.entries(expected).map(([heading, expectedAction]) => ({
      heading,
      expected: expectedAction,
      actual: actual[heading] ?? 'missing',
      ok: actual[heading] === expectedAction,
    }));
    const falseMoves = rows.filter((row) => row.actual === 'move' && row.expected !== 'move');
    const safeMoves = rows.filter((row) => row.actual === 'move' && row.expected === 'move');
    const expectedMoves = rows.filter((row) => row.expected === 'move');
    reports.push({
      moduleId,
      status: plan.status,
      rows,
      precision: safeMoves.length + falseMoves.length ? safeMoves.length / (safeMoves.length + falseMoves.length) : null,
      recall: expectedMoves.length ? safeMoves.length / expectedMoves.length : null,
      falseMoves: falseMoves.length,
      jev: plan.jev,
      reviewReasons: plan.reviewReasons,
      decisions: plan.decisions.map(({ heading, role, destination, topic, action, reasons }) => ({ heading, role, destination, topic, action, reasons })),
    });
  }

  const allRows = reports.flatMap((report) => report.rows);
  const totalSafeMoves = allRows.filter((row) => row.actual === 'move' && row.expected === 'move').length;
  const totalFalseMoves = reports.reduce((sum, report) => sum + report.falseMoves, 0);
  const totalPredictedMoves = totalSafeMoves + totalFalseMoves;
  const totalExpectedMoves = allRows.filter((row) => row.expected === 'move').length;
  const summary = {
    modules: reports.length,
    expectedMoves: totalExpectedMoves,
    predictedMoves: totalPredictedMoves,
    safeMoves: totalSafeMoves,
    falseMoves: totalFalseMoves,
    precision: totalPredictedMoves ? totalSafeMoves / totalPredictedMoves : null,
    recall: totalExpectedMoves ? totalSafeMoves / totalExpectedMoves : null,
    reports,
  };
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(totalFalseMoves, 0, 'production planner introduced a false move');
  assert.ok(totalSafeMoves > 0, 'production planner produced no positive auto-move evidence');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
