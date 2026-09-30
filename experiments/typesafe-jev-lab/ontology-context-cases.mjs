// Real MSSR corpus labels frozen before live inference.
// Expected labels are never sent to Jev. Manifest kind/topic are used only for scoring.
export const ontologyContextCases = [
  ['mssr-architecture-core','architecture_contract','current',true],
  ['mssr-current-release','operational_state','current',true],
  ['mssr-learning-activation-decision','durable_decision','current',true],
  ['mssr-change-history-contract','procedure_contract','current',true],
  ['mssr-project-knowledge-drift-review','procedure_contract','current',true],
  ['mssr-architecture-impact-decision','durable_decision','current',true],
  ['mssr-architecture-impact-history','historical_evidence','historical',false],
  ['mssr-first-party-skill-direction','durable_decision','current',true],
  ['mssr-learning-dataset-state','operational_state','current',true],
  ['mssr-core-skill-package-state','operational_state','current',true],
  ['mssr-canonical-ownership','architecture_contract','current',true],
  ['mssr-context-plane-history','historical_evidence','historical',false],
  ['mssr-operational-notice-plane-history','historical_evidence','historical',false],
  ['mssr-project-context-plane-architecture','architecture_contract','current',true],
  ['mssr-project-document-reference-lifecycle','procedure_contract','current',true],
  ['mssr-project-document-index','reference_index','current',false],
  ['mssr-canonical-project-context-cutover','durable_decision','current',true],
  ['mssr-context-economy-v2','architecture_contract','current',true],
  ['mssr-semantic-consistency-decision','durable_decision','current',true],
  ['mssr-semantic-relations-retrieval-decision','durable_decision','current',true],
  ['mssr-trace-lifecycle-integrity','durable_decision','current',true],
  ['mssr-human-task-identity','durable_decision','current',true],
].map(([moduleId, semanticType, lifecycle, protectedExpected]) => ({
  moduleId,
  expected: { semanticType, lifecycle, protected: protectedExpected },
}));

export const relationCases = [
  ['mssr-canonical-ownership','mssr-project-context-plane-architecture','supports'],
  ['mssr-architecture-impact-decision','mssr-architecture-impact-history','supports'],
  ['mssr-project-document-reference-lifecycle','mssr-project-document-index','supports'],
  ['mssr-semantic-consistency-decision','mssr-semantic-relations-retrieval-decision','supports'],
  ['mssr-trace-lifecycle-integrity','mssr-human-task-identity','supports'],
  ['mssr-learning-activation-decision','mssr-learning-dataset-state','supports'],
  ['mssr-first-party-skill-direction','mssr-core-skill-package-state','supports'],
  ['mssr-current-release','mssr-project-document-index','unrelated'],
].map(([left,right,relation]) => ({left,right,expected:relation}));
