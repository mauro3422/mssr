# MSSR project memory

## Fetchable Librarian tie ordering — 0.2.105

Librarian relevance scores remain lexical overlap ratios. When two candidates
tie, an exact-fetchable range now ranks before an oversized range; this makes
top-result retrieval actionable without pretending that fetchability is a
relevance label or changing the score. A regression uses a real-sized parent
and a matching bounded child section.

## Librarian query stopwords — 0.2.104

Deterministic search formerly allowed one shared token to emit a candidate, so
common English/Spanish function words could create low-score false positives.
The query now drops a small bilingual function-word set while indexed source
text retains every term. An all-function-word query returns no candidates.
Scores remain lexical overlap indicators, not relevance probabilities or Jev
confidence; translation, stemming, confidence thresholds and label-based
calibration remain out of scope.

## Read-only cited evidence pack — 0.2.102

The Librarian composition boundary now accepts bounded current Markdown plus
exact handles selected by search/host/Jev, re-fetches each against owner, source,
privacy, revision, line range and fingerprint, then returns unchanged source
ranges with one citation per item. It is an acquisition/assembly primitive, not
a summarizer, Jev call, truth verifier, paragraph generator or write path. This
preserves Mauro's intended composed workflow: Jev decides among bounded choices;
deterministic host/MSSR code retrieves, checks and carries evidence; a separate
structure-recovery or prose stage may assemble useful paragraphs while keeping
citations and contradiction review explicit. Source labels remain
caller-asserted, and confidence remains uncalibrated.

The 2026-10-04 real-document wiring smoke offered eight exact candidates from
three current MSSR documents. Jev selected the 0.2.102 changelog section at
Choice confidence 0.27 and Noul sufficiency 0.65; the caller then confirmed the
packed range exactly matched the source slice and citation handle. This is one
unadjudicated integration example: it validates selection-to-pack plumbing and
citation integrity, not semantic accuracy or a confidence cutoff.

## Exact-range EvidenceAtom metadata projection — 0.2.98

Librarian retrieval may accept exact EvidenceAtoms alongside caller-supplied
Markdown and catalog records. Only allowlisted enum fields can contribute to
search terms or metadata filters after the atom and catalog record bind to the
same owner, privacy class, source/ref/revision, exact section/block identity,
range offsets and payload fingerprint freshly derived from Document Surface.
The result explains which field matched, carries a separate projection
fingerprint, and labels provenance caller-asserted; full atoms and arbitrary
metadata remain out of results. Existing `searchableMetadata` stays
document-scoped. Stale, historical, and superseded freshness values remain
searchable for review, do not affect ranking, and remain caller assertions;
results identify atom fields that satisfied metadata filters. Indexed range and
subject maps keep work bounded. The portable contract does not make
Bridge/adapters send atoms automatically and confers no authentication or write
authority.

TypeSafe's official Structure recovery example confirms the useful composed
capability Mauro observed: Jev classifies line joins and text blocks; a
deterministic assembler preserves source words while rebuilding paragraphs and
Markdown. Jev itself does not generate open prose. Keep retrieval, decision,
exact fetch, deterministic rendering/generation, citation checks and host
approval as separately measured stages.

## Explicit Jev selection for the Librarian — 0.2.95
The bilingual full-heading experiment supports offering a separate Jev Choice over caller-supplied sections when the deterministic lexical shortlist misses useful evidence. The original 0.2.95 contract offers at most 254 exact heading candidates plus `none`, returns only a revision-bound handle, and requires the caller to exact-fetch the selected section. It makes no filesystem scan, compaction, paragraph generation, verification or canonical write. Option limits fail closed to `not-run` instead of silently dropping candidates; raw provider confidence is descriptive and uncalibrated. Titles, paths and excerpts are untrusted input to the model, so the host must review the exact fetched source. The first live MCP smoke used the frozen 21-document MSSR corpus and selected one expected section with an integrity-passing exact fetch; its label was Luna-reviewed, not approved by the human document owner, and is a wiring check rather than quality validation.

The 0.2.96 selector extension lets a host pass up to 100 exact handles returned by deterministic Librarian search. MSSR revalidates owner, explicit source, privacy classification, revision, range and fingerprint before producing a bounded query-centered excerpt for Jev. It returns the existing exact handle, which the host must still fetch; stale or out-of-scope candidates fail before provider use. Calls that omit handles retain heading enumeration. This repairs the missing bridge between lexical discovery and semantic choice without adding a tool, making search authoritative, calibrating confidence, or granting synthesis/write authority.

