# v18 hardened-runner offline preflight

This fresh child uses the frozen five input JSON files from v17 and the hardened root runner. It is a preflight-only artifact for checking candidate identity and the fail-closed runner contract. The live provider phase was not started; no Jev calls, labels, target index, or scoring are included.

Suite scope remains `metadataMode: off`: textual retrieval/build regression only. It is not a metadata-plane test, quality score, or calibration result. A metadata-enabled evaluation is designed separately in `experiments/jev-metadata-integration/README.md`.