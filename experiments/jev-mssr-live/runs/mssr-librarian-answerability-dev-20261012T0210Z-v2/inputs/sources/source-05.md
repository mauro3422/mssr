# Research radar — learned memory selection, relational recall, and portable memory control

Date: 2026-09-03
Status: research note / design radar only
Owner context: MSSR vNext Lite / clean activation evidence

## Question being investigated

Can the current MSSR skill/context routing problem eventually generalize into a model-agnostic memory/attention controller that learns **which knowledge becomes useful in which observable situation**, without forcing every host model to ingest all available memory first?

This note is not authorization to add embeddings, a vector database, a second model, RL, or new routing influence. It records relevant external work and what it does or does not imply for MSSR.

## Current MSSR stance

For the next implementation pass, prefer:

`structured state -> deterministic candidates -> host-gated decision -> Context Broker -> execution -> clean Evidence Ledger`

Keep:

- `observeOnly=true`;
- `routingInfluence=false`;
- embeddings/vector similarity deferred;
- secondary model judge deferred;
- learned ranking/RL deferred;
- host/main reasoning model responsible for semantic judgement once the candidate set is small enough.

The reason is practical: selecting among 3-8 candidates does not justify another inference service if the model already executing the task can judge them cheaply from bounded metadata. A separate retriever/controller becomes more interesting only when the candidate universe is too large for the main model to inspect directly.

---

# External architecture map

## 1. Let the main model control memory/context

### Letta / MemGPT

Primary source:
- https://github.com/letta-ai/letta

Letta is model-agnostic and treats memory management as part of the agent runtime. Its MemGPT-derived model separates in-context/core memory from out-of-context archival/conversation memory, and the agent uses tools to edit/search/manage memory.

Why it matters to MSSR:

- supports the idea that the **same reasoning model can decide what to retrieve** once retrieval/search tools exist;
- avoids inserting another model only to make a small semantic decision;
- resembles the desired `main model -> request bounded memory -> Context Broker` relationship.

Limit:

- agent-driven memory management can itself create extra reasoning/tool overhead;
- it does not automatically solve whether a retrieved memory actually improved the downstream task;
- retrieval quality and memory governance still need independent evaluation.

### Self-RAG

Primary source:
- https://github.com/AkariAsai/self-rag
- paper: https://openreview.net/forum?id=hSyW5go0v8

Self-RAG trains the language model itself to retrieve on demand, skip retrieval when unnecessary, and critique retrieved/generated evidence using learned reflection tokens.

Why it matters:

- direct proof that `retrieve now / do not retrieve now` can be a learned capability of the **reasoning model itself**;
- supports the argument that an extra small model is not architecturally mandatory;
- closest external precedent for treating retrieval timing as part of reasoning rather than fixed RAG plumbing.

Why it is not an immediate MSSR implementation pattern:

- it requires a model that was specifically trained/fine-tuned for those reflection/retrieval behaviors;
- closed models used by MauroPrime cannot simply be patched with Self-RAG weights;
- MSSR needs a model-agnostic external contract first.

### FLARE

Primary source:
- https://github.com/jzbjyb/FLARE

FLARE triggers retrieval during generation when predicted upcoming content contains low-confidence tokens. It is an older but useful example of **event-driven retrieval** rather than retrieving everything up front.

MSSR lesson:

- reevaluate dormant memory/skill candidates on meaningful deltas or uncertainty signals instead of every turn/tool call;
- `WAIT -> ACCEPT` should have an observable trigger.

---

## 2. Use a specialized learned controller only when the economics justify it

### Adaptive-RAG

Primary source:
- https://github.com/starsuzi/Adaptive-RAG
- paper: https://arxiv.org/abs/2403.14403

Adaptive-RAG trains a smaller classifier to choose between no retrieval, single-step retrieval, and iterative retrieval based on query complexity.

Why it matters:

- proves a small specialist can reduce wasted compute when retrieval strategies have materially different costs;
- gives a clean future comparison for MSSR if the candidate universe becomes large enough.

Why not now:

- current MSSR candidate sets are small;
- an extra model introduces latency, another failure surface, calibration work, and another dataset requirement;
- vNext Lite should first measure whether deterministic shortlist + main-model decision is already sufficient.

### Memory-R1 (ACL 2026)

Primary source:
- https://aclanthology.org/2026.acl-long.583/
- preprint: https://arxiv.org/abs/2508.19828

Memory-R1 is especially close to the long-term idea being discussed. It replaces a purely heuristic memory pipeline with learned memory behavior through reinforcement learning. It uses two specialized agents:

- Memory Manager: structured memory operations such as `ADD`, `UPDATE`, `DELETE`, `NOOP`;
- Answer Agent: pre-selects relevant memory and reasons over it.

The authors report that outcome-driven RL can learn useful memory-management behavior with relatively little task supervision and generalize across question types/backbones.

Why it matters to MSSR:

- direct evidence that **memory management can be learned from downstream outcomes**, not only semantic similarity;
- validates the future research direction `situation -> memory operation/selection -> outcome`;
- gives a precedent for learning *when memory should change or be used*.

