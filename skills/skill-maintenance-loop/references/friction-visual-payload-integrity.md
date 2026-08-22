# Visual payload integrity friction

Read when visual evidence, asset metadata, provider payloads or master/derivative lineage must be verified from actual decoded bytes.

## Visual evidence and payload gates

### Metrics-only output mistaken for visual evidence

A capture command may emit valid JSON, rects and a future PNG path while the renderer returned an empty image or no decodable file. Classify structural metrics separately from visual validity. For spatial surfaces larger than a viewport, require a decoded full-envelope panorama with bounded margins for global visual claims; use editor screenshots only as complementary evidence for chrome, focus and Debugger state. A declared path is not pixel readback.

### Declared visual metadata reused without byte readback

A manifest may claim a provider-requested size, keep `sha256=null`, or describe an old derivative while the saved file is smaller or different. Copying those fields into a downstream bundle creates false provenance and may turn a preview into a modeling master.

Observable pattern:

```text
manifest metadata exists or is partially null
bundle builder copies it unchanged
actual image is never opened
saved width/height/bytes/hash remain unproved or contradictory
```

Gate:

1. resolve every local image path relative to its owning manifest;
2. read the actual file signature, dimensions, byte count and SHA-256;
3. preserve declared metadata separately and record mismatches;
4. fail closed on missing referenced masters unless an explicit degraded mode is requested;
5. never promote requested dimensions, filenames or dashboard roles over measured bytes;
6. invalidate downstream modeling context when a source hash changes.

Metadata describes intent; byte readback proves the artifact.

### Final image payload available but a preview becomes the master

A generation surface may expose progressive/partial images, chat previews, library thumbnails, downloaded derivatives and one final completed payload. Saving the easiest visible surface can preserve only a small preview even though a better source existed.

Gate:

1. identify the provider's final/completed event or original-save path before persistence;
2. save that payload directly and preserve it before dashboard derivation;
3. reject partial streaming frames, screenshots, browser previews and contact sheets as masters;
4. classify `master`, `review`, `thumb` and `cover` as separate roles with parent lineage;
5. run `visual-reference-integrity` and require measured dimensions, bytes and SHA-256;
6. keep a low-resolution legacy file as `design-reference-only` instead of silently upgrading or deleting it;
7. add a provider compatibility module when event names, supported sizes or output formats can change.
