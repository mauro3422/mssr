# Jev Librarian paused-run diagnostic — run17

Run17 is a fresh child of v16, using Bridge .156 / MSSR .104 and the frozen
21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. It is exploratory paired
regression evidence (26 concepts, 52 language requests), not independent
calibration evidence.

The live-ready runner requires the pinned candidate confirmation and
`--pause-after-bootstrap`. It completes preflight and MSSR routing/bootstrap,
checks route core, Jev host selection/loading/context, feedback-learning,
benchmark-history selection/delivery, and lifecycle, then writes
`provider-gate-receipt.json` and pauses before the first Librarian search,
selection, fetch, or provider request. Only the exact untrimmed line
`START_JEV` continues. Raw confirmation input is not persisted.

This run intentionally stops at that pause without sending `START_JEV` or any
other approval. The route core and the separate bootstrap Project Context page
are reported independently; do not collapse `coreIncluded=true` from route
with `coreIncluded=false` from the bootstrap page.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --live --confirmation "0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca" --pause-after-bootstrap
```

The second command pauses at the provider gate. Inspect its receipt and obtain
human approval before entering the exact confirmation line.