MSSR 0.2.99 selects oversized excerpts using the window that covers the most distinct query terms, with earliest-window tie-breaking. This prevents a generic early match from crowding out denser binding evidence while preserving the 260-codepoint limit and exact-fetch requirement; it does not establish Jev selection accuracy or calibrate confidence.

## Probabilistic shortlists across Jev option shards — 0.2.97

The Jev Choice SDK exposes probabilities for each offered option, but the older MSSR transport mapping discarded them. The shared response contract now accepts that distribution optionally and validates exact option identity, approximate normalization and that the returned choice is among the highest-probability options. Hierarchical selection uses the within-shard distribution to retain up to two candidates per shard before one final Choice; a provider without a distribution retains its one selected local candidate. A 16-call preflight fails closed before contacting Jev. Noul is never a candidate-drop threshold. Single-pass Noul sees every offered candidate; hierarchical final Noul sees only retained finalists, so the values are not comparable across modes. All selected results remain advisory revision-bound handles and still require exact fetch.

The full-heading selector now centers bounded excerpts over the whole section with Unicode-cluster normalization, so composed and decomposed accent spellings align without changing source text and Spanish ñ remains distinct from n. Deterministic retrieval remains lexical, no translation or stemming.

The controlled live comparison uses byte-identical frozen inputs: 21 real MSSR documents, 200 headings and 26 paired English/Spanish questions (52 requests). Two 80k direct Choice runs on 0.2.96/0.2.97 scored 35/52 (18 EN, 17 ES) and 34/52 (17 EN, 17 ES), with 50/50 exact fetch checks each. They selected the same exact source/range in 50/52 cases; the one English strict-label change accounts for the one-point score difference. The paired 64k hierarchy scored 31/52 (14 EN, 17 ES), with 49/49 fetch checks and three abstentions over 156 calls. The previous full-heading result was 34/52. These runs do not show a repeatable quality improvement over the earlier full-heading path. Labels were reviewed by Luna agents, not approved by the human document owner; other acceptable ranges and abstention quality are unlabeled. Preserve every run and failed request-size smoke as exploratory evidence; do not infer a confidence cutoff from the small confidence bands.

Choice confidence and Noul scores remain uncalibrated for MSSR policy until a representative, independently adjudicated held-out evaluation supports a policy. Typed probabilities can guide a review/abstention experiment; they do not establish correctness or authorize use. No threshold or authority is introduced.

The end-user workflow may compose deterministic text search/fetch, Jev selection, iterative requests for more evidence, relation/contradiction review, a separate generator for compaction or paragraph assembly, and a reversible synthesis preview. This is the right architectural direction for the intelligent grep/selection/assembly behavior: each step contributes what it is good at and exposes evidence to the next. MSSR's current tools expose the search/fetch, selection, relation and preview contracts; an authorized host must orchestrate the loop and choose any open-text generator. Citation, current-revision, contradiction, independent-verifier and host approval gates stay explicit before canonical writes.

## Jev composition, confidence and reversible synthesis — 0.2.93

Jev supplies typed finite decisions inside composed workflows; it does not by
itself implement text search, compaction, open paragraph generation, tool
execution or verification. The host can combine grep/retrieval, bounded
selection, a generator or deterministic assembler, policy, execution and an
independent verifier around Jev. Keep each component's evidence and ownership
separate. Raw confidence is a routing signal, not a calibrated probability or
truth guarantee. Contradiction, unknown scope/time/freshness, or missing
independent verification must preserve the source and route to review. Exact
text synthesis remains an immutable, reversible preview with no canonical
write authority. Freshness and verifier evidence remain caller assertions until
a host re-reads current source revisions and verifies through its own trusted
boundary; owner/privacy/catalog labels are not authentication.

## Librarian coverage scope decision — 0.2.92

Coverage completeness belongs to an explicit evaluated scope. A producer-filtered
inventory may support a negative claim only within that selected scope; it must
not claim global completeness. Unknown producer identifiers fail closed rather
than silently shrinking the requested inventory. Host declarations and portable
adapter tests establish contract coverage, not proof of observations from every
live execution. This distinction should remain explicit in future atom benchmarks
and host adoption reviews.

## First-party context proportionality decision

