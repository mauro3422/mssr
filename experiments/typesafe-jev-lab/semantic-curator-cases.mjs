// Synthetic fixtures frozen before inference. Expected labels never enter Jev state/questions.
const block = (id, text, extra = {}) => ({ id, text, ...extra });

export const semanticCuratorCases = [
  {
    id: 'project-context-overflow',
    goal: 'Curate MSSR project memory so current state stays compact while durable history moves behind selective references.',
    topics: ['context-economy', 'routing', 'verification', 'release-history', 'ui'],
    blocks: [
      block('b1', 'Current invariant: optional Project Context modules that exceed their entry budget must be omitted with visible evidence instead of aborting the whole bootstrap.', { protected: true }),
      block('b2', 'The loader previously materialized every eligible module before final budget selection, so one oversized optional module could throw before omission was possible.'),
      block('b3', 'Historical note: release 0.2.63 introduced semantic segments with a baseline plus at most one matching optional segment.'),
      block('b4', 'Current maintenance rule: exact indexed sections may move automatically, but whole-file semantic segmentation requires reviewed selectors.'),
      block('b5', 'The dashboard card used a red accent in an older mockup.'),
      block('b6', 'Decision: preserve provenance, protected constraints and original text when semantic curation proposes keep/drop, merge or ref extraction.', { protected: true }),
    ],
    pairs: [
      ['b1', 'b2'],
      ['b3', 'b4'],
      ['b1', 'b6'],
      ['b4', 'b6'],
    ],
    expected: {
      role: { b1:'current_state', b2:'history', b3:'history', b4:'procedure', b5:'noise', b6:'durable_decision' },
      destination: { b1:'state', b2:'knowledge_ref', b3:'knowledge_ref', b4:'knowledge_ref', b5:'drop', b6:'memory' },
      protected: { b1:true, b2:false, b3:false, b4:false, b5:false, b6:true },
      topic: { b1:'context-economy', b2:'context-economy', b3:'context-economy', b4:'context-economy', b5:'ui', b6:'context-economy' },
      relation: { 'b1:b2':'supports', 'b3:b4':'supports', 'b1:b6':'supports', 'b4:b6':'supports' },
    },
  },
  {
    id: 'duplicate-and-supersession',
    goal: 'Separate current truth from duplicate or superseded memory and build compact refs without losing active restrictions.',
    topics: ['provider', 'routing', 'verification', 'release-history', 'ui'],
    blocks: [
      block('b1', 'Current provider timeout is 20 seconds.'),
      block('b2', 'Provider timeout=20s is the active configuration.'),
      block('b3', 'Older provider configuration used a timeout of 5 seconds.', { validity:'superseded' }),
      block('b4', 'Do not retry POST /charge unless an idempotency key is present.', { protected:true }),
      block('b5', 'A duplicate charge was observed when POST /charge was retried without an idempotency key.'),
      block('b6', 'The settings panel icon is circular.'),
    ],
    pairs: [
      ['b1','b2'],
      ['b1','b3'],
      ['b4','b5'],
      ['b2','b6'],
    ],
    expected: {
      role: { b1:'current_state', b2:'current_state', b3:'history', b4:'durable_decision', b5:'history', b6:'noise' },
      destination: { b1:'state', b2:'state', b3:'knowledge_ref', b4:'memory', b5:'knowledge_ref', b6:'drop' },
      protected: { b1:false, b2:false, b3:false, b4:true, b5:false, b6:false },
      topic: { b1:'provider', b2:'provider', b3:'provider', b4:'verification', b5:'verification', b6:'ui' },
      relation: { 'b1:b2':'duplicate', 'b1:b3':'supersedes', 'b4:b5':'supports', 'b2:b6':'unrelated' },
    },
  },
];
