# Run 60 — fresh cross-project paired-language candidate cohort

- Query arms: 6 Spanish-only concepts and their 6 Spanish + manually authored English equivalents; same frozen source per pair.
- Scope: 6 documents across 5 project clusters (the two MotorGrafico documents share one cluster).
- Cases: 24 total (6 positive + 6 source-scoped negative concepts, each with 2 query arms).
- Unit: concept pair; language variants are repeated measures, not independent observations.
- Labels: two independent Luna source reviews plus analyst-authored query pairs; not project-owner gold.
- Holdout: no matching source/hash/query phrase found in the local prior-run ledger; exposure outside that ledger is unknown.
- Flow: deterministic Librarian search -> bounded Jev selection/abstention -> exact fetch -> evidence pack. No full-project scan or mutation.
- Metrics: search target presence/rank, Jev answerability, accepted/relevant-range hit, exact fetch/fingerprint, evidence-pack citation/text integrity, blind sufficiency, overbreadth, raw confidence/Noul, tokens and latency. Raw scores are not calibrated.
- Order: serial, with language pairs adjacent, to keep pair comparisons close in time and simplify reproducibility.
- Live calls: user-authorized through existing Windows Credential Manager; raw provider responses/secrets are not stored.
- Preflight: runner and helper hashes, source bytes and source file hashes, Bridge build hashes, label schema, and heading/range paths validated before network use.
- Preflight corrections: local checks caught the GitTeach section number and the quoted NeoPSE subheading; no network calls occurred. Labels now target the exact validated heading paths.