Read-only history/integrity/Git inspection does not imply persistence; close
alone does not imply maintenance. Preserve explicit persistence actions, backup,
mutation evidence and required workflow obligations. Publication routing needs
a persistence action rather than a general status-review match.

Evaluate the assembled core/reference pack, not root length alone. Generic
review/friction should deliver a compact decision rather than implying proposal
generation or coordinator-loss experiments. Preserve required phase checkpoints
and learning gates while testing nearby negative and recovery cases. Context
cost improvements do not establish causal agent-quality gains; separate fixture
traces, incomplete outcomes and host/model cohorts when evaluating utility.

## Context-plane ownership decision

MSSR owns the portable semantic contract for bounded project context in addition to skill routing: selection, budgeting, provenance/freshness, continuity and safe structural maintenance. Repository documents remain authoritative. Bridge and other hosts own authorized I/O and delivery/transport only; they do not own project meaning. MSSR may relocate exact already-indexed bytes while preserving their logical contract. Reviewed historical modules may also declare internal semantic segments: keep parent identity/selectors stable, require one unconditional baseline, select at most one uniquely best optional segment, expose ties instead of guessing, and budget `baseline + largest optional`. MSSR may execute that declared selection but must not invent segment boundaries, terms, summaries or reclassification. Unknown, stale, conflicting or unavailable evidence triggers verification or replanning rather than inference.

The 0.2.56 envelope regression established that `estimatedChars` is only a reservation hint, not trusted size evidence. Selection must budget at least the exact serialized structured message; producers should report the measured value when representable, while legacy or external underestimates are corrected at selection time without changing message authority.

## Phase 2 core boundary

The 0.2.10 portable core (strict producers, repository collector, freshness revalidation, and a durable explicit-ack advisory-only JSON inbox) proved the portable message plane and repository scan. 0.2.11 introduced keyed repository facts and native/Codex/OpenCode `loadProjectContextHost` delivery under the then-current `.bridge/` convention; 0.2.12 added acknowledged-receipt tombstones and inbox v2; 0.2.17 moved canonical ownership to `.mssr/`. The 0.2.18 cutover removes active `.bridge` fallback entirely, unifies selection on `.mssr/project-context.json`, separates durable `.mssr/knowledge/` from ephemeral `.mssr/runtime/`, and makes initialization plus Project Context Health portable MSSR contracts. Hosts expose filesystem/runtime operations but do not redefine these semantics.

## Skill capability/reference architecture

A routed skill is the reusable capability/control plane: activation boundary, invariants, workflow and verification contract stay in `SKILL.md`. Situational procedures, recovery recipes and conditional detail remain parent-owned `references/` selected by `context-modules.json`; they are not independent routing nodes. Create a new skill only when the extracted behavior has independent activation, outcome, owner and verification. Structural health is preventive/advisory: `WATCH`/`REVIEW`, full fallback and unindexed references justify human review but never authorize background mutation or invalidate routing by themselves.

The 0.2.54 first-party refactor applies that architecture to all five bundled MSSR skills: compact roots retain activation/invariants/workflow/verification, while direct parent-owned references carry situational procedure. The 0.2.55 maintenance regression established that progressive disclosure must bound the selected reference units as well as the root: a broadly selected 20 KB pattern catalog still causes context starvation even behind a small `SKILL.md`. Broad anomaly evidence therefore selects only a compact index; detailed friction modules require matching stage/intent dimensions and remain independently pageable. Distribution is opt-in and reproducible; a reserved divergent runtime target is refused rather than overwritten, and package/discovery evidence never changes routing authority.

## Host adapter inheritance decision

Stateful hosts must inherit one portable MSSR routing/bootstrap contract instead of cloning Codex behavior. `MssrAdapter` owns shared lifecycle, host-gating and selective context assembly; Codex/OpenCode are thin specializations and Bridge consumes the same pure schema/selection helpers while retaining its host-specific Roblox/project/system-awareness integration. An absent optional decision means `pending`, not synthetic `skipped`.

## Paged procedural-context decision

