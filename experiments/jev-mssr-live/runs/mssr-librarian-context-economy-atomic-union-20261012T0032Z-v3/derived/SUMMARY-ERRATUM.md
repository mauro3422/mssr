# Derived summary correction

The first derived run summary counted zero evidence packs because the summarizer accepted only `evidencePack.status === complete`. The frozen runner records valid packs with `status: validated` and `passed: true`. The summarizer now recognizes validated and legacy complete statuses while requiring positive pass evidence where present.

The corrected `summary-calculated.json` reports 3/3 built evidence packs. It also distinguishes normalized heading equality (3/3), Jev's selected exact accepted source range (2/3), and whether search exposed that exact range (3/3). The original `summary.json`, manifest, records, and checksums remain unchanged.
