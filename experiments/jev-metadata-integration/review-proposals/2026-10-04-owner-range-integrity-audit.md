# Owner worksheet range-integrity audit — 2026-10-04

## Scope and method

This audit checks only whether the worksheet's proposed citations identify real,
exact source bytes in the frozen MSSR candidate. It does not adjudicate answers,
sufficiency, abstention, contradiction labels, or benchmark quality.

- Source revision: `e3e03912d63231ebf646fdaec9353ee1e28fe403` (MSSR 0.2.104).
- Candidate-bank SHA-256: `764ea6348116de93ce6499dd218b86a9fa869a12ec6733468ce6beff9d6b014a`.
- Worksheet SHA-256 before correction: `ee85b6cd0dffd50cadf4050512bb092407255640a5ebc888ea3714097ab48521`.
- Worksheet SHA-256 after correction: `865371fb01c8288c36d5406a1e8511ce43f105eddb12168ee16bfbac82846485`.
- Inventory: 38 cited ranges across 28 literal paths (27 evidence documents and one benchmark-protocol reference); 32 bilingual query pairs remain in the bank.

Each path was read from its exact Git blob. Inclusive physical lines were sliced
without counting a zero-width token after a terminal LF; file and range SHA-256
values and exact heading uniqueness were then checked. A second Luna reviewer
independently found the original range-boundary and digest defects; Codex
recomputed them from the frozen blobs before editing.

## Findings and mechanical corrections

The original worksheet had 10 ranges whose end line was one beyond the file's
physical line count. Two additional in-bounds ranges had incorrect excerpt
hashes. All 38 file hashes and all 38 referenced headings were correct and
unique. Only the 12 line-end/hash references below were changed; the candidate
wording, source files, and owner-label fields were left intact.

| Case | Original range → corrected range | Original excerpt SHA-256 → corrected SHA-256 |
| --- | --- | --- |
| C01 | 1–6 → 1–5 | `3acd95557cd53ef95b9b31e94217340c2d332aa8d22aa87ba2239c703220627c` → `e1ab8240b1edc4c6aad10d25a84b4bef4e9b7470663a7649cb415f0cd17c68df` |
| C03 | 28–31 → 28–30 | `43393de93d6cdbc4f793e8efad462ab5742a2f65338f3e97ab70b025a1ae162e` → `6291d31103fecb7088a65e4bb635eb5341bc0d8a097e80c24cd0756871e5c353` |
| C05 | 1–4 → 1–3 | `69f985b73ba3b59c82c4c665af826d16ddf20213e3ca72d04e00d5d1b9542c20` → `fe4b24a72e3a5da3b2bc24f11c3d575ec81fa7aa86aaf00b81716fd1573cf935` |
| C06 | 1–4 → 1–3 | `f32b1c6dd30563431c17f911db0522038dfc2e80fa8f66467bbf4f3f1eaa7b2f` → `ef4dec93e8718d6291ea3f03b83ef1c2b8aed3a54ffc1c904202ef7e3006a13a` |
| C09 | 11–15 → 11–15 | `5bace01f459d4a88ca6818bac0baab24895a43ef278ab59f1c3746e055b0814f` → `d0f2a84ad37a92a7596e42f29b555e15a2c2151065bf9fa9e70eb6a2c2d1f27b` |
| C10 | 1–8 → 1–7 | `018b05b0805b637733179981d1c12dd2ab1c3bdb0fc2cb0dd8d9749f3006c785` → `b92e1c7d22e2a26a2e6b8b1f238ea0452ed140790379f458f4d4b5ccaf66c212` |
| C14 | 1–8 → 1–7 | `1066cb0716426f49d698112c5d920e8fc39c534a58754a6a7fb940e9c7969931` → `7c7600253d4919570540c1f7a9de41c75369121ac0a2203d2e8d5fcef3409b5e` |
| C15 | 1–13 → 1–13 | `66298f74f501babc74d4555aa156bd020c54001d2db7db1b27a1cdaaf1b0687d` → `fa09f1ffa12379968e41481e4b1755f4ba1b618c4eabafefd52364c1d802d4ab` |
| C21 | 1–4 → 1–3 | `01f952fe11113cfb2841b4d30e6a7428626c565bb11a87849107266351d4f0a2` → `a26f9bd1929710a0cb90130c161020017a074f689155921b5ba514f35440948f` |
| C22 | 1–8 → 1–7 | `29857fa2a38af3f81e4c20a7ac54d02f92a0b91909ce196dd0334af40e6f65cd` → `78454857b313a70bfef25c00d24ecc59cbf6ff52ec3d1d1f0cc05ef2d0ee6905` |
| C31 | 11–14 → 11–13 | `bfa65c8225cb5276ec0153b959ac4fe4a2eabe3f72f6b4a21b50b3cf3bbdd05b` → `7a492a4f0a4216b55a137b6231eb2c39ae98e073e9a67bdbaf82afb8e7c57cd7` |
| C32 | 1–8 → 1–7 | `d09bd3264ca2d60283d62438939cd364beabc0e773bbaa47b35856cf904b6728` → `9a3ad7239843f468a72f7555668195670a767b1c9ebc7b0e2444047058837692` |

## Post-correction verification

The second byte-preserving pass returned 38/38 file-hash matches, 38/38
range-hash matches, 38/38 in-bounds ranges, and 38/38 unique exact headings.
This is citation-integrity evidence only. C02/C03 wording review, C13's
unsupported original checkpoint anchor, C18 historical/current framing, and
all answerability/sufficiency/abstention/contradiction labels remain open for
owner adjudication. No Jev, Noul, provider, or external MCP call was made.