The `0.2.52` page contract replaces one-shot overflow/whole-skill omission for already-selected skill context. Selection remains host-gated: workflow-required roots are `required`, while an explicit accepted optional root is `accepted` and stays distinct from an obligation. The portable planner orders selected cores/modules deterministically, fits only whole units into each bounded page, and returns explicit `partial`/`mustContinue` continuation metadata until every selected unit is delivered exactly once. Its opaque cursor carries only version, position and integrity/fingerprint data; it contains no prompt or procedural source text and is stale when reconstructed selection bytes or order differ. MSSR 0.2.57 deliberately removes the page budget from that selection fingerprint: a host may use a smaller first page around routing/project metadata and a larger continuation page without invalidating identity, while every page remains independently bounded and an indivisible unit remains a visible blocker with no non-progressing cursor. Bridge and other hosts decide whether/how to invoke their next-page tool and retain UI/tool transport responsibility.

The `0.2.53` correction restores the pre-existing deduplication invariant inside the paged planner: when a selected module's material is already present in the same skill core or in earlier selected material, the module is not turned into a second page unit. Its decision remains observable as `already-covered-by-loaded-context` and its assembled character count increases per-skill and global `duplicateCharsAvoided`. This is a representation/budget correction only; it does not weaken cursor validation, relabel accepted roots, or suppress genuinely deferred/blocked material.

## Context-delivery inheritance decision

Container authority and child depth are separate dimensions. A required skill/document guarantees its compact authority core; a child becomes a paging obligation only when the child itself is explicitly required. Optional child material remains accepted evidence, may be omitted when the bounded compact budget is exhausted, and must surface omission rather than manufacturing `mustContinue`. The portable document contract mirrors this rule for instruction/project-memory/state/guide/handoff/documentation sources through adjacent `<document>.context.json` manifests: core-only before canonical intent, relevant modules under semantic selection, deep modules on semantic match or explicit debug, and complete-document fallback when a host cannot prove a valid manifest. This rule is reusable across hosts; Bridge may implement filesystem discovery/transport but must not redefine the policy.

## Bridge delivery boundary

Bridge must consume MSSR through a versioned packaged artifact rather than an in-place junction across workspace authority boundaries. A sibling MSSR source edit is never live Bridge behavior by implication: adoption requires deliberately packaging/installing that MSSR version, rebuilding Bridge, performing the controlled host restart, and reading back the live Bridge/package/catalog state.

## Librarian deterministic-duplicate boundary

Cross-system evidence should enter one bounded advisory catalog contract before semantic comparison whenever a producer can expose stable identity/source/revision/fingerprint metadata. Exact record equality, source+revision aliasing, equal payload fingerprints, equal canonicalized metadata and conflicting evidence under one stable identity are deterministic contract facts and must not consume Jev/model calls. Different fingerprints may still be semantically duplicate, overlapping, supporting, contradicting or superseding; only that second problem belongs to Jev/semantic review. The Librarian never becomes canonical authority and never auto-merges an identity collision. Duplicate coverage is only as complete as producer instrumentation, so missing adapters must remain explicit coverage gaps.

`Document Surface` is the first Librarian adapter and the preferred future common primitive for Markdown structure/range inspection. Existing duplicated heading/range parsers may migrate incrementally after focused compatibility tests; do not mass-refactor them merely because the common primitive now exists.

## Semantic Experience promotion decision

Provider/digest output is observation, never truth. A fallback may become preferred only from independently verified project-held-out evidence that clears explicit breadth, precision, coverage and zero-wrong gates; insufficient evidence means abstain/block. “Independent verification” is now an explicit provenance contract: a verification has its own stable identity and verifier identity, same-provider or same-trace evidence cannot self-confirm a proposal, exact verification retries dedupe, and reuse of one verification identity with different evidence fails closed. Non-independent attempts may remain observable but never count as verified truth. Even an eligible fallback remains advisory: no routing, authority, canonical rewrite or auto-apply.

## Skill-overlap feedback decision

Optional-skill selection feedback is evidence for maintenance, never authority to mutate the catalog. A `redundant` skip may identify an exact observed `relatedSkillName`; that pair still does not prove semantic equivalence. Repeated redundancy without an exact peer stays ambiguous and may expose only bounded co-occurring candidates. Repeated `irrelevant-domain` evidence is a routing-contamination signal, not a deletion signal. After a distinct-trace threshold, MSSR may project review-only `skill-overlap` / `skill-domain-mismatch` candidates. The reviewed owner decides whether to tighten gates/negative intents, use existing `requires` / `complements` / `excludes`, keep both skills, or explicitly merge/split/supersede/remove them. Frequency, global workspace summaries and Jev/model suggestions never self-authorize the correction.

## Cross-host Bridge transport routing decision

