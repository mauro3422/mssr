# Stateless trace recovery

Read when diagnosing or recovering identity after restart, dispatch/coordinator
loss, or conflicting trace evidence. A normal replan or generic friction does
not require a recovery experiment.

First inspect existing identity and persisted evidence without changing runtime
state. For a controlled recovery test, use an isolated coordinator/session;
never clear a live user's session merely to audit its history. Route through the
real wrapper, confirm propagation, re-plan through the affected phase, clear or
bypass only the isolated coordinator memory, then require both a dedicated
load and trace-aware checkpoint to recover the same unique persisted trace.
Add a nearby ambiguous case that requires explicit id. Preparation-only calls
must not start a Web closure timer; substantive work or a non-final checkpoint
may. Never weaken ambiguity protection merely to reduce warnings.
