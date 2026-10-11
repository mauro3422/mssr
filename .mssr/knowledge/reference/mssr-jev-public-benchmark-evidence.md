## Public evidence reviewed

Public Jev results are useful prior evidence, not substitutes for MSSR
validation:

- [TypeSafe's Jev introduction and workflow evaluations](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
  compares four code workflows against a reference averaged from GPT-6 Astra
  and Claude Fable 5.1. TypeSafe notes the workflows were created by its own
  capability team; treat the headline as vendor evidence, not independent
  ground truth.
- The [Jev in Medicine preprint](https://arxiv.org/abs/2609.34024) evaluates
  8,469 requests across four medical benchmarks and reports accuracy and
  calibration varying by dataset. For example, a high-confidence subset did
  well on MetaMedQA, while confidence discriminated less well on
  DiagnosisArena-MCQ. This argues for task-specific calibration; it does not
  validate knowledge curation.
- [JevAdvBench](https://arxiv.org/abs/2609.31142) is an adversarial robustness
  preprint with 812 typed questions and 9,744 single-edit variants. It finds
  that unverified opinions added to state can flip decisions. Its clean-run
  comparison is a robustness measure, not truth labels or a merge evaluation.
- Independent community posts report mixed task-specific results. One
  [Reddit benchmark](https://www.reddit.com/r/AI_India/comments/1wmvyqz/i_benchmarked_typesafes_jev_against_llms_bert_and/)
  reports 500 held-out examples each across SST-2, AG News and Banking77, with
  accuracy and calibration changing across datasets. Another
  [agent-routing report](https://www.reddit.com/r/LLMDevs/comments/1wo000s/we_benchmarked_typesafes_new_jev_a_decisiononly/)
  reports high accuracy above a confidence cutoff on its hand-labeled routing
  set. These are author-reported, task-specific results, not peer-reviewed
  validation of MSSR.
- [FEVER](https://aclanthology.org/N18-1074/) and
  [SciFact](https://aclanthology.org/2020.emnlp-main.609/) are adjacent
  verification datasets, not Jev benchmarks. Their supported/refuted/
  insufficient-evidence labels and cited evidence rationales are useful
  precedents for MSSR contradiction cases.
- The reported Pokémon Red success is an anecdotal systems example: public
  coverage says a separate LLM, the developer and viewers adjusted the
  decision options and harness during play. It demonstrates a composed agent
  loop, not Jev acting alone or a controlled benchmark
  ([coverage](https://www.tomshardware.com/tech-industry/artificial-intelligence/developer-says-jev-decision-model-beat-pokemon-red-in-under-a-week-non-llm-engine-succeeds-where-traditional-chatbots-stalled-for-months-but-claude-opus-5-coached-the-model-through-its-dead-ends)).

No public benchmark found in this review measures Jev on MSSR's real
documents, skill references, contradiction layer, EvidenceAtom provenance,
Librarian evidence retrieval, or reversible semantic merges.

See [Jev decision-model use cases](../research/jev-decision-model-use-cases.md)
for 100 explicitly unvalidated application hypotheses, public source limits,
the OpenAI Decisions API announcement status and the QuietDesk evidence
boundary. QuietDesk demonstrates a separate live visual/action/verification
chain; it is not an MSSR retrieval or synthesis benchmark.