MSSR should route cross-host MauroPrime↔ChatGPT file/image handoff through the existing `mauroprime-bridge-collaboration` capability only when the structured intent establishes an actual collaboration/integrity boundary; mentions of Base64, images, or files alone are insufficient. Transport mechanics remain host-owned: Bridge may use direct MCP resources for PC→ChatGPT materialization and authorized file parameters for ChatGPT→PC image persistence, while manual Base64/chunk transfer is a compatibility or oversize fallback rather than a routing primitive. MSSR activates the reusable capability but does not reinterpret bytes, grant I/O authority, or treat a successful route as host adoption.

## Release byte-identity decision

A semantic version is not sufficient evidence that two package artifacts are equivalent. Host adoption must bind the version to the exact package SHA/receipt. If two artifacts share a version but differ in bytes, preserve both identities as conflicting evidence, do not overwrite either artifact, and issue a new reconciled version before further adoption. This prevents source/host divergence from being hidden behind an equal semver string. Reproducible package construction is part of that byte-identity contract: the final artifact must not depend on physical checkout EOL state. Release automation should derive the bounded npm file set, materialize it through an isolated Git index so `.gitattributes` defines canonical bytes, and leave the developer index/worktree untouched. Because npm may still execute `prepare` during directory packing, canonical staging must also provide the build-only source/config inputs plus access to the already-verified dependency tree so that any lifecycle rebuild happens from canonical source bytes while those support inputs remain outside the published package file set. Regression coverage should compare real `.tgz` hashes across deliberately inverted LF/CRLF checkouts rather than relying only on mocked pack metadata.


## Operational notice transition decision

Operational attention and durable truth are separate planes. MSSR owns pure transition/projection policy while each host owns observation/delivery; Bridge reuses `bridgeNotices`. Queue dedupe alone is insufficient, so semantic fingerprints plus previous-state comparison suppress stable actionable states and emit explicit resolution. C2b extends this rule to routing compliance: route/trace/boundary evidence and required skills determine compliance, while successful outcome phase gating reuses the trace lifecycle's objective closure phases (`verification` and `persistence`). Discovery, safety and implementation may be represented by the route/host workflow; maintenance remains a separate close-revision obligation rather than a direct outcome phase gate. Optional selected-but-not-loaded skills never become obligations. C2c adds explicit bounded consistency observations and C2d ranks advisory recovery without granting authority. Gate D (0.2.29) makes candidate semantics observably cross-host: native, Codex and OpenCode register one strict `mssr_operational_notice_evaluate` contract over the same transition evaluator and must return identical decisions/candidates for identical bounded evidence. This parity stops at evaluation; queueing, TTL/history, push/piggyback/UI and executable host suggestions remain host-owned. No notice or evaluator call authorizes or auto-runs recovery.

Gate E1 (0.2.30) promotes notice meaning/identity to the strict versioned `MssrNotice v1` contract, independent from delivery runtime. The existing transition evaluator is the sole semantic producer and still compares the original upstream fingerprint for stable/changed decisions. A notice has a stable source/code/subject lifecycle `noticeId`; its fixed SHA-256 `dedupeKey` captures lifecycle identity + event + current attention level + original semantic fingerprint, so producers cannot collide and changed/resolved evidence remains distinct without embedding large values. The envelope keeps single-line fingerprints up to 240 characters inline and compacts longer/non-single-line fingerprints to `sha256:<original-length>:<digest>`.

Gate E2 (0.2.31) freezes semantic preservation as a portable contract: `serializeMssrNoticeV1` validates and canonicalizes schema field order before deterministic serialization, and `hasSameMssrNoticeV1Semantics` compares only that validated payload. Host delivery wrappers may vary queue ids, TTL/timestamps, attempts, history/UI/actions or other host metadata without becoming MSSR semantics; the strict notice/details schemas reject those fields. E2 adds no queue, sink, retry spool or delivery adapter and does not repurpose Context Message or host-telemetry queues. `BridgeNotice` remains Bridge-owned for Bridge-native notices and delivery metadata; actual Bridge relay adoption, foreign-MCP relay rules and direct-host delivery are Gate E3–E5 work and are not current runtime adoption.