Why it should remain future work:

- RL magnifies bad labels, confounded outcomes, reward hacking and dataset bias;
- current MSSR evidence still has attribution/candidate-quality contamination;
- the first priority is to create clean candidate/decision/application/outcome data before copying an RL architecture.

---

## 3. Relational and temporal memory: more than embeddings, but not yet utility learning

### Graphiti / Zep

Primary source:
- https://github.com/getzep/graphiti

Graphiti builds temporal context graphs for agents. Facts retain temporal validity/provenance and can be retrieved through hybrid semantic, keyword and graph search. Relationships can evolve as episodes arrive rather than requiring a static snapshot.

Why it matters:

- close to the idea that memory should encode **entities, relations, time, provenance and supersession**, not only text similarity;
- relevant to MSSR Situation Model and `observed > declared > inferred > learned` evidence boundaries;
- useful precedent for future knowledge units whose relevance comes through relation chains rather than lexical similarity.

Important distinction:

- a context graph represents how facts relate;
- it does not by itself learn that recalling fact B during state A causally improves the agent outcome.

That second problem is where MSSR's activation/outcome ledger could add a different kind of signal.

### HippoRAG

Primary source:
- https://github.com/OSU-NLP-Group/HippoRAG

HippoRAG combines knowledge graphs and Personalized PageRank in a hippocampal-inspired retrieval architecture to integrate information across documents and support multi-hop recall.

Why it matters:

- demonstrates a cheap graph-propagation route from cues to indirectly related knowledge;
- useful conceptual precedent for `current cue -> connected knowledge` when surface text is not highly similar.

Limit:

- relation propagation/retrieval is still not the same as learned downstream utility;
- a memory can be graph-close and still be irrelevant to the current goal.

### A-MEM (NeurIPS 2025)

Primary sources:
- https://github.com/WujiangXu/A-mem
- system implementation: https://github.com/WujiangXu/A-mem-sys
- paper: https://arxiv.org/abs/2502.12110

A-MEM applies Zettelkasten-like dynamic memory organization. New memories receive structured attributes and are linked to historical memories; new information can also evolve the contextual representation of earlier memory.

Why it matters:

- strong precedent for memory being an **evolving network**, not an append-only vector store;
- resembles the user's idea that new experience changes which older knowledge has meaning now;
- suggests future knowledge units may carry typed/structured links in addition to dense similarity.

Risk to avoid:

- automatic memory evolution can corrupt authority if generated relations/updates are allowed to rewrite canonical project knowledge without evidence/review;
- MSSR should preserve explicit authority and provenance even if an adaptive memory graph is explored later.

### Mem0 / Graph Memory

Primary sources:
- https://github.com/mem0ai/mem0
- graph-memory documentation in repository/platform docs

Current Mem0 platform combines entity connections with semantic and keyword signals for retrieval. Its current graph memory links entities and memories and uses those relationships as ranking signals.

Useful lesson:

- hybrid retrieval is often more robust than a single vector score;
- entity resolution can recover relationships embeddings alone may blur.

Important current OSS boundary:

- Mem0's graph memory is now a platform feature rather than an equivalent self-hosted OSS graph path, so architecture descriptions must distinguish platform behavior from OSS package behavior.

---

## 4. A real "neural memory module" exists, but it is not a universal adapter

### Titans: Learning to Memorize at Test Time

Primary source:
- https://research.google/pubs/titans-learning-to-memorize-at-test-time/
- paper: https://arxiv.org/abs/2501.00663

Titans introduces a neural long-term memory module inside a model architecture. The memory is learned and updated at test time and is intended to complement attention as persistent memory.

This is the closest item in this radar to the intuitive idea of adding a **specialized neural memory component**.

But it is not equivalent to a universal LoRA/neuron that can be attached to arbitrary models:

- it is part of the model architecture/training design;
- closed GPT/Claude-family weights cannot simply load an external Titans memory module;
- architecture-specific adapters such as LoRA are tied to compatible base-model internals/layers.

MSSR implication:

A portable MauroPrime memory intelligence should remain **outside** host model weights unless/until there is a standard model family under local control. External memory/selection contracts are much more portable across Sol, Codex, Claude, Qwen, local models, etc.

---

# The key distinction for MSSR

Most memory systems optimize one or more of:

- semantic similarity;
- exact/keyword relevance;
- entity relationships;
- temporal validity;
- query complexity;
- model confidence;
- memory update operations.

The potentially distinctive MSSR dataset is trying to capture something else:

`observable situation -> candidate knowledge -> activation timing -> actual application -> downstream outcome/correction/cost`

This can eventually support a learned notion of **functional relevance**:

> not merely "these two texts mean similar things", but "knowledge of this kind tends to become useful when a state of this kind occurs".

That relation may be directional and goal-dependent:

`memory B useful in state A` does not imply `state A useful when retrieving memory B` in every context.

Possible future relation labels/semantics include:

- `EXPLAINS`;
- `CAUSES`;
- `PREVENTS`;
- `REQUIRES`;
- `CONTRADICTS`;
- `INVALIDATES`;
- `PRECEDES`;
- `SOLVED_BY`;
- `REMEMBER_WHEN`;
- `AUTHORIZES` / `DOES_NOT_AUTHORIZE`.

Do **not** create this ontology now. Preserve evidence so such relationships could later be derived/evaluated without destroying the original observations.

---

# Evaluation work that maps unusually well to MSSR

## LongMemEval

Primary source:
- https://github.com/xiaowu0162/LongMemEval

Classic LongMemEval separates abilities such as information extraction, multi-session reasoning, knowledge update, temporal reasoning and abstention.

Useful mainly as a baseline for memory retrieval/reading evaluation.

## LongMemEval-V2 (2026)

Primary source:
- https://github.com/xiaowu0162/LongMemEval-V2
- paper: https://arxiv.org/abs/2605.12493

This is substantially closer to MauroPrime than ordinary chat-memory benchmarks. It evaluates whether memory lets agents become experienced colleagues in customized environments, including:

- static state recall;
- dynamic state tracking;
- workflow knowledge;
- environment-specific gotchas;
- premise awareness (knowing when assumptions valid elsewhere are wrong here).

The benchmark can use histories up to hundreds of trajectories and very large token volumes, while evaluating both accuracy and latency.

MSSR implication:

Its future evaluation should include not just personal/chat recall but **environment experience**:

- recurring project/runtime gotchas;
- workflow knowledge;
- local state transitions;
- stale-premise detection;
- whether recalled experience improves task outcome under a bounded latency/context budget.

This looks like a better external benchmark family for the proposed generalized knowledge-activation layer than LoCoMo alone.

---

# Community signals — useful radar, not authority

Recent LocalLLaMA discussions repeatedly report three practical lessons:

1. vector-only memory often retrieves something semantically similar rather than the exact operationally useful memory;
2. raw/full conversation logs create noise and token cost;
3. hybrid retrieval (exact/entity/temporal/semantic/graph signals) is generally preferred over one retrieval mechanism.

Relevant discussions:
- https://www.reddit.com/r/LocalLLaMA/comments/1r21ojm/weve_built_memory_into_4_different_agent_systems/
- https://www.reddit.com/r/LocalLLaMA/comments/1r8cnwq/analyzed_8_agent_memory_systems_endtoend_heres/
- https://www.reddit.com/r/LocalLLaMA/comments/1mon8it/woah_letta_vs_mem0_for_ai_memory_nerds/

Community discussion also repeatedly warns that memory benchmarks are difficult and frequently measure recall while missing governance, supersession, uncertainty and sustained-use degradation. Treat vendor benchmark claims as design evidence, not final comparative truth.

---

# Architectural conclusion for MSSR

## Now

Use the main working model for semantic judgement after deterministic narrowing.

`large knowledge universe -> cheap structured filtering -> 3-8 candidates -> host/main model decides what to request -> Context Broker materializes minimal units`

No second model is justified yet.

## Later, if scale demands it

When the memory universe is too large for the main model to inspect candidates cheaply, compare experimentally:

1. deterministic/hybrid rules;
2. embedding retrieval;
3. graph/relational expansion;
4. main-model reranking;
5. a small learned ranker/controller;
6. outcome-trained memory controller (Memory-R1-like research direction).

Do not assume the learned controller wins. Benchmark latency, context cost, activation precision, missed useful memory, user correction rate and accepted outcome.

## Portable "memory neuron" interpretation

The portable analogue of a neural memory cell should initially be an external service/contract, not a LoRA:

`f(current structured state, candidate knowledge unit) -> relevance/usefulness/activation evidence`

Any future learned implementation can sit behind this interface while the evidence/provenance contract remains stable across host models.

The long-term research question is whether this function can generalize from skills to:

- project memory;
- episodic traces;
- tools;
- workflows;
- actions;
- next-task selection.

If so, share the **activation/evidence ledger**, not necessarily one global policy. Skill, memory, tool and task selection have different hard constraints even if they share the abstract form `state -> candidate -> decision -> consequence`.

---

# Immediate tasks / no-regret data work

1. Keep vNext Lite deterministic and host-gated.
2. Record clean candidate -> decision -> transition -> materialization -> application -> outcome evidence.
3. Add task-validity, model/surface/runtime epoch and artifact revision to cohort identity.
4. Record enough provenance to reproduce what memory/skill revision was available.
5. Keep old telemetry as diagnostic history; mark the clean evidence contract with a new schema/epoch if semantics change.
6. Build a small internal memory-eval taxonomy inspired by LongMemEval-V2: workflow knowledge, environment gotchas, dynamic state, stale-premise awareness.
7. Do not add vector DB/embeddings merely because the field commonly uses them; wait until the clean dataset demonstrates a retrieval recall problem deterministic indexing cannot solve.
8. Do not train/fine-tune/RL from current historical attribution metrics.

## Research success criterion

The useful future question is not:

> Can MSSR retrieve something similar?

It is:

> Can MSSR surface the smallest knowledge set that measurably improves the current agent's decision, at the right time, while preserving authority/provenance and avoiding unnecessary context cost?
