// Real MSSR Markdown sections. Labels frozen before live inference.
// No expected action/rationale is ever placed in Jev state.
export const realSectionSplitCases = [
  {
    moduleId: 'mssr-architecture-impact-history',
    sections: {
      '## Current cross-host coordinator (0.2.54)': 'keep_baseline',
      '## Coarse and structural refinement (0.2.33-0.2.39)': 'move_reference',
      '## Derived invariants, context feedback, and reviewed-current receipts (0.2.41-0.2.43)': 'move_reference',
    },
  },
  {
    moduleId: 'mssr-context-plane-history',
    sections: {
      '## Current persistence review boundary (0.2.54)': 'keep_baseline',
      '## Context Messages foundation (v1, 0.2.10)': 'move_reference',
      '## Host delivery and canonical project-context cutover (0.2.11, 0.2.18)': 'move_reference',
      '## Inbox tombstone semantics (0.2.12)': 'move_reference',
      '## Canonical-owner migration reconciliation (0.2.64)': 'move_reference',
    },
  },
  {
    moduleId: 'mssr-project-document-reference-lifecycle',
    sections: {
      '## States': 'keep_baseline',
      '## Retroactive discovery': 'keep_baseline',
      '## Reference-on-miss': 'keep_baseline',
      '## Forward registration': 'keep_baseline',
      '## Rename, deletion, freshness': 'keep_baseline',
      '## Human projections': 'keep_baseline',
    },
  },
  {
    moduleId: 'mssr-semantic-consistency-decision',
    sections: {
      '## C2c projection': 'keep_baseline',
      '## C2d recommendation': 'keep_baseline',
      '## R4 temporal validity': 'keep_baseline',
    },
  },
];
