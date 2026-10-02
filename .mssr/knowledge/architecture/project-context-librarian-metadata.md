# Project Context librarian metadata sidecar

## Goal and ownership

Provide explicit per-heading semantic tags for Librarian retrieval over current
Project Context sources. The sidecar is a project-owned annotation contract;
`.mssr/project-context.json` remains the canonical source/owner manifest, while
the Markdown source remains the authority for section bytes. This sidecar does
not affect ordinary module selection, routing, context budgets, permission, or
canonical truth.

## Declaration

`.mssr/project-context-librarian.json` v1 contains up to 512 heading declarations
over at most 32 direct Markdown sources. Each declaration has `entryId`, exact
project-relative `sourcePath`, full `headingPath`, expected section fingerprint,
and explicit closed-vocabulary `domains`, `actions`, `artifacts`, `needs`, and
`signals`. At least one selector is required. Every heading path may be declared
once; declaration selectors are not inherited from the core/module entry. Each
source must end in `.md` or `.markdown`, and each sorted `+`-encoded selector
attribute must fit EvidenceAtom's 120-character bound.

The source path is repeated so path drift is visible, but must equal the path on
the canonical core/module. `directive` entries are excluded. Entries with an
internal-segment or external-reference binding are excluded in v1 because those
contracts own a different physical source selection. When the canonical entry
has `source.sections`, the target heading must be inside one of those selected
section ranges.

## Projection and stale-data behavior

The host passes the current strict Project Context manifest, the sidecar, the
observed segment/reference sidecars (`null` only when absent), and current
bounded Markdown bytes. MSSR builds the current Document Surface and requires a
single exact `headingPath` match and equal expected SHA-256 range fingerprint.
Unknown entry, path mismatch, directive, indirect source, missing/oversized
source, duplicate input source, missing or ambiguous heading, out-of-scope
heading, and stale fingerprint produce an omission reason instead of a partial
or guessed atom. Malformed manifests reject the projection.

Each accepted heading produces one Librarian catalog record and one EvidenceAtom
whose identity uses the current exact section id and whose ref, revision,
headingPath, line/offset range, payload fingerprint, owner, and record fingerprint
must all match during retrieval. Multi-value selector fields are stored as
sorted closed-vocabulary values joined with the reserved `+` delimiter; the
retriever splits them only when every component belongs to the exact field
vocabulary. The atom never copies Markdown prose. Its freshness remains `unknown`
unless the host separately supplies exact observation evidence. Owner/provenance
remain caller-asserted, and all output remains advisory with no truth or rewrite
authority. Project Context Health uses the bounded Markdown reader, caps
aggregate source reads, and checks real-path containment so a project-local
symlink or junction cannot make health read outside the checkout.

## Compatibility and verification

Older MSSR/Bridge consumers ignore this optional file. The strict base
`.mssr/project-context.json` v1 and `project-context-segments.json` semantics do
not change. Project Context Health validates declarations against current
sources and surfaces stale/invalid bindings for visible review. Tests cover
non-inheritance, exact-range matching, closed vocabularies, stale/duplicate
headings, scope, indirect sources, selector/path bounds, exact fetch, health
fail-closed behavior, and strict sidecar inputs. Bridge adoption is a separate
later gate after the exact MSSR package artifact is verified.
