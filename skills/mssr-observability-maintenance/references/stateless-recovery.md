# Stateless trace recovery

Read after restart, dispatch loss, coordinator loss, phase replan, or ambiguity.

Route through the real wrapper, confirm trace propagation, re-plan through the
affected phase, deliberately clear/bypass memory, then require both a dedicated
load and trace-aware checkpoint to recover the same unique persisted trace.
Add a nearby ambiguous case that requires explicit id. Preparation-only calls
must not start a Web closure timer; substantive work or a non-final checkpoint
may. Never weaken ambiguity protection merely to reduce warnings.
