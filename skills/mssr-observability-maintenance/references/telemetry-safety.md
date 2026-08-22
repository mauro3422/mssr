# Telemetry safety

Read when changing metrics, retention, epochs, or privacy boundaries.

Store only bounded classifications, identifiers, durations, counters,
allow-listed subjects, and maintenance hints. Never store raw prompts,
transcripts, secrets, cookies, tokens, arguments, output, or private reasoning;
hash anonymous sessions. Maintenance hints are diagnostic evidence, never
authority to rewrite durable documentation or skills.

Preserve history. Start an active epoch only at an observable contract/release
boundary, recording old epoch, baseline, version/commit, and active/all counts;
then prove the new active epoch while all-scope retains history. A database reset
requires proven corruption, backup, documented loss, and explicit destructive
authorization.
