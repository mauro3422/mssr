import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';

const ROOT = path.resolve('D:/Dev/mssr');
const MODEL = 'jev-1.13.0';
const REPS = 3;
const cases = [
  {
    file: '.mssr/knowledge/architecture/architecture-impact-review-history.md',
    parent: { id: 'mssr-architecture-impact-history', kind: 'memory', description: 'Historical Architecture Impact review evidence retained for debugging and recovery.' },
    anchor: '## Current cross-host coordinator (0.2.54)',
    sections: {
      '## Current cross-host coordinator (0.2.54)': 'keep-baseline',
      '## Coarse and structural refinement (0.2.33-0.2.39)': 'move-reference',
      '## Derived invariants, context feedback, and reviewed-current receipts (0.2.41-0.2.43)': 'move-reference',
    },
  },
  {
    file: '.mssr/knowledge/architecture/context-plane-history.md',
    parent: { id: 'mssr-context-plane-history', kind: 'memory', description: 'Context Plane historical implementation evidence retained for debugging and recovery.' },
    anchor: '## Current persistence review boundary (0.2.54)',
    sections: {
      '## Current persistence review boundary (0.2.54)': 'keep-baseline',
      '## Context Messages foundation (v1, 0.2.10)': 'move-reference',
      '## Host delivery and canonical project-context cutover (0.2.11, 0.2.18)': 'move-reference',
      '## Inbox tombstone semantics (0.2.12)': 'move-reference',
      '## Canonical-owner migration reconciliation (0.2.64)': 'move-reference',
    },
  },
];

function extract(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start < 0) throw new Error(`missing ${heading}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
  return lines.slice(start, end).join('\n').trim();
}

const actionCriteria = {
  'keep-baseline': 'The candidate contains CURRENT/BROAD parent truth that is not safely covered by the baseline anchor and must remain unconditional.',
  'move-reference': 'The candidate is subordinate historical/deep evidence; current/broad truth needed unconditionally is already represented by the baseline anchor/current parent contract, so exact bytes can move behind a selective ref.',
  review: 'The comparison is ambiguous or current truth cannot be separated safely.',
};
const client = new TypeSafeClient({ timeout: 30000, retry: { maxRetries: 0 }, logLevel: 'off' });
const records = [];
for (let rep = 1; rep <= REPS; rep++) {
  for (const group of cases) {
    const markdown = await fs.readFile(path.join(ROOT, group.file), 'utf8');
    const anchorText = extract(markdown, group.anchor);
    for (const [heading, expected] of Object.entries(group.sections)) {
      const candidate = extract(markdown, heading);
      const response = await client.systemOne({
        model: MODEL,
        state: {
          goal: 'Verify whether one exact Project Context section can be removed from baseline and preserved verbatim behind a selective reference under the same logical parent.',
          parent: group.parent,
          baselineAnchor: { heading: group.anchor, text: anchorText },
          candidate: { heading, text: candidate },
          safety: 'Exact bytes are preserved. Importance does not imply baseline residency. Move only when current/broad truth needed on unrelated tasks remains represented without the candidate.',
        },
        questions: {
          action: choice('Compare candidate against the current baseline anchor and choose the safe physical action.', actionCriteria),
          currentTruthLoss: noul('Probability that moving candidate behind a selective ref would make unrelated future tasks lose necessary CURRENT/BROAD parent truth.'),
          historicalSubordinate: noul('Probability that candidate is primarily subordinate historical/deep evidence rather than current/broad baseline truth.'),
        },
      });
      const a = response.answers.action;
      records.push({ rep, heading, expected, action: a.choice, confidence: a.confidence, currentTruthLoss: response.answers.currentTruthLoss.noul, historicalSubordinate: response.answers.historicalSubordinate.noul });
    }
  }
}
const policy = (r) => r.action === 'move-reference' && r.currentTruthLoss <= 0.4 && r.historicalSubordinate >= 0.6 ? 'move-reference' : r.action === 'keep-baseline' ? 'keep-baseline' : 'review';
let tp=0,fp=0,fn=0,tn=0;
for (const r of records) {
  const pred = policy(r), truthMove = r.expected === 'move-reference', predMove = pred === 'move-reference';
  if (predMove && truthMove) tp++; else if (predMove && !truthMove) fp++; else if (!predMove && truthMove) fn++; else tn++;
}
const summary = { repetitions: REPS, records: records.length, tp, fp, fn, tn, precision: tp+fp ? tp/(tp+fp) : null, recall: tp+fn ? tp/(tp+fn) : null, rows: records.map(r => ({...r, policy: policy(r)})) };
console.log(JSON.stringify(summary, null, 2));
assert.equal(fp, 0, 'baseline-anchor verifier produced a false move');