Gate E3 is live in Bridge `0.6.106` on packaged MSSR `0.2.31`: genuine MSSR semantics travel as a separately validated `BridgeNotice.mssrNotice` through the existing Bridge queue, while Bridge delivery ids/timestamps/TTL/occurrences/UI/actions stay host-owned and foreign/native notices retain their own identity. Gate E4 (`0.2.32`) adds the corresponding direct-host boundary without Bridge: native/CLI hosts call `deliverMssrNoticeV1(...)`; Codex/OpenCode inherit `MssrAdapter.noticeDelivery` / `deliverNotice(...)`. The callback receipt is opaque host metadata. Missing configuration fails closed; transport exceptions propagate; portable MSSR performs no retry and owns no queue/spool/scheduler/UI/action runtime.

## Repeated tool-friction maintenance decision

Hosts may observe bounded operational failures, but portable MSSR owns deterministic clustering and maintenance priority. Repeated failures are identified by a stable sanitized `toolName + signature` identity and ranked using recurrence, cross-workflow breadth, recency, and severity; raw prompts, argument payloads, stack traces, secrets, or full error text are not portable evidence. Repeated clusters become advisory `repeated-friction` attention owned by `skill-maintenance-loop`; isolated failures stay lower priority. This operational maintenance signal is intentionally separate from routing-quality benchmarks and never authorizes automatic tool/skill mutation.

## Situation Model decision

Project knowledge and operational evidence share one bounded Situation Model before C2c/C2d: current repository owners, delivered Context Plane receipts, runtime/test facts and explicit semantic claims retain separate authority/evidence-class metadata. `observed > declared > inferred > learned` is a reliability prior only; inferred/learned evidence cannot be canonical and no confidence score overrides ownership. The first reliable memory/context rule is revision-first: if an agent was delivered PROJECT_CONTEXT/MEMORY/STATE/changelog/ADR revision X and the current canonical owner is revision Y, MSSR may flag stale operating context and recommend revalidation without parsing or rewriting free-form prose. C2e-D extends this only through explicit structured claim producers: `release-version`, `state-value`, `ownership`, and `decision-revision` use closed source kinds plus bounded scalar/revision payloads; source determines role/category/observed-vs-declared classification, while authority remains explicit. C2e-E consumes only already-active C2c/C2d mismatch keys and ready context actions, resolves each canonical Situation `sourceRef` against the project-context manifest, and returns an exact bounded module only when the mapping is proven unique (including an explicit `#section` selector when needed). Shared-file ambiguity, unindexed sources, or missing canonical identity abstain to authority-only/unresolved guidance; feedback never auto-loads context or changes host budgets/permissions. Arbitrary Markdown, logs, prompts, transcripts, and model-extracted prose remain outside canonical producer/feedback inputs. A durable delivery receipt must represent the most recent evidence actually delivered: re-selecting the same message refreshes `sources` and continuation metadata, and current/newer evidence supersedes older receipts for Situation evaluation. Dynamic guidance belongs in the existing Notice Plane; AGENTS remains for stable repository rules.

## Conjunctive visual-evidence gate decision

The visual-evidence lifecycle is required only when the intent proves both actual visual inspection (`visual-qa`) and a human conservation/approval decision (`human-approval`). A code/repository review may contain documents, tests, approval, and functional names such as “Smoke Lab” without becoming a visual-evidence obligation. `allNeeds` is the narrow conjunctive routing primitive; host-gated skips never erase a workflow-required root, so the workflow itself must express this boundary.

Repository cleanup is evidence-gated: preserve active or unique owner-repository work.


## Librarian duplicate granularity decision

A shared source revision is not enough to prove two evidence records duplicate: Markdown sections are distinct units within one document revision. Classify same-source-revision only when namespace, kind, source revision, and payload fingerprint all match. Preserve same-payload and exact-record checks as their own independent structural signals; semantic equivalence stays outside the deterministic reducer.

## Evidence provenance and Jev host boundary decision

EvidenceAtom v2 requires source class and canonical owner; `fresh` requires a host observation matching the exact normalized source ref, revision and owner with timestamp. Unknown remains safe. Sensitive-excluded atoms and free-form atom attributes are rejected. Semantic Curation may receive an injected normalized Jev decision provider so hosts own credentials/transport/retries; the legacy TypeSafe configuration is deprecated compatibility. As of 0.2.93, a bounded MCP flow supplies caller-owned exact source text to Jev relation review and emits unverified, atom-bound judgments; this adds no owner authentication, global index or write authority. Benchmark runs must preserve historical raw outputs, source/corpus hashes, label provenance and holdout boundaries; future run protocol defaults offline.
